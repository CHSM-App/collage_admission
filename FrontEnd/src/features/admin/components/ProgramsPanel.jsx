import { useCallback, useEffect, useState } from 'react'
import {
  getCollegePrograms, setCollegeProgramActive, syncCollegePrograms,
} from '../../../services/adminService.js'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

/**
 * Per-college program visibility.
 *
 * Every college receives its university's whole catalogue on creation — the
 * codes have to match across colleges for coursemaster/groupmaster imports — so
 * tailoring a college to what it actually offers is done by hiding programs
 * here, not by editing codes.
 */
export default function ProgramsPanel({ college }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(null)   // code_no being toggled
  const [syncing, setSyncing] = useState(false)
  const [error, setError]     = useState('')
  const [note, setNote]       = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Bumping the key re-runs the fetch below; the effect owns every setState so
  // none of them happen synchronously during render.
  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    getCollegePrograms(college.id)
      .then(r => { if (!cancelled) setRows(r.data.data || []) })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e, 'Could not load programs.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [college.id, reloadKey])

  async function toggle(row) {
    setBusy(row.code_no); setError(''); setNote('')
    try {
      await setCollegeProgramActive(college.id, row.code_no, !row.is_active)
      setRows(list => list.map(r =>
        r.code_no === row.code_no ? { ...r, is_active: !r.is_active } : r))
    } catch (e) {
      setError(getErrorMessage(e, 'Could not update the program.'))
    } finally { setBusy(null) }
  }

  async function sync() {
    setSyncing(true); setError(''); setNote('')
    try {
      const r = await syncCollegePrograms(college.id)
      setNote(r.data.message)
      if (r.data.data?.added) reload()
    } catch (e) {
      setError(getErrorMessage(e, 'Could not sync programs.'))
    } finally { setSyncing(false) }
  }

  const shown = rows.filter(r => r.is_active).length

  if (loading) return <SkeletonTable rows={5} cols={4} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">Programs</h3>
          <p className="text-xs text-slate-500">
            {college.university_name
              ? <>From <span className="font-medium">{college.university_name}</span>&rsquo;s catalogue — {shown} of {rows.length} shown to this college.</>
              : <>This college has no university assigned, so it cannot receive the shared catalogue.</>}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing || !college.university_id}
          title={college.university_id
            ? 'Add any catalogue programs this college is missing'
            : 'Assign a university first'}
          className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync from catalogue'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {note  && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{note}</p>}

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-slate-500 border border-dashed border-slate-300 rounded-lg">
          No programs yet. {college.university_id ? 'Use “Sync from catalogue”.' : 'Assign a university first.'}
        </p>
      ) : (
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-300">
              <tr>
                <th className="px-3 py-1.5 text-left border-r border-slate-200">Code</th>
                <th className="px-3 py-1.5 text-left border-r border-slate-200">Name</th>
                <th className="px-3 py-1.5 text-center border-r border-slate-200" title="The university's own faculty number — groupmaster.xls resolves against this">Univ. No</th>
                <th className="px-3 py-1.5 text-center border-r border-slate-200">Yrs</th>
                <th className="px-3 py-1.5 text-center border-r border-slate-200">In use</th>
                <th className="px-3 py-1.5 text-center">Shown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(r => {
                // Hiding a program with data attached is allowed but worth
                // warning about: its courses, groups and applications stay.
                const inUse = r.course_count + r.group_count + r.application_count
                return (
                  <tr key={r.code_no} className={r.is_active ? 'hover:bg-blue-50 transition' : 'bg-slate-50/60 text-slate-400'}>
                    <td className="px-3 py-1.5 font-mono font-semibold border-r border-slate-200">{r.degree_course_code}</td>
                    <td className="px-3 py-1.5 border-r border-slate-200">{r.degree_course_name}</td>
                    <td className="px-3 py-1.5 text-center border-r border-slate-200">
                      {r.university_faculty_no ?? (
                        <span className="text-amber-600 font-semibold" title="Needed to import groupmaster.xls">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center border-r border-slate-200">{r.duration_years}</td>
                    <td className="px-3 py-1.5 text-center text-xs border-r border-slate-200">
                      {inUse === 0 ? <span className="text-slate-400">—</span> : (
                        <span title={`${r.course_count} courses · ${r.group_count} groups · ${r.application_count} applications`}>
                          {r.course_count}c / {r.group_count}g / {r.application_count}a
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => toggle(r)}
                        disabled={busy === r.code_no}
                        title={r.is_active ? 'Hide this program from the college' : 'Show this program to the college'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold transition disabled:opacity-50 ${
                          r.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-slate-200 hover:text-slate-600'
                            : 'bg-slate-200 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {busy === r.code_no ? '…' : r.is_active ? 'Shown' : 'Hidden'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Hiding removes the program from the college&rsquo;s own Program Master and from new admissions.
        Existing courses, groups and applications are kept — nothing is deleted.
      </p>
    </div>
  )
}
