import api from './api'

export const getStudentNotifications = (studentId) =>
  api.get(`notifications/student/${studentId}`)
