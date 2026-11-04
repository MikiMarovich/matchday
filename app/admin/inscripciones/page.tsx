import type { Metadata } from 'next'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { AdminCancelButton, MatchTools } from '@/components/admin/registration-controls'
import { MatchStatusBadge } from '@/components/admin/match-status-badge'
import { getMatchesForFilter, getRegistrations, type AdminRegistration } from '@/lib/admin-data'
import { formatDay, formatPrice, formatTime } from '@/lib/dates'
import { REGISTRATION_STATUS_LABELS, REGISTRATION_STATUS_TONE, positionLabel } from '@/lib/labels'
import { Constants, type Enums } from '@/lib/supabase/database.types'
import { RegistrationFilters } from './filters'

export const metadata: Metadata = { title: 'Inscripciones — MATCHDAY' }

type Status = Enums<'registration_status'>
const ALL_STATUSES = Constants.public.Enums.registration_status as readonly Status[]
const ACTIVE: Status[] = ['PENDING_PAYMENT', 'PENDING_REVIEW', 'CONFIRMED', 'WAITLIST']

function isExpired(r: AdminRegistration, nowMs: number) {
  return r.status === 'PENDING_PAYMENT' && (!r.payment_deadline || new Date(r.payment_deadline).getTime() <= nowMs)
}

function when(iso: string | null) {
  return iso ? `${formatDay(iso)} · ${formatTime(iso)}` : '—'
}

/** Dato más útil según el estado. */
function detail(r: AdminRegistration, nowMs: number): string {
  if (isExpired(r, nowMs)) return `Venció ${when(r.payment_deadline)}`
  switch (r.status) {
    case 'PENDING_PAYMENT':
      return `Paga hasta ${when(r.payment_deadline)}`
    case 'PENDING_REVIEW':
      return `Comprobante ${when(r.receipt_submitted_at)}`
    case 'CONFIRMED':
      return `Aprobado ${when(r.confirmed_at)}`
    case 'WAITLIST':
      return `En lista desde ${when(r.waitlisted_at)}`
    case 'REJECTED':
      return `Motivo: ${r.rejection_reason ?? '—'}`
    case 'CANCELLED':
      return `${r.cancellation_reason ?? 'Cancelada'} · ${when(r.cancelled_at)}`
  }
}

