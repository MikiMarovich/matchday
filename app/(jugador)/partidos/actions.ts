'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getMyProfile, requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dbErrorMessage, fail, type ActionState } from '@/lib/action-state'
import { notifyAdminReceipt } from '@/lib/notifications'

const UUID = /^[0-9a-f-]{36}$/i

function revalidatePlayer() {
  revalidatePath('/', 'layout') // inicio, detalle del partido, mis inscripciones y el admin
}

/**
 * "Anotarme". Toda la lógica (cupo, lock, suplente, plazo, snapshot de pago) está en
 * register_for_match: acá solo pasamos el id y traducimos el resultado.
 */
export async function registerForMatch(matchId: string): Promise<ActionState> {
  await requireUser()
  if (!UUID.test(matchId)) return fail('Partido inválido.')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_for_match', { p_match_id: matchId })
  if (error || !data) return fail(dbErrorMessage(error))

  revalidatePlayer()
  return data.status === 'WAITLIST'
    ? { status: 'ok', message: 'El cupo está lleno: quedaste como suplente. Te avisamos si se libera un lugar.' }
    : { status: 'ok', message: '¡Lugar reservado! Transferí y subí el comprobante antes de que venza el plazo.' }
}

/**
 * Se llama después de subir el archivo a Storage desde el navegador.
 * submit_receipt verifica dueño, estado, plazo, que la ruta sea de esta inscripción
 * y que el archivo exista de verdad en el bucket.
 */
export async function submitReceipt(registrationId: string, receiptPath: string): Promise<ActionState> {
  const user = await requireUser()
  if (!UUID.test(registrationId)) return fail('Inscripción inválida.')
  if (!receiptPath.startsWith(`${user.id}/${registrationId}/`)) return fail('La ruta del comprobante no es válida.')

  const supabase = await createClient()
  const { data: reg, error } = await supabase.rpc('submit_receipt', {
    p_registration_id: registrationId,
    p_receipt_path: receiptPath,
  })
  if (error || !reg) return fail(dbErrorMessage(error))

  // Datos para el email al admin (RLS: el jugador lee su perfil y el partido).
  const [profile, { data: match }] = await Promise.all([
    getMyProfile(),
    supabase.from('matches').select('title, starts_at, ends_at').eq('id', reg.match_id).single(),
  ])
  after(() =>
    notifyAdminReceipt(supabase, {
      registrationId,
      playerName: profile.full_name ?? profile.email,
      playerEmail: profile.email,
      matchTitle: match?.title ?? 'Partido',
      startsAt: match?.starts_at ?? reg.created_at,
      endsAt: match?.ends_at ?? null,
    }),
  )

  revalidatePlayer()
  return { status: 'ok', message: 'Comprobante enviado. El administrador lo va a revisar.' }
}

export async function cancelRegistration(registrationId: string, reason: string): Promise<ActionState> {
  await requireUser()
  if (!UUID.test(registrationId)) return fail('Inscripción inválida.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_registration', {
    p_registration_id: registrationId,
    p_reason: reason.trim().slice(0, 500) || null,
  })
  if (error) return fail(dbErrorMessage(error))

  revalidatePlayer()
  return { status: 'ok', message: 'Inscripción cancelada.' }
}
