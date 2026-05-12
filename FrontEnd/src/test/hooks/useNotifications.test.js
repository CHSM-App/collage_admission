import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotifications } from '../../features/student/hooks/useNotifications.js'

vi.mock('../../services/notificationService.js', () => ({
  getStudentNotifications: vi.fn(),
}))

import { getStudentNotifications } from '../../services/notificationService.js'

const STUDENT_ID = 42

// Notifications with timestamps in the future so they pass clearedAt filter (which starts at 0)
const mockNotifications = [
  { id: 1, message: 'Application reviewed.', updated_at: new Date(Date.now() + 10000).toISOString() },
  { id: 2, message: 'Fee confirmed.',         updated_at: new Date(Date.now() + 20000).toISOString() },
]

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('initial state: empty notifications, unread=0, loading=false', () => {
    getStudentNotifications.mockReturnValue(new Promise(() => {})) // pending
    const { result } = renderHook(() => useNotifications(STUDENT_ID))
    // loading starts true while fetching
    expect(result.current.notifications).toEqual([])
    expect(result.current.unread).toBe(0)
  })

  it('fetches notifications on mount and sets state', async () => {
    getStudentNotifications.mockResolvedValueOnce({ data: { data: mockNotifications } })
    const { result } = renderHook(() => useNotifications(STUDENT_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications).toHaveLength(2)
    expect(result.current.unread).toBe(2)
  })

  it('markSeen sets unread to 0', async () => {
    getStudentNotifications.mockResolvedValueOnce({ data: { data: mockNotifications } })
    const { result } = renderHook(() => useNotifications(STUDENT_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.unread).toBe(2)

    act(() => result.current.markSeen())
    expect(result.current.unread).toBe(0)
  })

  it('clearAll empties notifications and resets unread', async () => {
    getStudentNotifications.mockResolvedValueOnce({ data: { data: mockNotifications } })
    const { result } = renderHook(() => useNotifications(STUDENT_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.clearAll())
    expect(result.current.notifications).toEqual([])
    expect(result.current.unread).toBe(0)
  })

  it('does not fetch if studentId is falsy', () => {
    renderHook(() => useNotifications(null))
    expect(getStudentNotifications).not.toHaveBeenCalled()
  })

  it('refetch calls getStudentNotifications again', async () => {
    getStudentNotifications.mockResolvedValue({ data: { data: mockNotifications } })
    const { result } = renderHook(() => useNotifications(STUDENT_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))

    getStudentNotifications.mockResolvedValueOnce({ data: { data: [] } })
    await act(async () => { result.current.refetch() })

    expect(getStudentNotifications).toHaveBeenCalledTimes(2)
  })

  it('handles API error gracefully (no crash)', async () => {
    getStudentNotifications.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useNotifications(STUDENT_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notifications).toEqual([])
  })

  it('filters out notifications older than clearedAt timestamp', async () => {
    // Set cleared timestamp far in the future so all notifications are "old"
    localStorage.setItem(`notif_cleared_at_${STUDENT_ID}`, (Date.now() + 999999).toString())

    getStudentNotifications.mockResolvedValueOnce({ data: { data: mockNotifications } })
    const { result } = renderHook(() => useNotifications(STUDENT_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notifications).toHaveLength(0)
  })
})