export default async function InscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ partido?: string; estado?: string }>
}) {
  const sp = await searchParams
  const matches = await getMatchesForFilter()
  const nowMs = Date.now()

  // Partido por defecto: el próximo que todavía se gestiona; si no hay, todos.
  const upcoming = matches
    .filter((m) => (m.status === 'OPEN' || m.status === 'CLOSED') && new Date(m.starts_at).getTime() > nowMs - 6 * 3600_000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const matchParam = sp.partido ?? upcoming[0]?.id ?? 'todos'
  const selected = matches.find((m) => m.id === matchParam) ?? null
  const estado = sp.estado ?? 'activas'

  const all = await getRegistrations({ matchId: selected?.id })
  const rows = all.filter((r) =>
    estado === 'todas' ? true : estado === 'activas' ? ACTIVE.includes(r.status) && !isExpired(r, nowMs) : r.status === estado,
  )

  // Suplentes en orden de llegada (misma regla que la base: waitlisted_at).
  const waitlist = all
    .filter((r) => r.status === 'WAITLIST')
    .sort((a, b) => (a.waitlisted_at ?? '').localeCompare(b.waitlisted_at ?? ''))
  const waitPos = new Map(waitlist.map((r, i) => [r.id, i + 1]))

  const occupied = selected
    ? all.filter((r) => r.status === 'CONFIRMED' || r.status === 'PENDING_REVIEW' || (r.status === 'PENDING_PAYMENT' && !isExpired(r, nowMs))).length
    : 0
  const expiredCount = all.filter((r) => isExpired(r, nowMs)).length
  const manageable = selected && (selected.status === 'OPEN' || selected.status === 'CLOSED')

  const matchOptions = [
    ...matches.map((m) => ({ value: m.id, label: `${m.title} · ${formatDay(m.starts_at)}` })),
    { value: 'todos', label: 'Todos los partidos' },
  ]
  const statusOptions = [
    { value: 'activas', label: 'Activas (ocupan lugar o esperan)' },
    ...ALL_STATUSES.map((s) => ({ value: s, label: REGISTRATION_STATUS_LABELS[s] })),
    { value: 'todas', label: 'Todas' },
  ]

  return (
    <div className="admin-stack">
      <div className="admin-intro">
        <span className="eyebrow">INSCRIPCIONES</span>
        <h2>Quién se anotó y en qué estado está</h2>
      </div>

      <RegistrationFilters matches={matchOptions} statuses={statusOptions} />

      {selected && (
        <section className="admin-panel">
          <div className="admin-panel-heading admin-panel-heading-wrap">
            <div>
              <span className="eyebrow">{`${formatDay(selected.starts_at)} · ${formatTime(selected.starts_at)} hs`.toUpperCase()}</span>
              <h2>
                <Link href={`/admin/partidos/${selected.id}`} className="plain-link">
                  {selected.title}
                </Link>
              </h2>
            </div>
            <MatchStatusBadge status={selected.status} />
          </div>
          <p className="field-hint panel-note">
            {occupied}/{selected.max_players} lugares ocupados · {waitlist.length} {waitlist.length === 1 ? 'suplente' : 'suplentes'} ·{' '}
            {formatPrice(selected.price)} por jugador
          </p>
          {manageable && (
            <MatchTools
              matchId={selected.id}
              defaultMinutes={selected.payment_window_minutes}
              waitlistCount={waitlist.length}
              freeSlots={Math.max(selected.max_players - occupied, 0)}
              expiredCount={expiredCount}
            />
          )}
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">RESULTADOS</span>
            <h2>{statusOptions.find((s) => s.value === estado)?.label ?? 'Inscripciones'}</h2>
          </div>
          <span className="count-pill">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state empty-state-small">
            <Users />
            <p>No hay inscripciones con este filtro.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>JUGADOR</th>
                  {!selected && <th>PARTIDO</th>}
                  <th>ESTADO</th>
                  <th>DETALLE</th>
                  <th>MONTO</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired = isExpired(r, nowMs)
                  const tone = expired ? 'neutral' : REGISTRATION_STATUS_TONE[r.status]
                  const label = expired
                    ? 'Plazo vencido'
                    : r.status === 'WAITLIST'
                      ? `Suplente N.° ${waitPos.get(r.id) ?? '?'}`
                      : REGISTRATION_STATUS_LABELS[r.status]
                  const name = r.player?.full_name ?? r.player?.email ?? 'Jugador'
                  const canCancel = ACTIVE.includes(r.status) && !expired
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="table-player">
                          <UserAvatar name={r.player?.full_name ?? null} src={r.player?.avatar_url ?? null} className="avatar avatar-small avatar-lime" />
                          <span>
                            <b>{name}</b>
                            <small>
                              {positionLabel(r.player?.position)} · {r.player?.email}
                            </small>
                          </span>
                        </div>
                      </td>
                      {!selected && <td>{r.match?.title ?? '—'}</td>}
                      <td>
                        <span className={`status-badge status-${tone}`}>
                          <span className="status-dot" />
                          {label}
                        </span>
                      </td>
                      <td className="cell-detail">{detail(r, nowMs)}</td>
                      <td>{formatPrice(r.price_snapshot)}</td>
                      <td className="cell-actions">
                        {r.status === 'PENDING_REVIEW' && (
                          <Link href="/admin/pagos" className="plain-link">
                            Revisar
                          </Link>
                        )}
                        {canCancel && <AdminCancelButton registrationId={r.id} playerName={name} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
