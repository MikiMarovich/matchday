import Link from 'next/link'
import { CalendarDays, ChevronRight, Trophy } from 'lucide-react'
import { MatchView } from '@/components/player/match-view'
import { getMyProfile } from '@/lib/auth'
import { TZ, formatMatchWhen, formatPrice } from '@/lib/dates'
import { firstName } from '@/lib/labels'
import { getMyRegistration, getPlayedCount, getRoster, getUpcomingMatches } from '@/lib/player-data'

export default async function InicioPage() {
  const profile = await getMyProfile()
  const [matches, played] = await Promise.all([getUpcomingMatches(), getPlayedCount(profile.id)])
  const next = matches[0] ?? null
  const others = matches.slice(1)

  const [roster, myReg] = next
    ? await Promise.all([getRoster(next.id), getMyRegistration(next.id, profile.id)])
    : [[], null]

  const nowMs = Date.now()
  const today = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })
    .format(new Date(nowMs))
    .replace(',', '')

  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow lime-text">{today.toUpperCase()}</span>
          <h1>¿Listo para jugar, {firstName(profile.full_name)}?</h1>
          <p>{next ? 'El próximo partido te está esperando.' : 'Todavía no hay partidos programados.'}</p>
        </div>
        <div className="streak">
          <Trophy />
          <span>
            <b>{played}</b> {played === 1 ? 'partido jugado' : 'partidos jugados'}
            <small>{played > 0 ? '¡No cortes la racha!' : 'Tu primer partido te espera'}</small>
          </span>
        </div>
      </div>

      {next ? (
        <MatchView match={next} roster={roster} myReg={myReg} userId={profile.id} eyebrow="PRÓXIMO PARTIDO" nowMs={nowMs} />
      ) : (
        <section className="panel">
          <div className="empty-state">
            <CalendarDays />
            <p>No hay partidos abiertos por ahora. Cuando el organizador publique uno, lo vas a ver acá.</p>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="panel other-matches">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MÁS ADELANTE</span>
              <h2>Otros partidos</h2>
            </div>
            <span className="count-pill">{others.length}</span>
          </div>
          {others.map((m) => (
            <Link key={m.id} href={`/partidos/${m.id}`} className="admin-match-link">
              <div className="mini-calendar">
                <CalendarDays />
              </div>
              <div className="admin-match-main">
                <strong>{m.title}</strong>
                <span>{formatMatchWhen(m.starts_at, m.ends_at)}</span>
                <span>
                  {m.location} · {formatPrice(m.price)}
                </span>
              </div>
              <ChevronRight className="row-chevron" />
            </Link>
          ))}
        </section>
      )}
    </>
  )
}
