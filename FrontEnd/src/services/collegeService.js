import api from './api'

export const searchColleges = (q) =>
  api.get(`colleges/search?q=${encodeURIComponent(q)}`)

export const getCollegeByCode = (code) =>
  api.get(`colleges/by-code/${encodeURIComponent(code)}`)

export const getCollege = (collegeId) =>
  api.get(`colleges/${collegeId}`)

export const getAdmissionPeriods = (collegeId) =>
  api.get(`colleges/${collegeId}/admission-periods`)

export const getAdmissionPeriodFee = (collegeId, periodId) =>
  api.get(`colleges/${collegeId}/admission-periods/${periodId}/fee`)

export const createCollege = (form) =>
  api.post('colleges', form)
