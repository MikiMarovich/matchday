'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { IDLE } from '@/lib/action-state'
import { createMatch, updateMatch } from './actions'

export type MatchFormValues = {
  id?: string
  title: string
  location: string
  date: string
  start_time: string
  end_time: string
  price: string
  max_players: string
  payment_window_minutes: string
  notes: string
}

export const EMPTY_MATCH: MatchFormValues = {
  title: '',
  location: '',
  date: '',
  start_time: '',
  end_time: '',
  price: '',
  max_players: '10',
  payment_window_minutes: '30',
  notes: '',
}

/** Alta (sin `values.id`) o edición. `locked`: partido jugado o cancelado, solo lectura. */
export function MatchForm({ values, locked = false }: { values: MatchFormValues; locked?: boolean }) {
  const isEdit = Boolean(values.id)
  const [state, action, pending] = useActionState(isEdit ? updateMatch : createMatch, IDLE)
  const v = { ...values, ...state.fields } as MatchFormValues

  return (
    <form action={action}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <fieldset disabled={locked || pending} className="form-grid form-grid-2">
        <label className="field field-wide">
          <span className="field-label">Título</span>
          <input className="field-input" name="title" defaultValue={v.title} required maxLength={120} placeholder="Jueves de fútbol" />
        </label>
        <label className="field field-wide">
          <span className="field-label">Lugar</span>
          <input className="field-input" name="location" defaultValue={v.location} required minLength={2} maxLength={200} placeholder="Nombre de la cancha y dirección" />
        </label>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input className="field-input" type="date" name="date" defaultValue={v.date} required />
        </label>
        <div className="field-pair">
          <label className="field">
            <span className="field-label">Empieza</span>
            <input className="field-input" type="time" name="start_time" defaultValue={v.start_time} required />
          </label>
          <label className="field">
            <span className="field-label">Termina (opcional)</span>
            <input className="field-input" type="time" name="end_time" defaultValue={v.end_time} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Precio por jugador ($)</span>
          <input className="field-input" name="price" defaultValue={v.price} required inputMode="numeric" pattern="[0-9.]+" title="Pesos enteros, sin centavos" placeholder="5500" />
        </label>
        <label className="field">
          <span className="field-label">Cupo de jugadores</span>
          <input className="field-input" type="number" name="max_players" defaultValue={v.max_players} required min={2} max={50} />
          <span className="field-hint">Los que se anoten después quedan como suplentes.</span>
        </label>
        <label className="field">
          <span className="field-label">Plazo para pagar (minutos)</span>
          <input className="field-input" type="number" name="payment_window_minutes" defaultValue={v.payment_window_minutes} required min={5} max={1440} />
          <span className="field-hint">Tiempo que se le guarda el lugar a quien se anota hasta que manda el comprobante.</span>
        </label>
        <label className="field field-wide">
          <span className="field-label">Notas para los jugadores (opcional)</span>
          <textarea className="field-input field-textarea" name="notes" defaultValue={v.notes} maxLength={1000} rows={3} placeholder="Traer camiseta clara y oscura…" />
        </label>
        {!locked && (
          <div className="form-actions field-wide">
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear partido'}
            </Button>
            {state.status !== 'idle' && (
              <span role="status" className={`form-message ${state.status}`}>
                {state.message}
              </span>
            )}
          </div>
        )}
      </fieldset>
    </form>
  )
}
