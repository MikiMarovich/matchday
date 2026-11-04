import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CalendarDays, ChevronRight, Receipt, Users, WalletCards } from 'lucide-react'
import { MatchStatusBadge } from '@/components/admin/match-status-badge'
import { createClient } from '@/lib/supabase/server'
import { formatMatchWhen, formatPrice } from '@/lib/dates'
import { getSlotCounts } from '@/lib/matches'

export const metadata: Metadata = { title: 'Backoffice — MATCHDAY' }

export default async function AdminPage() {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const [upcomingRes, reviewRes, playersRes, collectedRes, activePayRes] = await Promise.all([
    supabase
      .from('matches')
      .select('*')
      .in('status', ['DRAFT', 'OPEN', 'CLOSED'])
      .gt('starts_at', nowIso)
      .order('starts_at', { ascending: true }),
    supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_REVIEW'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    // Cobrado = pagos aprobados de partidos no cancelados (precio guardado en cada inscripción).
    supabase
      .from('registrations')
      .select('price_snapshot, match:matches!registrations_match_id_fkey!inner(status)')
      .eq('status', 'CONFIRMED')
      .neq('match.status', 'CANCELLED'),
    supabase.from('payment_settings').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  if (upcomingRes.error) throw new Error('No se pudo cargar el dashboard.')

  const upcoming = upcomingRes.data
  const counts = await getSlotCounts(upcoming.map((m) => m.id))
  const pendingReview = reviewRes.count ?? 0
  const players = playersRes.count ?? 0
  const collected = (collectedRes.data ?? []).reduce((sum, r) => sum + r.price_snapshot, 0)
  const confirmedUpcoming = upcoming.reduce((sum, m) => sum + (counts.get(m.id)?.confirmed ?? 0), 0)

  const stats = [
    { label: 'Partidos próximos', value: String(upcoming.length), icon: CalendarDays, href: '/admin/partidos' },
    { label: 'Confirmados en próximos partidos', value: String(confirmedUpcoming), icon: Users, href: '/admin/inscripciones' },
    { label: 'Comprobantes por revisar', value: String(pendingReview), icon: WalletCards, href: '/admin/pagos' },
    { label: 'Cobrado (pagos aprobados)', value: formatPrice(collected), icon: Receipt, href: '/admin/inscripciones?partido=todos&estado=CONFIRMED' },
  ]

  return (
    <div className="admin-stack">
      {!activePayRes.count && (
        <div className="admin-alert" role="alert">
          <AlertTriangle />
          <span>
            <b>No hay un medio de pago activo:</b> nadie se puede anotar. Activá uno en <Link href="/admin/configuracion">Configuración</Link>.
          </span>
        </div>
      )}
      {pendingReview > 0 && (
        <Link href="/admin/pagos" className="admin-alert admin-alert-action">
          <WalletCards />
          <span>
            <b>
              {pendingReview} {pendingReview === 1 ? 'comprobante espera' : 'comprobantes esperan'} tu revisión.
            </b>{' '}
            Ir a Pagos →
          </span>
        </Link>
      )}

      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link className="stat-card stat-link" key={label} href={href}>
            <div className="stat-icon">
              <Icon />
            </div>
            <span>{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">AGENDA</span>
            <h2>Próximos partidos</h2>
          </div>
          <span className="count-pill">{upcoming.length}</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty-state empty-state-small">
            <CalendarDays />
            <p>
              No hay partidos programados. <Link href="/admin/partidos/nuevo" className="plain-link">Crear uno</Link>
            </p>
          </div>
        ) : (
          upcoming.map((m) => {
            const c = counts.get(m.id)
            return (
              <Link key={m.id} href={`/admin/inscripciones?partido=${m.id}`} className="admin-match-link">
                <div className="mini-calendar">
                  <CalendarDays />
                </div>
                <div className="admin-match-main">
                  <strong>{m.title}</strong>
                  <span>{formatMatchWhen(m.starts_at, m.ends_at)}</span>
                </div>
                <div className="admin-match-meta">
                  <MatchStatusBadge status={m.status} />
                  <span>
                    {c?.occupied ?? 0}/{m.max_players} lugares · {c?.confirmed ?? 0} confirmados
                    {c?.waitlist ? ` · ${c.waitlist} suplentes` : ''}
                  </span>
                </div>
                <ChevronRight className="row-chevron" />
              </Link>
            )
          })
        )}
      </section>

      <p className="field-hint">
        {players} {players === 1 ? 'jugador registrado' : 'jugadores registrados'}. <Link href="/admin/jugadores" className="plain-link">Ver jugadores</Link>
      </p>
    </div>
  )
}
