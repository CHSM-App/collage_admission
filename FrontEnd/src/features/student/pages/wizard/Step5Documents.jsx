import { useState, useEffect } from 'react'
import api from '../../../../services/api.js'
import { StepHeader, StepFooter } from './Step1Context.jsx'

const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_EXTS  = ['pdf', 'jpg', 'jpeg', 'png']

export default function Step5Documents({
  data, errors, globalError, saving, appId, studentId,
  onBack, onNext, onDocumentsChange, extraFooter, readOnly,
}) {
  const required = data.required_documents || []
  const linked   = data.linked_documents   || []
  const existing = data.student_documents  || []

  const [uploading, setUploading] = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [previewDoc, setPreviewDoc] = useState(null)  // { file_name, file_path }

  // Map of linked docs: { [document_type_id]: docObj }
  const linkedMap   = Object.fromEntries(linked.map(d => [d.document_type_id, d]))
  // Map of latest existing student doc per type
  const existingMap = Object.fromEntries(existing.map(d => [d.document_type_id, d]))

  function setUploadError(dtId, msg) {
    setFileErrors(f => ({ ...f, [dtId]: msg }))
  }
  function clearUploadError(dtId) {
    setFileErrors(f => ({ ...f, [dtId]: '' }))
  }

  async function refreshLinked() {
    try {
      const res = await api.get(`api/applications/${appId}/form`)
      const formData = res.data.data
      // Pass back both linked docs and refreshed student docs list
      onDocumentsChange(formData.documents || [], formData.student_documents || [])
    } catch {}
  }

  async function linkExisting(dtId) {
    const sd = existingMap[dtId]
    if (!sd) return
    setUploading(u => ({ ...u, [dtId]: true }))
    clearUploadError(dtId)
    try {
      await api.post(`api/applications/${appId}/form-documents`, {
        student_id:       studentId,
        document_type_id: dtId,
        file_name:        sd.file_name,
        file_path:        sd.file_path,
      })
      refreshLinked()
    } catch (err) {
      setUploadError(dtId, err?.response?.data?.message || 'Failed to link document.')
    } finally {
      setUploading(u => ({ ...u, [dtId]: false }))
    }
  }

  async function handleUpload(dtId, file) {
    clearUploadError(dtId)

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return setUploadError(dtId, `File too large. Max ${MAX_SIZE_MB}MB allowed.`)
    }
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      return setUploadError(dtId, 'Only PDF, JPG, JPEG and PNG files are allowed.')
    }
    if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
      return setUploadError(dtId, 'Invalid file type. Only PDF, JPG and PNG are allowed.')
    }

    setUploading(u => ({ ...u, [dtId]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type_id', dtId)
      const uploadRes = await api.post(
        `student-documents?student_id=${studentId}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      const { file_path, file_name } = uploadRes.data.data

      await api.post(`api/applications/${appId}/form-documents`, {
        student_id:       studentId,
        document_type_id: dtId,
        file_name,
        file_path,
      })
      refreshLinked()
    } catch (err) {
      setUploadError(dtId, err?.response?.data?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(u => ({ ...u, [dtId]: false }))
    }
  }

  async function removeDoc(dtId) {
    clearUploadError(dtId)
    setUploading(u => ({ ...u, [dtId]: true }))
    try {
      await api.delete(`api/applications/${appId}/form-documents/${dtId}`)
      refreshLinked()
    } catch (err) {
      setUploadError(dtId, err?.response?.data?.message || 'Remove failed.')
    } finally {
      setUploading(u => ({ ...u, [dtId]: false }))
    }
  }

  const missingMandatory = required
    .filter(rd => rd.is_mandatory && !linkedMap[rd.document_type_id])
    .map(rd => rd.document_name)

  function handleNext() {
    if (missingMandatory.length > 0) return
    onNext()
  }

  return (
    <div>
      <StepHeader
        step={5}
        title="Document Upload"
        desc="Upload required documents. Previously uploaded files can be reused."
      />

      <div className="px-4 sm:px-5 py-5 space-y-4">
        {required.length === 0 && (
          <p className="text-sm text-slate-500">No documents required for this application.</p>
        )}

        {required.map(rd => {
          const dtId    = rd.document_type_id
          const linked_ = linkedMap[dtId]
          const exist_  = existingMap[dtId]
          const isUpl   = uploading[dtId]
          const ferr    = fileErrors[dtId]

          return (
            <div key={dtId} className={`rounded-xl border p-4 transition ${
              linked_ ? 'border-emerald-200 bg-emerald-50' :
              rd.is_mandatory ? 'border-red-100 bg-red-50/40' :
              'border-slate-200 bg-white'
            }`}>
              {/* Title row */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-slate-900">{rd.document_name}</p>
                    {rd.is_mandatory
                      ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">Required</span>
                      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Optional</span>
                    }
                    {linked_ && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ Uploaded</span>}
                  </div>
                  {rd.description && <p className="mt-0.5 text-xs text-slate-400">{rd.description}</p>}
                </div>

                {/* Remove */}
                {linked_ && !readOnly && (
                  <button
                    onClick={() => removeDoc(dtId)}
                    disabled={isUpl}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 shrink-0"
                  >
                    {isUpl ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>

              {/* Linked file info + preview */}
              {linked_ && (
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-xs text-emerald-700 font-medium truncate flex-1">
                    📄 {linked_.file_name}
                    {linked_.uploaded_at && ` · ${new Date(linked_.uploaded_at).toLocaleDateString('en-IN')}`}
                  </p>
                  <button
                    onClick={() => setPreviewDoc(linked_)}
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Preview
                  </button>
                </div>
              )}

              {/* Actions when not yet linked */}
              {!linked_ && !readOnly && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {exist_ && (
                    <button
                      onClick={() => linkExisting(dtId)}
                      disabled={isUpl}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                    >
                      {isUpl ? 'Linking…' : `Use existing: ${exist_.file_name}`}
                    </button>
                  )}
                  <label className={`flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition
                    ${isUpl ? 'opacity-50 pointer-events-none' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                      <path d="M8 2v8M4 6l4-4 4 4M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {isUpl ? 'Uploading…' : (exist_ ? 'Upload new version' : 'Upload file')}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => { if (e.target.files[0]) handleUpload(dtId, e.target.files[0]); e.target.value = '' }}
                    />
                  </label>
                </div>
              )}

              {/* Replace when already linked */}
              {linked_ && !readOnly && (
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                    <path d="M8 2v8M4 6l4-4 4 4M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {isUpl ? 'Uploading…' : 'Replace'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={isUpl}
                    onChange={e => { if (e.target.files[0]) handleUpload(dtId, e.target.files[0]); e.target.value = '' }}
                  />
                </label>
              )}

              {ferr && <p className="mt-1.5 text-xs font-medium text-red-600">{ferr}</p>}
              <p className="mt-1 text-xs text-slate-400">PDF, JPG or PNG · Max 5MB</p>
            </div>
          )
        })}

        {missingMandatory.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Required before proceeding:</strong> {missingMandatory.join(', ')}
          </div>
        )}

        {globalError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</p>
        )}

        <StepFooter
          onBack={onBack}
          onNext={handleNext}
          saving={saving}
          disabled={missingMandatory.length > 0}
          nextLabel={missingMandatory.length > 0 ? `${missingMandatory.length} required doc(s) missing` : 'Save & Continue'}
          extraFooter={extraFooter}
          readOnly={readOnly}
        />
      </div>

      {previewDoc && (
        <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  )
}

