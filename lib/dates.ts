/**
 * Fechas del partido. La base guarda timestamptz (UTC); la app muestra y carga todo
 * en hora de Argentina, sin importar dónde corra el servidor (Vercel corre en UTC).
 * Argentina no tiene horario de verano desde 2009: el offset fijo -03:00 es correcto.
 */
export const TZ = 'America/Argentina/Buenos_Aires'
const AR_OFFSET = '-03:00'

const fullFmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const timeFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "jueves 24 de octubre" */
export function formatDay(iso: string): string {
  return fullFmt.format(new Date(iso)).replace(',', '')
}

/** "20:30" */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** "jueves 24 de octubre · 20:30 — 22:00 hs" */
export function formatMatchWhen(startsAt: string, endsAt: string | null): string {
  const range = endsAt ? `${formatTime(startsAt)} — ${formatTime(endsAt)}` : formatTime(startsAt)
  return `${formatDay(startsAt)} · ${range} hs`
}

/** Valores para <input type="date"> y <input type="time"> en hora argentina. */
export function toLocalInputs(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  return { date: isoDateFmt.format(new Date(iso)), time: formatTime(iso) }
}

/** "2026-11-10" + "20:30" (hora argentina) → ISO con offset. Devuelve null si el formato no es válido. */
export function fromLocalInputs(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const iso = `${date}T${time}:00${AR_OFFSET}`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

/** "$ 5.500" */
export function formatPrice(pesos: number): string {
  return `$ ${new Intl.NumberFormat('es-AR').format(pesos)}`
}
