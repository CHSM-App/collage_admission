import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'

const ALL_PERMISSIONS = [
  { key: 'submit_application', label: 'Submit New Application' },
  { key: 'review_application', label: 'Review Applications' },
  { key: 'edit_application',   label: 'Edit Student Application Form' },
  { key: 'upload_documents',   label: 'Upload Documents' },
  { key: 'review_documents',   label: 'Review / Verify Documents' },
  { key: 'assign_subjects',    label: 'Assign Subjects & Roll Numbers' },
  { key: 'collect_fees',       label: 'Collect Fees' },
  { key: 'masters',            label: 'Masters (Add / Edit)' },
]

const emptyPerms = () => Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, false]))

const ALL_NAV_ITEMS = [
  { key: 'overview',          label: 'Overview' },
  { key: 'periods',           label: 'Admission Periods' },
  { key: 'inbox',             label: 'Admission Inbox' },
  { key: 'add-application',   label: 'Admission (Add)' },
  { key: 'rollnumbers',       label: 'Roll Numbers' },
  { key: 'master-faculty',    label: 'Program Master' },
  { key: 'master-class',      label: 'Class Master' },
  { key: 'master-bank',       label: 'Bank Master' },
  { key: 'master-course',     label: 'Course Master' },
  { key: 'master-group',      label: 'Group Master' },
  { key: 'master-division',   label: 'Division Master' },
  { key: 'master-fees',       label: 'Fees Master' },
  { key: 'master-documents',  label: 'Required Documents' },
]
const emptyNav = () => Object.fromEntries(ALL_NAV_ITEMS.map(n => [n.key, true]))

