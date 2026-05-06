import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/',
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
    if (err.response?.status === 401) {
      localStorage.removeItem('collegeAdmissionAuth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
