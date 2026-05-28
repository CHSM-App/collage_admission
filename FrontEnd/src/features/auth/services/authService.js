import api from '../../../services/api.js'

const loginEndpoints = {
  student: 'auth/login/student',
  college: 'auth/login/college',
  admin:   'auth/login/admin',
}

function normalizeAuthResponse(responseData, fallbackRole) {
  return {
    user:  responseData?.user || { email: responseData?.email },
    role:  responseData?.role || fallbackRole,
    token: responseData?.token || null,
  }
}

export async function loginByRole(role, credentials) {
  const endpoint = loginEndpoints[role]

  if (!endpoint) {
    throw new Error('Unsupported login role')
  }

  const { data } = await api.post(endpoint, {
    email:    credentials.email,
    phone:    credentials.phone,
    password: credentials.password,
  })

  return normalizeAuthResponse(data, role)
}

export async function registerStudent(fields) {
  const { data } = await api.post('auth/register/student', fields)
  return normalizeAuthResponse(data, 'student')
}

export const sendOtp = (data) =>
  api.post('auth/otp/send', data)

export const verifyOtp = (phone, otp) =>
  api.post('auth/otp/verify', { phone, otp })

export const forgotPasswordSendOtp = (phone) =>
  api.post('auth/forgot-password/send-otp', { phone })

export const forgotPasswordReset = (data) =>
  api.post('auth/forgot-password/reset', data)

export const registerStudentByCollege = (data) =>
  api.post('auth/register/student', data)

export const authService = {
  loginByRole,
  registerStudent,
  sendOtp,
  verifyOtp,
  forgotPasswordSendOtp,
  forgotPasswordReset,
  registerStudentByCollege,
}
