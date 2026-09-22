import api from './api'

// collegeId scopes the list to one college's portal — a student with
// applications at several colleges must only ever see the current one's.
export const getApplications = (studentId, collegeId) =>
  api.get(`applications?student_id=${studentId}&limit=100${collegeId ? `&college_id=${collegeId}` : ''}`)

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

export const submitDirectApplication = (appId, data) =>
  api.post(`api/applications/${appId}/submit-direct`, data)

export const getSubjectSelections = (appId) =>
  api.get(`api/applications/${appId}/subject-selections`)

export const saveSubjectSelections = (appId, data) =>
  api.post(`api/applications/${appId}/subject-selections`, data)

export const getSubjectsList = (collegeId, courseId, semester) =>
  api.get('api/subjects-list', { params: { college_id: collegeId, course_id: courseId, semester } })

// ─── Subject groups (application wizard) ──────────────────────
// Each group comes back with its member courses inlined, so expanding one on
// screen costs no extra request.
export const getGroupsList = (collegeId, courseId, semester) =>
  api.get('api/groups-list', { params: { college_id: collegeId, course_id: courseId, semester } })

export const getApplicationGroups = (appId) =>
  api.get(`api/applications/${appId}/groups`)

export const saveApplicationGroups = (appId, selections) =>
  api.post(`api/applications/${appId}/groups`, { selections })

export const linkFormDocument = (appId, data) =>
  api.post(`api/applications/${appId}/form-documents`, data)

export const unlinkFormDocument = (appId, dtId) =>
  api.delete(`api/applications/${appId}/form-documents/${dtId}`)

export const getRequiredDocuments = (collegeId, courseId, year) =>
  api.get(`api/required-documents?college_id=${collegeId}&course_id=${courseId}&year=${year}`)

export const getStudentAutofill = (studentId) =>
  api.get(`api/student-profile/autofill?student_id=${studentId}`)
