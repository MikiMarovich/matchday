import type { Metadata } from 'next'
import { UserAvatar } from '@/components/user-avatar'
import { getMyProfile } from '@/lib/auth'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'Mi perfil — MATCHDAY' }

export default async function PerfilPage() {
  const profile = await getMyProfile()

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow lime-text">CUENTA</span>
          <h1>Mi perfil</h1>
          <p>Tu nombre y tu posición aparecen en las listas de cada partido.</p>
        </div>
      </div>
      <div className="panel profile-card">
        <UserAvatar name={profile.full_name} src={profile.avatar_url} className="large-avatar" />
        <div className="flex-1 w-full">
          <ProfileForm profile={profile} />
        </div>
      </div>
    </div>
  )
}
