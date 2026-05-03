import { useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
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

export default function CollegeDashboard() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') || 'overview'
  const appId   = searchParams.get('app_id')
  const { user } = useAuthContext()

  if (section === 'periods')          return <AdmissionPeriods collegeId={user?.id} />
  if (section === 'inbox')            return <ApplicationInbox collegeId={user?.id} />
  if (section === 'app' && appId)     return <ApplicationDetail collegeId={user?.id} appId={appId} />
  if (section === 'rollnumbers')      return <RollNumbers collegeId={user?.id} />
  if (section === 'add-application')  return <AddApplicationStart />
  if (section === 'master-faculty')   return <FacultyMaster   collegeId={user?.id} />
  if (section === 'master-bank')      return <BankMaster      collegeId={user?.id} />
  if (section === 'master-course')    return <CourseMaster    collegeId={user?.id} />
  if (section === 'master-group')     return <GroupMaster     collegeId={user?.id} />
  if (section === 'master-division')  return <DivisionMaster  collegeId={user?.id} />
  if (section === 'master-fees')      return <FeesMaster      collegeId={user?.id} />

  return <Overview user={user} />
}

function Overview({ user }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{user?.name}</h1>
        <p className="mt-1 text-slate-600">{user?.city}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Admission Periods', desc: 'Open or close admissions for each course and year.', section: 'periods', accent: 'blue' },
          { title: 'Application Inbox', desc: 'Review, approve, or reject student applications.', section: 'inbox', accent: 'teal' },
          { title: 'Add Application', desc: 'Fill in the admission form on behalf of a student.', section: 'add-application', accent: 'indigo' },
          { title: 'Document Verification', desc: 'Confirm students who have visited with documents.', section: 'inbox?status=approved', accent: 'orange' },
          { title: 'Roll Numbers', desc: 'Generate roll numbers for confirmed students.', section: 'rollnumbers', accent: 'violet' },
          { title: 'Faculty Master', desc: 'Manage degree programs and university codes.', section: 'master-faculty', accent: 'slate' },
          { title: 'Fees Master',    desc: 'Configure fee heads, slabs, and classwise overrides.', section: 'master-fees', accent: 'rose' },
        ].map(card => (
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
