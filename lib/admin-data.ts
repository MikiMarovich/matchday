import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Enums, Tables } from '@/lib/supabase/database.types'

/**
 * Lecturas del backoffice. Todas pasan por RLS con la sesión del admin
 * (003_rls.sql: el admin ve todo). No se usa la secret key.
 */

export type AdminRegistration = Pick<
  Tables<'registrations'>,
  | 'id'
  | 'match_id'
  | 'user_id'
  | 'status'
  | 'price_snapshot'
  | 'payment_provider_snapshot'
  | 'payment_alias_snapshot'
  | 'payment_deadline'
  | 'receipt_path'
  | 'receipt_submitted_at'
  | 'waitlisted_at'
  | 'confirmed_at'
  | 'rejection_reason'
  | 'cancelled_at'
  | 'cancellation_reason'
  | 'created_at'
> & {
  player: Pick<Tables<'profiles'>, 'full_name' | 'email' | 'avatar_url' | 'position'> | null
  match: Pick<Tables<'matches'>, 'id' | 'title' | 'starts_at' | 'ends_at' | 'status' | 'max_players' | 'payment_window_minutes'> | null
}

// Hay dos FK de registrations a profiles (user_id y reviewed_by): hay que nombrar cuál.
const REG_SELECT = `
  id, match_id, user_id, status, price_snapshot, payment_provider_snapshot, payment_alias_snapshot,
  payment_deadline, receipt_path, receipt_submitted_at, waitlisted_at, confirmed_at,
  rejection_reason, cancelled_at, cancellation_reason, created_at,
  player:profiles!registrations_user_id_fkey(full_name, email, avatar_url, position),
  match:matches!registrations_match_id_fkey(id, title, starts_at, ends_at, status, max_players, payment_window_minutes)
`

export async function getRegistrations(filter: {
  matchId?: string
  statuses?: Enums<'registration_status'>[]
  orderBy?: 'created_at' | 'receipt_submitted_at'
}): Promise<AdminRegistration[]> {
  const supabase = await createClient()
  let q = supabase.from('registrations').select(REG_SELECT)
  if (filter.matchId) q = q.eq('match_id', filter.matchId)
  if (filter.statuses?.length) q = q.in('status', filter.statuses)
  const { data, error } = await q.order(filter.orderBy ?? 'created_at', { ascending: filter.orderBy === 'receipt_submitted_at' }).limit(500)
  if (error) throw new Error('No se pudieron cargar las inscripciones.')
  return data as unknown as AdminRegistration[]
}

/**
 * Links temporales (10 minutos) para ver comprobantes del bucket privado.
 * Se generan en el servidor con la sesión del admin; la política de Storage
 * "ver los propios o admin" es la que lo autoriza.
 */
export async function getReceiptUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  if (paths.length === 0) return urls
  const supabase = await createClient()
  const { data } = await supabase.storage.from('receipts').createSignedUrls(paths, 600)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return urls
}

export async function getPendingReviewCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING_REVIEW')
  return count ?? 0
}

export async function getMatchesForFilter() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('matches')
    .select('id, title, starts_at, status, max_players, payment_window_minutes, price')
    .order('starts_at', { ascending: false })
    .limit(100)
  if (error) throw new Error('No se pudieron cargar los partidos.')
  return data
}

export async function getPlayers() {
  const supabase = await createClient()
  const [{ data: profiles, error }, { data: regs, error: regError }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, avatar_url, position, created_at').order('full_name'),
    supabase.from('registrations').select('user_id, status, match:matches!registrations_match_id_fkey(status)'),
  ])
  if (error || regError) throw new Error('No se pudieron cargar los jugadores.')

  const stats = new Map<string, { total: number; confirmed: number; played: number; cancelled: number }>()
  for (const r of regs as unknown as { user_id: string; status: string; match: { status: string } | null }[]) {
    const s = stats.get(r.user_id) ?? { total: 0, confirmed: 0, played: 0, cancelled: 0 }
    s.total++
    if (r.status === 'CONFIRMED') {
      s.confirmed++
      if (r.match?.status === 'PLAYED') s.played++
    }
    if (r.status === 'CANCELLED') s.cancelled++
    stats.set(r.user_id, s)
  }
  return profiles.map((p) => ({ ...p, stats: stats.get(p.id) ?? { total: 0, confirmed: 0, played: 0, cancelled: 0 } }))
}
