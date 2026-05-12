import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext.jsx'

// Mock react-router hooks
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams:       vi.fn(),
    useSearchParams: vi.fn(),
    useNavigate:     vi.fn(),
  }
})

// Mock application service
vi.mock('../../services/applicationService.js', () => ({
  initApplication:        vi.fn(),
  getApplicationForm:     vi.fn(),
  updateApplicationStep:  vi.fn(),
  getRequiredDocuments:   vi.fn(),
  getStudentAutofill:     vi.fn(),
}))

// Mock document service
vi.mock('../../services/documentService.js', () => ({
  getStudentDocuments: vi.fn(),
}))

import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  initApplication,
  getApplicationForm,
  updateApplicationStep,
  getRequiredDocuments,
  getStudentAutofill,
} from '../../services/applicationService.js'
import { getStudentDocuments } from '../../services/documentService.js'
import { useApplicationForm } from '../../features/student/hooks/useApplicationForm.js'

const MOCK_USER = { id: 5, email: 'student@test.com', role: 'student' }
const MOCK_APP = {
  id: 42,
  college_id: 1, college_name: 'Test College', college_city: 'Pune',
  course_id: 2, course_name: 'B.Sc', year_of_study: 1,
  academic_year: '2024-25', application_fee: 200,
  status: 'draft', current_step: 1,
  application_fee_paid: false, correction_note: null,
}

const MOCK_FORM_RESPONSE = {
  data: {
    data: {
      application: MOCK_APP,
      documents: [],
      previous_exams: {},
    },
  },
}

const MOCK_AUTOFILL = {
  data: {
    data: {
      profile: { surname: 'Sharma', first_name: 'Rahul', phone: '9876543210', category: 'general' },
      last_application: {},
    },
  },
}

const MOCK_DOCS = { data: { data: [{ id: 1, document_type_name: 'Marksheet' }] } }
const MOCK_REQUIRED = { data: { data: [{ id: 1, document_type_id: 1, required: true }] } }

// Set localStorage with user session before rendering
function setupLocalStorage() {
  localStorage.setItem('collegeAdmissionAuth', JSON.stringify({
    user: MOCK_USER, role: 'student', token: 'tok', isAuthenticated: true,
  }))
}

function wrapper({ children }) {
  return React.createElement(
    MemoryRouter,
    { initialEntries: ['/apply/42'] },
    React.createElement(AuthProvider, null, children)
  )
}

