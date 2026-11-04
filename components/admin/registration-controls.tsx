'use client'

import { useState, useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ActionState } from '@/lib/action-state'
import {
  adminCancelRegistration,
  approvePayment,
  expirePendingPayments,
  promoteFromWaitlist,
  rejectPayment,
} from '@/app/admin/inscripciones/actions'

function Feedback({ state }: { state: ActionState | null }) {
  if (!state || state.status === 'idle') return null
  return (
    <span role="status" className={`form-message ${state.status}`}>
      {state.message}
    </span>
  )
}

/* ---------- Aprobar / rechazar un comprobante ---------- */

export function ReviewButtons({ registrationId, playerName }: { registrationId: string; playerName: string }) {
  const [mode, setMode] = useState<'idle' | 'reject'>('idle')
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  if (mode === 'reject') {
    return (
      <div className="review-box">
        <label className="field">
          <span className="field-label">Motivo del rechazo (lo ve {playerName})</span>
          <input
            className="field-input"
            value={reason}
            maxLength={300}
            autoFocus
            placeholder="Ej.: el monto no coincide, no llegó la transferencia…"
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
          />
        </label>
        <div className="form-actions">
          <Button
            variant="destructive"
            size="lg"
            disabled={pending || reason.trim().length < 3}
            onClick={() => startTransition(async () => setState(await rejectPayment(registrationId, reason)))}
          >
            {pending ? 'Rechazando…' : 'Confirmar rechazo'}
          </Button>
          <Button variant="outline" size="lg" disabled={pending} onClick={() => setMode('idle')}>
            Volver
          </Button>
          <Feedback state={state} />
        </div>
      </div>
    )
  }

  return (
    <div className="form-actions">
      <Button
        size="lg"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`¿Confirmás que recibiste la transferencia de ${playerName}?`)) return
          startTransition(async () => setState(await approvePayment(registrationId)))
        }}
      >
        <Check data-icon="inline-start" />
        {pending ? 'Aprobando…' : 'Aprobar pago'}
      </Button>
      <Button variant="outline" size="lg" disabled={pending} onClick={() => setMode('reject')}>
        <X data-icon="inline-start" />
        Rechazar
      </Button>
      <Feedback state={state} />
    </div>
  )
}

/* ---------- Cancelar una inscripción (admin) ---------- */

export function AdminCancelButton({ registrationId, playerName }: { registrationId: string; playerName: string }) {
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <span className="inline-form">
      <button
        type="button"
        className="text-button"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt(
            `Cancelar la inscripción de ${playerName}.\nMotivo (opcional, lo ve el jugador):`,
            '',
          )
          if (reason === null) return // tocó "Cancelar" en el diálogo
          startTransition(async () => setState(await adminCancelRegistration(registrationId, reason)))
        }}
      >
        {pending ? 'Cancelando…' : 'Cancelar'}
      </button>
      {state?.status === 'error' && <Feedback state={state} />}
    </span>
  )
}

/* ---------- Herramientas por partido: liberar vencidas y promover suplente ---------- */

export function MatchTools({
  matchId,
  defaultMinutes,
  waitlistCount,
  freeSlots,
  expiredCount,
}: {
  matchId: string
  defaultMinutes: number
  waitlistCount: number
  freeSlots: number
  expiredCount: number
}) {
  const [minutes, setMinutes] = useState(String(defaultMinutes))
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()
  const canPromote = waitlistCount > 0 && freeSlots > 0

  return (
    <div className="match-tools">
      <div className="match-tool">
        <div>
          <strong>Reservas vencidas</strong>
          <span>
            {expiredCount === 0
              ? 'No hay reservas vencidas sin liberar.'
              : `${expiredCount} ${expiredCount === 1 ? 'reserva venció' : 'reservas vencieron'} sin comprobante. Ya no ocupan lugar; liberarlas las marca como canceladas.`}
          </span>
        </div>
        <Button
          variant="outline"
          size="lg"
          disabled={pending || expiredCount === 0}
          onClick={() => startTransition(async () => setState(await expirePendingPayments(matchId)))}
        >
          Liberar vencidas
        </Button>
      </div>

      <div className="match-tool">
        <div>
          <strong>Promover suplente</strong>
          <span>
            {waitlistCount === 0
              ? 'No hay suplentes.'
              : freeSlots === 0
                ? `Hay ${waitlistCount} ${waitlistCount === 1 ? 'suplente' : 'suplentes'}, pero no hay lugares libres.`
                : `Pasa al suplente N.° 1 a «falta pagar». Plazo para pagar:`}
          </span>
          {canPromote && (
            <label className="minutes-input">
              <input
                className="field-input"
                type="number"
                min={5}
                max={2880}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={pending}
              />
              minutos
            </label>
          )}
        </div>
        <Button
          size="lg"
          disabled={pending || !canPromote}
          onClick={() => startTransition(async () => setState(await promoteFromWaitlist(matchId, Number(minutes))))}
        >
          Promover
        </Button>
      </div>
      <Feedback state={state} />
    </div>
  )
}
