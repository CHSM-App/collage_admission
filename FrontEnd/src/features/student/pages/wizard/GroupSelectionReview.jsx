import { useEffect, useState } from 'react'
import { getApplicationGroups } from '../../../../services/applicationService.js'

/**
 * The subject group chosen for each semester, for the review steps.
 *
 * Selections are not part of the wizard's form state — Step6Groups saves them
 * straight to the server — so this fetches them itself, and both the student and
 * college reviews render it rather than each wizard carrying its own copy.
 *
 * Renders nothing when the course defines no groups, which is also when the
 * group step itself is skipped.
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

  if (!rows.length) return null

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Subject Group</p>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
        )}
      </div>
      <div className="px-4 py-3 space-y-1.5">
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
