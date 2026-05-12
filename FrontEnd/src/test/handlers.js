import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:5000'

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login/student`, () =>
    HttpResponse.json({ user: { id: 1, email: 'student@test.com', role: 'student' }, token: 'tok-student', role: 'student' })
  ),
  http.post(`${BASE}/auth/login/college`, () =>
    HttpResponse.json({ user: { id: 10, email: 'admin@college.com', role: 'college' }, token: 'tok-college', role: 'college' })
  ),
  http.post(`${BASE}/auth/otp/send`, () =>
    HttpResponse.json({ message: 'OTP sent successfully.' })
  ),
  http.post(`${BASE}/auth/otp/verify`, () =>
    HttpResponse.json({ message: 'OTP verified.' })
  ),
  http.post(`${BASE}/auth/forgot-password/send-otp`, () =>
    HttpResponse.json({ message: 'OTP sent to your registered phone.' })
  ),
  http.post(`${BASE}/auth/forgot-password/reset`, () =>
    HttpResponse.json({ message: 'Password reset successful.' })
  ),

  // Notifications
  http.get(`${BASE}/notifications/student/:studentId`, () =>
    HttpResponse.json({
      data: [
        { id: 1, message: 'Your application has been reviewed.', updated_at: new Date(Date.now() + 1000).toISOString() },
        { id: 2, message: 'Fee payment confirmed.', updated_at: new Date(Date.now() + 2000).toISOString() },
      ],
    })
  ),

  // Payment
  http.get(`${BASE}/payments/college-fee-status/:appId`, () =>
    HttpResponse.json({
      data: {
        application_id: 1,
        college_fee_amount: 5000,
        college_fee_paid: false,
        payment_status: 'pending',
      },
    })
  ),
  http.post(`${BASE}/payments/create-order`, () =>
    HttpResponse.json({
      data: {
        id: 'order_test123',
        amount: 50000,
        currency: 'INR',
        key: 'rzp_test_key',
      },
    })
  ),
  http.post(`${BASE}/payments/verify`, () =>
    HttpResponse.json({ message: 'Payment verified successfully.', data: { registration_number: 'REG2024001' } })
  ),

  // College admin
  http.post(`${BASE}/college-admin/:collegeId/applications/:appId/record-cash-payment`, () =>
    HttpResponse.json({ message: 'Cash payment recorded.' })
  ),

  // Documents
  http.get(`${BASE}/uploads/*`, () =>
    new HttpResponse(new Blob(['pdf content'], { type: 'application/pdf' }), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  ),
  http.get(`${BASE}/student-documents`, () =>
    HttpResponse.json({
      data: [
        { id: 1, document_type_id: 1, document_type_name: 'Marksheet', file_path: 'uploads/marksheet.pdf', file_name: 'marksheet.pdf' },
      ],
    })
  ),

  // Applications
  http.post(`${BASE}/api/applications/init`, () =>
    HttpResponse.json({ data: { application_id: 42 } })
  ),
  http.get(`${BASE}/api/applications/:appId/form`, () =>
    HttpResponse.json({
      data: {
        application: {
          id: 42,
          college_id: 1,
          college_name: 'Test College',
          college_city: 'Pune',
          course_id: 2,
          course_name: 'B.Sc',
          year_of_study: 1,
          academic_year: '2024-25',
          application_fee: 200,
          status: 'draft',
          current_step: 1,
          application_fee_paid: false,
          correction_note: null,
        },
        documents: [],
        previous_exams: {},
      },
    })
  ),
  http.get(`${BASE}/api/student-profile/autofill`, () =>
    HttpResponse.json({
      data: {
        profile: {
          surname: 'Sharma', first_name: 'Rahul', phone: '9876543210',
          email: 'rahul@test.com', city: 'Pune', category: 'general',
        },
        last_application: {},
      },
    })
  ),
  http.get(`${BASE}/api/required-documents`, () =>
    HttpResponse.json({ data: [{ id: 1, document_type_id: 1, document_type_name: 'Marksheet', required: true }] })
  ),
  http.patch(`${BASE}/api/applications/:appId/:endpoint`, () =>
    HttpResponse.json({ message: 'Saved.' })
  ),
  http.post(`${BASE}/api/applications/:appId/declaration`, () =>
    HttpResponse.json({ message: 'Declaration accepted.' })
  ),
  http.post(`${BASE}/api/applications/:appId/resubmit`, () =>
    HttpResponse.json({ message: 'Application resubmitted.' })
  ),
]
