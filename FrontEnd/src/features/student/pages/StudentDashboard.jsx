import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import BrowseColleges from './BrowseColleges.jsx'
import MyApplications from './MyApplications.jsx'
import StudentDocuments from './StudentDocuments.jsx'
import ApplyForm from './ApplyForm.jsx'
import AllReceipts from './AllReceipts.jsx'
import StudentNotifications from './StudentNotifications.jsx'

export default function StudentDashboard() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') || 'overview'
  const applyPeriodId = searchParams.get('apply_period')
  const applyCollegeId = searchParams.get('college')

  const { user } = useAuthContext()

  if (section === 'browse') return <BrowseColleges />
  if (section === 'applications') return <MyApplications />
  if (section === 'documents') return <StudentDocuments />
  if (section === 'receipts') return <AllReceipts />
  if (section === 'notifications') return <StudentNotifications />
  if (section === 'apply' && applyPeriodId && applyCollegeId) {
    return <ApplyForm periodId={applyPeriodId} collegeId={applyCollegeId} />
  }

  return <Overview user={user} />
}

function Overview({ user }) {
  const navigate = useNavigate()

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950">Welcome, {user?.name}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Apply to colleges, track your applications, and manage your documents — all in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <ActionCard
          title="Browse & Apply"
          desc="Find colleges with open admissions and submit your application."
          btnLabel="Browse colleges"
          onClick={() => navigate('/student/dashboard?section=browse')}
          accent="emerald"
        />
        <ActionCard
          title="My Applications"
          desc="Track the status of all your submitted applications."
          btnLabel="View applications"
          onClick={() => navigate('/student/dashboard?section=applications')}
          accent="blue"
        />
        <ActionCard
          title="My Documents"
          desc="View and manage documents you've uploaded."
          btnLabel="Manage documents"
          onClick={() => navigate('/student/dashboard?section=documents')}
          accent="violet"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">How admissions work</h2>
        <ol className="mt-4 space-y-3">
          {[
            'Browse open admissions and pick a college + course.',
            'Submit your application and pay the application fee (₹250–₹600).',
            'College reviews your application and calls you for document verification.',
            'Bring original documents to the college for verification.',
            'On confirmation, pay the college fee to secure your seat.',
            'Roll number is assigned. Select your subjects to complete enrollment.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
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

function ActionCard({ title, desc, btnLabel, onClick, accent }) {
  const accents = {
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white',
    blue:    'bg-blue-50    text-blue-700    hover:bg-blue-600    hover:text-white',
    violet:  'bg-violet-50  text-violet-700  hover:bg-violet-600  hover:text-white',
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>
      <button
        onClick={onClick}
        className={`mt-auto rounded-md px-4 py-2 text-sm font-semibold transition ${accents[accent]}`}
      >
        {btnLabel}
      </button>
    </article>
  )
}
