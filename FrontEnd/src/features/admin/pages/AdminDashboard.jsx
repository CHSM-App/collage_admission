import { useSearchParams } from 'react-router-dom'

const sections = {
  overview: {
    title: 'Admin Overview',
    description: 'Manage platform activity, account access, and operating health.',
    stats: [
      { label: 'Students', value: '12.4k' },
      { label: 'Colleges', value: '318' },
      { label: 'Open Tickets', value: '27' },
    ],
  },
  institutions: {
    title: 'Institution Management',
    description: 'Review onboarding, approvals, and college profile health.',
    stats: [
      { label: 'Pending Colleges', value: '14' },
      { label: 'Approved Colleges', value: '304' },
      { label: 'Needs Update', value: '21' },
    ],
  },
  users: {
    title: 'User Administration',
    description: 'Monitor access, roles, and support escalations.',
    stats: [
      { label: 'Active Users', value: '9.8k' },
      { label: 'Locked Accounts', value: '06' },
      { label: 'Role Changes', value: '18' },
    ],
  },
}

export default function AdminDashboard() {
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('section') || 'overview'
  const section = sections[activeSection] || sections.overview

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
          Admin console
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{section.title}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{section.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {section.stats.map((stat) => (
          <article key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{stat.value}</p>
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">System controls</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Role access review', 'College approval queue', 'API health monitor'].map((item) => (
            <div key={item} className="rounded-md bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
