import { useEffect, useState } from 'react'
import { getApplicationGroups } from '../../../../services/applicationService.js'

/**
 * The subject group chosen for each semester, for the review steps.
 *
 * Selections are not part of the wizard's form state — Step6Groups saves them
 * straight to the server — so this fetches them itself, and both the student and
 * college reviews render it rather than each wizard carrying its own copy.
 *
 * Always shown on the review, flagged "Not filled" when no group is chosen yet.
 */
export default function GroupSelectionReview({ appId, onEdit }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!appId || appId === 'new') return
    let cancelled = false
    getApplicationGroups(appId)
      .then(r => { if (!cancelled) setRows(r.data.data?.selections || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [appId])

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Subject Group</p>
          {!rows.length && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">Not filled</span>
          )}
        </div>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
        )}
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {!rows.length && <p className="text-sm text-slate-400 italic">No subject group selected yet.</p>}
        {rows.map(r => (
          <div key={r.semester} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="w-24 shrink-0 text-slate-400">Semester {r.semester}:</span>
            <span className="font-mono text-xs text-slate-500">{r.group_code}</span>
            <span className="font-medium text-slate-800">{r.group_description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
