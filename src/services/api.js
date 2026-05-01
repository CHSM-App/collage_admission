import axios from 'axios'

const api = axios.create({
  baseURL: 'https://qless.vengurlatech.com/',
  headers: {
    'Content-Type': 'application/json',
  },
})

// JWT authentication is disabled for now.
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('authToken')
//
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`
//   }
//
//   return config
// })

export default api
