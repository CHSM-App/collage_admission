/**
 * PaymentResult — landing page after PayU redirects the browser back.
 *
 * PayU POSTs to /payments/payu-return on the backend which:
 *  1. Verifies the hash
 *  2. Commits the payment
 *  3. Redirects to this page with query params:
 *       ?status=success&reg=REG-XXXX   (application fee)
 *       ?status=success                 (college fee)
 *       ?status=failed&reason=...
 *
 * This component reads those params and shows the appropriate screen.
 */
import { useSearchParams, useNavigate } from 'react-router-dom'
import Button from '../../../shared/components/Button.jsx'

export default function PaymentResult() {
  const [params]  = useSearchParams()
  const navigate  = useNavigate()

  const status = params.get('status')   // 'success' | 'failed' | 'error' | 'pending'
  const reg    = params.get('reg')      // registration number (application_fee only)
  const reason = params.get('msg') || params.get('reason')   // failure/error message

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-950">Payment Error</h1>
          <p className="text-slate-600 text-sm">
            {reason || 'An unexpected error occurred while processing your payment.'}
          </p>
          <p className="text-slate-500 text-xs">
            If money was deducted from your account, please contact support with your transaction details.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              ← Go Back
            </Button>
            <Button onClick={() => navigate('/student/dashboard')}>
              My Applications
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-950">Payment Successful!</h1>

          {reg ? (
            <>
              <p className="text-slate-600 text-sm">
                Application fee paid. Your application has been submitted.
              </p>
              <p className="text-slate-700">
                Registration number:{' '}
                <span className="font-mono font-bold text-slate-950">{reg}</span>
              </p>
              <p className="text-slate-500 text-xs">
                The college will contact you for document verification.
              </p>
            </>
          ) : (
            <p className="text-slate-600 text-sm">
              College fee has been recorded. Your application is progressing.
            </p>
          )}

          <Button onClick={() => navigate('/student/dashboard')} className="mx-auto">
            Go to My Applications →
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-950">Payment Pending</h1>
          <p className="text-slate-600 text-sm">
            Your payment is being processed. This may take a few minutes.
            Please check your application status shortly.
          </p>
          <Button onClick={() => navigate('/student/dashboard')} className="mx-auto">
            Go to My Applications →
          </Button>
        </div>
      </div>
    )
  }

  // Failed or unknown
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-950">Payment Failed</h1>
        <p className="text-slate-600 text-sm">
          {reason || 'The payment was not completed. No amount has been deducted.'}
        </p>
        <p className="text-slate-500 text-xs">
          Please try again. If the issue persists, contact support.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ← Go Back
          </Button>
          <Button onClick={() => navigate('/student/dashboard')}>
            My Applications
          </Button>
        </div>
      </div>
    </div>
  )
}
