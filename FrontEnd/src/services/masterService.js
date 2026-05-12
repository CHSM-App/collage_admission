import api from './api'

// Faculty
export const getFaculty = (collegeId) =>
  api.get(`masters/${collegeId}/faculty`)

export const createFaculty = (collegeId, data) =>
  api.post(`masters/${collegeId}/faculty`, data)

export const updateFaculty = (collegeId, codeNo, data) =>
  api.put(`masters/${collegeId}/faculty/${codeNo}`, data)

export const deleteFaculty = (collegeId, codeNo) =>
  api.delete(`masters/${collegeId}/faculty/${codeNo}`)

// Course
export const getCourses = (collegeId, facultyId, semester) =>
  api.get(`masters/${collegeId}/course?faculty_id=${facultyId}&semester=${semester}`)

export const updateCourse = (collegeId, courseId, data) =>
  api.put(`masters/${collegeId}/course/${courseId}`, data)

export const bulkSaveCourses = (collegeId, data) =>
  api.post(`masters/${collegeId}/course/bulk-save`, data)

export const deleteCourse = (collegeId, courseId) =>
  api.delete(`masters/${collegeId}/course/${courseId}`)

// Class
export const getClasses = (collegeId) =>
  api.get(`masters/${collegeId}/class`)

export const createClass = (collegeId, data) =>
  api.post(`masters/${collegeId}/class`, data)

export const updateClass = (collegeId, classId, data) =>
  api.put(`masters/${collegeId}/class/${classId}`, data)

export const deleteClass = (collegeId, classId) =>
  api.delete(`masters/${collegeId}/class/${classId}`)

// Division
export const getDivisions = (collegeId, facultyId, yearLevel) =>
  api.get(`masters/${collegeId}/division?faculty_id=${facultyId}&year_level=${yearLevel}`)

export const saveDivisionGrid = (collegeId, data) =>
  api.post(`masters/${collegeId}/division/save-grid`, data)

// Group
export const getGroups = (collegeId, facultyId, semester) =>
  api.get(`masters/${collegeId}/group?faculty_id=${facultyId}&semester=${semester}`)

export const getGroup = (collegeId, groupId) =>
  api.get(`masters/${collegeId}/group/${groupId}`)

export const getCoursesForSemester = (collegeId, semester) =>
  api.get(`masters/${collegeId}/course?semester=${semester}`)

export const createGroup = (collegeId, data) =>
  api.post(`masters/${collegeId}/group`, data)

export const updateGroup = (collegeId, groupId, data) =>
  api.put(`masters/${collegeId}/group/${groupId}`, data)

export const deleteGroup = (collegeId, groupId) =>
  api.delete(`masters/${collegeId}/group/${groupId}`)

// Bank
export const getBankLedgers = (collegeId) =>
  api.get(`masters/${collegeId}/bank`)

export const createBankLedger = (collegeId, data) =>
  api.post(`masters/${collegeId}/bank`, data)

export const updateBankLedger = (collegeId, ledgerCode, data) =>
  api.put(`masters/${collegeId}/bank/${ledgerCode}`, data)

export const deleteBankLedger = (collegeId, ledgerCode) =>
  api.delete(`masters/${collegeId}/bank/${ledgerCode}`)

// Fees master
export const getFeesList = (collegeId) =>
  api.get(`masters/${collegeId}/fees`)

export const createFees = (collegeId, data) =>
  api.post(`masters/${collegeId}/fees`, data)

export const updateFees = (collegeId, feesCode, data) =>
  api.put(`masters/${collegeId}/fees/${feesCode}`, data)

export const deleteFees = (collegeId, feesCode) =>
  api.delete(`masters/${collegeId}/fees/${feesCode}`)

export const getClasswiseFees = (collegeId, facultyId, yearLevel) =>
  api.get(`masters/${collegeId}/fees/classwise?faculty_id=${facultyId}&year_level=${yearLevel}`)

export const saveClasswiseFees = (collegeId, data) =>
  api.post(`masters/${collegeId}/fees/classwise/save`, data)

// Fees compute
export const computeFees = (collegeId, data) =>
  api.post(`masters/${collegeId}/fees/compute`, data)

// Required Documents
export const getMasterDocumentTypes = () =>
  api.get('masters/document-types')

export const getRequiredDocumentsMaster = (collegeId, params) =>
  api.get(`masters/${collegeId}/required-documents`, { params })

export const createRequiredDocument = (collegeId, data) =>
  api.post(`masters/${collegeId}/required-documents`, data)

export const updateRequiredDocument = (collegeId, docId, data) =>
  api.put(`masters/${collegeId}/required-documents/${docId}`, data)

export const deleteRequiredDocument = (collegeId, docId) =>
  api.delete(`masters/${collegeId}/required-documents/${docId}`)
