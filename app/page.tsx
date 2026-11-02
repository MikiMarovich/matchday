'use client'

import { useState } from 'react'
import { ArrowRight, Bell, CalendarDays, Check, ChevronDown, Clock3, CreditCard, FileCheck2, Home, LayoutDashboard, LogOut, MapPin, Menu, MoreHorizontal, Plus, Receipt, Settings, ShieldCheck, Trophy, Upload, Users, WalletCards, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const players = [
  { name: 'Tomás Echeverría', role: 'Mediocampista', initials: 'TE', tone: 'lime' },
  { name: 'Matías Suárez', role: 'Defensor', initials: 'MS', tone: 'blue' },
  { name: 'Nicolás Paz', role: 'Delantero', initials: 'NP', tone: 'orange' },
  { name: 'Franco Ríos', role: 'Arquero', initials: 'FR', tone: 'purple' },
  { name: 'Santi López', role: 'Mediocampista', initials: 'SL', tone: 'pink' },
]

const navItems = [
  { label: 'Inicio', icon: Home },
  { label: 'Mis inscripciones', icon: Receipt },
  { label: 'Mi perfil', icon: Users },
]

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2"><div className="logo-mark"><Trophy /></div>{!compact && <span className="text-lg font-black tracking-tight text-white">MATCH<span className="text-lime">DAY</span></span>}</div>
}

function Avatar({ player, small = false }: { player: typeof players[number], small?: boolean }) {
  return <div className={`avatar avatar-${player.tone} ${small ? 'avatar-small' : ''}`}>{player.initials}</div>
}

function StatusBadge({ children, tone = 'pending' }: { children: React.ReactNode, tone?: 'pending' | 'success' | 'danger' | 'neutral' }) {
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

function PlayerList({ title, players: list, empty = false }: { title: string, players: typeof players, empty?: boolean }) {
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">JUGADORES</span><h2>{title}</h2></div><span className="count-pill">{empty ? '0' : list.length}</span></div>{empty ? <div className="empty-state"><Users /><p>Todavía no hay jugadores en esta lista.</p></div> : <div className="player-list">{list.map((player) => <div className="player-row" key={player.name}><Avatar player={player} small /><div className="player-info"><strong>{player.name}</strong><span>{player.role}</span></div><Check className="check-icon" /></div>)}</div>}</section>
}

function Sidebar({ current, onNavigate, mobileOpen, onClose, onAdmin }: { current: string, onNavigate: (x: string) => void, mobileOpen: boolean, onClose: () => void, onAdmin: () => void }) {
  return <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="sidebar-head"><Logo /><button className="close-mobile" onClick={onClose}><X /></button></div><div className="profile-mini"><div className="profile-avatar">JC</div><div><strong>Juan Cruz</strong><span>Jugador</span></div><ChevronDown /></div><nav>{navItems.map(({ label, icon: Icon }) => <button className={current === label ? 'active' : ''} key={label} onClick={() => { onNavigate(label); onClose() }}><Icon />{label}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => onNavigate('Login')}><LogOut />Cerrar sesión</button><div className="admin-link" role="button" tabIndex={0} onClick={onAdmin} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onAdmin() }}><ShieldCheck /><span>¿Sos administrador?<b>Ir al backoffice</b></span><ArrowRight /></div></div></aside>
}

function Header({ onMenu, title }: { onMenu: () => void, title: string }) {
  return <header className="topbar"><button className="menu-button" onClick={onMenu}><Menu /></button><div><span className="eyebrow">MATCHDAY / JUGADORES</span><h2>{title}</h2></div><div className="top-actions"><button className="icon-button"><Bell /><i /></button><div className="top-avatar">JC</div></div></header>
}

function HomeScreen({ onRegister }: { onRegister: () => void }) {
  return <><div className="welcome"><div><span className="eyebrow lime-text">JUEVES, 17 DE OCTUBRE</span><h1>¿Listo para jugar, Juan?</h1><p>El próximo partido te está esperando.</p></div><div className="streak"><Trophy /><span><b>4</b> partidos jugados<small>¡No cortes la racha!</small></span></div></div><MatchCard onRegister={onRegister} /><div className="two-col"><PlayerList title="Confirmados" players={players} /><PlayerList title="Suplentes" players={[]} empty /></div><section className="pending-banner"><div className="pending-icon"><Clock3 /></div><div><strong>Tenés una inscripción pendiente</strong><p>Recordá enviar tu comprobante para confirmar tu lugar.</p></div><Button variant="outline" onClick={onRegister}>Ver inscripción <ArrowRight data-icon="inline-end" /></Button></section></>
}

