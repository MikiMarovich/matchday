import type { Metadata } from 'next'
import { AdminMock } from '@/components/mock/admin-mock'
import { getMyProfile, requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Backoffice — MATCHDAY' }

// TODO(7b/7d): reemplazar por las secciones reales del backoffice.
export default async function AdminPage() {
  await requireAdmin() // segunda capa: ADMIN_EMAIL + is_admin() en la base
  const profile = await getMyProfile()
  return <AdminMock adminName={profile.full_name} avatarUrl={profile.avatar_url} />
}
