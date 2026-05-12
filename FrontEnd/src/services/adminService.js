import api from './api'

export const getAdminColleges = (page, limit) =>
  api.get(`admin/colleges?page=${page}&limit=${limit}`)

export const getAllAdminColleges = () =>
  api.get('admin/colleges')

export const updateAdminCollege = (collegeId, data) =>
  api.put(`admin/colleges/${collegeId}`, data)

// Roles
export const getRoles = (collegeId) =>
  api.get(`admin/colleges/${collegeId}/roles`)

export const createRole = (collegeId, data) =>
  api.post(`admin/colleges/${collegeId}/roles`, data)

export const updateRole = (collegeId, roleId, data) =>
  api.put(`admin/colleges/${collegeId}/roles/${roleId}`, data)

export const deleteRole = (collegeId, roleId) =>
  api.delete(`admin/colleges/${collegeId}/roles/${roleId}`)

// Users
export const createUser = (collegeId, data) =>
  api.post(`admin/colleges/${collegeId}/users`, data)

export const updateUser = (collegeId, userId, data) =>
  api.put(`admin/colleges/${collegeId}/users/${userId}`, data)

export const deleteUser = (collegeId, userId) =>
  api.delete(`admin/colleges/${collegeId}/users/${userId}`)
