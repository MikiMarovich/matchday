import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { adminEmails } from '@/lib/admin-emails'
import { formatMatchWhen } from '@/lib/dates'
import { sendEmail } from '@/lib/email'

/**
 * Aviso a los admins: "Fulano pagó, validá el pago".
 * Se llama dentro de after(): corre DESPUÉS de responderle al jugador, así el envío
 * no lo demora y, si Gmail falla, el comprobante igual quedó enviado.
 * Un email por admin (si falla uno, el otro igual sale) y una fila por destinatario
 * en notifications_log vía log_receipt_notification.
 */
export async function notifyAdminReceipt(
  supabase: SupabaseClient<Database>,
  data: { registrationId: string; playerName: string; playerEmail: string; matchTitle: string; startsAt: string; endsAt: string | null },
) {
  const recipients = adminEmails()
  if (recipients.length === 0) return

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://matchday-alpha-seven.vercel.app'
  const subject = `Pago para validar: ${data.playerName}`
  const text = [
    `${data.playerName} (${data.playerEmail}) pagó y envió el comprobante del partido «${data.matchTitle}» (${formatMatchWhen(data.startsAt, data.endsAt)}).`,
    '',
    'Tenés que validar el pago:',
    `${site}/admin/pagos`,
  ].join('\n')

  await Promise.all(
    recipients.map(async (to) => {
      const result = await sendEmail(to, subject, text)
      const { error } = await supabase.rpc('log_receipt_notification', {
        p_registration_id: data.registrationId,
        p_recipient: to,
        p_status: result.ok ? 'SENT' : 'FAILED',
        p_message_id: result.ok ? result.messageId : null,
        p_error: result.ok ? null : result.error,
      })
      if (error || !result.ok) {
        console.error('[notifyAdminReceipt]', to, result.ok ? 'no se pudo registrar el envío' : result.error, error?.message ?? '')
      }
    }),
  )
}
