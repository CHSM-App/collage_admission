import { useEffect, useRef, useState } from 'react'
import api from '../../../services/api.js'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { SkeletonCards } from '../../../shared/components/Skeleton.jsx'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/').replace(/\/$/, '')

// ── Photo validation ─────────────────────────────────────────
// Returns { ok: true } or { ok: false, reason: string }
async function validatePhoto(file) {
  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: 'Photo must be an image file (JPG, PNG).' }
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, reason: 'Photo must be under 2 MB.' }
  }

  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight

      // Min resolution: at least 200×200
      if (w < 200 || h < 200) {
        return resolve({ ok: false, reason: 'Photo resolution is too low. Minimum 200×200 px required.' })
      }

      // Aspect ratio: must be portrait or square (height >= width, allow up to 1.5 landscape slack)
      const ratio = w / h
      if (ratio > 1.2) {
        return resolve({ ok: false, reason: 'Photo must be portrait or square (not landscape/wide). Use a passport-size photo.' })
      }

      // ── Face detection ──────────────────────────────────────
      // Use browser FaceDetector API if available, else canvas heuristic
      if ('FaceDetector' in window) {
        try {
          const fd      = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 5 })
          const bitmap  = await createImageBitmap(file)
          const faces   = await fd.detect(bitmap)
          bitmap.close()

          if (faces.length === 0) {
            return resolve({ ok: false, reason: 'No face detected. Please upload a clear front-facing passport-size photo.' })
          }
          if (faces.length > 1) {
            return resolve({ ok: false, reason: 'Multiple faces detected. The photo must show only one person.' })
          }

          // Face should occupy at least 15% of image area (not too far away)
          const face      = faces[0].boundingBox
          const faceArea  = face.width * face.height
          const imgArea   = w * h
          if (faceArea / imgArea < 0.10) {
            return resolve({ ok: false, reason: 'Face is too small or too far. Please use a close-up passport-size photo.' })
          }

          // Face should be roughly centred horizontally (not a side profile selfie)
          const faceCentreX = face.x + face.width / 2
          const leftBound   = w * 0.25
          const rightBound  = w * 0.75
          if (faceCentreX < leftBound || faceCentreX > rightBound) {
            return resolve({ ok: false, reason: 'Face is not centred. Please use a front-facing photo, not a side profile.' })
          }

          return resolve({ ok: true })
        } catch {
          // FaceDetector threw — fall through to canvas check
        }
      }

      // ── Canvas brightness heuristic (fallback) ──────────────
      // Passport photos typically have a light/white background.
      // We sample corner pixels — if they are all dark, it's likely a selfie in poor lighting.
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      // Sample 4 corners (10×10 px each) — background should be light (>180 avg brightness)
      const sampleSize = Math.min(30, Math.floor(w * 0.08))
      const corners = [
        ctx.getImageData(0,           0,           sampleSize, sampleSize),
        ctx.getImageData(w-sampleSize, 0,           sampleSize, sampleSize),
        ctx.getImageData(0,           h-sampleSize, sampleSize, sampleSize),
        ctx.getImageData(w-sampleSize, h-sampleSize,sampleSize, sampleSize),
      ]

      const avgBrightness = corners.map(d => {
        let sum = 0
        for (let i = 0; i < d.data.length; i += 4) {
          sum += (d.data[i] * 0.299 + d.data[i+1] * 0.587 + d.data[i+2] * 0.114)
        }
        return sum / (d.data.length / 4)
      })

      const cornersAvg = avgBrightness.reduce((a, b) => a + b, 0) / 4
      if (cornersAvg < 140) {
        return resolve({
          ok: false,
          reason: 'Photo background appears dark. Passport photos require a plain white or light background. Selfies are not accepted.',
        })
      }

      resolve({ ok: true })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ ok: false, reason: 'Could not read image file.' })
    }
    img.src = url
  })
}

// ── Is this document type a "Photo" ─────────────────────────
function isPhotoType(name) {
  return /photo|photograph|picture/i.test(name)
}

