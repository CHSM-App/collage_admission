import { useEffect, useState, useCallback } from 'react'
import api from '../../../../services/api.js'
import { usePermissions } from '../../hooks/usePermissions.js'

const YEAR_LEVELS = [
  { value: 1, label: 'FY (First Year)' },
  { value: 2, label: 'SY (Second Year)' },
  { value: 3, label: 'TY (Third Year)' },
]

export default function DocumentsMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')

  const [faculty, setFaculty]         = useState([])
  const [docTypes, setDocTypes]       = useState([])
  const [rows, setRows]               = useState([])
  const [selFaculty, setSelFaculty]   = useState('')
  const [selYear, setSelYear]         = useState(1)
  const [selDocType, setSelDocType]   = useState('')
  const [isMandatory, setIsMandatory] = useState(true)
  const [loading, setLoading]         = useState(true)
  const [adding, setAdding]           = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`masters/${collegeId}/faculty`),
      api.get('masters/document-types'),
    ]).then(([fRes, dtRes]) => {
      const active = (fRes.data.data || []).filter(f => f.is_active)
      setFaculty(active)
      if (active.length) setSelFaculty(active[0].code_no)
      setDocTypes(dtRes.data.data || [])
    }).finally(() => setLoading(false))
  }, [collegeId])

  const loadRows = useCallback(() => {
    if (!selFaculty) return
    api.get(`masters/${collegeId}/required-documents`, {
      params: { faculty_master_id: selFaculty, year_of_study: selYear },
    }).then(r => setRows(r.data.data || []))
  }, [collegeId, selFaculty, selYear])

  useEffect(() => { loadRows() }, [loadRows])

  async function handleAdd(e) {
    e.preventDefault()
    if (!selDocType) return
    setAdding(true)
    setError('')
    try {
      await api.post(`masters/${collegeId}/required-documents`, {
        faculty_master_id: selFaculty,
        year_of_study:     selYear,
        document_type_id:  selDocType,
        is_mandatory:      isMandatory,
      })
      setSelDocType('')
      loadRows()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add.')
    } finally {
      setAdding(false)
    }
  }

  async function toggleMandatory(row) {
    try {
      await api.put(`masters/${collegeId}/required-documents/${row.id}`, {
        is_mandatory: !row.is_mandatory,
      })
      loadRows()
    } catch {
      alert('Failed to update.')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this document from the required list?')) return
    try {
      await api.delete(`masters/${collegeId}/required-documents/${id}`)
      loadRows()
    } catch {
      alert('Failed to delete.')
    }
  }

  const alreadyAdded = new Set(rows.map(r => r.document_type_id))
  const availableTypes = docTypes.filter(dt => !alreadyAdded.has(dt.id))

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Required Documents Master</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Define which documents students must upload when applying for each course and year.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Degree Course</label>
          <select
            value={selFaculty}
            onChange={e => setSelFaculty(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-full sm:min-w-[220px]"
          >
            {faculty.map(f => (
              <option key={f.code_no} value={f.code_no}>
                {f.degree_course_code} — {f.degree_course_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Year of Study</label>
          <div className="flex gap-1">
            {YEAR_LEVELS.map(y => (
              <button
                key={y.value}
                onClick={() => setSelYear(y.value)}
                className={`px-4 h-9 rounded-lg text-sm font-medium border transition ${
                  selYear === y.value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {y.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current required documents list */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Required Documents ({rows.length})
          </p>
          <p className="text-xs text-slate-400">
            {YEAR_LEVELS.find(y => y.value === selYear)?.label}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-400">
            No documents configured for this batch yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Document</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500">Mandatory</th>
                {rw && <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-800 font-medium">{row.document_type_name}</td>
                  <td className="px-4 py-2.5 text-center">
                    {rw ? (
                      <button
                        onClick={() => toggleMandatory(row)}
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold transition ${
                          row.is_mandatory
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {row.is_mandatory ? 'Mandatory' : 'Optional'}
                      </button>
                    ) : (
                      <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                        row.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.is_mandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    )}
                  </td>
                  {rw && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add document form */}
      {rw && (
        <form onSubmit={handleAdd} className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 max-w-lg">
          <p className="text-sm font-semibold text-slate-800">Add Document</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Document Type</label>
              <select
                required
                value={selDocType}
                onChange={e => setSelDocType(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select document…</option>
                {availableTypes.map(dt => (
                  <option key={dt.id} value={dt.id}>{dt.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 h-9">
              <input
                type="checkbox"
                id="isMandatory"
                checked={isMandatory}
                onChange={e => setIsMandatory(e.target.checked)}
                className="h-4 w-4 accent-slate-700"
              />
              <label htmlFor="isMandatory" className="text-sm text-slate-700">Mandatory</label>
            </div>
            <button
              type="submit"
              disabled={adding || !selDocType}
              className="h-9 px-4 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {availableTypes.length === 0 && (
            <p className="text-xs text-slate-500">All document types have been added for this batch.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}
