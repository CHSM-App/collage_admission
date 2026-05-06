import AppProviders from './providers.jsx'
import AppRoutes from './routes.jsx'
import ErrorBoundary from '../shared/components/ErrorBoundary.jsx'

function AppCrashFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
      <p className="text-xl font-bold text-slate-800">The application crashed unexpectedly.</p>
      <p className="text-sm text-slate-500">Please reload the page. If the problem persists, contact support.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
      >
        Reload
      </button>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary fallback={<AppCrashFallback />}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </ErrorBoundary>
  )
}
