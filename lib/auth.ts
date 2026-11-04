import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SessionUser = { id: string; email: string }

/** Devuelve el usuario logueado o null. Valida el JWT (getClaims), no confía en la cookie. */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub || typeof claims.email !== 'string') return null
  return { id: claims.sub, email: claims.email.toLowerCase() }
}

/** Para páginas y Server Actions que requieren sesión. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Para páginas y Server Actions del backoffice. Dos capas:
 *  1. El email coincide con ADMIN_EMAIL (variable solo del servidor).
 *  2. La base confirma con public.is_admin() (tabla public.admins).
 * Si alguna falla, vuelve al inicio.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!adminEmail || user.email !== adminEmail) redirect('/')

  const supabase = await createClient()
  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  if (error || isAdmin !== true) redirect('/')

  return user
}
