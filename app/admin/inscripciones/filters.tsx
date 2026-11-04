'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type Option = { value: string; label: string }

/** Filtros en la URL (?partido=…&estado=…): se pueden compartir o guardar como marcador. */
export function RegistrationFilters({ matches, statuses }: { matches: Option[]; statuses: Option[] }) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    router.push(`/admin/inscripciones?${next.toString()}`)
  }

  return (
    <div className="filters">
      <label className="field">
        <span className="field-label">Partido</span>
        <select className="field-input" value={params.get('partido') ?? matches[0]?.value} onChange={(e) => update('partido', e.target.value)}>
          {matches.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Estado</span>
        <select className="field-input" value={params.get('estado') ?? 'activas'} onChange={(e) => update('estado', e.target.value)}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
