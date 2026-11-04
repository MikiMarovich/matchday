import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/database.types'

export type SessionUser = { id: string; email: string }
export type Profile = Pick<Tables<'profiles'>, 'id' | 'email' | 'full_name' | 'avatar_url' | 'position'>

/**
 * Devuelve el usuario logueado o null. Valida el JWT (getClaims), no confía en la cookie.
 * `cache` evita repetir el trabajo si layout y página lo piden en el mismo request.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub || typeof claims.email !== 'string') return null
  return { id: claims.sub, email: claims.email.toLowerCase() }
})

/** Para páginas y Server Actions que requieren sesión. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/** Perfil del usuario logueado (RLS: solo puede leer el propio). */
export const getMyProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, position')
    .eq('id', user.id)
    .single()
  if (error || !data) throw new Error('No se encontró tu perfil.')
  return data
})

/**
 * ¿Es admin? Dos capas, las dos tienen que dar sí:
 *  1. El email coincide con ADMIN_EMAIL (variable solo del servidor).
 *  2. La base lo confirma con public.is_admin() (tabla public.admins).
 */
export const isAdmin = cache(async (): Promise<boolean> => {
  const user = await getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || !adminEmail || user.email !== adminEmail) return false

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
})

/** Para páginas y Server Actions del backoffice. Si no es admin, vuelve al inicio. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!(await isAdmin())) redirect('/')
  return user
}
