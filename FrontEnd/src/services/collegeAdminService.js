import api from './api'

export const getApplicationsList = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/applications?${params}`)

export const getApplicationDetail = (collegeId, appId) =>
  api.get(`college-admin/${collegeId}/applications/${appId}`)

export const postApplicationAction = (collegeId, appId, endpoint, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/${endpoint}`, data)

export const confirmApplication = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/confirm`, data)

export const setApplicationFee = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/set-fee`, data)

export const recordCashPayment = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/record-cash-payment`, data)

export const getCollegeAdminAdmissionPeriods = (collegeId, active) => {
  const qs = active !== undefined ? `?active=${active}` : ''
  return api.get(`college-admin/${collegeId}/admission-periods${qs}`)
}

export const createAdmissionPeriod = (collegeId, data) =>
  api.post(`college-admin/${collegeId}/admission-periods`, data)

export const updateAdmissionPeriod = (collegeId, periodId, data) =>
  api.put(`college-admin/${collegeId}/admission-periods/${periodId}`, data)

export const getFeeReceipts = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/fee-receipts?${params}`)

export const generateRollNumbers = (collegeId, data) =>
  api.post(`college-admin/${collegeId}/roll-numbers/generate`, data)

export const searchStudents = (collegeId, query) =>
  api.get(`college-admin/${collegeId}/students/search?q=${encodeURIComponent(query)}`)
