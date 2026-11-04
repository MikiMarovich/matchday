'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, CalendarDays, LayoutDashboard, Menu, Settings, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { UserAvatar } from '@/components/user-avatar'

// Inscripciones, Pagos y Jugadores se suman en la etapa 7d (no se muestran links a pantallas que no existen).
const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/partidos', label: 'Partidos', icon: CalendarDays },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminShell({
  adminName,
  avatarUrl,
  children,
}: {
  adminName: string | null
  avatarUrl: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const close = () => setMobileOpen(false)
  const title = NAV.find((item) => isActive(pathname, item.href))?.label ?? 'Backoffice'

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileOpen ? 'admin-sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="close-mobile" onClick={close} aria-label="Cerrar menú">
            <X />
          </button>
        </div>
        <div className="admin-label">BACKOFFICE</div>
        <nav>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={isActive(pathname, href) ? 'active' : ''}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              onClick={close}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="exit-admin" onClick={close}>
          <ArrowLeft />
          Volver a jugadores
        </Link>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop admin-backdrop" onClick={close} aria-label="Cerrar menú" />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu />
          </button>
          <div className="admin-topbar-title">
            <span className="eyebrow lime-text">PANEL DE CONTROL</span>
            <h1>{title}</h1>
          </div>
          <div className="admin-user">
            <UserAvatar name={adminName} src={avatarUrl} className="top-avatar" />
            <span>
              <b>{adminName ?? 'Administrador'}</b>
              <small>Administrador</small>
            </span>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}
