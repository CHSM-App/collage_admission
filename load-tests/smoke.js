/**
 * SMOKE TEST — 1 virtual user, 1 minute
 * Goal: verify every endpoint responds correctly before running a real load test.
 * Run: k6 run load-tests/smoke.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

// ── Config ────────────────────────────────────────────────────
const BASE = 'http://localhost:8000'

// Fill these in before running — use a real student account
const STUDENT_PHONE    = '9404931342'
const STUDENT_PASSWORD = '1234567'

export const options = {
  vus:      1,
  duration: '1m',
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // <1% errors
    http_req_duration: ['p(95)<1000'],  // 95% under 1s
  },
}

// ── Helpers ───────────────────────────────────────────────────
function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

// ── Main ──────────────────────────────────────────────────────
export default function () {
  // 1. Public endpoint — college list
  const colleges = http.get(`${BASE}/colleges?page=1&limit=20`)
  check(colleges, {
    'colleges: status 200':    r => r.status === 200,
    'colleges: has data':      r => JSON.parse(r.body).data?.length > 0,
    'colleges: has pagination':r => !!JSON.parse(r.body).pagination,
  })
  sleep(0.5)

  // 2. Student login
  const loginRes = http.post(
    `${BASE}/auth/login/student`,
    JSON.stringify({ phone: STUDENT_PHONE, password: STUDENT_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  check(loginRes, { 'login: status 200': r => r.status === 200 })

  const token = JSON.parse(loginRes.body)?.token
  if (!token) return  // abort iteration if login failed

  sleep(0.5)

  // 3. My applications
  const user      = JSON.parse(loginRes.body)?.user
  const studentId = user?.id
  const myApps    = http.get(`${BASE}/applications?student_id=${studentId}&limit=20`, authHeaders(token))
  check(myApps, { 'my-apps: status 200': r => r.status === 200 })
  sleep(0.5)

  // 4. Notifications
  const notif = http.get(`${BASE}/notifications/student/${studentId}`, authHeaders(token))
  check(notif, { 'notifications: status 200': r => r.status === 200 })
  sleep(1)
}
