/**
 * Scroll the first matching form control into view and focus it, so the user
 * lands on the field an error message is about. Matches `name="…"` (inputs,
 * selects, radio groups) or `data-field="…"` (custom widgets without a name).
 */
export default function scrollToField(field) {
  if (!field) return
  // Wait a frame so an error message rendered in the same update is laid out
  requestAnimationFrame(() => {
    const el = document.querySelector(`[name="${CSS.escape(field)}"], [data-field="${CSS.escape(field)}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus?.({ preventScroll: true })
  })
}
