import api from './api'

export const getApplications = (studentId) =>
  api.get(`applications?student_id=${studentId}&limit=100`)

export const createApplication = (data) =>
  api.post('applications', data)

export const deleteApplication = (appId) =>
  api.delete(`applications/${appId}`)

export const submitApplication = (appId) =>
  api.post(`applications/${appId}/submit`)

export const initApplication = (data) =>
  api.post('api/applications/init', data)

export const initApplicationByCollege = (data) =>
  api.post('api/applications/init-by-college', data)

export const getApplicationForm = (appId) =>
  api.get(`api/applications/${appId}/form`)

export const updateApplicationStep = (appId, endpoint, data) =>
  api.patch(`api/applications/${appId}/${endpoint}`, data)

export const acceptDeclaration = (appId, data) =>
  api.post(`api/applications/${appId}/declaration`, data)

export const resubmitApplication = (appId) =>
  api.post(`api/applications/${appId}/resubmit`)

export const getSubjectSelections = (appId) =>
  api.get(`api/applications/${appId}/subject-selections`)

export const saveSubjectSelections = (appId, data) =>
  api.post(`api/applications/${appId}/subject-selections`, data)

export const getSubjectsList = (collegeId, courseId, semester) =>
  api.get('api/subjects-list', { params: { college_id: collegeId, course_id: courseId, semester } })

export const linkFormDocument = (appId, data) =>
  api.post(`api/applications/${appId}/form-documents`, data)

export const unlinkFormDocument = (appId, dtId) =>
  api.delete(`api/applications/${appId}/form-documents/${dtId}`)

export const getRequiredDocuments = (collegeId, courseId, year) =>
  api.get(`api/required-documents?college_id=${collegeId}&course_id=${courseId}&year=${year}`)

export const getStudentAutofill = (studentId) =>
  api.get(`api/student-profile/autofill?student_id=${studentId}`)
