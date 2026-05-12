import { describe, it, expect } from 'vitest'
import {
  validatePassword,
  validatePhone,
  formatPhone,
} from '../../shared/hooks/usePasswordValidation.js'

describe('validatePassword', () => {
  it('returns error when password is too short', () => {
    expect(validatePassword('Ab1!')).toBe('Password must be at least 8 characters.')
  })

  it('returns error when no uppercase letter', () => {
    expect(validatePassword('abcdef1!')).toBe('Password must contain at least one uppercase letter.')
  })

  it('returns error when no lowercase letter', () => {
    expect(validatePassword('ABCDEF1!')).toBe('Password must contain at least one lowercase letter.')
  })

  it('returns error when no number', () => {
    expect(validatePassword('Abcdefg!')).toBe('Password must contain at least one number.')
  })

  it('returns error when no special character', () => {
    expect(validatePassword('Abcdefg1')).toBe('Password must contain at least one special character.')
  })

  it('returns null for a valid password', () => {
    expect(validatePassword('Abcdef1!')).toBeNull()
  })

  it('returns error for empty password', () => {
    expect(validatePassword('')).toBe('Password must be at least 8 characters.')
  })

  it('returns error for null/undefined', () => {
    expect(validatePassword(null)).toBe('Password must be at least 8 characters.')
    expect(validatePassword(undefined)).toBe('Password must be at least 8 characters.')
  })
})

describe('validatePhone', () => {
  it('returns null for valid phone starting with 9', () => {
    expect(validatePhone('9876543210')).toBeNull()
  })

  it('returns null for valid phone starting with 6', () => {
    expect(validatePhone('6123456789')).toBeNull()
  })

  it('returns error for phone starting with 5', () => {
    expect(validatePhone('5123456789')).toBe('Phone number must be 10 digits starting with 6–9.')
  })

  it('returns error for phone with fewer than 10 digits', () => {
    expect(validatePhone('987654321')).toBe('Phone number must be 10 digits starting with 6–9.')
  })

  it('returns error for phone with letters', () => {
    expect(validatePhone('98765abcde')).toBe('Phone number must be 10 digits starting with 6–9.')
  })

  it('handles phone with leading/trailing spaces', () => {
    expect(validatePhone('  9876543210  ')).toBeNull()
  })
})

describe('formatPhone', () => {
  it('strips non-digit characters', () => {
    expect(formatPhone('98-765-4321-0')).toBe('9876543210')
  })

  it('truncates to 10 digits', () => {
    expect(formatPhone('98765432109999')).toBe('9876543210')
  })

  it('returns empty string for empty input', () => {
    expect(formatPhone('')).toBe('')
  })

  it('strips all letters', () => {
    expect(formatPhone('abc9876543210xyz')).toBe('9876543210')
  })
})
