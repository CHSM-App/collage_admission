/**
 * AddApplicationStart — College admin picks (or registers) a student and an admission period,
 * then gets redirected to CollegeApplyWizard.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { registerStudentByCollege } from '../../auth/services/authService.js'
import { getCollegeAdminAdmissionPeriods, searchStudents } from '../../../services/collegeAdminService.js'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonLines } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

const EMPTY_REG = {
  full_name: '', email: '', password: '', phone: '',
}

export default function AddApplicationStart() {
  const { user }   = useAuthContext()
  const navigate   = useNavigate()
  const collegeId  = user?.id

  // Periods
  const [periods, setPeriods]            = useState([])
  const [periodsLoading, setPeriodsLoad] = useState(true)

  // Student search
  const [query, setQuery]          = useState('')
  const [students, setStudents]    = useState([])
  const [searching, setSearching]  = useState(false)
  const [noResults, setNoResults]  = useState(false)   // true after search completes with 0 results
  const [selectedStudent, setSelected] = useState(null)

  // New student registration form
  const [showRegForm, setShowRegForm] = useState(false)
  const [regForm, setRegForm]         = useState(EMPTY_REG)
  const [regError, setRegError]       = useState('')
  const [registering, setRegistering] = useState(false)

  // Period & submit
  const [selectedPeriod, setPeriod] = useState('')
  const [error, setError]           = useState('')

  // ── Load all admission periods ──────────────────────────────
  useEffect(() => {
    getCollegeAdminAdmissionPeriods(collegeId, 1)
      .then(r => setPeriods(r.data.data || []))
      .catch(() => setError('Failed to load admission periods.'))
      .finally(() => setPeriodsLoad(false))
  }, [collegeId])

  // ── Debounced student search ────────────────────────────────
  useEffect(() => {
    setNoResults(false)
    if (query.trim().length < 2) { setStudents([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      searchStudents(collegeId, query.trim())
        .then(r => {
          const data = r.data.data || []
          setStudents(data)
          setNoResults(data.length === 0)
        })
        .catch(() => { setStudents([]); setNoResults(true) })
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [query, collegeId])

  function handleSelectStudent(s) {
    setSelected(s)
    setStudents([])
    setNoResults(false)
    setQuery(s.full_name)
    setShowRegForm(false)
  }

  function openRegForm() {
    setShowRegForm(true)
    setNoResults(false)
    setStudents([])
    setRegForm({ ...EMPTY_REG, full_name: query.trim() })
    setRegError('')
  }

  function cancelRegForm() {
    setShowRegForm(false)
    setRegForm(EMPTY_REG)
    setRegError('')
  }

  // ── Register new student ────────────────────────────────────
  async function handleRegister() {
    setRegError('')
    const { full_name, email, password, phone } = regForm
    if (!full_name.trim()) { setRegError('Full name is required.'); return }
    if (!email.trim())     { setRegError('Email is required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setRegError('Enter a valid email address.'); return }
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) { setRegError('Mobile number must be 10 digits starting with 6–9.'); return }
    if (!password)         { setRegError('Password is required.'); return }
    if (password.length < 6) { setRegError('Password must be at least 6 characters.'); return }

    setRegistering(true)
    try {
      const res = await registerStudentByCollege({
        full_name: full_name.trim(),
        email:     email.trim().toLowerCase(),
        password,
        phone:     phone.trim() || undefined,
      })
      const newStudent = res.data.user
      handleSelectStudent({ id: newStudent.id, full_name: newStudent.name, email: newStudent.email, phone: phone.trim() || '' })
      setShowRegForm(false)
      setRegForm(EMPTY_REG)
    } catch (err) {
      setRegError(err?.response?.data?.message || 'Registration failed.')
    } finally {
      setRegistering(false)
    }
  }

  // ── Navigate to wizard ──────────────────────────────────────
  function handleStart() {
    setError('')
    if (!selectedStudent) { setError('Please search and select a student, or register a new one.'); return }
    if (!selectedPeriod)  { setError('Please select an admission period.'); return }

    const p = periods.find(p => String(p.id) === selectedPeriod)
    if (!p) return

    navigate(
      `/college/apply/new` +
      `?student_id=${selectedStudent.id}` +
      `&course_id=${p.course_id}` +
      `&period_id=${p.id}` +
      `&academic_year=${encodeURIComponent(p.academic_year)}` +
      `&year_of_study=${p.year_of_study}`
    )
  }

  return (
    <section className="max-w-lg space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Add Application</h1>
        <p className="mt-1 text-slate-500">Search for an existing student or register a new one, then fill in the admission form.</p>
      </div>

      {/* ── Student search ── */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Search Student <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); setShowRegForm(false) }}
            placeholder="Name, email or phone…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searching && (
            <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          )}

          {/* Search results dropdown */}
          {students.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
              {students.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => handleSelectStudent(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm"
                  >
                    <span className="font-medium text-slate-900">{s.full_name}</span>
                    <span className="ml-2 text-slate-400">{s.email}</span>
                    {s.phone && <span className="ml-2 text-slate-400">· {s.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Confirmation of selected student */}
        {selectedStudent && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
            <p className="text-sm text-emerald-800 font-medium">
              ✓ {selectedStudent.full_name}
              <span className="ml-2 font-normal text-emerald-600">{selectedStudent.email}</span>
            </p>
            <button
              onClick={() => { setSelected(null); setQuery('') }}
              className="text-xs text-slate-400 hover:text-slate-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* No results — offer registration */}
        {noResults && !showRegForm && !selectedStudent && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800">No student found for "{query}".</p>
            <button
              onClick={openRegForm}
              className="shrink-0 text-sm font-semibold text-indigo-700 hover:underline"
            >
              + Register new student
            </button>
          </div>
        )}

        {/* Or always show a register link below the search */}
        {!noResults && !selectedStudent && !showRegForm && query.trim().length === 0 && (
          <p className="mt-1.5 text-xs text-slate-400">
            Student not in system?{' '}
            <button onClick={openRegForm} className="text-indigo-600 hover:underline font-medium">
              Register new student
            </button>
          </p>
        )}
      </div>

      {/* ── Register new student inline form ── */}
      {showRegForm && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-indigo-900">Register New Student</p>
            <button onClick={cancelRegForm} className="text-xs text-slate-400 hover:text-slate-600">✕ Cancel</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <RegField
                label="Full Name" required
                value={regForm.full_name}
                onChange={v => setRegForm(f => ({ ...f, full_name: v }))}
                placeholder="e.g. Aarav Sharma"
              />
            </div>
            <RegField
              label="Email" required type="email"
              value={regForm.email}
              onChange={v => setRegForm(f => ({ ...f, email: v }))}
              placeholder="student@example.com"
            />
            <RegField
              label="Phone"
              value={regForm.phone}
              onChange={v => setRegForm(f => ({ ...f, phone: v }))}
              placeholder="10-digit mobile"
              maxLength={10}
              inputMode="numeric"
            />
            <RegField
              label="Password" required type="password"
              value={regForm.password}
              onChange={v => setRegForm(f => ({ ...f, password: v }))}
              placeholder="Min 6 characters"
            />
          </div>

          {regError && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{regError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button onClick={handleRegister} loading={registering}>
              Create Account & Continue →
            </Button>
            <Button variant="secondary" onClick={cancelRegForm} disabled={registering}>
              Cancel
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            The student can log in with this email and password to track their application.
          </p>
        </div>
      )}

      {/* ── Admission period ── */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Admission Course <span className="text-red-500">*</span>
        </label>
        {periodsLoading ? (
          <SkeletonLines rows={2} />
        ) : periods.length === 0 ? (
          <p className="text-sm text-slate-500">No admission periods found. Create one first.</p>
        ) : (
          <select
            value={selectedPeriod}
            onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select course &amp; year —</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {p.course_name} — {YEAR_LABEL[p.year_of_study]} · {p.academic_year}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleStart} disabled={!selectedStudent || !selectedPeriod || showRegForm}>
          Start Application →
        </Button>
        <Button variant="secondary" onClick={() => navigate('/college/dashboard?section=inbox')}>
          Cancel
        </Button>
      </div>
    </section>
  )
}

function RegField({ label, value, onChange, placeholder, type = 'text', required, maxLength, inputMode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => {
          let v = e.target.value
          if (inputMode === 'numeric') v = v.replace(/\D/g, '').slice(0, maxLength || 10)
          onChange(v)
        }}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={maxLength}
        inputMode={inputMode}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />
    </div>
  )
}