const EXT_MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

function mimeFromFilename(filename) {
  const ext = filename?.split('.').pop().toLowerCase()
  return EXT_MIME[ext] || 'application/octet-stream'
}

function DocPreviewModal({ doc, onClose }) {
  const mime  = mimeFromFilename(doc.file_name)
  const isPdf = mime === 'application/pdf'
  const [blobUrl, setBlobUrl] = useState(null)
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    let url
    api.get(doc.file_path, { responseType: 'blob' })
      .then(res => {
        url = URL.createObjectURL(new Blob([res.data], { type: mime }))
        setBlobUrl(url)
      })
      .catch(() => setLoadErr('Failed to load document.'))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [doc.file_path])

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = doc.file_name
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`relative bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden w-full ${isPdf ? 'max-w-3xl h-[90vh]' : 'max-w-lg'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{doc.document_name || doc.file_name}</p>
            <p className="text-xs text-slate-400 truncate">{doc.file_name}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            {blobUrl && (
              <button onClick={handleDownload} className="text-xs font-semibold text-blue-600 hover:underline">
                Download
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-100 p-2">
          {loadErr ? (
            <p className="text-sm text-red-500">{loadErr}</p>
          ) : !blobUrl ? (
            <p className="text-sm text-slate-400 animate-pulse">Loading…</p>
          ) : isPdf ? (
            <iframe
              src={blobUrl}
              title={doc.file_name}
              className="w-full h-full border-0 rounded"
              style={{ minHeight: '75vh' }}
            />
          ) : (
            <img
              src={blobUrl}
              alt={doc.file_name}
              className="max-w-full max-h-[75vh] object-contain rounded shadow"
            />
          )}
        </div>
      </div>
    </div>
  )
}
