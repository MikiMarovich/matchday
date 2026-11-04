import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { MatchStatusBadge } from '@/components/admin/match-status-badge'
import { createClient } from '@/lib/supabase/server'
import { formatMatchWhen, formatPrice } from '@/lib/dates'
import { getSlotCounts, matchToFormValues } from '@/lib/matches'
import { MatchForm } from '../match-form'
import { StatusActions } from './status-actions'

export const metadata: Metadata = { title: 'Partido — MATCHDAY' }

const UUID = /^[0-9a-f-]{36}$/i

export default async function PartidoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const [{ data: match }, { count: activePayments }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', id).maybeSingle(),
    supabase.from('payment_settings').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  if (!match) notFound()

  const counts = (await getSlotCounts([match.id])).get(match.id)!
  const locked = match.status === 'PLAYED' || match.status === 'CANCELLED'
  const free = Math.max(match.max_players - counts.occupied, 0)

  return (
    <div className="admin-stack">
      <Link href="/admin/partidos" className="back-link">
        ← Volver a partidos
      </Link>

      <section className="admin-panel">
        <div className="admin-panel-heading admin-panel-heading-wrap">
          <div>
            <span className="eyebrow">{formatMatchWhen(match.starts_at, match.ends_at).toUpperCase()}</span>
            <h2>{match.title}</h2>
          </div>
          <MatchStatusBadge status={match.status} />
        </div>

        <div className="stats-grid stats-grid-compact">
          <div className="stat-card">
            <span>Lugares ocupados</span>
            <strong>
              {counts.occupied}/{match.max_players}
            </strong>
          </div>
          <div className="stat-card">
            <span>Confirmados (pago aprobado)</span>
            <strong>{counts.confirmed}</strong>
          </div>
          <div className="stat-card">
            <span>Lugares libres</span>
            <strong>{free}</strong>
          </div>
          <div className="stat-card">
            <span>Suplentes</span>
            <strong>{counts.waitlist}</strong>
          </div>
        </div>
        <p className="field-hint panel-footnote">
          «Ocupados» incluye a quienes reservaron y todavía están dentro del plazo para pagar. Precio: {formatPrice(match.price)}.
          La gestión de inscripciones y pagos llega en la próxima etapa.
        </p>

        {match.status === 'OPEN' && !activePayments && (
          <div className="admin-alert" role="alert">
            <AlertTriangle />
            <span>
              <b>La inscripción está abierta pero no hay un medio de pago activo:</b> nadie se puede anotar. Activá uno en{' '}
              <Link href="/admin/configuracion">Configuración</Link>.
            </span>
          </div>
        )}

        <StatusActions matchId={match.id} status={match.status} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">DATOS</span>
            <h2>{locked ? 'Datos del partido' : 'Editar partido'}</h2>
          </div>
        </div>
        {locked && (
          <p className="field-hint panel-note">Un partido jugado o cancelado ya no se puede editar.</p>
        )}
        <MatchForm values={matchToFormValues(match)} locked={locked} />
        {!locked && (
          <p className="field-hint panel-footnote">
            Los cambios de precio no afectan a quienes ya reservaron: cada inscripción guarda el precio del momento.
          </p>
        )}
      </section>
    </div>
  )
}
