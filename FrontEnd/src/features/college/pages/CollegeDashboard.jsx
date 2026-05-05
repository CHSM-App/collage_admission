import { useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { usePermissions }  from '../hooks/usePermissions.js'
import AdmissionPeriods    from './AdmissionPeriods.jsx'
import ApplicationInbox    from './ApplicationInbox.jsx'
import ApplicationDetail   from './ApplicationDetail.jsx'
import RollNumbers         from './RollNumbers.jsx'
import AddApplicationStart from './AddApplicationStart.jsx'
import FacultyMaster       from './masters/FacultyMaster.jsx'
import BankMaster          from './masters/BankMaster.jsx'
import CourseMaster        from './masters/CourseMaster.jsx'
import GroupMaster         from './masters/GroupMaster.jsx'
import DivisionMaster      from './masters/DivisionMaster.jsx'
import FeesMaster          from './masters/FeesMaster.jsx'
import DocumentsMaster     from './masters/DocumentsMaster.jsx'
import ClassMaster         from './masters/ClassMaster.jsx'

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

export default function CollegeDashboard() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') || 'overview'
  const appId   = searchParams.get('app_id')
  const { user } = useAuthContext()
  const { canWrite } = usePermissions()

  const readOnly = (perm) => !canWrite(perm)

  // nav_visibility only applies to staff users; non-staff (main college admin) sees everything
  const navVis = user?.is_staff ? (user?.nav_visibility || {}) : null
  const navAllowed = (key) => !navVis || navVis[key] !== false

  if (section === 'periods') {
    if (!navAllowed('periods')) return <NavBlocked />
    return <>{readOnly('masters') && <ReadOnlyBanner label="Admission Periods" />}<AdmissionPeriods collegeId={user?.id} readOnly={readOnly('masters')} /></>
  }
  if (section === 'inbox') {
    if (!navAllowed('inbox')) return <NavBlocked />
    return <>{readOnly('review_application') && <ReadOnlyBanner label="Applications" />}<ApplicationInbox collegeId={user?.id} readOnly={readOnly('review_application')} /></>
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
  if (section === 'master-class')     return navAllowed('master-class')     ? <ClassMaster collegeId={user?.id} />                                                                                                              : <NavBlocked />
  if (section === 'master-bank')      return navAllowed('master-bank')      ? <>{masterReadOnly && <ReadOnlyBanner label="Bank Master" />}<BankMaster          collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-course')    return navAllowed('master-course')    ? <>{masterReadOnly && <ReadOnlyBanner label="Course Master" />}<CourseMaster      collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-group')     return navAllowed('master-group')     ? <>{masterReadOnly && <ReadOnlyBanner label="Group Master" />}<GroupMaster        collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-division')  return navAllowed('master-division')  ? <>{masterReadOnly && <ReadOnlyBanner label="Division Master" />}<DivisionMaster  collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-fees')      return navAllowed('master-fees')      ? <>{masterReadOnly && <ReadOnlyBanner label="Fees Master" />}<FeesMaster          collegeId={user?.id} readOnly={masterReadOnly} /></>   : <NavBlocked />
  if (section === 'master-documents') return navAllowed('master-documents') ? <>{masterReadOnly && <ReadOnlyBanner label="Required Documents" />}<DocumentsMaster collegeId={user?.id} readOnly={masterReadOnly} /></> : <NavBlocked />

  return <Overview user={user} navAllowed={navAllowed} />
}

function Overview({ user, navAllowed }) {
  const allCards = [
    { title: 'Admission Periods',    desc: 'Open or close admissions for each course and year.', section: 'periods',         accent: 'blue' },
    { title: 'Application Inbox',    desc: 'Review, approve, or reject student applications.',   section: 'inbox',            accent: 'teal' },
    { title: 'Add Application',      desc: 'Fill in the admission form on behalf of a student.', section: 'add-application',  accent: 'indigo' },
    { title: 'Roll Numbers',         desc: 'Generate roll numbers for confirmed students.',       section: 'rollnumbers',      accent: 'violet' },
    { title: 'Faculty Master',       desc: 'Manage degree programs and university codes.',        section: 'master-faculty',   accent: 'slate' },
    { title: 'Fees Master',          desc: 'Configure fee heads, slabs, and classwise overrides.',section: 'master-fees',     accent: 'rose' },
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
            'Student pays college fee. Their status moves to "Fees paid".',
            'Run "Generate roll numbers" to assign roll numbers in bulk.',
            'Students select subjects and enrollment is complete.',
          ].map((step, i) => (
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

function ActionCard({ title, desc, section, accent }) {
  const accents = {
    blue:   'hover:border-blue-300 hover:bg-blue-50',
    teal:   'hover:border-teal-300 hover:bg-teal-50',
    indigo: 'hover:border-indigo-300 hover:bg-indigo-50',
    orange: 'hover:border-orange-300 hover:bg-orange-50',
    violet: 'hover:border-violet-300 hover:bg-violet-50',
    slate:  'hover:border-slate-300 hover:bg-slate-50',
    rose:   'hover:border-rose-300 hover:bg-rose-50',
  }
  const dots = {
    blue:   'bg-blue-600',
    teal:   'bg-teal-600',
    indigo: 'bg-indigo-600',
    orange: 'bg-orange-500',
    violet: 'bg-violet-600',
    slate:  'bg-slate-600',
    rose:   'bg-rose-500',
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
