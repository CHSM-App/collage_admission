/**
 * Step 6 — Subject Group.
 *
 * One group per semester, for both semesters of the applicant's year (year Y
 * covers absolute semesters 2Y-1 and 2Y). Each group expands to show the
 * subjects it contains, so the choice is made on what is actually studied
 * rather than on a group code.
 *
 * Required in the student wizard; `skippable` relaxes that for the college
 * wizard, where staff enter applications on a student's behalf and may not know
 * the group yet.
 *
 * The wizard only reaches this step when groups exist — ApplyWizard skips
 * straight to Review otherwise — but the empty state is kept for the college
 * wizard, which has no such gate.
 */
import { useEffect, useState } from 'react'
import { StepHeader, StepFooter } from './Step1Context.jsx'
import { SkeletonLines } from '../../../../shared/components/Skeleton.jsx'
import { getGroupsList, getApplicationGroups, saveApplicationGroups } from '../../../../services/applicationService.js'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'
import { semestersForYear } from '../../lib/semesters.js'

export default function Step6Groups({
  step = 6,
  data,
  appId,
  saving,
  globalError,
  readOnly,
  skippable = false,
  onBack,
  onNext,
}) {
  const [semesters, setSemesters] = useState(() => semestersForYear(data?.year_of_study))
  const [groupsBySem, setGroupsBySem] = useState({})   // semester -> group[]
  const [chosen, setChosen] = useState({})             // semester -> group_id
  const [expanded, setExpanded] = useState(null)       // `${sem}:${groupId}`
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        // The server owns the year -> semester mapping; semestersForYear is only
        // the pre-fetch guess used for the initial render.
        const saved = await getApplicationGroups(appId)
        const d = saved.data.data
        const sems = d.semesters?.length ? d.semesters : semestersForYear(data?.year_of_study)

        const lists = await Promise.all(
          sems.map(s => getGroupsList(d.college_id, d.course_id, s).then(r => r.data.data || []))
        )
        if (!alive) return

        setSemesters(sems)
        setGroupsBySem(Object.fromEntries(sems.map((s, i) => [s, lists[i]])))
        setChosen(Object.fromEntries((d.selections || []).map(x => [x.semester, x.group_id])))
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Could not load subject groups.'))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [appId, data?.year_of_study])

  function choose(semester, groupId) {
    if (readOnly) return
    setChosen(prev => ({ ...prev, [semester]: groupId }))
    setError('')
  }

  const allChosen = semesters.length > 0 && semesters.every(s => chosen[s] != null)
  // Nothing to choose from — let the step be passed rather than trapping anyone.
  const noGroups = semesters.every(s => (groupsBySem[s] || []).length === 0)
  const canContinue = readOnly || skippable || noGroups || allChosen

  async function handleNext() {
    if (readOnly) { onNext(); return }
    if (!canContinue) {
      setError('Choose a group for each semester to continue.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const selections = semesters
        .filter(s => chosen[s] != null)
        .map(s => ({ semester: s, group_id: chosen[s] }))
      await saveApplicationGroups(appId, selections)
      onNext()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your subject group.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <StepHeader
        step={step}
        title="Subject Group"
        desc={skippable
          ? 'Optional — choose the subject combination for each semester, or leave it for the student.'
          : 'Choose the subject combination you want for each semester of this year.'}
      />

      <div className="px-3 py-4 sm:px-5 sm:py-5 space-y-5">
        {loading ? (
          <SkeletonLines rows={6} />
        ) : (
          <>
            {semesters.map(sem => (
              <SemesterGroupPanel
                key={sem}
                semester={sem}
                groups={groupsBySem[sem] || []}
                chosenId={chosen[sem]}
                expanded={expanded}
                readOnly={readOnly}
                onChoose={id => choose(sem, id)}
                onToggleExpand={key => setExpanded(prev => (prev === key ? null : key))}
              />
            ))}

            {!loading && noGroups && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No subject groups have been set up for this course yet. You can continue.
              </p>
            )}
          </>
        )}

        {(error || globalError) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || globalError}
          </p>
        )}

        <StepFooter
          onBack={onBack}
          onNext={handleNext}
          saving={saving || busy}
          readOnly={readOnly}
          disabled={!canContinue}
          nextLabel={skippable && !allChosen ? 'Skip & Continue' : 'Save & Continue'}
        />
      </div>
    </div>
  )
}

function SemesterGroupPanel({ semester, groups, chosenId, expanded, readOnly, onChoose, onToggleExpand }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-slate-800">Semester {semester}</p>
          {chosenId != null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Chosen
            </span>
          )}
        </div>
        {groups.length > 0 && (
          <span className="text-xs text-slate-400">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="px-3 sm:px-5 py-4 text-sm text-slate-400">No groups available for this semester.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map(g => {
            const key = `${semester}:${g.id}`
            const isOpen = expanded === key
            const isChosen = chosenId === g.id
            return (
              <div key={g.id} className={isChosen ? 'bg-violet-50/40' : ''}>
                <div className="flex items-start gap-2 sm:gap-3 px-3 sm:px-5 py-3">
                  <input
                    type="radio"
                    name={`group-sem-${semester}`}
                    checked={isChosen}
                    onChange={() => onChoose(g.id)}
                    disabled={readOnly}
                    className="mt-1 h-4 w-4 accent-violet-600 cursor-pointer shrink-0 disabled:cursor-default"
                    aria-label={`${g.group_code} — ${g.group_description}`}
                  />
                  {/* Clicking the body selects; only the chevron expands, so
                      browsing subjects never changes the answer by accident. */}
                  <button
                    type="button"
                    onClick={() => !readOnly && onChoose(g.id)}
                    className="flex-1 min-w-0 text-left"
                    disabled={readOnly}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{g.group_code}</span>
                      <span className="text-sm font-medium text-slate-800">{g.group_description}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {g.course_count} subject{g.course_count !== 1 ? 's' : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleExpand(key)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'Hide' : 'View'}<span className="hidden sm:inline"> subjects</span>
                    <svg className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-3 sm:px-5 py-2">
                    {g.courses.length === 0 ? (
                      <p className="py-2 text-sm text-slate-400">This group has no subjects yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-200/70">
                        {g.courses.map(c => (
                          <li key={`${c.course_position}-${c.course_code}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                            <span className="w-5 text-right text-xs text-slate-300 shrink-0">{c.course_position}</span>
                            <span className="font-mono text-xs text-slate-500 sm:w-28 shrink-0">{c.course_code}</span>
                            <span className="order-last basis-full pl-8 text-sm text-slate-700 sm:order-none sm:basis-0 sm:flex-1 sm:pl-0">{c.course_title}</span>
                            {c.subject_type && <span className="text-xs text-slate-400 shrink-0">{c.subject_type}</span>}
                            {c.credits != null && <span className="text-xs text-slate-400 shrink-0">{c.credits} cr</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
