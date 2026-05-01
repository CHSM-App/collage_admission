import { useSearchParams } from 'react-router-dom'

const sections = {
  overview: {
    title: 'College Overview',
    description: 'Monitor applicant volume, verification work, and intake progress.',
    stats: [
      { label: 'Applicants', value: '248' },
      { label: 'Verified', value: '173' },
      { label: 'Seats Open', value: '62' },
    ],
  },
  applicants: {
    title: 'Applicant Review',
    description: 'Prioritize submitted profiles and document verification.',
    stats: [
      { label: 'New Profiles', value: '38' },
      { label: 'Pending Review', value: '19' },
      { label: 'Approved', value: '84' },
    ],
  },
  seats: {
    title: 'Seat Matrix',
    description: 'Track course capacity and intake availability.',
    stats: [
      { label: 'Programs', value: '12' },
      { label: 'Filled Seats', value: '186' },
      { label: 'Available Seats', value: '62' },
    ],
  },
}

export default function CollegeDashboard() {
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('section') || 'overview'
  const section = sections[activeSection] || sections.overview

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          College portal
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
        <h2 className="text-lg font-semibold text-slate-950">Review queue</h2>
        <div className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200">
          {['B.Tech Computer Science', 'BBA Finance', 'B.Sc Data Science'].map((program) => (
            <div key={program} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium text-slate-700">{program}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
