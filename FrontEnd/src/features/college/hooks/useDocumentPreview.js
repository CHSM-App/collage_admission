/**
 * useDocumentPreview — fetches a document as a blob URL for inline preview.
 *
 * Returns { blobUrl, loadErr } for a given file path + MIME type.
 * Automatically revokes the blob URL on cleanup.
 */
import { useEffect, useState } from 'react'
import { getDocumentFile } from '../../../services/documentService.js'

const EXT_MIME = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export function getMimeType(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || ''
  return EXT_MIME[ext] || 'application/octet-stream'
}

export function useDocumentPreview(filePath, fileName) {
  const mime = getMimeType(fileName)
  const [blobUrl, setBlobUrl] = useState(null)
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    if (!filePath) return
    let url
    getDocumentFile(filePath)
      .then(res => {
        url = URL.createObjectURL(new Blob([res.data], { type: mime }))
        setBlobUrl(url)
      })
      .catch(() => setLoadErr('Failed to load document.'))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [filePath, mime])

  return { blobUrl, loadErr, mime, isPdf: mime === 'application/pdf' }
}
