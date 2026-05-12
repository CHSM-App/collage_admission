import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { useAuth } from '../../features/auth/hooks/useAuth.js'

vi.mock('../../features/auth/services/authService.js', () => ({
  authService: {
    loginByRole: vi.fn(),
  },
}))

import { authService } from '../../features/auth/services/authService.js'

function wrapper({ children }) {
  return React.createElement(
    MemoryRouter,
    { initialEntries: ['/'] },
    React.createElement(AuthProvider, null, children)
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('initial state has loading=false, error=empty', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('')
  })

  it('login sets loading, calls authService.loginByRole and saves session', async () => {
    const mockSession = {
      user: { id: 1, email: 'student@test.com' },
      role: 'student',
      token: 'tok-student',
    }
    authService.loginByRole.mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('student', { phone: '9876543210', password: 'Test@1234' })
    })

    expect(authService.loginByRole).toHaveBeenCalledWith('student', {
      phone: '9876543210',
      password: 'Test@1234',
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('')
  })

  it('login sets error on failure', async () => {
    authService.loginByRole.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials.' } },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('student', { phone: '9876543210', password: 'wrong' })
    })

    expect(result.current.error).toBe('Invalid credentials.')
    expect(result.current.loading).toBe(false)
  })

  it('clearError clears the error state', async () => {
    authService.loginByRole.mockRejectedValueOnce({
      response: { data: { message: 'Bad credentials' } },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('student', { phone: '9876543210', password: 'wrong' })
    })

    expect(result.current.error).toBe('Bad credentials')

    act(() => result.current.clearError())
    expect(result.current.error).toBe('')
  })

  it('login returns null on error', async () => {
    authService.loginByRole.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    let returnValue
    await act(async () => {
      returnValue = await result.current.login('student', { phone: '9876543210', password: 'bad' })
    })

    expect(returnValue).toBeNull()
  })

  it('login returns session on success', async () => {
    const mockSession = { user: { id: 1 }, role: 'student', token: 'tok' }
    authService.loginByRole.mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })

    let returnValue
    await act(async () => {
      returnValue = await result.current.login('student', { phone: '9876543210', password: 'Test@1234' })
    })

    expect(returnValue).toEqual(mockSession)
  })
})
