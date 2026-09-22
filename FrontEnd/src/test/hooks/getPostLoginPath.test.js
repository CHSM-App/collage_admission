import { describe, it, expect } from 'vitest'
import { getPostLoginPath, STUDENT_PATHS, DASHBOARD_PATHS } from '../../app/routePaths.js'

// `next` comes from the URL, so it is attacker-controllable: anyone who can
// hand a student a link controls it. These cases are the open-redirect guard.
describe('getPostLoginPath', () => {
  it('returns the college-scoped dashboard when there is no next', () => {
    expect(getPostLoginPath('student', 'CL001', '')).toBe(STUDENT_PATHS.dashboard('CL001'))
  })

  it('falls back to the role dashboard for staff', () => {
    expect(getPostLoginPath('college', null, '')).toBe(DASHBOARD_PATHS.college)
    expect(getPostLoginPath('admin', null, '')).toBe(DASHBOARD_PATHS.admin)
  })

  it('honours a same-origin next path', () => {
    expect(getPostLoginPath('student', 'CL001', '?next=%2Fc%2FCL001')).toBe('/c/CL001')
    expect(getPostLoginPath('student', 'CL001', '?next=%2Fc%2FCL002%2Fdashboard'))
      .toBe('/c/CL002/dashboard')
  })

  it('rejects protocol-relative URLs', () => {
    // `//evil.com` passes a naive leading-slash check but the browser treats it
    // as another origin.
    expect(getPostLoginPath('student', 'CL001', '?next=%2F%2Fevil.com'))
      .toBe(STUDENT_PATHS.dashboard('CL001'))
  })

  it('rejects absolute URLs to another origin', () => {
    expect(getPostLoginPath('student', 'CL001', '?next=https%3A%2F%2Fevil.com'))
      .toBe(STUDENT_PATHS.dashboard('CL001'))
  })

  it('rejects a relative next that would resolve off the current path', () => {
    expect(getPostLoginPath('student', 'CL001', '?next=evil.com'))
      .toBe(STUDENT_PATHS.dashboard('CL001'))
  })

  it('falls back when a student has no college code', () => {
    expect(getPostLoginPath('student', null, '')).toBe(DASHBOARD_PATHS.student)
  })
})