describe('useApplicationForm', () => {
  const mockNavigate = vi.fn()

  function setupSuccessMocks() {
    getApplicationForm.mockResolvedValue(MOCK_FORM_RESPONSE)
    getStudentAutofill.mockResolvedValue(MOCK_AUTOFILL)
    getStudentDocuments.mockResolvedValue(MOCK_DOCS)
    getRequiredDocuments.mockResolvedValue(MOCK_REQUIRED)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setupLocalStorage()

    useParams.mockReturnValue({ applicationId: '42' })
    useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()])
    useNavigate.mockReturnValue(mockNavigate)

    setupSuccessMocks()
  })

  it('initial state: loading=true, applicationId=null', () => {
    // Make init hang to test initial state (use Once so subsequent tests are unaffected)
    getApplicationForm.mockReturnValueOnce(new Promise(() => {}))
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    expect(result.current.loading).toBe(true)
    expect(result.current.applicationId).toBeNull()
  })

  it('loads existing application when paramId is numeric', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(getApplicationForm).toHaveBeenCalledWith(42)
    expect(result.current.applicationId).toBe(42)
    expect(result.current.appStatus).toBe('draft')
    expect(result.current.applicationFeePaid).toBe(false)
  })

  it('initializes new application when paramId is "new"', async () => {
    useParams.mockReturnValue({ applicationId: 'new' })
    useSearchParams.mockReturnValue([
      new URLSearchParams({
        college_id: '1', course_id: '2', period_id: '3', academic_year: '2024-25',
      }),
      vi.fn(),
    ])

    initApplication.mockResolvedValueOnce({ data: { data: { application_id: 99 } } })
    getApplicationForm.mockResolvedValueOnce({
      data: {
        data: {
          application: { ...MOCK_APP, id: 99 },
          documents: [],
          previous_exams: {},
        },
      },
    })

    const { result } = renderHook(() => useApplicationForm(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(initApplication).toHaveBeenCalledWith({
      student_id: MOCK_USER.id,
      college_id: 1,
      course_id: 2,
      admission_period_id: 3,
      academic_year: '2024-25',
      year_of_study: undefined,
    })
    expect(mockNavigate).toHaveBeenCalledWith('/apply/99', { replace: true })
  })

  it('sets globalError on init failure', async () => {
    getApplicationForm.mockRejectedValueOnce({
      response: { data: { message: 'Application not found.' } },
    })

    const { result } = renderHook(() => useApplicationForm(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.globalError).toBe('Application not found.')
  })

  it('autofills profile data into form data', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.college_name).toBe('Test College')
    expect(result.current.data.course_name).toBe('B.Sc')
  })

  it('loads student documents and required documents', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.student_documents).toHaveLength(1)
    expect(result.current.data.required_documents).toHaveLength(1)
  })

  it('setField updates data and clears errors', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setField('surname', 'Patel'))
    expect(result.current.data.surname).toBe('Patel')
    expect(result.current.errors).toEqual({})
  })

  it('handleChange updates data via event', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleChange({ target: { name: 'first_name', value: 'Priya' } })
    })
    expect(result.current.data.first_name).toBe('Priya')
  })

  it('goStep changes currentStep', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.goStep(3))
    expect(result.current.currentStep).toBe(3)
    expect(result.current.errors).toEqual({})
  })

  it('saveAndNext calls updateApplicationStep and advances step', async () => {
    updateApplicationStep.mockResolvedValueOnce({ data: { message: 'Saved.' } })

    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveAndNext('personal', { surname: 'Sharma' }, 2)
    })

    expect(updateApplicationStep).toHaveBeenCalledWith(42, 'personal', { surname: 'Sharma' })
    expect(result.current.currentStep).toBe(2)
    expect(result.current.saving).toBe(false)
  })

  it('saveAndNext skips API call when endpoint is null', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveAndNext(null, {}, 3)
    })

    expect(updateApplicationStep).not.toHaveBeenCalled()
    expect(result.current.currentStep).toBe(3)
  })

  it('saveAndNext sets field errors on validation failure', async () => {
    updateApplicationStep.mockRejectedValueOnce({
      response: {
        data: {
          errors: { surname: 'Surname is required.' },
        },
      },
    })

    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveAndNext('personal', {}, 2)
    })

    expect(result.current.errors).toEqual({ surname: 'Surname is required.' })
    expect(result.current.currentStep).toBe(1) // stays on same step
  })

  it('saveAndNext sets globalError on server error (no errors obj)', async () => {
    updateApplicationStep.mockRejectedValueOnce({
      response: { data: { message: 'Server error occurred.' } },
    })

    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveAndNext('personal', {}, 2)
    })

    expect(result.current.globalError).toBe('Server error occurred.')
  })

  it('readOnly is false for draft status', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.readOnly).toBe(false)
  })

  it('readOnly is true for submitted status', async () => {
    getApplicationForm.mockResolvedValueOnce({
      data: {
        data: {
          application: { ...MOCK_APP, status: 'submitted' },
          documents: [],
          previous_exams: {},
        },
      },
    })

    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.readOnly).toBe(true)
  })

  it('setDocuments updates linked_documents', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const newDocs = [{ id: 2, document_type_name: 'ID Card' }]
    act(() => result.current.setDocuments(newDocs))
    expect(result.current.data.linked_documents).toEqual(newDocs)
  })

  it('advanceToStep6 sets currentStep and maxStep to 6', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.advanceToStep6())
    expect(result.current.currentStep).toBe(6)
  })

  it('exposes studentId from user context', async () => {
    const { result } = renderHook(() => useApplicationForm(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.studentId).toBe(MOCK_USER.id)
  })
})
