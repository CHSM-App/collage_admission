/**
 * LOAD TEST — ramp to 30 virtual users, hold for 2 minutes
 * Goal: simulate realistic concurrent traffic across all major endpoints.
 * Run: k6 run load-tests/load.js
 *
 * Before running:
 *   1. Start your backend: npm start (in BackEnd/)
 *   2. Fill in STUDENT_* and COLLEGE_* credentials below
 *   3. Fill in a real COLLEGE_ID and APPLICATION_ID from your DB
 */

import http  from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ── Config ────────────────────────────────────────────────────
const BASE = 'http://localhost:8000'

const STUDENT_PHONE    = '9404931342'
const STUDENT_PASSWORD = '1234567'

const COLLEGE_EMAIL    = 'coep@gmail.com'
const COLLEGE_PASSWORD = 'Admin@123'

// Use real IDs from your DB
const COLLEGE_ID       = 1
const APPLICATION_ID   = 154   // any submitted application in that college

// ── Custom metrics ────────────────────────────────────────────
const loginErrors    = new Rate('login_errors')
const inboxDuration  = new Trend('inbox_duration', true)

// ── Stages ────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up to 10 users
    { duration: '1m',  target: 30 },   // ramp up to 30 users
    { duration: '2m',  target: 30 },   // hold at 30 users
    { duration: '20s', target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.02'],      // <2% errors overall
    http_req_duration: ['p(95)<800'],      // 95% under 800ms
    inbox_duration:    ['p(95)<1500'],     // inbox (heavy JOIN) under 1.5s
    login_errors:      ['rate<0.05'],      // login fail rate < 5%
  },
}

// ── Helpers ───────────────────────────────────────────────────
function json(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

function loginStudent() {
  const r = http.post(
    `${BASE}/auth/login/student`,
    JSON.stringify({ phone: STUDENT_PHONE, password: STUDENT_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  loginErrors.add(r.status !== 200)
  check(r, { 'student login 200': r => r.status === 200 })
  return r.status === 200 ? JSON.parse(r.body) : null
}

function loginCollege() {
  const r = http.post(
    `${BASE}/auth/login/college`,
    JSON.stringify({ email: COLLEGE_EMAIL, password: COLLEGE_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  check(r, { 'college login 200': r => r.status === 200 })
  return r.status === 200 ? JSON.parse(r.body) : null
}

// ── Scenarios (split VUs across two user types) ───────────────
export default function () {
  // Alternate between student and college flows based on VU number
  if (__VU % 2 === 0) {
    studentFlow()
  } else {
    collegeFlow()
  }
}

function studentFlow() {
  group('Student flow', () => {
    // Login
    const auth = loginStudent()
    if (!auth) return
    const token     = auth.token
    const studentId = auth.user?.id
    sleep(0.5)

    // Browse colleges (public)
    group('Public: college list', () => {
      const r = http.get(`${BASE}/colleges?page=1&limit=20`)
      check(r, { 'colleges 200': r => r.status === 200 })
    })
    sleep(0.3)

    // My applications
    group('My applications', () => {
      const r = http.get(`${BASE}/applications?student_id=${studentId}&limit=20`, json(token))
      check(r, { 'my-apps 200': r => r.status === 200 })
    })
    sleep(0.5)

    // Fee status check
    group('College fee status', () => {
      const r = http.get(`${BASE}/payments/college-fee-status/${APPLICATION_ID}`, json(token))
      check(r, { 'fee-status 200 or 404': r => r.status === 200 || r.status === 404 })
    })
    sleep(1)
  })
}

function collegeFlow() {
  group('College flow', () => {
    // Login
    const auth = loginCollege()
    if (!auth) return
    const token = auth.token
    sleep(0.5)

    // Application inbox (the heaviest query)
    group('Application inbox', () => {
      const start = Date.now()
      const r = http.get(
        `${BASE}/college-admin/${COLLEGE_ID}/applications?page=1&limit=20&status=submitted`,
        json(token)
      )
      inboxDuration.add(Date.now() - start)
      check(r, { 'inbox 200': r => r.status === 200 })
    })
    sleep(0.5)

    // Fee receipts
    group('Fee receipts', () => {
      const r = http.get(
        `${BASE}/college-admin/${COLLEGE_ID}/fee-receipts?page=1&limit=20`,
        json(token)
      )
      check(r, { 'fee-receipts 200': r => r.status === 200 })
    })
    sleep(0.5)

    // Single application detail
    group('Application detail', () => {
      const r = http.get(
        `${BASE}/college-admin/${COLLEGE_ID}/applications/${APPLICATION_ID}`,
        json(token)
      )
      check(r, { 'app-detail 200 or 404': r => r.status === 200 || r.status === 404 })
    })
    sleep(1)
  })
}
