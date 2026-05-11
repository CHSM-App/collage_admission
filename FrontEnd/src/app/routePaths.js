export const ROLES = {
  student: 'student',
  college: 'college',
  admin: 'admin',
}

export const LOGIN_PATHS = {
  student: '/login/student',
  college: '/login/college',
  admin: '/login/admin',
}

export const DASHBOARD_PATHS = {
  student: '/student/dashboard',
  college: '/college/dashboard',
  admin: '/admin/dashboard',
}

export const REGISTER_PATHS = {
  student: '/register/student',
}

export const FORGOT_PASSWORD_PATH = '/forgot-password'

export const getDashboardPath = (role) => DASHBOARD_PATHS[role] || LOGIN_PATHS.student

export const getLoginPath = (role) => LOGIN_PATHS[role] || LOGIN_PATHS.student
