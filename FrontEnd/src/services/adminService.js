import api from './api'

export const getAdminColleges = (page, limit) =>
  api.get(`admin/colleges?page=${page}&limit=${limit}`)

export const getAllAdminColleges = () =>
  api.get('admin/colleges')

export const updateAdminCollege = (collegeId, data) =>
  api.put(`admin/colleges/${collegeId}`, data)

// Brands the college's student portal. Multipart — let the browser set the
// boundary itself rather than pinning a Content-Type header.
export const uploadCollegeLogo = (collegeId, file) => {
  const form = new FormData()
  form.append('logo', file)
  return api.post(`admin/colleges/${collegeId}/logo`, form)
}

// ── Universities & the shared program catalogue ──────────────
// Programs are identical across the colleges of one university and their codes
// must stay fixed for coursemaster/groupmaster imports, so the super admin
// curates one catalogue per university and colleges receive all of it.
export const getUniversities = () =>
  api.get('admin/universities')

export const createUniversity = (data) =>
  api.post('admin/universities', data)

export const updateUniversity = (universityId, data) =>
  api.put(`admin/universities/${universityId}`, data)

export const getCatalogPrograms = (universityId) =>
  api.get(`admin/universities/${universityId}/programs`)

export const createCatalogProgram = (universityId, data) =>
  api.post(`admin/universities/${universityId}/programs`, data)

export const updateCatalogProgram = (programId, data) =>
  api.put(`admin/programs/${programId}`, data)

// What one college actually holds, with the counts that say whether hiding is safe.
export const getCollegePrograms = (collegeId) =>
  api.get(`admin/colleges/${collegeId}/programs`)

export const setCollegeProgramActive = (collegeId, codeNo, isActive) =>
  api.put(`admin/colleges/${collegeId}/programs/${codeNo}`, { is_active: isActive })

// Adds catalogue programs the college is missing; never edits or removes.
export const syncCollegePrograms = (collegeId) =>
  api.post(`admin/colleges/${collegeId}/programs/sync`)

// Roles
export const getRoles = (collegeId) =>
  api.get(`admin/colleges/${collegeId}/roles`)

export const createRole = (collegeId, data) =>
  api.post(`admin/colleges/${collegeId}/roles`, data)

export const updateRole = (collegeId, roleId, data) =>
  api.put(`admin/colleges/${collegeId}/roles/${roleId}`, data)

export const deleteRole = (collegeId, roleId) =>
  api.delete(`admin/colleges/${collegeId}/roles/${roleId}`)

// Features
export const getCollegeFeatures = (collegeId) =>
  api.get(`admin/colleges/${collegeId}/features`)

// Users
export const createUser = (collegeId, data) =>
  api.post(`admin/colleges/${collegeId}/users`, data)

export const updateUser = (collegeId, userId, data) =>
  api.put(`admin/colleges/${collegeId}/users/${userId}`, data)

export const deleteUser = (collegeId, userId) =>
  api.delete(`admin/colleges/${collegeId}/users/${userId}`)
