/**
 * Resultado estándar de las Server Actions de formularios (useActionState).
 * `fields`: React 19 resetea el formulario al terminar cada envío, aunque haya error.
 * Devolvemos lo que se cargó para usarlo como defaultValue y no hacerle perder lo escrito.
 */
export type ActionState = { status: 'idle' | 'ok' | 'error'; message?: string; fields?: Record<string, string> }

export const IDLE: ActionState = { status: 'idle' }

/** Error de validación conservando lo que el usuario escribió. */
export function fail(message: string, formData?: FormData): ActionState {
  return { status: 'error', message, fields: formData ? formFields(formData) : undefined }
}

export function formFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (typeof value === 'string' && !key.startsWith('$')) fields[key] = value
  })
  return fields
}

/**
 * Las funciones de la base tiran el error con un código estable en `message`
 * (ej. INVALID_TRANSITION) y el texto en español en `hint`. Mostramos el hint;
 * si no es uno de nuestros códigos (error inesperado de Postgres/PostgREST, cuyo hint puede
 * traer detalles técnicos en inglés), un mensaje genérico, sin filtrar detalles internos.
 */
export function dbErrorMessage(error: { message?: string; hint?: string | null } | null): string {
  if (error?.hint && /^[A-Z][A-Z_]+$/.test(error.message ?? '')) return error.hint
  return 'No se pudo completar la operación. Probá de nuevo.'
}
