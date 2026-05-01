import api from '../../../services/api.js'

const loginEndpoints = {
  student: 'login/login/student/',
  college: '/login/college/',
  admin: '/login/admin/',
}

function normalizeAuthResponse(responseData, fallbackRole, email) {
  const user =
    responseData?.user ||
    responseData?.data?.user ||
    responseData?.profile ||
    { email }

  // JWT token handling is disabled for now.
  // const token =
  //   responseData?.token ||
  //   responseData?.accessToken ||
  //   responseData?.access ||
  //   responseData?.jwt ||
  //   responseData?.data?.token ||
  //   null

  return {
    user,
    token: null,
    role: fallbackRole,
  }
}

export async function loginByRole(role, credentials) {
  const endpoint = loginEndpoints[role]

  if (!endpoint) {
    throw new Error('Unsupported login role')
  }

  const { data } = await api.post(endpoint, {
    email: credentials.email,
    password: credentials.password,
  })

  return normalizeAuthResponse(data, role, credentials.email)
}

export const authService = {
  loginByRole,
}
