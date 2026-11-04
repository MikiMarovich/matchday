import type { Metadata } from 'next'
import { HistoryMock } from '@/components/mock/player-mock'

export const metadata: Metadata = { title: 'Mis inscripciones — MATCHDAY' }

// TODO(7c): reemplazar por las inscripciones reales del usuario.
export default function MisInscripcionesPage() {
  return <HistoryMock />
}
