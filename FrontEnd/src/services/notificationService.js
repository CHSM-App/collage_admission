import api from './api'

// collegeId scopes the feed to one college's portal — see getApplications.
export const getStudentNotifications = (studentId, collegeId) =>
  api.get(`notifications/student/${studentId}${collegeId ? `?college_id=${collegeId}` : ''}`)
