import type { Metadata } from 'next'
import { DashboardMock } from '@/components/mock/admin-mock'

export const metadata: Metadata = { title: 'Backoffice — MATCHDAY' }

// TODO(7d): reemplazar por métricas reales.
export default function AdminPage() {
  return <DashboardMock />
}
