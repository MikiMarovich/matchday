'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Copy, FileCheck2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { ActionState } from '@/lib/action-state'
import { cancelRegistration, joinWaitlist, registerForMatch, submitReceipt } from '@/app/(jugador)/partidos/actions'

function Feedback({ state }: { state: ActionState | null }) {
  if (!state || state.status === 'idle') return null
  return (
    <span role="status" className={`form-message ${state.status}`}>
      {state.message}
    </span>
  )
}

/* ---------- Anotarme ---------- */

export function RegisterButton({ matchId, full }: { matchId: string; full: boolean }) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<ActionState | null>(null)
  const run = (action: () => Promise<ActionState>) => startTransition(async () => setState(await action()))

  return (
    <div className="register-box">
      <Button className="register-button" disabled={pending} onClick={() => run(() => registerForMatch(matchId))}>
        {pending ? 'UN MOMENTO…' : full ? 'ANOTARME DE SUPLENTE' : 'ANOTARME'}
        {!pending && <ArrowRight data-icon="inline-end" />}
      </Button>
      {/* Con lugar libre, el jugador puede elegir quedar como suplente sin reservar ni pagar. */}
      {!full && (
        <button type="button" className="text-button waitlist-link" disabled={pending} onClick={() => run(() => joinWaitlist(matchId))}>
          No sé si llego: anotarme como suplente (sin pagar)
        </button>
      )}
      {state?.status === 'error' && <Feedback state={state} />}
    </div>
  )
}

/* ---------- Cuenta regresiva del plazo de pago ---------- */

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return h > 0 ? `${h}:${mmss}` : mmss
}

export function Countdown({ deadline }: { deadline: string }) {
  const router = useRouter()
  // null en el primer render: la hora del servidor y la del navegador no coinciden (evita error de hidratación).
  const [left, setLeft] = useState<number | null>(null)
  const refreshed = useRef(false)

  useEffect(() => {
    const end = new Date(deadline).getTime()
    const tick = () => {
      const ms = end - Date.now()
      setLeft(ms)
      if (ms <= 0 && !refreshed.current) {
        refreshed.current = true
        router.refresh() // el servidor recalcula: el lugar se libera y se muestra "plazo vencido"
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline, router])

  const urgent = left !== null && left < 5 * 60 * 1000
  return <strong className={`countdown ${urgent ? 'countdown-urgent' : ''}`}>{left === null ? '--:--' : format(left)}</strong>
}

/* ---------- Copiar alias / CVU ---------- */

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="copy-button"
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* sin permiso de portapapeles: el dato igual está a la vista */
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </button>
  )
}

/* ---------- Subir comprobante ---------- */

// Las mismas reglas que el bucket (004_storage.sql). El bucket es la barrera real; esto evita subir de gusto.
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
const MAX_BYTES = 5 * 1024 * 1024

function validateFile(file: File): string | null {
  if (!ALLOWED[file.type]) return 'El comprobante tiene que ser una imagen (JPG, PNG o WEBP) o un PDF.'
  if (file.size > MAX_BYTES) return 'El archivo pesa más de 5 MB.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

export function ReceiptUpload({ userId, registrationId }: { userId: string; registrationId: string }) {
  const [file, setFile] = useState<File | null>(null)
  // Copia en memoria del archivo, leída apenas se elige. En Android, Chrome guarda solo
  // una referencia al archivo de la galería: si el jugador sale a otra app (Mercado Pago,
  // Naranja X) y vuelve, ese permiso puede caducar y el envío falla antes de salir del
  // celular (ERR_UPLOAD_FILE_CHANGED). Con los bytes ya leídos eso no pasa.
  const [data, setData] = useState<Blob | null>(null)
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(f: File | undefined) {
    if (!f) return
    const reset = (message: string) => {
      setFile(null)
      setData(null)
      setState({ status: 'error', message })
      if (inputRef.current) inputRef.current.value = ''
    }
    const problem = validateFile(f)
    if (problem) return reset(problem)
    try {
      const bytes = await f.arrayBuffer()
      setData(new Blob([bytes], { type: f.type }))
    } catch {
      return reset('No se pudo leer el archivo. Elegilo de nuevo desde la galería.')
    }
    setFile(f)
    setState(null)
  }

  function send() {
    if (!file || !data) return
    startTransition(async () => {
      // Nombre único con timestamp: el bucket no permite pisar archivos (sin UPDATE ni upsert).
      const path = `${userId}/${registrationId}/${Date.now()}.${ALLOWED[file.type]}`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, data, { upsert: false, contentType: file.type })
      if (uploadError) {
        console.error('[ReceiptUpload]', uploadError)
        setState({
          status: 'error',
          message: 'No se pudo subir el archivo. Revisá tu conexión y probá de nuevo; si sigue fallando, recargá la página y elegí el archivo otra vez.',
        })
        return
      }
      setState(await submitReceipt(registrationId, path))
    })
  }

  return (
    <div className="receipt-upload">
      <label className={`upload-zone ${file ? 'upload-zone-ready' : ''}`}>
        {file ? <FileCheck2 /> : <Upload />}
        <strong>{file ? file.name : 'Elegí el comprobante'}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · tocá para cambiarlo` : 'JPG, PNG, WEBP o PDF · hasta 5 MB'}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={pending}
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </label>
      <Button className="full-button" disabled={!file || !data || pending} onClick={send}>
        {pending ? 'Enviando…' : 'Enviar comprobante'}
      </Button>
      <Feedback state={state} />
    </div>
  )
}

/* ---------- Cancelar inscripción ---------- */

export function CancelRegistration({ registrationId, warning }: { registrationId: string; warning?: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        Cancelar mi inscripción
      </button>
    )
  }

  return (
    <div className="cancel-box">
      {warning && <p className="cancel-warning">{warning}</p>}
      <label className="field">
        <span className="field-label">Motivo (opcional)</span>
        <input className="field-input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} disabled={pending} />
      </label>
      <div className="form-actions">
        <Button
          variant="destructive"
          size="lg"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await cancelRegistration(registrationId, reason)))}
        >
          {pending ? 'Cancelando…' : 'Confirmar cancelación'}
        </Button>
        <Button variant="outline" size="lg" disabled={pending} onClick={() => setOpen(false)}>
          Volver
        </Button>
        <Feedback state={state} />
      </div>
    </div>
  )
}
