import api from './api'

export const lookupStudent = (collegeId, regNo) =>
  api.get(`certificates/${collegeId}/student-lookup`, { params: { reg_no: regNo } })

// Bonafide
export const getBonafideList = (collegeId) =>
  api.get(`certificates/${collegeId}/bonafide`)

export const getBonafideNextNo = (collegeId) =>
  api.get(`certificates/${collegeId}/bonafide/next-no`)

export const createBonafide = (collegeId, data) =>
  api.post(`certificates/${collegeId}/bonafide`, data)

export const updateBonafide = (collegeId, certId, data) =>
  api.put(`certificates/${collegeId}/bonafide/${certId}`, data)

// Character
export const getCharacterList = (collegeId) =>
  api.get(`certificates/${collegeId}/character`)

export const getCharacterNextNo = (collegeId) =>
  api.get(`certificates/${collegeId}/character/next-no`)

export const createCharacter = (collegeId, data) =>
  api.post(`certificates/${collegeId}/character`, data)

export const updateCharacter = (collegeId, certId, data) =>
  api.put(`certificates/${collegeId}/character/${certId}`, data)

// NOC
export const getNocList = (collegeId) =>
  api.get(`certificates/${collegeId}/noc`)

export const getNocNextNo = (collegeId) =>
  api.get(`certificates/${collegeId}/noc/next-no`)

export const createNoc = (collegeId, data) =>
  api.post(`certificates/${collegeId}/noc`, data)

export const updateNoc = (collegeId, certId, data) =>
  api.put(`certificates/${collegeId}/noc/${certId}`, data)
