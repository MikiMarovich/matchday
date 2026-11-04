import { PlayerShell } from '@/components/player/player-shell'
import { getMyProfile, isAdmin } from '@/lib/auth'

// Layout de todas las pantallas del jugador. Las rutas ya están protegidas por proxy.ts;
// getMyProfile vuelve a validar la sesión del lado servidor.
export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const [profile, admin] = await Promise.all([getMyProfile(), isAdmin()])

  return (
    <PlayerShell user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} isAdmin={admin}>
      {children}
    </PlayerShell>
  )
}
