'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dbErrorMessage, fail, type ActionState } from '@/lib/action-state'

/*
 * Acciones del admin sobre inscripciones. Cada una llama a una función SQL que vuelve a
 * verificar que sea admin, valida el estado con lock y deja registro en audit_logs.
 */

const UUID = /^[0-9a-f-]{36}$/i

function revalidateAll() {
  revalidatePath('/', 'layout') // admin + portal del jugador (listas, cupos, su estado)
}

export async function approvePayment(registrationId: string): Promise<ActionState> {
  await requireAdmin()
  if (!UUID.test(registrationId)) return fail('Inscripción inválida.')
  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_payment', { p_registration_id: registrationId })
  if (error) return fail(dbErrorMessage(error))
  revalidateAll()
  return { status: 'ok', message: 'Pago aprobado.' }
}

export async function rejectPayment(registrationId: string, reason: string): Promise<ActionState> {
  await requireAdmin()
  if (!UUID.test(registrationId)) return fail('Inscripción inválida.')
  const clean = reason.trim()
  if (clean.length < 3) return fail('Escribí el motivo del rechazo: lo va a ver el jugador.')
  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_payment', { p_registration_id: registrationId, p_reason: clean.slice(0, 500) })
  if (error) return fail(dbErrorMessage(error))
  revalidateAll()
  return { status: 'ok', message: 'Pago rechazado. El lugar quedó libre.' }
}

export async function adminCancelRegistration(registrationId: string, reason: string): Promise<ActionState> {
  await requireAdmin()
  if (!UUID.test(registrationId)) return fail('Inscripción inválida.')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_registration', {
    p_registration_id: registrationId,
    p_reason: reason.trim().slice(0, 500) || null, // sin motivo: "Cancelada por el administrador"
  })
  if (error) return fail(dbErrorMessage(error))
  revalidateAll()
  return { status: 'ok', message: 'Inscripción cancelada.' }
}

export async function expirePendingPayments(matchId: string): Promise<ActionState> {
  await requireAdmin()
  if (!UUID.test(matchId)) return fail('Partido inválido.')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('expire_pending_payments', { p_match_id: matchId })
  if (error) return fail(dbErrorMessage(error))
  revalidateAll()
  const n = data ?? 0
  return { status: 'ok', message: n === 0 ? 'No había reservas vencidas.' : `Se liberaron ${n} ${n === 1 ? 'reserva vencida' : 'reservas vencidas'}.` }
}

/** Pasa al suplente más antiguo a "falta pagar", con el plazo que elige el admin (en minutos desde ahora). */
export async function promoteFromWaitlist(matchId: string, minutes: number): Promise<ActionState> {
  await requireAdmin()
  if (!UUID.test(matchId)) return fail('Partido inválido.')
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 2880) return fail('El plazo tiene que ser entre 5 minutos y 48 horas.')
  const deadline = new Date(Date.now() + minutes * 60_000).toISOString()
  const supabase = await createClient()
  const { error } = await supabase.rpc('promote_from_waitlist', { p_match_id: matchId, p_deadline: deadline })
  if (error) return fail(dbErrorMessage(error))
  revalidateAll()
  return { status: 'ok', message: 'Suplente promovido. Ya puede ver los datos para pagar.' }
}