function RegistrationScreen({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false)
  return <div className="form-page"><button className="back-link" onClick={onBack}>← Volver al inicio</button><div className="form-heading"><span className="eyebrow lime-text">PASO 1 DE 2</span><h1>Confirmá tu lugar</h1><p>Completá el pago para asegurar tu inscripción.</p></div>{sent ? <div className="success-card"><div className="success-icon"><Check /></div><h2>¡Comprobante enviado!</h2><p>El administrador revisará tu pago y te confirmará el lugar.</p><Button onClick={onBack}>Volver al inicio</Button></div> : <div className="registration-grid"><div className="panel payment-summary"><div className="panel-heading"><div><span className="eyebrow">RESUMEN</span><h2>Jueves de fútbol</h2></div><span className="summary-price">$ 5.500</span></div><div className="summary-line"><CalendarDays /><span>Jueves 24 de octubre · 20:30 hs</span></div><div className="summary-line"><MapPin /><span>Club Atlético Palermo</span></div><div className="no-cash"><CreditCard /><div><strong>NO SE ACEPTA EFECTIVO</strong><p>El pago debe realizarse por transferencia.</p></div></div></div><div className="panel transfer-card"><div className="panel-heading"><div><span className="eyebrow">PASO 2</span><h2>Enviá el comprobante</h2></div><FileCheck2 /></div><div className="bank-details"><span>DATOS DE TRANSFERENCIA</span><p><b>Alias</b><strong>matchday.futbol</strong></p><p><b>CVU</b><strong>0000003100012345678901</strong></p><p><b>Titular</b><strong>Matchday Fútbol</strong></p></div><label className="upload-zone"><Upload /><strong>Subir comprobante</strong><span>PNG, JPG o PDF · hasta 5 MB</span><input type="file" /></label><Button className="full-button" onClick={() => setSent(true)}>Enviar comprobante <ArrowRight data-icon="inline-end" /></Button></div></div>}</div>
}

function HistoryScreen() {
  const history = [{ date: 'Jueves 10 de octubre', status: 'Confirmado', amount: '$ 5.500', tone: 'success' as const }, { date: 'Jueves 3 de octubre', status: 'Confirmado', amount: '$ 5.000', tone: 'success' as const }, { date: 'Jueves 26 de septiembre', status: 'Pendiente', amount: '$ 5.000', tone: 'pending' as const }]
  return <div className="content-page"><div className="page-heading"><div><span className="eyebrow lime-text">TU ACTIVIDAD</span><h1>Mis inscripciones</h1><p>Consultá el estado de tus partidos.</p></div></div><div className="history-list">{history.map((item) => <div className="history-card" key={item.date}><div className="history-date"><div className="mini-calendar"><CalendarDays /></div><div><strong>{item.date}</strong><span>20:30 hs · Club Atlético Palermo</span></div></div><StatusBadge tone={item.tone}>{item.status}</StatusBadge><span className="history-price">{item.amount}</span><button className="more-button"><MoreHorizontal /></button></div>)}</div></div>
}

function ProfileScreen() { return <div className="content-page"><div className="page-heading"><div><span className="eyebrow lime-text">CUENTA</span><h1>Mi perfil</h1><p>Administrá tus datos personales.</p></div><Button variant="outline">Editar perfil</Button></div><div className="panel profile-card"><div className="large-avatar">JC</div><div className="profile-fields"><div><span>Nombre completo</span><strong>Juan Cruz Rodríguez</strong></div><div><span>Email</span><strong>juan.cruz@gmail.com</strong></div><div><span>Posición habitual</span><strong>Mediocampista</strong></div></div></div></div> }

function LoginScreen({ onLogin }: { onLogin: () => void }) { return <main className="login-screen"><div className="login-brand"><Logo /><span className="eyebrow">FÚTBOL ENTRE AMIGOS</span></div><div className="login-card"><div className="login-ball"><Trophy /></div><h1>Entrá a la cancha</h1><p>Organizá tus partidos y jugá con tu gente.</p><Button className="google-button" onClick={onLogin}><span className="google-g">G</span>Continuar con Google</Button><div className="login-note"><ShieldCheck /> Acceso seguro. Solo para jugadores invitados.</div></div><span className="login-footer">MATCHDAY · Tu partido, tu equipo.</span></main> }

