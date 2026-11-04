import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin-emails'

// Rutas accesibles sin sesión.
const PUBLIC_PATHS = ['/login', '/auth', '/privacidad']

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas:
 *  - Sin sesión → /login (salvo rutas públicas).
 *  - /admin con un email que no está en ADMIN_EMAIL (lista separada por comas) → /.
 * La autorización real del admin vive en la base (public.is_admin()); esto es la primera capa.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Un cliente nuevo por request (nunca global).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
          Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value))
        },
      },
    },
  )

  // No poner código entre createServerClient y getClaims() (recomendación de Supabase).
  // getClaims() valida la firma del JWT; getSession() NO es confiable en el servidor.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const { pathname } = request.nextUrl

  const redirectTo = (path: string, keepNext = false) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    if (keepNext) url.searchParams.set('next', pathname + request.nextUrl.search)
    const response = NextResponse.redirect(url)
    // Conservar las cookies de sesión que se hayan refrescado.
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  if (!claims && !isPublic(pathname)) {
    return redirectTo('/login', pathname !== '/')
  }

  if (claims && pathname === '/login') {
    return redirectTo('/')
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const email = typeof claims?.email === 'string' ? claims.email : null
    if (!isAdminEmail(email)) {
      return redirectTo('/')
    }
  }

  return supabaseResponse
}
