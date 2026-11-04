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

export const PROVIDER_LABELS: Record<Enums<'payment_provider'>, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  NARANJA_X: 'Naranja X',
}

export const MATCH_STATUS_LABELS: Record<Enums<'match_status'>, string> = {
  DRAFT: 'Borrador',
  OPEN: 'Inscripción abierta',
  CLOSED: 'Inscripción cerrada',
  PLAYED: 'Jugado',
  CANCELLED: 'Cancelado',
}

/** Tono del status-badge existente en globals.css */
export const MATCH_STATUS_TONE: Record<Enums<'match_status'>, 'success' | 'pending' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'pending',
  PLAYED: 'neutral',
  CANCELLED: 'danger',
}

/** "0000 0031 0000 0000 0000 00" → más fácil de leer y de verificar contra el home banking. */
export function formatAccount(account: string): string {
  return account.replace(/(\d{4})(?=\d)/g, '$1 ')
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
