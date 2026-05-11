import { useEffect, useState, useCallback } from 'react'
import api from '../../../../services/api.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'

const YEAR_LEVEL_LABELS = ['FY', 'SY', 'TY', '4Y', '5Y']
const DIVISIONS    = ['A','B','C','D','E','F','G','H','I','J']
const FUNDING_OPTS = ['Granted','NonGranted','Both']

function yearLevelsFor(durationYears) {
  const n = Math.max(1, Math.min(5, parseInt(durationYears) || 3))
  return YEAR_LEVEL_LABELS.slice(0, n)
}

export default function DivisionMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const [faculty, setFaculty]       = useState([])
  const [selFaculty, setSelFaculty] = useState('')
  const [selYear, setSelYear]       = useState('FY')
  const [grid, setGrid]             = useState(Object.fromEntries(DIVISIONS.map(d => [d, null])))
  const [classYearCode, setClassYearCode] = useState('')
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    api.get(`masters/${collegeId}/faculty`)
      .then(r => {
        const active = (r.data.data || []).filter(f => f.is_active)
        setFaculty(active)
        if (active.length) setSelFaculty(active[0].code_no)
      })
  }, [collegeId])

  useEffect(() => {
    const f = faculty.find(f => f.code_no == selFaculty)
    if (f) setClassYearCode(`${selYear}${f.degree_course_code}`)
  }, [selFaculty, selYear, faculty])

  const loadGrid = useCallback(() => {
    if (!selFaculty) return
    setLoading(true)
    api.get(`masters/${collegeId}/division?faculty_id=${selFaculty}&year_level=${selYear}`)
      .then(r => {
        const fresh = Object.fromEntries(DIVISIONS.map(d => [d, null]))
        for (const row of r.data.data || []) {
          if (row.is_active) fresh[row.division_letter] = row.funding_type
        }
        setGrid(fresh)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [collegeId, selFaculty, selYear])

  useEffect(() => { loadGrid() }, [loadGrid])

  function toggle(div, type) {
    setGrid(g => ({ ...g, [div]: g[div] === type ? null : type }))
    setSaved(false)
  }

  async function saveGrid() {
    setSaving(true); setError(''); setSaved(false)
    const divisions = DIVISIONS.map(d => ({
      division_letter: d,
      funding_type:    grid[d] || 'Granted',
      is_active:       grid[d] !== null,
    }))
    try {
      await api.post(`masters/${collegeId}/division/save-grid`, {
        faculty_master_id: selFaculty,
        year_level:        selYear,
        class_year_code:   classYearCode,
        divisions,
      })
      setSaved(true)
    } catch (e) { setError(e?.response?.data?.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  const selFacultyRow  = faculty.find(f => f.code_no == selFaculty)
  const selFacultyName = selFacultyRow?.degree_course_name || ''
  const yearLevels     = yearLevelsFor(selFacultyRow?.duration_years)

  // Snap selYear back to FY when switching to a shorter program
  useEffect(() => {
    if (yearLevels.length && !yearLevels.includes(selYear)) setSelYear(yearLevels[0])
  }, [yearLevels, selYear])

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Division Master</h2>
        {rw && <button onClick={saveGrid} disabled={saving}
          className="shrink-0 px-4 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Degree Course</label>
          <select value={selFaculty} onChange={e => setSelFaculty(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-full sm:min-w-[220px]">
            {faculty.map(f => <option key={f.code_no} value={f.code_no}>{f.degree_course_code} — {f.degree_course_name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Year</label>
          <div className="flex gap-1">
            {yearLevels.map(y => (
              <button key={y} onClick={() => setSelYear(y)}
                className={`px-4 h-9 rounded-lg text-sm font-medium border transition ${selYear === y ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Class-Year Code</label>
          <input value={classYearCode} onChange={e => setClassYearCode(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-full sm:w-36"
            placeholder="FYBA" />
        </div>
      </div>

      {selFacultyName && (
        <p className="text-xs text-slate-400 mb-3">{selFacultyName} — {selYear} — {classYearCode}</p>
      )}

      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {saved && <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved successfully.</p>}

      {loading ? <SkeletonTable rows={4} cols={3} /> : (
        <div className="overflow-x-auto rounded-lg border-2 border-slate-400">
          <div className="min-w-[640px]">
            {/* Radio-grid styled to match the Program Master grid: slate-400
                outer border, slate-100 header, bold uppercase tracked titles,
                slate-300 inner cell borders. */}
            <table className="text-sm border-collapse w-full">
              <thead className="bg-slate-100 border-b-2 border-slate-400">
                <tr>
                  <th className="w-28 border-r-2 border-slate-300 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 text-left">Funding Type</th>
                  {DIVISIONS.map((d, i) => (
                    <th key={d} className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 text-center w-14 ${i < DIVISIONS.length - 1 ? 'border-r-2 border-slate-300' : ''}`}>
                      Div {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {FUNDING_OPTS.map(ftype => (
                  <tr key={ftype} className="hover:bg-blue-50 transition">
                    <td className="border-r-2 border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 whitespace-nowrap">
                      {ftype === 'NonGranted' ? 'Non-Granted' : ftype}
                      {ftype === 'Both' && <span className="ml-1 text-slate-400 font-normal">(confirm)</span>}
                    </td>
                    {DIVISIONS.map((d, i) => {
                      const checked = grid[d] === ftype
                      const active  = grid[d] !== null
                      return (
                        <td key={d} className={`text-center px-2 py-2.5 transition ${!active ? 'bg-slate-50' : ''} ${i < DIVISIONS.length - 1 ? 'border-r-2 border-slate-300' : ''}`}>
                          <input
                            type="radio"
                            name={`div-${d}`}
                            checked={checked}
                            onChange={() => toggle(d, ftype)}
                            className="h-4 w-4 accent-slate-700 cursor-pointer"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {/* Clear row */}
                <tr>
                  <td className="border-r-2 border-slate-300 px-3 py-2.5 text-xs text-slate-400 bg-slate-50">Not configured</td>
                  {DIVISIONS.map((d, i) => (
                    <td key={d} className={`text-center px-2 py-2.5 ${i < DIVISIONS.length - 1 ? 'border-r-2 border-slate-300' : ''}`}>
                      {grid[d] !== null ? (
                        <button onClick={() => setGrid(g => ({ ...g, [d]: null }))}
                          title="Clear this division"
                          className="text-xs text-slate-300 hover:text-red-400">✕</button>
                      ) : (
                        <span className="text-xs text-slate-200">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Select one funding type per division column. Leave all blank (click ✕) to mark a division as not configured.
        Non-Granted divisions override payment mode to Paying regardless of caste.
      </p>
    </div>
  )
}
