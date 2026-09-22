/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { getCollegeByCode } from '../services/collegeService.js'
import { rememberCollegeCode } from '../app/routePaths.js'

const CollegeContext = createContext(null)

/**
 * The college whose portal the student is currently in, resolved once from the
 * :collegeCode URL segment. Everything under /c/:collegeCode reads from here —
 * the numeric id for scoping API calls, the name and logo for branding.
 */
export function useCollege() {
  return useContext(CollegeContext)
}

function CenteredCard({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">{children}</div>
    </main>
  )
}

/**
 * CollegeScope — layout route for /c/:collegeCode.
 *
 * Resolves the code to a college before rendering any child route, so no child
 * has to handle a missing college. Also owns the two portal-wide side effects:
 * the browser tab title and remembering the code for legacy-URL recovery.
 */
export default function CollegeScope() {
  const { collegeCode } = useParams()
  // The resolved code is kept in state so a switch to a different portal reads
  // as loading immediately, without resetting state from inside the effect.
  const [resolved, setResolved] = useState({ status: 'loading', data: null, code: null })
  const state = resolved.code === collegeCode ? resolved : { status: 'loading', data: null }

  useEffect(() => {
    let cancelled = false

    getCollegeByCode(collegeCode)
      .then(res => {
        if (cancelled) return
        const { college, periods } = res.data.data
        setResolved({
          status: 'ready',
          code: collegeCode,
          data: {
            code: collegeCode,
            id: college.id,
            name: college.name,
            city: college.city,
            phone: college.phone,
            logoUrl: college.logo_url || null,
            features: college.features,
            periods: periods || [],
          },
        })
        rememberCollegeCode(collegeCode)
      })
      .catch(() => {
        if (!cancelled) setResolved({ status: 'notfound', data: null, code: collegeCode })
      })

    return () => { cancelled = true }
  }, [collegeCode])

  // The tab title is part of the white-label — the static index.html title
  // would otherwise show the platform name in tabs, history and bookmarks.
  const resolvedName = state.status === 'ready' ? state.data.name : null
  useEffect(() => {
    if (resolvedName) document.title = `${resolvedName} — Admissions`
  }, [resolvedName])

  if (state.status === 'loading') {
    return (
      <CenteredCard>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </CenteredCard>
    )
  }

  if (state.status === 'notfound') {
    return (
      <CenteredCard>
        <h1 className="text-2xl font-bold text-slate-950">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This admission link is not valid. Please check the link your college shared with you.
        </p>
      </CenteredCard>
    )
  }

  return (
    <CollegeContext.Provider value={state.data}>
      <Outlet />
    </CollegeContext.Provider>
  )
}
