import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Envío de emails por Gmail SMTP (gratis, ~500/día).
 * Requiere en el servidor (NUNCA con prefijo NEXT_PUBLIC_):
 *   GMAIL_USER          la cuenta de Gmail que envía
 *   GMAIL_APP_PASSWORD  contraseña de aplicación de 16 letras (no la clave de Gmail)
 * Si faltan, no se envía nada y se informa como fallo: la app sigue funcionando igual.
 */

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string }

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '') // Google la muestra con espacios
  if (!user || !pass) return null
  transporter ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // TLS desde el inicio
    auth: { user, pass },
  })
  return transporter
}

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  const t = getTransporter()
  if (!t) return { ok: false, error: 'Faltan GMAIL_USER / GMAIL_APP_PASSWORD en el servidor.' }
  try {
    const info = await t.sendMail({
      from: { name: 'MATCHDAY', address: process.env.GMAIL_USER! },
      to,
      subject,
      text,
    })
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    // Sin detalles sensibles: nodemailer no incluye la contraseña en sus errores.
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido al enviar el email.' }
  }
}
