import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { MatchStatusBadge } from '@/components/admin/match-status-badge'
import { createClient } from '@/lib/supabase/server'
import { formatMatchWhen, formatPrice } from '@/lib/dates'
import { getSlotCounts, type Match, type SlotCounts } from '@/lib/matches'

export const metadata: Metadata = { title: 'Partidos — MATCHDAY' }

function MatchRow({ match, counts }: { match: Match; counts?: SlotCounts }) {
  return (
    <Link href={`/admin/partidos/${match.id}`} className="admin-match-link">
      <div className="mini-calendar">
        <CalendarDays />
      </div>
      <div className="admin-match-main">
        <strong>{match.title}</strong>
        <span>{formatMatchWhen(match.starts_at, match.ends_at)}</span>
        <span>{match.location}</span>
      </div>
      <div className="admin-match-meta">
        <MatchStatusBadge status={match.status} />
        <span>
          {counts?.occupied ?? 0}/{match.max_players} lugares
          {counts?.waitlist ? ` · ${counts.waitlist} suplentes` : ''} · {formatPrice(match.price)}
        </span>
      </div>
      <ChevronRight className="row-chevron" />
    </Link>
  )
}

export default async function PartidosPage() {
  const supabase = await createClient()
  const [{ data: matches, error }, { count: activePayments }] = await Promise.all([
    supabase.from('matches').select('*').order('starts_at', { ascending: false }),
    supabase.from('payment_settings').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  if (error) throw new Error('No se pudieron cargar los partidos.')

  const counts = await getSlotCounts(matches.map((m) => m.id))
  // Próximos: los que todavía se pueden gestionar, del más cercano al más lejano.
  const upcoming = matches.filter((m) => m.status === 'DRAFT' || m.status === 'OPEN' || m.status === 'CLOSED').reverse()
  const history = matches.filter((m) => m.status === 'PLAYED' || m.status === 'CANCELLED')

  return (
    <div className="admin-stack">
      <div className="admin-intro admin-intro-row">
        <div>
          <span className="eyebrow">PARTIDOS</span>
          <h2>Gestión de partidos</h2>
          <p>Un partido nuevo arranca como borrador (los jugadores no lo ven) hasta que abrís la inscripción.</p>
        </div>
        <Link href="/admin/partidos/nuevo" className={buttonVariants({ size: 'lg' })}>
          <Plus data-icon="inline-start" />
          Nuevo partido
        </Link>
      </div>

      {!activePayments && (
        <div className="admin-alert" role="alert">
          <AlertTriangle />
          <span>
            <b>No hay un medio de pago activo.</b> Nadie se va a poder anotar hasta que actives uno en{' '}
            <Link href="/admin/configuracion">Configuración</Link>.
          </span>
        </div>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">EN CURSO</span>
            <h2>Próximos</h2>
          </div>
          <span className="count-pill">{upcoming.length}</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty-state">
            <CalendarDays />
            <p>No hay partidos programados. Creá uno con «Nuevo partido».</p>
          </div>
        ) : (
          upcoming.map((m) => <MatchRow key={m.id} match={m} counts={counts.get(m.id)} />)
        )}
      </section>

      {history.length > 0 && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">HISTORIAL</span>
              <h2>Jugados y cancelados</h2>
            </div>
            <span className="count-pill">{history.length}</span>
          </div>
          {history.map((m) => (
            <MatchRow key={m.id} match={m} counts={counts.get(m.id)} />
          ))}
        </section>
      )}
    </div>
  )
}
