/**
 * usePermissions — returns permission helpers for the logged-in college user.
 *
 * For the main college admin (is_staff = false/undefined), all permissions are granted.
 * For staff users, permissions come from user.permissions map.
 *
 * canWrite(perm)  — true if the user has write access for this permission
 * canView(perm)   — true always (all staff can view everything; denied = read-only)
 * isStaff         — true if this is a sub-user, not the main college admin
 */
import { useAuthContext } from '../../../context/AuthContext.jsx'

export function usePermissions() {
  const { user } = useAuthContext()

  const isStaff = !!user?.is_staff

  function canWrite(perm) {
    if (!isStaff) return true           // main college admin has all access
    return !!user?.permissions?.[perm]
  }

  // All users can always view; write-denied means read-only
  function canView() { return true }

  return { canWrite, canView, isStaff, permissions: user?.permissions || {} }
}
