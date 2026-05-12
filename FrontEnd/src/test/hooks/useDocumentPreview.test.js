import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDocumentPreview, getMimeType } from '../../features/college/hooks/useDocumentPreview.js'

vi.mock('../../services/documentService.js', () => ({
  getDocumentFile: vi.fn(),
}))

import { getDocumentFile } from '../../services/documentService.js'

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockObjectUrl = 'blob:http://localhost/test-blob'
global.URL.createObjectURL = vi.fn(() => mockObjectUrl)
global.URL.revokeObjectURL = vi.fn()

describe('getMimeType', () => {
  it('returns application/pdf for .pdf', () => {
    expect(getMimeType('document.pdf')).toBe('application/pdf')
  })

  it('returns image/jpeg for .jpg', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg')
  })

  it('returns image/jpeg for .jpeg', () => {
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg')
  })

  it('returns image/png for .png', () => {
    expect(getMimeType('photo.png')).toBe('image/png')
  })

  it('returns image/webp for .webp', () => {
    expect(getMimeType('photo.webp')).toBe('image/webp')
  })

  it('returns application/octet-stream for unknown extensions', () => {
    expect(getMimeType('archive.zip')).toBe('application/octet-stream')
  })

  it('returns application/octet-stream for no extension', () => {
    expect(getMimeType('noextension')).toBe('application/octet-stream')
  })

  it('handles null/undefined gracefully', () => {
    expect(getMimeType(null)).toBe('application/octet-stream')
    expect(getMimeType(undefined)).toBe('application/octet-stream')
  })
})

describe('useDocumentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initial state: blobUrl=null, loadErr=empty', () => {
    getDocumentFile.mockReturnValue(new Promise(() => {})) // pending
    const { result } = renderHook(() => useDocumentPreview('uploads/test.pdf', 'test.pdf'))
    expect(result.current.blobUrl).toBeNull()
    expect(result.current.loadErr).toBe('')
  })

  it('sets blobUrl after successful fetch', async () => {
    const fakeData = new Uint8Array([1, 2, 3])
    getDocumentFile.mockResolvedValueOnce({ data: fakeData })

    const { result } = renderHook(() => useDocumentPreview('uploads/test.pdf', 'test.pdf'))

    await waitFor(() => expect(result.current.blobUrl).toBe(mockObjectUrl))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('sets loadErr on fetch failure', async () => {
    getDocumentFile.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDocumentPreview('uploads/test.pdf', 'test.pdf'))

    await waitFor(() => expect(result.current.loadErr).toBe('Failed to load document.'))
  })

  it('does not fetch when filePath is empty', () => {
    renderHook(() => useDocumentPreview('', 'test.pdf'))
    expect(getDocumentFile).not.toHaveBeenCalled()
  })

  it('does not fetch when filePath is null/undefined', () => {
    renderHook(() => useDocumentPreview(null, 'test.pdf'))
    expect(getDocumentFile).not.toHaveBeenCalled()
  })

  it('returns correct mime and isPdf for pdf', async () => {
    getDocumentFile.mockResolvedValueOnce({ data: new Uint8Array([]) })
    const { result } = renderHook(() => useDocumentPreview('uploads/doc.pdf', 'doc.pdf'))
    expect(result.current.mime).toBe('application/pdf')
    expect(result.current.isPdf).toBe(true)
  })

  it('returns isPdf=false for non-pdf file', async () => {
    getDocumentFile.mockResolvedValueOnce({ data: new Uint8Array([]) })
    const { result } = renderHook(() => useDocumentPreview('uploads/photo.jpg', 'photo.jpg'))
    expect(result.current.isPdf).toBe(false)
    expect(result.current.mime).toBe('image/jpeg')
  })

  it('revokes blob URL on unmount', async () => {
    getDocumentFile.mockResolvedValueOnce({ data: new Uint8Array([1]) })
    const { result, unmount } = renderHook(() => useDocumentPreview('uploads/test.pdf', 'test.pdf'))

    await waitFor(() => expect(result.current.blobUrl).toBe(mockObjectUrl))

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })
})
