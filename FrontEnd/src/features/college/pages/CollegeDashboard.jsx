import { useState, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { STUDENT_PATHS } from '../../../app/routePaths.js'
import { usePermissions }  from '../hooks/usePermissions.js'
import { useCollegeFeatures } from '../hooks/useCollegeFeatures.js'
import { SkeletonLines } from '../../../shared/components/Skeleton.jsx'
const AdmissionPeriods = lazy(() => import('./AdmissionPeriods.jsx'))
const ApplicationInbox = lazy(() => import('./ApplicationInbox.jsx'))
const ApplicationDetail = lazy(() => import('./ApplicationDetail.jsx'))
const RollNumbers = lazy(() => import('./RollNumbers.jsx'))
const AddApplicationStart = lazy(() => import('./AddApplicationStart.jsx'))
const FacultyMaster = lazy(() => import('./masters/FacultyMaster.jsx'))
const BankMaster = lazy(() => import('./masters/BankMaster.jsx'))
const CourseMaster = lazy(() => import('./masters/CourseMaster.jsx'))
const GroupMaster = lazy(() => import('./masters/GroupMaster.jsx'))
const DivisionMaster = lazy(() => import('./masters/DivisionMaster.jsx'))
const FeesMaster = lazy(() => import('./masters/FeesMaster.jsx'))
const DocumentsMaster = lazy(() => import('./masters/DocumentsMaster.jsx'))
const CategoryMaster = lazy(() => import('./masters/CategoryMaster.jsx'))
const ExamRegistration = lazy(() => import('./ExamRegistration.jsx'))
const FeeReceipts = lazy(() => import('./FeeReceipts.jsx'))
const Reports = lazy(() => import('./Reports.jsx'))
const Certificates = lazy(() => import('./certificates/Certificates.jsx'))

function ReadOnlyBanner({ label }) {
  return (
    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
      <span className="font-bold">View only</span> — you do not have write access to {label}.
    </div>
  )
}

function NavBlocked() {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-5 py-6 text-red-800 text-sm">
      <p className="font-bold text-base mb-1">Access Denied</p>
      You do not have access to this section.
    </div>
  )
}

// Each section is its own download; this boundary keeps the sidebar/header on screen while one loads.
export default function CollegeDashboard() {
  return (
    <Suspense fallback={<SkeletonLines rows={6} />}>
      <DashboardSection />
    </Suspense>
  )
}

function DashboardSection() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') || 'overview'
  const appId   = searchParams.get('app_id')
  const { user } = useAuthContext()
  const { canWrite } = usePermissions()
  const { collegeFeeEnabled, isAgriculture } = useCollegeFeatures(user?.id)

  const readOnly = (perm) => !canWrite(perm)

  // nav_visibility only applies to staff users; non-staff (main college admin) sees everything
  const navVis = user?.is_staff ? (user?.nav_visibility || {}) : null
  const navAllowed = (key) => {
    if (!collegeFeeEnabled && ['fee-receipts', 'reports', 'master-fees'].includes(key)) return false
    // Agriculture: reg-no is the roll-no, so there's no separate Roll Numbers page.
    if (isAgriculture && key === 'rollnumbers') return false
    return !navVis || navVis[key] !== false
  }

  if (section === 'periods') {
    if (!navAllowed('periods')) return <NavBlocked />
    return <>{readOnly('manage_admission_periods') && <ReadOnlyBanner label="Admission Periods" />}<AdmissionPeriods collegeId={user?.id} readOnly={readOnly('manage_admission_periods')} /></>
  }
  if (section === 'inbox') {
    if (!navAllowed('inbox')) return <NavBlocked />
    return <>{readOnly('review_application') && <ReadOnlyBanner label="Applications" />}<ApplicationInbox collegeId={user?.id} collegeName={user?.name || ''} readOnly={readOnly('review_application')} /></>
  }
  if (section === 'app' && appId) return (
    <ApplicationDetail collegeId={user?.id} appId={appId}
      readOnly={readOnly('review_application')}
      canUploadDocs={canWrite('upload_documents')}
      canReviewDocs={canWrite('review_documents')}
      canCollectFees={canWrite('collect_fees')} />
  )
  if (section === 'rollnumbers') {
    if (!navAllowed('rollnumbers')) return <NavBlocked />
    return <>{readOnly('assign_subjects') && <ReadOnlyBanner label="Roll Numbers" />}<RollNumbers collegeId={user?.id} readOnly={readOnly('assign_subjects')} /></>
  }
  if (section === 'exam-registration') {
    if (!navAllowed('exam-registration')) return <NavBlocked />
    return <>{readOnly('exams') && <ReadOnlyBanner label="Exam Registration" />}<ExamRegistration collegeId={user?.id} readOnly={readOnly('exams')} /></>
  }
  if (section === 'add-application') {
    if (!navAllowed('add-application')) return <NavBlocked />
    if (readOnly('submit_application')) return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-5 py-6 text-amber-800 text-sm">
        <p className="font-bold text-base mb-1">Access Denied</p>
        You do not have permission to submit new applications.
      </div>
    )
    return <AddApplicationStart />
  }

  const masterReadOnly = readOnly('masters')
  if (section === 'master-faculty')   return navAllowed('master-faculty')   ? <>{masterReadOnly && <ReadOnlyBanner label="Program Master" />}<FacultyMaster   collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-bank')      return navAllowed('master-bank')      ? <>{masterReadOnly && <ReadOnlyBanner label="Bank Master" />}<BankMaster          collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-course')    return navAllowed('master-course')    ? <>{masterReadOnly && <ReadOnlyBanner label="Course Master" />}<CourseMaster      collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-group')     return navAllowed('master-group')     ? <>{masterReadOnly && <ReadOnlyBanner label="Group Master" />}<GroupMaster        collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-division')  return navAllowed('master-division')  ? <>{masterReadOnly && <ReadOnlyBanner label="Division Master" />}<DivisionMaster  collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-fees')      return navAllowed('master-fees')      ? <>{masterReadOnly && <ReadOnlyBanner label="Fees Master" />}<FeesMaster          collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-documents') return navAllowed('master-documents') ? <>{masterReadOnly && <ReadOnlyBanner label="Required Documents" />}<DocumentsMaster collegeId={user?.id} readOnly={masterReadOnly} /></> : <NavBlocked />
  if (section === 'master-categories') return navAllowed('master-categories') ? <>{masterReadOnly && <ReadOnlyBanner label="Category Master" />}<CategoryMaster collegeId={user?.id} /></> : <NavBlocked />
  if (section === 'fee-receipts')     return navAllowed('fee-receipts')     ? <FeeReceipts collegeId={user?.id} />                                                                                                             : <NavBlocked />
  if (section === 'reports')          return navAllowed('reports')          ? <Reports     collegeId={user?.id} />                                                                                                                : <NavBlocked />

  // Certificates
  if (section === 'certificates') return navAllowed('certificates') ? <Certificates collegeId={user?.id} readOnly={readOnly('certificates')} /> : <NavBlocked />

  return <Overview user={user} navAllowed={navAllowed} collegeFeeEnabled={collegeFeeEnabled} />
}

