export function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  if (normalized.includes('email rate limit')) {
    return 'Supabase bloqueó temporalmente los correos de registro. Intenta más tarde o avisa al administrador para crear tu cuenta.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos. Si acabas de registrarte, confirma tu correo o pide al administrador revisar tu cuenta.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Tu correo aún no está confirmado. Revisa tu email o pide al administrador confirmar tu cuenta.'
  }

  if (normalized.includes('already registered')) {
    return 'Ese correo ya está registrado. Entra desde Login o recupera tu contraseña.'
  }

  if (normalized.includes('failed to fetch')) {
    return 'No pudimos conectar con Supabase. Revisa tu conexión o la configuración del proyecto.'
  }

  return message
}
