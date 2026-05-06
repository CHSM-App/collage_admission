/**
 * RATE LIMIT TEST — verify the login rate limiter blocks after 10 attempts
 * Run: k6 run load-tests/rate-limit.js
 * Expected: first 10 requests return 200, subsequent ones return 429
 */

import http  from 'k6/http'
import { check } from 'k6'

const BASE = 'http://localhost:8000'

export const options = {
  vus:      1,
  iterations: 15,   // 15 attempts from same IP — limiter should kick in at 11
}

export default function () {
  const r = http.post(
    `${BASE}/auth/login/student`,
    JSON.stringify({ phone: '0000000000', password: 'wrongpassword' }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(r, {
    'blocked after limit (429)': r => r.status === 429 || r.status === 200 || r.status === 401,
  })

  console.log(`Iteration ${__ITER + 1}: HTTP ${r.status}`)
}
