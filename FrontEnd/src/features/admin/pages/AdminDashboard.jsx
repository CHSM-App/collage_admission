import { useSearchParams } from 'react-router-dom'
import CreateCollege from '../components/CreateCollege.jsx'
import CollegeList   from '../components/CollegeList.jsx'

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') || 'colleges'

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Admin console</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">
          {section === 'create-college' ? 'Create College' : 'Colleges & Staff'}
        </h1>
      </div>

      {/* Tab strip */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'colleges',       label: 'Colleges & Roles' },
          { key: 'create-college', label: '+ New College' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setSearchParams({ section: t.key })}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              section === t.key
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === 'create-college' && (
        <CreateCollege onCreated={() => setSearchParams({ section: 'colleges' })} />
      )}
      {section !== 'create-college' && <CollegeList />}
    </section>
  )
}
