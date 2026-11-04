import { AdminShell } from '@/components/admin/admin-shell'
import { getMyProfile, requireAdmin } from '@/lib/auth'
import { getPendingReviewCount } from '@/lib/admin-data'

/**
 * Todo lo que cuelga de /admin pasa por acá. El proxy ya filtró por ADMIN_EMAIL;
 * requireAdmin() suma la verificación contra la base (is_admin). Cada Server Action
 * vuelve a llamar requireAdmin(), y las funciones SQL validan por su cuenta.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const [profile, pendingReview] = await Promise.all([getMyProfile(), getPendingReviewCount()])
  return (
    <AdminShell adminName={profile.full_name} avatarUrl={profile.avatar_url} pendingReview={pendingReview}>
      {children}
    </AdminShell>
  )
}
