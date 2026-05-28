/**
 * usePayU — initiates a PayU redirect payment.
 *
 * PayU uses a server-signed form POST (redirect flow) — no external SDK needed.
 * The backend returns { endpoint, fields } and we auto-submit a hidden form.
 *
 * Usage:
 *   const { redirectToPayU } = usePayU()
 *   redirectToPayU({ endpoint, fields })
 */

export function usePayU() {
  /**
   * Auto-submit a hidden HTML form to the PayU endpoint.
   * This redirects the browser away from the SPA — the user will be sent
   * to the PayU payment page and then redirected back to surl/furl.
   *
   * @param {{ endpoint: string, fields: Record<string, string> }} payuData
   */
  function redirectToPayU({ endpoint, fields }) {
    // Remove any previous form leftover (safety)
    const existing = document.getElementById('__payu_form__')
    if (existing) existing.remove()

    const form = document.createElement('form')
    form.id     = '__payu_form__'
    form.method = 'POST'
    form.action = endpoint

    Object.entries(fields).forEach(([name, value]) => {
      const input  = document.createElement('input')
      input.type   = 'hidden'
      input.name   = name
      input.value  = value ?? ''
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
  }

  return { redirectToPayU }
}
