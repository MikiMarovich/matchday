'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { IDLE } from '@/lib/action-state'
import type { Enums } from '@/lib/supabase/database.types'
import { setMatchStatus } from '../actions'

type Status = Enums<'match_status'>
type Transition = { to: Status; label: string; variant: 'default' | 'outline' | 'destructive'; confirm?: string }

// Espejo de las transiciones que permite admin_set_match_status (la base es la que decide).
const TRANSITIONS: Record<Status, Transition[]> = {
  DRAFT: [
    { to: 'OPEN', label: 'Abrir inscripción', variant: 'default', confirm: 'Los jugadores van a poder ver el partido y anotarse. ¿Abrir la inscripción?' },
    { to: 'CANCELLED', label: 'Cancelar partido', variant: 'destructive', confirm: '¿Cancelar este partido? No se puede deshacer.' },
  ],
  OPEN: [
    { to: 'CLOSED', label: 'Cerrar inscripción', variant: 'outline' },
    { to: 'PLAYED', label: 'Marcar como jugado', variant: 'outline', confirm: '¿Marcar el partido como jugado? No se puede deshacer.' },
    { to: 'CANCELLED', label: 'Cancelar partido', variant: 'destructive', confirm: 'Se cancelan TODAS las inscripciones activas («Partido suspendido»). Los reintegros los coordinás vos. No se puede deshacer. ¿Cancelar el partido?' },
  ],
  CLOSED: [
    { to: 'OPEN', label: 'Reabrir inscripción', variant: 'default' },
    { to: 'PLAYED', label: 'Marcar como jugado', variant: 'outline', confirm: '¿Marcar el partido como jugado? No se puede deshacer.' },
    { to: 'CANCELLED', label: 'Cancelar partido', variant: 'destructive', confirm: 'Se cancelan TODAS las inscripciones activas («Partido suspendido»). Los reintegros los coordinás vos. No se puede deshacer. ¿Cancelar el partido?' },
  ],
  PLAYED: [],
  CANCELLED: [],
}

export function StatusActions({ matchId, status }: { matchId: string; status: Status }) {
  const [state, action, pending] = useActionState(setMatchStatus, IDLE)
  const transitions = TRANSITIONS[status]
  if (transitions.length === 0) return null

  return (
    <div className="status-actions">
      {transitions.map((t) => (
        <form
          key={t.to}
          action={action}
          onSubmit={(e) => {
            if (t.confirm && !window.confirm(t.confirm)) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={matchId} />
          <input type="hidden" name="status" value={t.to} />
          <Button type="submit" variant={t.variant} size="lg" disabled={pending}>
            {t.label}
          </Button>
        </form>
      ))}
      {state.status === 'error' && (
        <span role="status" className="form-message error">
          {state.message}
        </span>
      )}
    </div>
  )
}
