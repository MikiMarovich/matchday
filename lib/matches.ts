import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/database.types'
import { toLocalInputs } from '@/lib/dates'
import type { MatchFormValues } from '@/app/admin/partidos/match-form'

export type Match = Tables<'matches'>
export type SlotCounts = { occupied: number; confirmed: number; waitlist: number }

/**
 * Cupos por partido, con la misma regla que private.occupied_slots() en la base:
 * ocupan CONFIRMED, PENDING_REVIEW y PENDING_PAYMENT con plazo vigente.
 * Es solo para mostrar: la decisión real de dar o no un lugar la toma register_for_match.
 * Requiere permisos de admin (RLS de registrations: el jugador solo ve las suyas).
 */
export async function getSlotCounts(matchIds: string[]): Promise<Map<string, SlotCounts>> {
  const counts = new Map<string, SlotCounts>()
  for (const id of matchIds) counts.set(id, { occupied: 0, confirmed: 0, waitlist: 0 })
  if (matchIds.length === 0) return counts

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('registrations')
    .select('match_id, status, payment_deadline')
    .in('match_id', matchIds)
    .in('status', ['CONFIRMED', 'PENDING_REVIEW', 'PENDING_PAYMENT', 'WAITLIST'])
  if (error) throw new Error('No se pudieron contar las inscripciones.')

  const now = Date.now()
  for (const r of data) {
    const c = counts.get(r.match_id)
    if (!c) continue
    if (r.status === 'WAITLIST') c.waitlist++
    else if (r.status === 'PENDING_PAYMENT') {
      if (r.payment_deadline && new Date(r.payment_deadline).getTime() > now) c.occupied++
    } else {
      c.occupied++
      if (r.status === 'CONFIRMED') c.confirmed++
    }
  }
  return counts
}

export function matchToFormValues(m: Match): MatchFormValues {
  const start = toLocalInputs(m.starts_at)
  return {
    id: m.id,
    title: m.title,
    location: m.location,
    date: start.date,
    start_time: start.time,
    end_time: m.ends_at ? toLocalInputs(m.ends_at).time : '',
    price: String(m.price),
    max_players: String(m.max_players),
    payment_window_minutes: String(m.payment_window_minutes),
    notes: m.notes ?? '',
  }
}
