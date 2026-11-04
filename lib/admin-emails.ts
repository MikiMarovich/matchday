/**
 * Emails de los administradores, desde la variable de servidor ADMIN_EMAIL.
 * Admite varios separados por coma: "uno@gmail.com, otro@gmail.com".
 * Primera capa de autorización; la segunda es public.is_admin() contra public.admins.
 * Los dos lugares tienen que tener los mismos emails.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase())
}