export default function StudentDocuments() {
  const { user } = useAuthContext()
  const [docTypes, setDocTypes]   = useState([])
  const [uploaded, setUploaded]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [previewDoc, setPreviewDoc] = useState(null)  // doc object to preview

  function fetchData() {
    Promise.all([
      api.get('document-types'),
      api.get(`student-documents?student_id=${user.id}`),
    ])
      .then(([dtRes, sdRes]) => {
        setDocTypes(dtRes.data.data || [])
        setUploaded(sdRes.data.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [user.id])

  const uploadedMap = Object.fromEntries(uploaded.map(d => [d.document_type_id, d]))

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950">My Documents</h1>
        <p className="mt-1 max-w-xl text-slate-600">
          Documents uploaded here are reused across all your applications. Upload once, use everywhere.
          Documents linked to active applications cannot be removed.
        </p>
      </div>

      {loading && <SkeletonCards count={4} />}

      {previewDoc && (
        <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {!loading && (
        <div className="space-y-3">
          {docTypes.map(dt => {
            const existing = uploadedMap[dt.id]
            const isPhoto  = isPhotoType(dt.name)
            return (
              <div key={dt.id} className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / icon */}
                    {existing ? (
                      existing.file_name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                        <button onClick={() => setPreviewDoc(existing)} className="shrink-0">
                          <img
                            src={`${API_BASE}${existing.file_path}`}
                            alt={dt.name}
                            className="h-14 w-10 object-cover rounded border border-slate-200 hover:opacity-80 transition"
                          />
                        </button>
                      ) : (
                        <a
                          href={`${API_BASE}${existing.file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 flex h-14 w-10 items-center justify-center rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition"
                        >
                          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                          </svg>
                        </a>
                      )
                    ) : (
                      <div className="shrink-0 h-14 w-10 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-950">{dt.name}</p>
                        {isPhoto && (
                          <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                            Photo validation
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{dt.description}</p>
                      {existing && (
                        <p className="mt-1 text-xs text-emerald-600 font-medium">
                          {existing.file_name} · {new Date(existing.uploaded_at).toLocaleDateString('en-IN')}
                        </p>
                      )}
                      {existing?.is_locked ? (
                        <p className="mt-0.5 text-xs text-amber-600 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                          Locked — used in active application
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                    {existing && (
                      <>
                        <a
                          href={`${API_BASE}${existing.file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          View
                        </a>
                        {!existing.is_locked && (
                          <DeleteButton docId={existing.id} onSuccess={fetchData} />
                        )}
                      </>
                    )}
                    <UploadButton
                      documentTypeId={dt.id}
                      documentName={dt.name}
                      studentId={user.id}
                      isPhoto={isPhoto}
                      isLocked={!!existing?.is_locked}
                      onSuccess={fetchData}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Upload button with real FormData upload ──────────────────
function UploadButton({ documentTypeId, documentName, studentId, isPhoto, isLocked, onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const inputRef = useRef(null)

  async function handleChange(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setError('')

    // Photo-specific validation
    if (isPhoto) {
      setUploading(true)
      const result = await validatePhoto(file)
      if (!result.ok) {
        setUploading(false)
        setError(result.reason)
        return
      }
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('student_id', studentId)
    fd.append('document_type_id', documentTypeId)

    try {
      await api.post(`student-documents?student_id=${studentId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onSuccess()
    } catch (err) {
      setError(err?.response?.data?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  if (isLocked) {
    return (
      <span className="text-xs text-slate-400 italic">Locked</span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
        uploading
          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
      }`}>
        {uploading ? 'Validating…' : 'Upload'}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={isPhoto ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}
          disabled={uploading}
          onChange={handleChange}
        />
      </label>
      {error && (
        <p className="text-xs text-red-600 max-w-xs text-right leading-tight">{error}</p>
      )}
    </div>
  )
}

// ── Delete button ────────────────────────────────────────────
function DeleteButton({ docId, onSuccess }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState('')

  async function handleDelete() {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`student-documents/${docId}`)
      onSuccess()
    } catch (err) {
      setError(err?.response?.data?.message || 'Delete failed.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  )
}

// ── Image preview modal ──────────────────────────────────────
function DocPreviewModal({ doc, onClose }) {
  const fileUrl = `${API_BASE}${doc.file_path}`
  const isPdf   = doc.file_name?.toLowerCase().endsWith('.pdf')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxWidth: isPdf ? '900px' : '600px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <p className="font-semibold text-slate-900 text-sm">{doc.document_name || doc.file_name}</p>
          <div className="flex items-center gap-3">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Open in new tab
            </a>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50">
          {isPdf ? (
            <iframe
              src={fileUrl}
              title={doc.file_name}
              className="w-full h-full border-0"
              style={{ minHeight: '75vh' }}
            />
          ) : (
            <div className="flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={doc.file_name}
                className="max-w-full max-h-[75vh] object-contain rounded shadow"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
