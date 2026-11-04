import type { Enums } from '@/lib/supabase/database.types'

export const POSITION_LABELS: Record<Enums<'player_position'>, string> = {
  ARQUERO: 'Arquero',
  DEFENSOR: 'Defensor',
  MEDIOCAMPISTA: 'Mediocampista',
  DELANTERO: 'Delantero',
}

export function positionLabel(position: Enums<'player_position'> | null | undefined): string {
  return position ? POSITION_LABELS[position] : 'Sin definir'
}

/** Iniciales para el avatar cuando no hay foto: "Mikael Marovich" → "MM". */
export function initials(name: string | null | undefined, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Primer nombre para saludos. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] || 'jugador'
}