export default function RolesPanel({ college }) {
  const [roles,     setRoles]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('roles')   // 'roles' | 'users'

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole,  setEditingRole]  = useState(null)   // role object when editing
  const [roleForm,     setRoleForm]     = useState({ role_name: '', permissions: emptyPerms(), nav_visibility: emptyNav() })
  const [roleSaving,   setRoleSaving]   = useState(false)
  const [roleError,    setRoleError]    = useState('')

  // User form
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser,  setEditingUser]  = useState(null)
  const [userForm,     setUserForm]     = useState({ full_name: '', email: '', password: '', role_id: '' })
  const [userSaving,   setUserSaving]   = useState(false)
  const [userError,    setUserError]    = useState('')

  const [msg, setMsg] = useState('')

  function fetchRoles() {
    setLoading(true)
    api.get(`admin/colleges/${college.id}/roles`)
      .then(r => setRoles(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRoles() }, [college.id])

  // ── Role helpers ─────────────────────────────────────────
  function openNewRole() {
    setEditingRole(null)
    setRoleForm({ role_name: '', permissions: emptyPerms(), nav_visibility: emptyNav() })
    setRoleError('')
    setShowRoleForm(true)
  }

  function openEditRole(role) {
    const perms = emptyPerms()
    const nav = emptyNav()
    role.permissions.forEach(p => {
      if (p.permission.startsWith('nav:')) {
        nav[p.permission.slice(4)] = !!p.can_write
      } else {
        perms[p.permission] = !!p.can_write
      }
    })
    setEditingRole(role)
    setRoleForm({ role_name: role.role_name, permissions: perms, nav_visibility: nav })
    setRoleError('')
    setShowRoleForm(true)
  }

  async function saveRole(e) {
    e.preventDefault()
    if (!roleForm.role_name.trim()) { setRoleError('Role name is required.'); return }
    setRoleSaving(true)
    setRoleError('')
    try {
      if (editingRole) {
        await api.put(`admin/colleges/${college.id}/roles/${editingRole.id}`, roleForm)
        setMsg('Role updated.')
      } else {
        await api.post(`admin/colleges/${college.id}/roles`, roleForm)
        setMsg('Role created.')
      }
      setShowRoleForm(false)
      fetchRoles()
    } catch (err) {
      setRoleError(err?.response?.data?.message || 'Failed to save role.')
    } finally {
      setRoleSaving(false) }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete role "${role.role_name}"?`)) return
    try {
      await api.delete(`admin/colleges/${college.id}/roles/${role.id}`)
      setMsg('Role deleted.')
      fetchRoles()
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to delete role.')
    }
  }

  // ── User helpers ─────────────────────────────────────────
  function openNewUser() {
    setEditingUser(null)
    setUserForm({ full_name: '', email: '', password: '', role_id: roles[0]?.id || '' })
    setUserError('')
    setShowUserForm(true)
  }

  function openEditUser(user) {
    setEditingUser(user)
    setUserForm({ full_name: user.full_name, email: user.email, password: '', role_id: user.role_id })
    setUserError('')
    setShowUserForm(true)
  }

  async function saveUser(e) {
    e.preventDefault()
    if (!userForm.full_name.trim() || !userForm.email.trim() || !userForm.role_id) {
      setUserError('Name, email and role are required.')
      return
    }
    if (!editingUser && !userForm.password) { setUserError('Password is required for new users.'); return }
    setUserSaving(true)
    setUserError('')
    try {
      if (editingUser) {
        await api.put(`admin/colleges/${college.id}/users/${editingUser.id}`, userForm)
        setMsg('User updated.')
      } else {
        await api.post(`admin/colleges/${college.id}/users`, userForm)
        setMsg('User created.')
      }
      setShowUserForm(false)
      fetchRoles()
    } catch (err) {
      setUserError(err?.response?.data?.message || 'Failed to save user.')
    } finally {
      setUserSaving(false) }
  }

  async function toggleUser(user) {
    try {
      await api.put(`admin/colleges/${college.id}/users/${user.id}`, { is_active: !user.is_active })
      setMsg(user.is_active ? 'User deactivated.' : 'User activated.')
      fetchRoles()
    } catch { setMsg('Failed to update user.') }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete user "${user.full_name}"?`)) return
    try {
      await api.delete(`admin/colleges/${college.id}/users/${user.id}`)
      setMsg('User deleted.')
      fetchRoles()
    } catch { setMsg('Failed to delete user.') }
  }

  // Flatten users from all roles
  const allUsers = roles.flatMap(r => r.users.map(u => ({ ...u, role_name: r.role_name, role_id: r.id })))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{college.name}</h2>
          <p className="text-xs text-blue-600 font-mono">{college.college_code} · {college.city}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTab('roles'); setMsg('') }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${tab === 'roles' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Roles ({roles.length})
          </button>
          <button onClick={() => { setTab('users'); setMsg('') }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${tab === 'users' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Staff ({allUsers.length})
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800 flex justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-emerald-500 hover:text-emerald-700 ml-4">✕</button>
        </div>
      )}

      {/* ── ROLES TAB ── */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewRole}>+ New Role</Button>
          </div>

          {/* Role form */}
          {showRoleForm && (
            <form onSubmit={saveRole} className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
              <p className="font-semibold text-slate-900">{editingRole ? `Edit Role: ${editingRole.role_name}` : 'New Role'}</p>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role Name <span className="text-red-500">*</span></label>
                <input
                  value={roleForm.role_name}
                  onChange={e => setRoleForm(f => ({ ...f, role_name: e.target.value }))}
                  placeholder="e.g. Admission Clerk"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Permissions <span className="text-slate-400 font-normal">(toggle ON = write access, OFF = read-only)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!roleForm.permissions[p.key]}
                        onChange={e => setRoleForm(f => ({ ...f, permissions: { ...f.permissions, [p.key]: e.target.checked } }))}
                        className="accent-amber-500 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Sidebar Visibility <span className="text-slate-400 font-normal">(checked = visible in sidebar)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_NAV_ITEMS.map(n => (
                    <label key={n.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!roleForm.nav_visibility[n.key]}
                        onChange={e => setRoleForm(f => ({ ...f, nav_visibility: { ...f.nav_visibility, [n.key]: e.target.checked } }))}
                        className="accent-blue-500 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">{n.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {roleError && <p className="text-sm text-red-600">{roleError}</p>}

              <div className="flex gap-3">
                <Button type="submit" loading={roleSaving}>{editingRole ? 'Update Role' : 'Create Role'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowRoleForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Roles list */}
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-slate-400">No roles yet. Create one to start adding staff.</p>
          ) : (
            <div className="space-y-3">
              {roles.map(role => (
                <div key={role.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{role.role_name}</p>
                      <p className="text-xs text-slate-400">{role.users.length} user{role.users.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditRole(role)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => deleteRole(role)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {ALL_PERMISSIONS.map(p => {
                      const granted = role.permissions.find(rp => rp.permission === p.key)?.can_write
                      return (
                        <span key={p.key} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          granted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400'
                        }`}>
                          {granted ? '✓' : '–'} {p.label}
                        </span>
                      )
                    })}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Sidebar</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_NAV_ITEMS.map(n => {
                        const entry = role.permissions.find(rp => rp.permission === `nav:${n.key}`)
                        const visible = entry ? !!entry.can_write : true
                        return (
                          <span key={n.key} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            visible ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-400'
                          }`}>
                            {visible ? '👁' : '–'} {n.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewUser} disabled={roles.length === 0}>+ New Staff User</Button>
          </div>
          {roles.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Create at least one role before adding staff users.
            </p>
          )}

          {/* User form */}
          {showUserForm && (
            <form onSubmit={saveUser} className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
              <p className="font-semibold text-slate-900">{editingUser ? `Edit User: ${editingUser.full_name}` : 'New Staff User'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Staff member name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="staff@college.edu.in"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Password {editingUser && <span className="font-normal text-slate-400">(leave blank to keep)</span>}
                    {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role <span className="text-red-500">*</span></label>
                  <select value={userForm.role_id} onChange={e => setUserForm(f => ({ ...f, role_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Select role —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                  </select>
                </div>
              </div>

              {userError && <p className="text-sm text-red-600">{userError}</p>}
              <div className="flex gap-3">
                <Button type="submit" loading={userSaving}>{editingUser ? 'Update User' : 'Create User'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowUserForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Users list */}
          {allUsers.length === 0 ? (
            <p className="text-sm text-slate-400">No staff users yet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map(u => (
                    <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600">{u.role_name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-3">
                        <button onClick={() => openEditUser(u)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => toggleUser(u)} className="text-xs font-semibold text-amber-600 hover:underline">
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => deleteUser(u)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
