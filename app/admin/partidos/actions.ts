'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Enums } from '@/lib/supabase/database.types'
import { dbErrorMessage, fail, type ActionState } from '@/lib/action-state'
import { fromLocalInputs } from '@/lib/dates'

const STATUSES = Constants.public.Enums.match_status as readonly string[]
const UUID = /^[0-9a-f-]{36}$/i
const DAY_MS = 24 * 60 * 60 * 1000

type MatchInput = {
  p_title: string
  p_location: string
  p_starts_at: string
  p_ends_at: string | null
  p_price: number
  p_max_players: number
  p_payment_window_minutes: number
  p_notes: string | null
}

function intField(formData: FormData, name: string): number {
  const raw = String(formData.get(name) ?? '').replace(/[.\s$]/g, '')
  return /^\d+$/.test(raw) ? Number(raw) : NaN
}

/**
 * Valida el formulario antes de llamar a la base, para dar mensajes claros.
 * Los mismos límites están como CHECK en la tabla: esto es comodidad, no la barrera.
 */
function parseMatchForm(formData: FormData): MatchInput | string {
  const title = String(formData.get('title') ?? '').trim().replace(/\s+/g, ' ')
  const location = String(formData.get('location') ?? '').trim().replace(/\s+/g, ' ')
  const date = String(formData.get('date') ?? '')
  const startTime = String(formData.get('start_time') ?? '')
  const endTime = String(formData.get('end_time') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  const price = intField(formData, 'price')
  const maxPlayers = intField(formData, 'max_players')
  const window = intField(formData, 'payment_window_minutes')

  if (title.length < 1 || title.length > 120) return 'El título tiene que tener entre 1 y 120 caracteres.'
  if (location.length < 2 || location.length > 200) return 'Completá el lugar.'

  const startsAt = fromLocalInputs(date, startTime)
  if (!startsAt) return 'Revisá la fecha y la hora de inicio.'

  let endsAt: string | null = null
  if (endTime) {
    const end = fromLocalInputs(date, endTime)
    if (!end) return 'Revisá la hora de fin.'
    // Si termina "antes" de empezar, es que cruza la medianoche (ej. 23:00 a 00:30).
    const endMs = new Date(end).getTime()
    const startMs = new Date(startsAt).getTime()
    if (endMs === startMs) return 'La hora de fin tiene que ser distinta a la de inicio.'
    endsAt = endMs > startMs ? end : new Date(endMs + DAY_MS).toISOString()
  }

  if (!Number.isInteger(price) || price < 0 || price > 10_000_000) return 'Revisá el precio (pesos enteros, sin centavos).'
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 50) return 'El cupo tiene que ser entre 2 y 50 jugadores.'
  if (!Number.isInteger(window) || window < 5 || window > 1440) return 'El plazo para pagar tiene que ser entre 5 y 1440 minutos.'
  if (notes.length > 1000) return 'Las notas no pueden superar los 1000 caracteres.'

  return {
    p_title: title,
    p_location: location,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_price: price,
    p_max_players: maxPlayers,
    p_payment_window_minutes: window,
    p_notes: notes || null,
  }
}

function revalidateMatches() {
  revalidatePath('/admin', 'layout')
  revalidatePath('/', 'layout') // el portal de jugadores también muestra partidos (7c)
}

export async function createMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const input = parseMatchForm(formData)
  if (typeof input === 'string') return fail(input, formData)
  if (new Date(input.p_starts_at).getTime() <= Date.now()) return fail('La fecha del partido tiene que ser futura.', formData)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_create_match', input)
  if (error || !data) return fail(dbErrorMessage(error), formData)

  revalidateMatches()
  redirect(`/admin/partidos/${data.id}`) // fuera de try: redirect() funciona tirando una excepción
}

export async function updateMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) return fail('Partido inválido.', formData)
  const input = parseMatchForm(formData)
  if (typeof input === 'string') return fail(input, formData)

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_update_match', { p_match_id: id, ...input })
  if (error) return fail(dbErrorMessage(error), formData)

  revalidateMatches()
  return { status: 'ok', message: 'Cambios guardados.' }
}

export async function setMatchStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!UUID.test(id) || !STATUSES.includes(status)) return fail('Acción inválida.')

  // La función SQL valida la transición (ej. no se puede reabrir un partido jugado).
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_match_status', {
    p_match_id: id,
    p_status: status as Enums<'match_status'>,
  })
  if (error) return fail(dbErrorMessage(error))

  revalidateMatches()
  return { status: 'ok' }
}
