import { useCollege } from '../context/CollegeContext.jsx'

export default function AuthLayout({ title, subtitle, children }) {
  // Inside a college portal (/c/:collegeCode) the auth pages carry that
  // college's own identity; outside one — staff and admin login — they keep
  // the platform wording. Read here rather than as props so every auth page
  // gets it without threading.
  const college = useCollege()

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          {college?.logoUrl && (
            <img
              src={college.logoUrl}
              alt=""
              className="mx-auto mb-3 h-14 w-14 rounded-lg object-contain"
            />
          )}
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-600">
            {college?.name || 'College Admission System'}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </section>
    </main>
  )
}
