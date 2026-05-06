/**
 * STRESS TEST — ramp up until it breaks
 * Goal: find the breaking point (DB pool exhaustion, timeouts, OOM).
 * Run: k6 run load-tests/stress.js
 *
 * Watch while running:
 *   - Node process memory (Task Manager)
 *   - Backend console for "connection pool exhausted" errors
 *   - k6 output for error rate spikes
 */

import http  from 'k6/http'
import { check, sleep } from 'k6'

const BASE             = 'https://collageserver.vengurlatech.com'
const COLLEGE_EMAIL    = 'admin@testcollege.com'
const COLLEGE_PASSWORD = 'password123'
const COLLEGE_ID       = 1

export const options = {
  stages: [
    { duration: '1m',  target: 20  },
    { duration: '1m',  target: 50  },
    { duration: '1m',  target: 100 },
    { duration: '1m',  target: 150 },
    { duration: '1m',  target: 200 },
    { duration: '30s', target: 0   },   // ramp down
  ],
  thresholds: {
    // These are deliberately loose — we WANT to see it fail
    http_req_duration: ['p(99)<5000'],
    http_req_failed:   ['rate<0.5'],
  },
}

export default function () {
  // Login
  const loginRes = http.post(
    `${BASE}/auth/login/college`,
    JSON.stringify({ email: COLLEGE_EMAIL, password: COLLEGE_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  if (loginRes.status !== 200) { sleep(1); return }

  const token = JSON.parse(loginRes.body)?.token

  // Hit the heaviest endpoint repeatedly
  const r = http.get(
    `${BASE}/college-admin/${COLLEGE_ID}/applications?page=1&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  check(r, { 'status 200': r => r.status === 200 })

  sleep(0.5)
}
