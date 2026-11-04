import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { getPlayers } from '@/lib/admin-data'
import { formatDay } from '@/lib/dates'
import { POSITION_LABELS, positionLabel } from '@/lib/labels'

export const metadata: Metadata = { title: 'Jugadores — MATCHDAY' }

export default async function JugadoresPage() {
  const players = await getPlayers()
  const byPosition = Object.entries(POSITION_LABELS).map(([key, label]) => ({
    label,
    count: players.filter((p) => p.position === key).length,
  }))
  const undefinedCount = players.filter((p) => !p.position).length

  return (
    <div className="admin-stack">
      <div className="admin-intro">
        <span className="eyebrow">JUGADORES</span>
        <h2>Quiénes entraron a la app</h2>
        <p>Cualquiera con cuenta de Google puede entrar. El nombre y la posición los edita cada jugador desde su perfil.</p>
      </div>

      <div className="stats-grid stats-grid-compact">
        {byPosition.map((p) => (
          <div className="stat-card" key={p.label}>
            <span>{p.label}s</span>
            <strong>{p.count}</strong>
          </div>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">REGISTRADOS</span>
            <h2>Todos los jugadores</h2>
          </div>
          <span className="count-pill">{players.length}</span>
        </div>
        {undefinedCount > 0 && (
          <p className="field-hint panel-note">
            {undefinedCount} {undefinedCount === 1 ? 'jugador no definió' : 'jugadores no definieron'} su posición.
          </p>
        )}
        {players.length === 0 ? (
          <div className="empty-state empty-state-small">
            <Users />
            <p>Todavía no entró nadie.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>JUGADOR</th>
                  <th>POSICIÓN</th>
                  <th>INSCRIPCIONES</th>
                  <th>CONFIRMADAS</th>
                  <th>JUGADOS</th>
                  <th>CANCELADAS</th>
                  <th>ALTA</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-player">
                        <UserAvatar name={p.full_name} src={p.avatar_url} className="avatar avatar-small avatar-lime" />
                        <span>
                          <b>{p.full_name ?? 'Sin nombre'}</b>
                          <small>{p.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{positionLabel(p.position)}</td>
                    <td>{p.stats.total}</td>
                    <td>{p.stats.confirmed}</td>
                    <td>{p.stats.played}</td>
                    <td>{p.stats.cancelled}</td>
                    <td className="capitalize-first">{formatDay(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
