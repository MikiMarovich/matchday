'use client'

// BACKOFFICE CON DATOS DE EJEMPLO (heredado de v0). Se reemplaza por pantallas reales en 7b y 7d.
// Este archivo se borra cuando ya no lo use ninguna ruta.

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock3, LayoutDashboard, Receipt, Settings, ShieldCheck, Users, WalletCards } from 'lucide-react'
import { Logo } from '@/components/logo'
import { UserAvatar } from '@/components/user-avatar'
import { DemoNotice } from './player-mock'

const players = [
  { name: 'Tomás Echeverría', role: 'Mediocampista', initials: 'TE', tone: 'lime' },
  { name: 'Matías Suárez', role: 'Defensor', initials: 'MS', tone: 'blue' },
  { name: 'Nicolás Paz', role: 'Delantero', initials: 'NP', tone: 'orange' },
]

const adminNav = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Partidos', icon: CalendarDays },
  { label: 'Inscripciones', icon: Users },
  { label: 'Pagos', icon: WalletCards },
  { label: 'Suplentes', icon: Clock3 },
  { label: 'Jugadores', icon: ShieldCheck },
  { label: 'Configuración', icon: Settings },
]

export function AdminMock({ adminName, avatarUrl }: { adminName: string | null; avatarUrl: string | null }) {
  const [section, setSection] = useState('Dashboard')

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Logo />
        <div className="admin-label">BACKOFFICE</div>
        <nav>
          {adminNav.map(({ label, icon: Icon }) => (
            <button className={section === label ? 'active' : ''} key={label} onClick={() => setSection(label)}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <Link href="/" className="exit-admin">
          <ArrowRight />
          Volver a jugadores
        </Link>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow lime-text">PANEL DE CONTROL</span>
            <h1>{section}</h1>
          </div>
          <div className="admin-user">
            <UserAvatar name={adminName} src={avatarUrl} className="top-avatar" />
            <span>
              <b>{adminName ?? 'Administrador'}</b>
              <small>Administrador</small>
            </span>
          </div>
        </header>
        <div className="admin-content">
          <DemoNotice />
          {section === 'Dashboard' ? (
            <div className="stats-grid">
              {[
                ['Partidos próximos', '4', CalendarDays],
                ['Jugadores confirmados', '32', Users],
                ['Pagos pendientes', '3', WalletCards],
                ['Recaudación total', '$ 176.500', Receipt],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Users
                return (
                  <div className="stat-card" key={label as string}>
                    <div className="stat-icon"><I /></div>
                    <span>{label as string}</span>
                    <strong>{value as string}</strong>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="admin-panel large-table">
              <div className="admin-panel-heading">
                <div>
                  <span className="eyebrow">GESTIÓN</span>
                  <h2>{section}</h2>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Jugador</th><th>Partido</th><th>Importe</th></tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.name}>
                        <td>
                          <div className="table-player">
                            <div className={`avatar avatar-${p.tone} avatar-small`}>{p.initials}</div>
                            <span><b>{p.name}</b><small>{p.role}</small></span>
                          </div>
                        </td>
                        <td>24 oct · 20:30</td>
                        <td>$ 5.500</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
