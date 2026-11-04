'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { POSITION_LABELS } from '@/lib/labels'
import type { Profile } from '@/lib/auth'
import { updateProfile, type ProfileFormState } from './actions'

const initialState: ProfileFormState = { status: 'idle' }

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={formAction} className="form-grid">
      <label className="field">
        <span className="field-label">Nombre completo</span>
        <input
          className="field-input"
          name="full_name"
          defaultValue={profile.full_name ?? ''}
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
        <span className="field-hint">Es el nombre que ven los demás en las listas del partido.</span>
      </label>

      <label className="field">
        <span className="field-label">Email</span>
        <input className="field-input" value={profile.email} readOnly />
        <span className="field-hint">Es el de tu cuenta de Google. No se puede cambiar.</span>
      </label>

      <label className="field">
        <span className="field-label">Posición habitual</span>
        <select className="field-input" name="position" defaultValue={profile.position ?? ''}>
          <option value="">Sin definir</option>
          {Object.entries(POSITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {state.status !== 'idle' && (
          <span role="status" className={`form-message ${state.status}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}
