import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Database, Enums, Tables } from '@/lib/supabase/database.types'

export type Match = Tables<'matches'>
export type RosterEntry = Database['public']['Functions']['get_match_roster']['Returns'][number]
export type MyRegistration = Pick<
  Tables<'registrations'>,
  | 'id'
  | 'status'
  | 'price_snapshot'
  | 'payment_provider_snapshot'
  | 'payment_alias_snapshot'
  | 'payment_account_snapshot'
  | 'payment_holder_snapshot'
  | 'payment_deadline'
  | 'receipt_submitted_at'
  | 'rejection_reason'
  | 'cancellation_reason'
  | 'created_at'
>

/**
 * Estado "visible" de la inscripción. Una PENDING_PAYMENT con el plazo vencido sigue así
 * en la tabla hasta que alguien dispara expire_pending_payments (pasa sola al próximo
 * "Anotarme" de cualquiera); para el jugador ya está vencida.
 */
export type EffectiveStatus = Enums<'registration_status'> | 'EXPIRED'

export function effectiveStatus(reg: Pick<MyRegistration, 'status' | 'payment_deadline'>, nowMs: number): EffectiveStatus {
  if (reg.status === 'PENDING_PAYMENT' && (!reg.payment_deadline || new Date(reg.payment_deadline).getTime() <= nowMs)) {
    return 'EXPIRED'
  }
  return reg.status
}

const MY_REG_COLUMNS =
  'id, status, price_snapshot, payment_provider_snapshot, payment_alias_snapshot, payment_account_snapshot, payment_holder_snapshot, payment_deadline, receipt_submitted_at, rejection_reason, cancellation_reason, created_at'

/** Partidos visibles que todavía no se jugaron (RLS: el jugador no ve los borradores). */
export async function getUpcomingMatches(): Promise<Match[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['OPEN', 'CLOSED'])
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
  if (error) throw new Error('No se pudieron cargar los partidos.')
  return data
}

export async function getMatch(id: string): Promise<Match | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('matches').select('*').eq('id', id).maybeSingle()
  return data
}

/** Última inscripción del usuario en el partido (puede haber cancelaciones previas). RLS: solo las propias. */
export async function getMyRegistration(matchId: string, userId: string): Promise<MyRegistration | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('registrations')
    .select(MY_REG_COLUMNS)
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

/** Listas públicas: nombre, foto, posición y grupo. Nunca email ni datos de pago. */
export async function getRoster(matchId: string): Promise<RosterEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_match_roster', { p_match_id: matchId })
  if (error) throw new Error('No se pudo cargar la lista del partido.')
  return data ?? []
}

/** Partidos jugados con el pago confirmado, para el contador del inicio. */
export async function getPlayedCount(userId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('registrations')
    .select('id, matches!inner(status)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'CONFIRMED')
    .eq('matches.status', 'PLAYED')
  return count ?? 0
}

export type HistoryItem = MyRegistration & {
  matches: Pick<Match, 'id' | 'title' | 'location' | 'starts_at' | 'ends_at' | 'status'> | null
}

export async function getMyHistory(userId: string): Promise<HistoryItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('registrations')
    .select(`${MY_REG_COLUMNS}, matches(id, title, location, starts_at, ends_at, status)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error('No se pudieron cargar tus inscripciones.')
  return data as HistoryItem[]
}