export default function Page() {
  const [screen, setScreen] = useState('Inicio'); const [mobileOpen, setMobileOpen] = useState(false); const [logged, setLogged] = useState(true); const [admin, setAdmin] = useState(false)
  if (!logged) return <LoginScreen onLogin={() => setLogged(true)} />
  if (admin) return <AdminApp onExit={() => setAdmin(false)} />
  return <div className="app-shell"><Sidebar current={screen} onNavigate={setScreen} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onAdmin={() => setAdmin(true)} /><div className="main-shell"><Header onMenu={() => setMobileOpen(true)} title={screen === 'Inicio' ? 'Inicio' : screen} /><main className="page-content">{screen === 'Inicio' && <HomeScreen onRegister={() => setScreen('Inscripción')} />}{screen === 'Inscripción' && <RegistrationScreen onBack={() => setScreen('Inicio')} />}{screen === 'Mis inscripciones' && <HistoryScreen />}{screen === 'Mi perfil' && <ProfileScreen />}</main></div></div>
}

function AdminApp({ onExit }: { onExit: () => void }) { const [section, setSection] = useState('Dashboard'); const adminNav = [{ label: 'Dashboard', icon: LayoutDashboard }, { label: 'Partidos', icon: CalendarDays }, { label: 'Inscripciones', icon: Users }, { label: 'Pagos', icon: WalletCards }, { label: 'Suplentes', icon: Clock3 }, { label: 'Jugadores', icon: ShieldCheck }]; return <div className="admin-shell"><aside className="admin-sidebar"><Logo /><div className="admin-label">BACKOFFICE</div><nav>{adminNav.map(({ label, icon: Icon }) => <button className={section === label ? 'active' : ''} key={label} onClick={() => setSection(label)}><Icon />{label}{label === 'Pagos' && <span className="nav-count">3</span>}</button>)}</nav><button className="admin-settings"><Settings />Configuración</button><button className="exit-admin" onClick={onExit}><ArrowRight />Volver a jugadores</button></aside><main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow lime-text">PANEL DE CONTROL</span><h1>{section}</h1></div><div className="admin-user"><div className="top-avatar">JC</div><span><b>Juan Cruz</b><small>Administrador</small></span><ChevronDown /></div></header>{section === 'Dashboard' ? <AdminDashboard /> : <AdminSection title={section} />}</main></div> }

function AdminDashboard() { return <div className="admin-content"><div className="stats-grid">{[['Partidos próximos','4','CalendarDays'],['Jugadores confirmados','32','Users'],['Pagos pendientes','3','WalletCards'],['Recaudación total','$ 176.500','Receipt']].map(([label, value, icon]) => { const Icon = icon === 'Users' ? Users : icon === 'WalletCards' ? WalletCards : icon === 'Receipt' ? Receipt : CalendarDays; return <div className="stat-card" key={label}><div className="stat-icon"><Icon /></div><span>{label}</span><strong>{value}</strong><small className="stat-up">+12.5% <span>vs. mes anterior</span></small></div> })}</div><div className="admin-grid"><div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">AGENDA</span><h2>Próximos partidos</h2></div><Button variant="outline" size="sm"><Plus data-icon="inline-start" /> Nuevo partido</Button></div>{['Jueves 24 de octubre','Jueves 31 de octubre','Jueves 7 de noviembre'].map((date, i) => <div className="admin-match-row" key={date}><div className="mini-calendar"><CalendarDays /></div><div><strong>{date}</strong><span>20:30 hs · Club Atlético Palermo</span></div><span className="admin-match-status">{i === 0 ? 'En curso' : 'Programado'}</span><MoreHorizontal /></div>)}</div><div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">ACTIVIDAD</span><h2>Pagos a validar</h2></div><span className="count-pill">3</span></div>{players.slice(0, 3).map((p, i) => <div className="payment-row" key={p.name}><Avatar player={p} small /><div><strong>{p.name}</strong><span>Jueves 24 de octubre</span></div><span className="payment-amount">$ 5.500</span><Button size="sm" variant={i === 0 ? 'default' : 'outline'}>{i === 0 ? 'Validar' : 'Ver'}</Button></div>)}</div></div></div> }

function AdminSection({ title }: { title: string }) { return <div className="admin-content"><div className="admin-panel large-table"><div className="admin-panel-heading"><div><span className="eyebrow">GESTIÓN</span><h2>{title}</h2></div><Button><Plus data-icon="inline-start" /> Agregar nuevo</Button></div><div className="table-wrap"><table><thead><tr><th>Jugador</th><th>Partido</th><th>Estado</th><th>Importe</th><th>Acción</th></tr></thead><tbody>{players.map((p, i) => <tr key={p.name}><td><div className="table-player"><Avatar player={p} small /><span><b>{p.name}</b><small>{p.role}</small></span></div></td><td>24 oct · 20:30</td><td><StatusBadge tone={i === 2 ? 'pending' : 'success'}>{i === 2 ? 'Pendiente' : 'Confirmado'}</StatusBadge></td><td>$ 5.500</td><td><Button size="sm" variant="outline">Ver detalle</Button></td></tr>)}</tbody></table></div></div></div> }
