// DASHBOARD CON DATOS DE EJEMPLO (heredado de v0). Se reemplaza por métricas reales en la etapa 7d.
// Este archivo se borra cuando ya no lo use ninguna ruta.

import { CalendarDays, Receipt, Users, WalletCards } from 'lucide-react'
import { DemoNotice } from './player-mock'

const STATS = [
  { label: 'Partidos próximos', value: '4', icon: CalendarDays },
  { label: 'Jugadores confirmados', value: '32', icon: Users },
  { label: 'Pagos pendientes', value: '3', icon: WalletCards },
  { label: 'Recaudación total', value: '$ 176.500', icon: Receipt },
]

export function DashboardMock() {
  return (
    <>
      <DemoNotice />
      <div className="stats-grid">
        {STATS.map(({ label, value, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon">
              <Icon />
            </div>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  )
}
