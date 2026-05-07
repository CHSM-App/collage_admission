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
const COLLEGE_EMAIL    = 'coep@gmail.com'
const COLLEGE_PASSWORD = 'Admin@123'
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

// Login once per VU (setup), reuse token across iterations
export function setup() {
  const r = http.post(
    `${BASE}/auth/login/college`,
    JSON.stringify({ email: COLLEGE_EMAIL, password: COLLEGE_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  if (r.status !== 200) {
    console.log(`Setup login failed: HTTP ${r.status} — ${r.body}`)
    return { token: null }
  }
  return { token: JSON.parse(r.body)?.token }
}

export default function (data) {
  if (!data.token) { sleep(1); return }

  // Hit the heaviest endpoint repeatedly
  const r = http.get(
    `${BASE}/college-admin/${COLLEGE_ID}/applications?page=1&limit=20`,
    { headers: { Authorization: `Bearer ${data.token}` } }
  )
  check(r, { 'status 200': r => r.status === 200 })

  sleep(0.5)
}
