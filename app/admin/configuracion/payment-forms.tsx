'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { IDLE } from '@/lib/action-state'
import { PROVIDER_LABELS, formatAccount } from '@/lib/labels'
import type { Tables } from '@/lib/supabase/database.types'
import { savePaymentSetting, setPaymentSettingActive } from './actions'

type Setting = Pick<Tables<'payment_settings'>, 'id' | 'provider' | 'alias' | 'account_number' | 'holder_name' | 'is_active'>

function Message({ state }: { state: { status: string; message?: string } }) {
  if (state.status === 'idle') return null
  return (
    <span role="status" className={`form-message ${state.status}`}>
      {state.message}
    </span>
  )
}

/** Formulario de alta (sin `setting`) o edición (con `setting`). */
export function PaymentSettingForm({ setting }: { setting?: Setting }) {
  const [state, action, pending] = useActionState(savePaymentSetting, IDLE)
  const f = state.fields

  return (
    <form action={action} className="form-grid form-grid-2">
      {setting && <input type="hidden" name="id" value={setting.id} />}
      <label className="field">
        <span className="field-label">Billetera</span>
        <select className="field-input" name="provider" defaultValue={f?.provider ?? setting?.provider ?? 'MERCADO_PAGO'} required>
          {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Alias</span>
        <input className="field-input" name="alias" defaultValue={f?.alias ?? setting?.alias ?? ''} required minLength={3} maxLength={60} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field-label">CVU / CBU</span>
        <input
          className="field-input"
          name="account_number"
          defaultValue={f?.account_number ?? (setting ? formatAccount(setting.account_number) : '')}
          required
          inputMode="numeric"
          pattern="[0-9 ]{22,30}"
          title="22 dígitos"
          autoComplete="off"
        />
        <span className="field-hint">22 dígitos. Podés pegarlo con espacios.</span>
      </label>
      <label className="field">
        <span className="field-label">Titular de la cuenta</span>
        <input className="field-input" name="holder_name" defaultValue={f?.holder_name ?? setting?.holder_name ?? ''} required minLength={2} maxLength={100} autoComplete="off" />
      </label>
      <div className="form-actions field-wide">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : setting ? 'Guardar cambios' : 'Agregar medio de pago'}
        </Button>
        <Message state={state} />
      </div>
    </form>
  )
}

export function ToggleActiveForm({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState(setPaymentSettingActive, IDLE)
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <Button type="submit" variant={active ? 'outline' : 'default'} size="sm" disabled={pending}>
        {pending ? '…' : active ? 'Desactivar' : 'Usar este medio'}
      </Button>
      {state.status === 'error' && <Message state={state} />}
    </form>
  )
}
