'use client'

// PANTALLAS CON DATOS DE EJEMPLO (heredadas de v0). Se reemplazan por datos reales en la etapa 7c.
// Este archivo se borra cuando ya no lo use ninguna ruta.

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, CreditCard, FileCheck2, Info, MapPin, Trophy, Upload, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const players = [
  { name: 'Tomás Echeverría', role: 'Mediocampista', initials: 'TE', tone: 'lime' },
  { name: 'Matías Suárez', role: 'Defensor', initials: 'MS', tone: 'blue' },
  { name: 'Nicolás Paz', role: 'Delantero', initials: 'NP', tone: 'orange' },
  { name: 'Franco Ríos', role: 'Arquero', initials: 'FR', tone: 'purple' },
  { name: 'Santi López', role: 'Mediocampista', initials: 'SL', tone: 'pink' },
]

export function DemoNotice() {
  return (
    <div className="demo-notice" role="note">
      <Info />
      <span>
        <b>Vista de ejemplo.</b> Los partidos y las listas reales llegan en la próxima actualización.
      </span>
    </div>
  )
}

function Avatar({ player, small = false }: { player: (typeof players)[number]; small?: boolean }) {
  return <div className={`avatar avatar-${player.tone} ${small ? 'avatar-small' : ''}`}>{player.initials}</div>
}

function StatusBadge({ children, tone = 'pending' }: { children: React.ReactNode; tone?: 'pending' | 'success' | 'danger' | 'neutral' }) {
  return <span className={`status-badge status-${tone}`}><span className="status-dot" />{children}</span>
}

function MatchCard({ onRegister }: { onRegister: () => void }) {
  return <section className="match-card">
    <div className="match-glow" />
    <div className="match-topline"><span className="eyebrow lime-text">PRÓXIMO PARTIDO</span><span className="match-tag"><span className="live-dot" /> Abierto</span></div>
    <div className="match-title-row"><div><h1>Jueves de fútbol</h1><p className="match-subtitle">Partido amistoso · 5 vs 5</p></div><div className="date-block"><strong>24</strong><span>OCT</span></div></div>
    <div className="match-details"><div><CalendarDays /><span><b>Jueves 24 de octubre</b><small>20:30 — 22:00 hs</small></span></div><div><MapPin /><span><b>Club Atlético Palermo</b><small>Av. Dorrego 3600, CABA</small></span></div></div>
    <div className="match-footer"><div><span className="price-label">VALOR POR JUGADOR</span><strong className="price">$ 5.500</strong></div><Button onClick={onRegister} className="register-button">ANOTARME <ArrowRight data-icon="inline-end" /></Button></div>
    <div className="capacity"><div className="capacity-label"><span><strong>8</strong> confirmados</span><span><strong className="lime-text">2</strong> cupos disponibles</span></div><div className="progress-track"><div className="progress-fill" style={{ width: '80%' }} /></div></div>
  </section>
}

function PlayerList({ title, list }: { title: string; list: typeof players }) {
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">JUGADORES</span><h2>{title}</h2></div><span className="count-pill">{list.length}</span></div>{list.length === 0 ? <div className="empty-state"><Users /><p>Todavía no hay jugadores en esta lista.</p></div> : <div className="player-list">{list.map((player) => <div className="player-row" key={player.name}><Avatar player={player} small /><div className="player-info"><strong>{player.name}</strong><span>{player.role}</span></div><Check className="check-icon" /></div>)}</div>}</section>
}

function RegistrationMock({ onBack }: { onBack: () => void }) {
  return <div className="form-page"><button className="back-link" onClick={onBack}>← Volver al inicio</button><div className="form-heading"><span className="eyebrow lime-text">PASO 1 DE 2</span><h1>Confirmá tu lugar</h1><p>Completá el pago para asegurar tu inscripción.</p></div><div className="registration-grid"><div className="panel payment-summary"><div className="panel-heading"><div><span className="eyebrow">RESUMEN</span><h2>Jueves de fútbol</h2></div><span className="summary-price">$ 5.500</span></div><div className="summary-line"><CalendarDays /><span>Jueves 24 de octubre · 20:30 hs</span></div><div className="summary-line"><MapPin /><span>Club Atlético Palermo</span></div><div className="no-cash"><CreditCard /><div><strong>NO SE ACEPTA EFECTIVO</strong><p>El pago debe realizarse por transferencia.</p></div></div></div><div className="panel transfer-card"><div className="panel-heading"><div><span className="eyebrow">PASO 2</span><h2>Enviá el comprobante</h2></div><FileCheck2 /></div><div className="bank-details"><span>DATOS DE TRANSFERENCIA</span><p><b>Alias</b><strong>—</strong></p><p><b>CVU</b><strong>—</strong></p><p><b>Titular</b><strong>—</strong></p></div><div className="upload-zone"><Upload /><strong>Subir comprobante</strong><span>Disponible en la próxima actualización</span></div></div></div></div>
}

export function HomeMock({ firstName, today }: { firstName: string; today: string }) {
  const [registering, setRegistering] = useState(false)
  if (registering) return <><DemoNotice /><RegistrationMock onBack={() => setRegistering(false)} /></>
  return <><DemoNotice /><div className="welcome"><div><span className="eyebrow lime-text">{today.toUpperCase()}</span><h1>¿Listo para jugar, {firstName}?</h1><p>El próximo partido te está esperando.</p></div><div className="streak"><Trophy /><span><b>4</b> partidos jugados<small>¡No cortes la racha!</small></span></div></div><MatchCard onRegister={() => setRegistering(true)} /><div className="two-col"><PlayerList title="Confirmados" list={players} /><PlayerList title="Suplentes" list={[]} /></div><section className="pending-banner"><div className="pending-icon"><Clock3 /></div><div><strong>Tenés una inscripción pendiente</strong><p>Recordá enviar tu comprobante para confirmar tu lugar.</p></div><Button variant="outline" onClick={() => setRegistering(true)}>Ver inscripción <ArrowRight data-icon="inline-end" /></Button></section></>
}

export function HistoryMock() {
  const history = [{ date: 'Jueves 10 de octubre', status: 'Confirmado', amount: '$ 5.500', tone: 'success' as const }, { date: 'Jueves 3 de octubre', status: 'Confirmado', amount: '$ 5.000', tone: 'success' as const }, { date: 'Jueves 26 de septiembre', status: 'Pendiente', amount: '$ 5.000', tone: 'pending' as const }]
  return <div className="content-page"><DemoNotice /><div className="page-heading"><div><span className="eyebrow lime-text">TU ACTIVIDAD</span><h1>Mis inscripciones</h1><p>Consultá el estado de tus partidos.</p></div></div><div className="history-list">{history.map((item) => <div className="history-card" key={item.date}><div className="history-date"><div className="mini-calendar"><CalendarDays /></div><div><strong>{item.date}</strong><span>20:30 hs · Club Atlético Palermo</span></div></div><StatusBadge tone={item.tone}>{item.status}</StatusBadge><span className="history-price">{item.amount}</span></div>)}</div></div>
}
