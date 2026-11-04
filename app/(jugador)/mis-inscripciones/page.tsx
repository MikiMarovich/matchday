import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, ChevronRight, Receipt } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { formatMatchWhen, formatPrice } from '@/lib/dates'
import { REGISTRATION_STATUS_LABELS, REGISTRATION_STATUS_TONE } from '@/lib/labels'
import { effectiveStatus, getMyHistory } from '@/lib/player-data'

export const metadata: Metadata = { title: 'Mis inscripciones — MATCHDAY' }

export default async function MisInscripcionesPage() {
  const user = await requireUser()
  const history = await getMyHistory(user.id)
  const nowMs = Date.now()

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow lime-text">TU ACTIVIDAD</span>
          <h1>Mis inscripciones</h1>
          <p>El estado de cada partido al que te anotaste.</p>
        </div>
      </div>

      {history.length === 0 ? (
        <section className="panel">
          <div className="empty-state">
            <Receipt />
            <p>Todavía no te anotaste a ningún partido.</p>
          </div>
        </section>
      ) : (
        <div className="history-list">
          {history.map((item) => {
            const status = effectiveStatus(item, nowMs)
            const expired = status === 'EXPIRED' || (status === 'CANCELLED' && item.cancellation_reason === 'Plazo vencido')
            const label = expired ? 'Plazo vencido' : REGISTRATION_STATUS_LABELS[status as keyof typeof REGISTRATION_STATUS_LABELS]
            const tone = expired ? 'neutral' : REGISTRATION_STATUS_TONE[status as keyof typeof REGISTRATION_STATUS_TONE]
            const match = item.matches
            const card = (
              <>
                <div className="history-date">
                  <div className="mini-calendar">
                    <CalendarDays />
                  </div>
                  <div>
                    <strong>{match?.title ?? 'Partido'}</strong>
                    <span className="capitalize-first">
                      {match ? `${formatMatchWhen(match.starts_at, match.ends_at)} · ${match.location}` : ''}
                    </span>
                    {match?.status === 'CANCELLED' && <span className="history-note">Partido suspendido</span>}
                    {status === 'REJECTED' && item.rejection_reason && (
                      <span className="history-note">Motivo: {item.rejection_reason}</span>
                    )}
                  </div>
                </div>
                <span className={`status-badge status-${tone}`}>
                  <span className="status-dot" />
                  {label}
                </span>
                <span className="history-price">{formatPrice(item.price_snapshot)}</span>
                {match && <ChevronRight className="row-chevron" />}
              </>
            )
            return match ? (
              <Link key={item.id} href={`/partidos/${match.id}`} className="history-card history-link">
                {card}
              </Link>
            ) : (
              <div key={item.id} className="history-card">
                {card}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
