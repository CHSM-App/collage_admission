import { useEffect, useRef, useState } from 'react'
import api from '../../services/api'

/**
 * One Excel importer -> one button, placed next to the table it fills.
 *
 * The importers answer in newline-delimited JSON: `{ phases }`, then one
 * `{ phase, step }` per stage, then the result. Anything that rejects before
 * the stream opens is still a plain JSON body, so both shapes are handled.
 */
function ndjson(text) {
  const out = []
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue
    try { out.push(JSON.parse(line)) } catch { /* half-received line */ }
  }
  return out
}

/** "3.2s — saving groups 2.1s", for spotting which phase is the slow one. */
function timingLine(d) {
  if (!d.timings?.length) return ''
  const parts = d.timings.filter(t => t.ms >= 100).map(t => `${t.label.toLowerCase()} ${(t.ms / 1000).toFixed(1)}s`)
  return `\n${(d.total_ms / 1000).toFixed(1)}s${parts.length ? ` — ${parts.join(', ')}` : ''}`
}

export default function ImportButton({
  label,                      // shown on the file-picker trigger
  path,                       // POST target, relative to the api base
  accept = '.xls,.xlsx',
  disabled = false,
  title,
  describe,                   // result -> one-line summary
  onDone,
}) {
  const input = useRef(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  // Three stages, each with its own honest measure: bytes while uploading,
  // nothing at all while the server parses the sheet, then real phase counts
  // once it starts writing.
  const [pct, setPct] = useState(0)
  const [secs, setSecs] = useState(0)
  const [step, setStep] = useState(null)   // { label, n, of }

  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    const id = setInterval(() => setSecs(Math.round((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(id)
  }, [busy])

  function pickFile(e) {
    const chosen = e.target.files[0] || null
    e.target.value = ''            // allow re-picking the same file after a fix
    setFile(chosen)
    setResult(null)
  }

  // Same error shape everywhere: { message } or { errors: [{ line, error }] }.
  function showError(d, fallback) {
    const rows = d?.errors ? d.errors.map(x => `Row ${x.line}: ${x.error}`).join('\n') : null
    setResult({
      error: d?.message || d?.error
        || (rows ? `${d.errors.length} row${d.errors.length !== 1 ? 's' : ''} rejected — nothing was imported.` : fallback),
      rows,
    })
  }

  async function runImport() {
    if (!file) return
    setBusy(true); setResult(null); setPct(0); setSecs(0); setStep(null)
    let of = 0
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(path, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setPct(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
        // Progress lines arrive long before the response is complete.
        onDownloadProgress: e => {
          for (const m of ndjson(e.event?.target?.responseText || '')) {
            if (m.phases) of = m.phases
            else if (m.phase) setStep({ label: m.phase, n: m.step, of })
          }
        },
      })
      // A streamed response reaches axios as text, since NDJSON is not JSON.
      const lines = typeof res.data === 'string' ? ndjson(res.data) : [res.data]
      const data = lines[lines.length - 1] || {}
      if (data.status >= 400) { showError(data, 'Import failed'); return }
      // A progress line as the LAST line means the stream died part-way.
      if (data.phase || data.phases) { showError(null, 'The server stopped part-way through the import.'); return }

      setResult({
        ok: (describe ? describe(data) : `${data.inserted} added, ${data.updated} updated.`) + timingLine(data),
        warnings: data.warnings || [],
      })
      setFile(null)              // consumed
      onDone?.(data)
    } catch (err) {
      showError(err.response?.data, err.friendlyMessage || 'Import failed')
    } finally { setBusy(false) }
  }

  return (
    <>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={pickFile} />

      {/* Pick first, then confirm — an import is not something to fire off the
          moment a file is chosen, and the clerk should see which file it is. */}
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy || disabled}
          title={title}
          className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          {label}
        </button>

        {file && (
          <>
            <span className="text-xs text-slate-500 max-w-[11rem] truncate" title={file.name}>{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={busy}
              title="Clear the selected file"
              className="text-slate-400 hover:text-slate-600 px-1 text-sm disabled:opacity-50"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={busy || disabled}
              className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {!busy ? 'Import'
                : pct < 100 ? `Uploading ${pct}%`
                : step ? `${step.label}… ${secs}s`
                : `Reading the sheet… ${secs}s`}
            </button>
          </>
        )}
      </div>

      {busy && (
        <div className="h-1 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
          {/* Upload bytes first, then real server phases. In between the server
              is parsing the sheet and reports nothing, so the bar trickles on
              elapsed time rather than sitting full and looking hung. */}
          <div
            className="h-full bg-slate-800 transition-[width] duration-500"
            style={{ width: `${pct < 100 ? pct
              : step ? Math.round((step.n / step.of) * 100)
              : Math.round(80 * (1 - Math.exp(-secs / 10)))}%` }}
          />
        </div>
      )}

      {result && <ImportResult result={result} onClose={() => setResult(null)} />}
    </>
  )
}

/** Pinned to the corner so a long error list does not push the table down. */
function ImportResult({ result, onClose }) {
  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-md text-xs rounded-xl border p-3 shadow-lg ${
      result.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-800'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-wrap">{result.error || result.ok}</p>
        <button type="button" onClick={onClose} className="text-current opacity-50 hover:opacity-100">✕</button>
      </div>
      {result.rows && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap opacity-80">{result.rows}</pre>}
      {result.warnings?.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-amber-700">
            {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-amber-800">{result.warnings.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}
