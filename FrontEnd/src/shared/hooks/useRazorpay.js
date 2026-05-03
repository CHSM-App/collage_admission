/**
 * useRazorpay — loads the Razorpay checkout script once and exposes openCheckout().
 *
 * Usage:
 *   const { openCheckout, loading, error } = useRazorpay()
 *   openCheckout({ orderData, onSuccess, onFailure })
 *
 *   orderData = response from POST /payments/create-order  (data field)
 *   onSuccess(response) — called after Razorpay confirms payment
 *   onFailure(err)      — called on modal close without payment
 */
import { useState, useEffect } from 'react'

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
      resolve(!!window.Razorpay)
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function useRazorpay() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptError,  setScriptError]  = useState(false)

  useEffect(() => {
    loadRazorpayScript().then(ok => {
      if (ok) setScriptLoaded(true)
      else    setScriptError(true)
    })
  }, [])

  function openCheckout({ orderData, onSuccess, onFailure }) {
    if (!window.Razorpay) {
      onFailure(new Error('Razorpay SDK not loaded'))
      return
    }

    const options = {
      key:         orderData.key_id,
      amount:      orderData.amount,        // paise
      currency:    orderData.currency,
      order_id:    orderData.order_id,
      name:        'College Admission',
      description: orderData.payment_type === 'application_fee'
        ? 'Application Fee'
        : 'College Admission Fee',
      prefill: {
        name:    orderData.student_name  || '',
        email:   orderData.student_email || '',
        contact: orderData.student_phone || '',
      },
      theme: { color: '#1e293b' },
      handler: function (response) {
        onSuccess(response)
      },
      modal: {
        ondismiss: function () {
          onFailure(new Error('Payment cancelled by user.'))
        },
      },
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  return { openCheckout, scriptLoaded, scriptError }
}
