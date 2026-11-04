import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MatchView } from '@/components/player/match-view'
import { requireUser } from '@/lib/auth'
import { getMatch, getMyRegistration, getRoster } from '@/lib/player-data'

export const metadata: Metadata = { title: 'Partido — MATCHDAY' }

const UUID = /^[0-9a-f-]{36}$/i

export default async function PartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const user = await requireUser()
  // RLS: un jugador no ve borradores, así que un DRAFT da "no encontrado".
  const match = await getMatch(id)
  if (!match) notFound()

  const [roster, myReg] = await Promise.all([getRoster(match.id), getMyRegistration(match.id, user.id)])

  return (
    <div className="match-page">
      <Link href="/" className="back-link">
        ← Volver al inicio
      </Link>
      <MatchView match={match} roster={roster} myReg={myReg} userId={user.id} eyebrow="PARTIDO" nowMs={Date.now()} />
    </div>
  )
}
