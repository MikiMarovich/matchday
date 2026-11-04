import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente para Server Components, Server Actions y Route Handlers.
// Actúa con la sesión del usuario (cookies), así que RLS y las funciones
// de la base ven quién es. No usa la secret key.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // No pasa nada porque proxy.ts refresca la sesión en cada request.
          }
        },
      },
    },
  )
}
