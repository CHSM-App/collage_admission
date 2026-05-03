import api from '../../../services/api.js'

const loginEndpoints = {
  student: 'auth/login/student',
  college: 'auth/login/college',
  admin:   'auth/login/admin',
}

function normalizeAuthResponse(responseData, fallbackRole) {
  return {
    user:  responseData?.user  || { email: responseData?.email },
    token: null,
    role:  responseData?.role  || fallbackRole,
  }
}

export async function loginByRole(role, credentials) {
  const endpoint = loginEndpoints[role]

  if (!endpoint) {
    throw new Error('Unsupported login role')
  }

  const { data } = await api.post(endpoint, {
    email:    credentials.email,
    password: credentials.password,
  })

  return normalizeAuthResponse(data, role)
}

export async function registerStudent(fields) {
  const { data } = await api.post('auth/register/student', fields)
  return normalizeAuthResponse(data, 'student')
}

export const authService = {
  loginByRole,
  registerStudent,
}
