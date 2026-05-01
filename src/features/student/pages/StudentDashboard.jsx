import { useSearchParams } from 'react-router-dom'

const sections = {
  overview: {
    title: 'Student Overview',
    description: 'Track admission progress and upcoming actions.',
    stats: [
      { label: 'Applications', value: '04' },
      { label: 'Shortlisted', value: '02' },
      { label: 'Pending Documents', value: '03' },
    ],
  },
  applications: {
    title: 'Applications',
    description: 'Review colleges, deadlines, and application status.',
    stats: [
      { label: 'Submitted', value: '04' },
      { label: 'Under Review', value: '02' },
      { label: 'Offer Letters', value: '01' },
    ],
  },
  documents: {
    title: 'Documents',
    description: 'Keep academic and identity documents ready for review.',
    stats: [
      { label: 'Uploaded', value: '08' },
      { label: 'Verified', value: '05' },
      { label: 'Required', value: '03' },
    ],
  },
}

export default function StudentDashboard() {
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('section') || 'overview'
  const section = sections[activeSection] || sections.overview

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
          Student portal
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
        <h2 className="text-lg font-semibold text-slate-950">Next admission steps</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Complete profile', 'Upload transcripts', 'Track counselling date'].map((item) => (
            <div key={item} className="rounded-md bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
