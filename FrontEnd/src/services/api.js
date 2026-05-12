import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://192.168.1.10:5000/',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('collegeAdmissionAuth')
    if (stored) {
      const auth = JSON.parse(stored)
      if (auth.token) {
        config.headers['Authorization'] = `Bearer ${auth.token}`
      }
    }
  } catch {}
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status
    if (status === 401) {
      try {
        const stored = localStorage.getItem('collegeAdmissionAuth')
        const auth   = stored ? JSON.parse(stored) : null
        // Only redirect if the user had an active session (token exists).
        // A failed login attempt also returns 401 but has no stored token —
        // in that case let the error propagate so the form can show the message.
        if (auth?.token) {
          const role = auth.role
          localStorage.removeItem('collegeAdmissionAuth')
          window.location.href = role === 'admin'   ? '/login/admin'   :
                                 role === 'college' ? '/login/college' :
                                 '/login/student'
        }
      } catch {
        // ignore parse errors
      }
    }
    if (status === 403) {
      err.message = err.response?.data?.message || 'Access denied.'
    }
    if (status === 429) {
      err.message = 'Too many requests. Please wait a moment and try again.'
    }
    return Promise.reject(err)
  }
)

export default api
