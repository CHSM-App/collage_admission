import axios from 'axios'

const api = axios.create({
  baseURL:      import.meta.env.VITE_API_URL || 'http://192.168.1.7:5000/',
  headers:      { 'Content-Type': 'application/json' },
  withCredentials: true,   // send httpOnly auth_token cookie on every request
})



api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status

    // Tag network-level failures (no response received) with a consistent flag
    // so every component can distinguish "offline / server unreachable" from
    // "server returned an error" without duplicating detection logic.
    if (!err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.message === 'Network Error')) {
      err.isNetworkError = true
      err.message = navigator.onLine
        ? 'The server could not be reached. Please try again.'
        : 'No internet connection. Please check your network and try again.'
      return Promise.reject(err)
    }

    if (status === 401) {
      try {
        const stored = localStorage.getItem('collegeAdmissionAuth')
        const auth   = stored ? JSON.parse(stored) : null
        // Only redirect if the user had an active session.
        // A failed login attempt also returns 401 — let the error propagate.
        if (auth?.isAuthenticated) {
          const role = auth.role
          localStorage.removeItem('collegeAdmissionAuth')
          window.location.href = role === 'admin'   ? '/login/vtadmin' :
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







