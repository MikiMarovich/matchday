'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Home, LogOut, Menu, Receipt, ShieldCheck, Users, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { UserAvatar } from '@/components/user-avatar'

const NAV = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/mis-inscripciones', label: 'Mis inscripciones', icon: Receipt },
  { href: '/perfil', label: 'Mi perfil', icon: Users },
]

type ShellUser = { name: string | null; avatarUrl: string | null }

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function pageTitle(pathname: string) {
  if (pathname.startsWith('/partidos')) return 'Partido'
  return NAV.find((item) => isActive(pathname, item.href))?.label ?? 'MATCHDAY'
}

export function PlayerShell({
  user,
  isAdmin,
  children,
}: {
  user: ShellUser
  isAdmin: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const close = () => setMobileOpen(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="close-mobile" onClick={close} aria-label="Cerrar menú">
            <X />
          </button>
        </div>
        <div className="profile-mini">
          <UserAvatar name={user.name} src={user.avatarUrl} className="profile-avatar" />
          <div>
            <strong>{user.name ?? 'Jugador'}</strong>
            <span>{isAdmin ? 'Administrador' : 'Jugador'}</span>
          </div>
        </div>
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
        <div className="sidebar-bottom">
          <form action="/auth/signout" method="post">
            <button type="submit">
              <LogOut />
              Cerrar sesión
            </button>
          </form>
          {isAdmin && (
            <Link href="/admin" className="admin-link" onClick={close}>
              <ShieldCheck />
              <span>
                Sos administrador
                <b>Ir al backoffice</b>
              </span>
              <ArrowRight />
            </Link>
          )}
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" onClick={close} aria-label="Cerrar menú" />}

      <div className="main-shell">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu />
          </button>
          <div>
            <span className="eyebrow">MATCHDAY / JUGADORES</span>
            <h2>{pageTitle(pathname)}</h2>
          </div>
          <div className="top-actions">
            <Link href="/perfil" aria-label="Mi perfil">
              <UserAvatar name={user.name} src={user.avatarUrl} className="top-avatar" />
            </Link>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
