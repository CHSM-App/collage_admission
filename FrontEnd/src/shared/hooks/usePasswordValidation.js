/**
 * usePasswordValidation — shared validation helpers for password and phone.
 * Exported as both standalone functions and a hook (for future extensions).
 */

export function validatePassword(pwd) {
  if (!pwd || pwd.length < 8)        return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pwd))            return 'Password must contain at least one uppercase letter.'
  if (!/[a-z]/.test(pwd))            return 'Password must contain at least one lowercase letter.'
  if (!/[0-9]/.test(pwd))            return 'Password must contain at least one number.'
  if (!/[^A-Za-z0-9]/.test(pwd))     return 'Password must contain at least one special character.'
  return null
}

export function validatePhone(phone) {
  if (!/^[6-9]\d{9}$/.test(phone.trim())) {
    return 'Phone number must be 10 digits starting with 6–9.'
  }
  return null
}

export function formatPhone(value) {
  return value.replace(/\D/g, '').slice(0, 10)
}
