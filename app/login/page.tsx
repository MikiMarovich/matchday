import type { Metadata } from 'next'
import { ShieldCheck, Trophy } from 'lucide-react'
import { GoogleLoginButton } from '@/components/google-login-button'
import { Logo } from '@/components/logo'

export const metadata: Metadata = { title: 'Ingresar — MATCHDAY' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  return (
    <main className="login-screen">
      <div className="login-brand">
        <Logo />
        <span className="eyebrow">FÚTBOL ENTRE AMIGOS</span>
      </div>
      <div className="login-card">
        <div className="login-ball">
          <Trophy />
        </div>
        <h1>Entrá a la cancha</h1>
        <p>Organizá tus partidos y jugá con tu gente.</p>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-400">
            No se pudo iniciar sesión. Probá de nuevo.
          </p>
        )}
        <GoogleLoginButton next={next} />
        <div className="login-note">
          <ShieldCheck /> Acceso seguro con tu cuenta de Google.
        </div>
      </div>
      <span className="login-footer">
        MATCHDAY · Tu partido, tu equipo. · <a href="/privacidad" className="hover:underline">Privacidad</a>
      </span>
    </main>
  )
}
