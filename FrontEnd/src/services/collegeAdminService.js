import api from './api'

export const getApplicationsList = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/applications?${params}`)

export const getApplicationDetail = (collegeId, appId) =>
  api.get(`college-admin/${collegeId}/applications/${appId}`)

export const postApplicationAction = (collegeId, appId, endpoint, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/${endpoint}`, data)

export const confirmApplication = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/confirm`, data)

export const getComputedFee = (collegeId, appId, division) =>
  api.get(`college-admin/${collegeId}/applications/${appId}/computed-fee${division ? `?division=${division}` : ''}`)

export const getAppInstallments = (collegeId, appId) =>
  api.get(`college-admin/${collegeId}/applications/${appId}/installments`)

export const setApplicationFee = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/set-fee`, data)

export const recordCashPayment = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/record-cash-payment`, data)

export const recordApplicationFee = (collegeId, appId) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/record-application-fee`)

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

export const getStudentAppliedCourses = (collegeId, studentId) =>
  api.get(`college-admin/${collegeId}/students/${studentId}/applied-courses`)

export const sendTransferOtp = (collegeId, mobile) =>
  api.post(`college-admin/${collegeId}/students/transfer-otp`, { mobile })

export const verifyTransferOtp = (collegeId, mobile, otp) =>
  api.post(`college-admin/${collegeId}/students/transfer-verify`, { mobile, otp })

export const exportApplications = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/applications/export?${params}`)

export const getFeesCollectionReport = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/reports/fees-collection?${params}`)

export const getFeesByHeadReport = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/reports/fees-by-head?${params}`)

export const sendPaymentLink = (data) =>
  api.post('payments/send-payment-link', data)

export const getPaymentLinkData = (token) =>
  api.get(`payments/pay/${token}`)

export const getMiscExamHeads = (collegeId, type) =>
  api.get(`college-admin/${collegeId}/fees/misc-exam-heads${type ? `?type=${type}` : ''}`)

export const recordMiscPayment = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/record-misc-payment`, data)

export const getMiscExamReceipts = (collegeId, params) =>
  api.get(`college-admin/${collegeId}/misc-exam-receipts?${params}`)

export const createMiscFee = (collegeId, appId, data) =>
  api.post(`college-admin/${collegeId}/applications/${appId}/create-misc-fee`, data)

export const getCollegeSelfFeatures = (collegeId) =>
  api.get(`college-admin/${collegeId}/features`)