function Overview({ user, navAllowed, collegeFeeEnabled }) {
  const feeCards = collegeFeeEnabled ? [
    { title: 'Fee Receipts',  desc: 'View pending and paid college fee receipts.',           section: 'fee-receipts', accent: 'orange' },
    { title: 'Reports',       desc: 'Fee collection reports by date, class, and year.',      section: 'reports',      accent: 'green' },
    { title: 'Fees Master',   desc: 'Configure fee heads, slabs, and classwise overrides.',  section: 'master-fees',  accent: 'rose' },
  ] : []
  const allCards = [
    { title: 'Admission Periods',    desc: 'Open or close admissions for each course and year.', section: 'periods',           accent: 'blue' },
    { title: 'Application Inbox',    desc: 'Review, approve, or reject student applications.',   section: 'inbox',              accent: 'teal' },
    { title: 'Add Application',      desc: 'Fill in the admission form on behalf of a student.', section: 'add-application',    accent: 'indigo' },
    { title: 'Roll Numbers',         desc: 'Generate roll numbers for confirmed students.',       section: 'rollnumbers',        accent: 'violet' },
    { title: 'Exam Registration',    desc: 'Register confirmed students for their semester exams.', section: 'exam-registration', accent: 'amber' },
    ...feeCards,
    { title: 'Faculty Master',       desc: 'Manage degree programs and university codes.',        section: 'master-faculty',     accent: 'slate' },
    { title: 'Category Master',      desc: collegeFeeEnabled
        ? 'Manage castes, special statuses, and fees categories.'
        : 'Manage castes and special statuses.',                 section: 'master-categories', accent: 'purple' },
  ]
  const cards = allCards.filter(c => navAllowed(c.section))

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-950">{user?.name}</h1>
          {user?.college_code && (
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm font-mono font-semibold text-blue-700">
              {user.college_code}
            </span>
          )}
        </div>
        <p className="mt-1 text-slate-600">{user?.city}</p>
        {user?.college_code && <PortalLink code={user.college_code} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => (
          <ActionCard key={card.section} {...card} />
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Admission workflow</h2>
        <ol className="mt-4 space-y-2">
          {[
            'Set up admission periods for each course and year.',
            'Students apply and pay application fee — they appear in your inbox.',
            'Review applications: approve or reject with a reason.',
            'When a student visits with documents, open their application and confirm verification.',
            collegeFeeEnabled && 'Student pays college fee. Their status moves to "Fees paid".',
            'Run "Generate roll numbers" to assign roll numbers in bulk.',
            'Students select subjects and enrollment is complete.',
          ].filter(Boolean).map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// The college's own admission portal address — the link students are given.
// Without this shown somewhere, a college has no way to find it.
function PortalLink({ code }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}${STUDENT_PATHS.landing(code)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — the link is selectable anyway */ }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Your admission link — share this with students
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="break-all font-mono text-sm text-blue-700 hover:underline">
          {url}
        </a>
        <button
          onClick={copy}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function ActionCard({ title, desc, section, accent }) {
  const accents = {
    blue:   'hover:border-blue-300 hover:bg-blue-50',
    teal:   'hover:border-teal-300 hover:bg-teal-50',
    indigo: 'hover:border-indigo-300 hover:bg-indigo-50',
    orange: 'hover:border-orange-300 hover:bg-orange-50',
    violet: 'hover:border-violet-300 hover:bg-violet-50',
    slate:  'hover:border-slate-300 hover:bg-slate-50',
    rose:   'hover:border-rose-300 hover:bg-rose-50',
    green:  'hover:border-green-300 hover:bg-green-50',
    amber:  'hover:border-amber-300 hover:bg-amber-50',
  }
  const dots = {
    blue:   'bg-blue-600',
    teal:   'bg-teal-600',
    indigo: 'bg-indigo-600',
    orange: 'bg-orange-500',
    violet: 'bg-violet-600',
    slate:  'bg-slate-600',
    rose:   'bg-rose-500',
    green:  'bg-green-600',
    amber:  'bg-amber-500',
  }

  return (
    <a
      href={`/college/dashboard?section=${section}`}
      className={`block rounded-lg border border-slate-200 bg-white p-5 transition ${accents[accent]}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dots[accent]} mb-3`} />
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </a>
  )
}
