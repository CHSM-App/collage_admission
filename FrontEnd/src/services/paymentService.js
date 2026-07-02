import api from './api'

export const getCollegeFeeStatus = (appId) =>
  api.get(`payments/college-fee-status/${appId}`)

export const initiatePayment = (data) =>
  api.post('payments/initiate', data)

export const getPaymentReceipts = (applicationId) =>
  api.get(`payments/receipts/${applicationId}`)

export const studentHasPayments = (studentId) =>
  api.get(`payments/student-has-payments?student_id=${studentId}`)

export const getMiscFeeStatus = (appId) =>
  api.get(`payments/misc-fee-status/${appId}`)

export const initiateMiscFeePayment = (data) =>
  api.post('payments/initiate-misc-fee', data)
