import api from './api'

// Confirmed students of a class + the subjects offered that semester.
export const getExamRegistration = (collegeId, facultyId, semester, academicYear) =>
  api.get(
    `exams/${collegeId}/registration` +
    `?faculty_id=${facultyId}` +
    `&semester=${semester}` +
    `&academic_year=${encodeURIComponent(academicYear)}`
  )

// Bulk save of the whole grid — one request, one transaction.
// data: { faculty_master_id, semester, academic_year,
//         students: [{ application_id, subjects: [{ course_master_id, exam_type }] }] }
export const saveExamRegistration = (collegeId, data) =>
  api.post(`exams/${collegeId}/registration`, data)
