import api from './api'

export const getCollegeFeeStatus = (appId) =>
  api.get(`payments/college-fee-status/${appId}`)

export const createOrder = (data) =>
  api.post('payments/create-order', data)

export const verifyPayment = (data) =>
  api.post('payments/verify', data)

export const getPaymentReceipts = (applicationId) =>
  api.get(`payments/receipts/${applicationId}`)

export const studentHasPayments = (studentId) =>
  api.get(`payments/student-has-payments?student_id=${studentId}`)
