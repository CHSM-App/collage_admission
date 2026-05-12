import api from './api'

export const getDocumentTypes = () =>
  api.get('document-types')

export const getStudentDocuments = (studentId) =>
  api.get(`student-documents?student_id=${studentId}`)

export const uploadStudentDocument = (studentId, formData) =>
  api.post(`student-documents?student_id=${studentId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deleteStudentDocument = (docId) =>
  api.delete(`student-documents/${docId}`)

export const getDocumentFile = (filePath) =>
  api.get(filePath, { responseType: 'blob' })
