import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { formatMatchWhen } from '@/lib/dates'
import { sendEmail } from '@/lib/email'

/**
 * Aviso al admin: "Fulano pagó, validá el pago".
 * Se llama dentro de after(): corre DESPUÉS de responderle al jugador, así el envío
 * no lo demora y, si Gmail falla, el comprobante igual quedó enviado.
 * El resultado (SENT/FAILED) queda en notifications_log vía log_receipt_notification.
 */
export async function notifyAdminReceipt(
  supabase: SupabaseClient<Database>,
  data: { registrationId: string; playerName: string; playerEmail: string; matchTitle: string; startsAt: string; endsAt: string | null },
) {
  const to = process.env.ADMIN_EMAIL
  if (!to) return

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://matchday-alpha-seven.vercel.app'
  const subject = `Pago para validar: ${data.playerName}`
  const text = [
    `${data.playerName} (${data.playerEmail}) pagó y envió el comprobante del partido «${data.matchTitle}» (${formatMatchWhen(data.startsAt, data.endsAt)}).`,
    '',
    'Tenés que validar el pago:',
    `${site}/admin/pagos`,
  ].join('\n')

  const result = await sendEmail(to, subject, text)
  const { error } = await supabase.rpc('log_receipt_notification', {
    p_registration_id: data.registrationId,
    p_status: result.ok ? 'SENT' : 'FAILED',
    p_message_id: result.ok ? result.messageId : null,
    p_error: result.ok ? null : result.error,
  })
  if (error || !result.ok) {
    console.error('[notifyAdminReceipt]', result.ok ? 'no se pudo registrar el envío' : result.error, error?.message ?? '')
  }
}
