/**
 * Utility for consistent network/server error message extraction.
 *
 * Usage in any component catch block:
 *
 *   import { getErrorMessage, isNetworkError } from '../../../shared/hooks/useNetworkError.js'
 *
 *   catch (err) {
 *     setError(getErrorMessage(err))
 *   }
 *
 * The axios interceptor in api.js already sets err.isNetworkError = true and
 * writes a user-friendly err.message for offline/unreachable cases, so
 * getErrorMessage() simply reads that — no duplicated detection needed here.
 */

/**
 * Returns true if the error is a network-level failure (offline or server
 * unreachable), as tagged by the axios response interceptor.
 */
export function isNetworkError(err) {
  return !!err?.isNetworkError
}

/**
 * Returns the most user-friendly error message available, in priority order:
 * 1. Axios-interceptor message (covers network errors + 403/429 with custom text)
 * 2. Server response body message
 * 3. Provided fallback
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  // Network error — interceptor already wrote a good message
  if (err.isNetworkError) return err.message
  // Server returned a structured error body
  const serverMsg = err?.response?.data?.message
  if (serverMsg) return serverMsg
  // Interceptor-enriched message (403, 429, etc.)
  if (err.message && err.message !== 'Network Error') return err.message
  return fallback
}
