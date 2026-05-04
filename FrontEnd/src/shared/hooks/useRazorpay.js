/**
 * useRazorpay — loads the Razorpay checkout script once (module-level singleton)
 * and exposes openCheckout().
 *
 * Usage:
 *   const { openCheckout, scriptError } = useRazorpay()
 *   openCheckout({ orderData, onSuccess, onFailure })
 */
import { useState, useEffect } from 'react'

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

// Module-level singleton — shared across all hook instances.
// null  = not started yet
// Promise = load in progress or already done
let scriptPromise = null

function getScriptPromise() {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve) => {
    // Already loaded by a previous page visit (SPA navigation)
    if (window.Razorpay) {
      resolve(true)
      return
    }

    // Script tag already in DOM but still loading (e.g. two components mounted at once)
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load',  () => resolve(true),  { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      // If it already finished loading before we attached the listener,
      // window.Razorpay will be set — check once with a short delay.
      setTimeout(() => { if (window.Razorpay) resolve(true) }, 200)
      return
    }

    const script = document.createElement('script')
    script.src   = SCRIPT_URL
    script.async = true
    script.onload  = () => resolve(true)
    script.onerror = () => { scriptPromise = null; resolve(false) }  // reset so retry is possible
    document.body.appendChild(script)
  })

  return scriptPromise
}

export function useRazorpay() {
  const [scriptError, setScriptError] = useState(false)

  useEffect(() => {
    // If already loaded, no state update needed — avoids flicker
    if (window.Razorpay) return

    getScriptPromise().then(ok => {
      if (!ok) setScriptError(true)
    })
  }, [])

  function openCheckout({ orderData, onSuccess, onFailure }) {
    if (!window.Razorpay) {
      onFailure(new Error('Razorpay SDK not loaded'))
      return
    }

    const options = {
      key:         orderData.key_id,
      amount:      orderData.amount,
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

  return { openCheckout, scriptError }
}
