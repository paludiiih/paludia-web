// Configuración central del inicio de sesión.
export const AUTH = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "on",
  minPassword: 8
};

// Solo se permite volver a páginas internas (evita redirecciones a sitios ajenos).
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

// Traduce los errores de Supabase a mensajes claros en español.
export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined) {
  if (!error) return "";
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "El correo o la contraseña no son correctos.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "Todavía no confirmaste tu correo. Revisá tu bandeja de entrada (y la de spam) y tocá el enlace que te enviamos.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "Ya existe una cuenta con ese correo. Probá ingresar o recuperar la contraseña.";
  if (code === "weak_password" || msg.includes("password should")) return `La contraseña es muy débil. Usá al menos ${AUTH.minPassword} caracteres, combinando letras y números.`;
  if (code === "same_password") return "La contraseña nueva tiene que ser distinta de la anterior.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) return "Hiciste demasiados intentos seguidos. Esperá unos minutos y volvé a probar.";
  if (code === "email_address_invalid" || msg.includes("invalid email") || msg.includes("unable to validate email")) return "Ese correo no parece válido. Revisalo.";
  if (code === "provider_disabled" || msg.includes("provider is not enabled")) return "Ese método de inicio de sesión todavía no está activado.";
  if (code === "otp_expired" || msg.includes("expired")) return "El enlace venció o ya se usó. Pedí uno nuevo.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "No hay conexión con el servidor. Revisá tu internet y volvé a intentar.";
  return "Algo salió mal. Volvé a intentar en un momento.";
}
