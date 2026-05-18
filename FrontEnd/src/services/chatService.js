import api from './api'

export const sendChatMessage = (message, role) =>
  api.post('chat', { message, role })

export const getChatSuggestions = (role) =>
  api.get(`chat/suggestions?role=${role}`)
