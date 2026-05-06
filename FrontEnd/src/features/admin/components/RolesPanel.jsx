import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'

// ── Permission definitions ────────────────────────────────────
const ALL_PERMISSIONS = [
  { key: 'submit_application', label: 'Submit New Application',       desc: 'Fill and submit the admission form on behalf of a student' },
  { key: 'review_application', label: 'Review & Approve Applications', desc: 'Accept, reject, request corrections, and set fees for applications' },
  { key: 'edit_application',   label: 'Edit Student Application',      desc: 'Edit a student\'s filled application form' },
  { key: 'upload_documents',   label: 'Upload Documents',              desc: 'Upload documents on behalf of an applicant' },
  { key: 'review_documents',   label: 'Verify Documents',              desc: 'Mark uploaded documents as verified' },
  { key: 'collect_fees',       label: 'Collect Fees',                  desc: 'Record cash payments and manage fee receipts' },
  { key: 'assign_subjects',    label: 'Assign Roll Numbers',           desc: 'Generate and assign roll numbers to enrolled students' },
  { key: 'masters',            label: 'Manage Masters',                desc: 'Add/edit program, course, bank, fee, and document masters' },
]

// ── Nav visibility definitions ────────────────────────────────
const NAV_SECTIONS = [
  {
    group: 'Main',
    items: [
      { key: 'overview',        label: 'Overview',           desc: 'Dashboard home page' },
      { key: 'periods',         label: 'Admission Periods',  desc: 'Manage open/closed admission periods' },
      { key: 'inbox',           label: 'Application Inbox',  desc: 'Review and process student applications' },
      { key: 'add-application', label: 'Add Application',    desc: 'Submit an application on behalf of a student' },
      { key: 'rollnumbers',     label: 'Roll Numbers',       desc: 'Bulk generate roll numbers' },
      { key: 'fee-receipts',    label: 'Fee Receipts',       desc: 'View and collect college fee payments' },
    ],
  },
  {
    group: 'Masters',
    items: [
      { key: 'master-faculty',   label: 'Program Master',    desc: 'Degree programs and university codes' },
      { key: 'master-class',     label: 'Class Master',      desc: 'Class/batch configuration' },
      { key: 'master-bank',      label: 'Bank Master',       desc: 'Bank account details' },
      { key: 'master-course',    label: 'Course Master',     desc: 'Course codes and names' },
      { key: 'master-group',     label: 'Group Master',      desc: 'Student group categories' },
      { key: 'master-division',  label: 'Division Master',   desc: 'Class divisions' },
      { key: 'master-fees',      label: 'Fees Master',       desc: 'Fee heads, slabs, and class overrides' },
      { key: 'master-documents', label: 'Required Documents',desc: 'Document checklist configuration' },
    ],
  },
]

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

const emptyPerms   = () => Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, false]))
const emptyNav     = () => Object.fromEntries(ALL_NAV_ITEMS.map(n => [n.key, true]))   // new role: all visible by default
const emptyNavEdit = () => Object.fromEntries(ALL_NAV_ITEMS.map(n => [n.key, false]))  // edit role: only what DB says

export default function RolesPanel({ college }) {
  const [roles,   setRoles]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('roles')   // 'roles' | 'users'
  const [msg,     setMsg]     = useState('')
  const [msgType, setMsgType] = useState('ok')      // 'ok' | 'err'

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole,  setEditingRole]  = useState(null)
  const [roleForm,     setRoleForm]     = useState({ role_name: '', permissions: emptyPerms(), nav_visibility: emptyNav() })
  const [roleSaving,   setRoleSaving]   = useState(false)
  const [roleError,    setRoleError]    = useState('')

  // User form
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser,  setEditingUser]  = useState(null)
  const [userForm,     setUserForm]     = useState({ full_name: '', email: '', password: '', role_id: '' })
  const [userSaving,   setUserSaving]   = useState(false)
  const [userError,    setUserError]    = useState('')

  function fetchRoles() {
    setLoading(true)
    api.get(`admin/colleges/${college.id}/roles`)
      .then(r => setRoles(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRoles() }, [college.id])

  function flash(text, type = 'ok') { setMsg(text); setMsgType(type) }

  // ── Role helpers ─────────────────────────────────────────────
  function openNewRole() {
    setEditingRole(null)
    setRoleForm({ role_name: '', permissions: emptyPerms(), nav_visibility: emptyNav() })
    setRoleError('')
    setShowRoleForm(true)
  }

  function openEditRole(role) {
    const perms = emptyPerms()
    const nav   = emptyNavEdit()
    role.permissions.forEach(p => {
      if (p.permission.startsWith('nav:')) nav[p.permission.slice(4)] = !!p.can_write
      else perms[p.permission] = !!p.can_write
    })
    setEditingRole(role)
    setRoleForm({ role_name: role.role_name, permissions: perms, nav_visibility: nav })
    setRoleError('')
    setShowRoleForm(true)
  }

  async function saveRole(e) {
    e.preventDefault()
    if (!roleForm.role_name.trim()) { setRoleError('Role name is required.'); return }
    setRoleSaving(true); setRoleError('')
    try {
      if (editingRole) {
        await api.put(`admin/colleges/${college.id}/roles/${editingRole.id}`, roleForm)
        flash('Role updated.')
      } else {
        await api.post(`admin/colleges/${college.id}/roles`, roleForm)
        flash('Role created.')
      }
      setShowRoleForm(false)
      fetchRoles()
    } catch (err) {
      setRoleError(err?.response?.data?.message || 'Failed to save role.')
    } finally { setRoleSaving(false) }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete role "${role.role_name}"? This cannot be undone.`)) return
    try {
      await api.delete(`admin/colleges/${college.id}/roles/${role.id}`)
      flash('Role deleted.')
      fetchRoles()
    } catch (err) {
      flash(err?.response?.data?.message || 'Failed to delete role.', 'err')
    }
  }

  // ── User helpers ─────────────────────────────────────────────
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
      setUserError('Name, email and role are required.'); return
    }
    if (!editingUser && !userForm.password) { setUserError('Password is required for new users.'); return }
    setUserSaving(true); setUserError('')
    try {
      if (editingUser) {
        await api.put(`admin/colleges/${college.id}/users/${editingUser.id}`, userForm)
        flash('Staff user updated.')
      } else {
        await api.post(`admin/colleges/${college.id}/users`, userForm)
        flash('Staff user created.')
      }
      setShowUserForm(false)
      fetchRoles()
    } catch (err) {
      setUserError(err?.response?.data?.message || 'Failed to save user.')
    } finally { setUserSaving(false) }
  }

  async function toggleUser(user) {
    try {
      await api.put(`admin/colleges/${college.id}/users/${user.id}`, { is_active: !user.is_active })
      flash(user.is_active ? 'User deactivated.' : 'User activated.')
      fetchRoles()
    } catch { flash('Failed to update user.', 'err') }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete user "${user.full_name}"? This cannot be undone.`)) return
    try {
      await api.delete(`admin/colleges/${college.id}/users/${user.id}`)
      flash('User deleted.')
      fetchRoles()
    } catch { flash('Failed to delete user.', 'err') }
  }

  const allUsers = roles.flatMap(r => r.users.map(u => ({ ...u, role_name: r.role_name, role_id: r.id })))
  const grantedPerms = (role) => ALL_PERMISSIONS.filter(p => role.permissions.find(rp => rp.permission === p.key)?.can_write)
  const hiddenNav = (role) => ALL_NAV_ITEMS.filter(n => {
    const entry = role.permissions.find(rp => rp.permission === `nav:${n.key}`)
    return entry ? !entry.can_write : false
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{college.name}</h2>
          <p className="text-xs text-blue-600 font-mono">{college.college_code} · {college.city}</p>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'roles', label: `Roles (${roles.length})` },
            { key: 'users', label: `Staff (${allUsers.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setMsg('') }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                tab === t.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-2 text-sm flex justify-between items-center ${
          msgType === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ══════════════ ROLES TAB ══════════════ */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Roles define what each staff member can do. Each staff account is assigned one role.
            </p>
            <Button onClick={openNewRole}>+ New Role</Button>
          </div>

          {/* Role form */}
          {showRoleForm && (
            <form onSubmit={saveRole} className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
              {/* Form header */}
              <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <p className="font-semibold text-slate-900">
                  {editingRole ? `Edit Role: ${editingRole.role_name}` : 'Create New Role'}
                </p>
                <button type="button" onClick={() => setShowRoleForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>

              <div className="px-5 py-5 space-y-6">
                {/* Role name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={roleForm.role_name}
                    onChange={e => setRoleForm(f => ({ ...f, role_name: e.target.value }))}
                    placeholder="e.g. Admission Clerk, Document Verifier"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* Access Control */}
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-bold text-slate-800">Access Control</p>
                    <p className="text-xs text-slate-400 mt-0.5">Choose what actions this role is allowed to perform. Unchecked = read-only (can view but not act).</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {ALL_PERMISSIONS.map(p => (
                      <label key={p.key}
                        className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition ${
                          roleForm.permissions[p.key] ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'
                        }`}>
                        <div className="shrink-0">
                          <input
                            type="checkbox"
                            checked={!!roleForm.permissions[p.key]}
                            onChange={e => setRoleForm(f => ({ ...f, permissions: { ...f.permissions, [p.key]: e.target.checked } }))}
                            className="sr-only"
                          />
                          <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition ${
                            roleForm.permissions[p.key]
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {roleForm.permissions[p.key] && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${roleForm.permissions[p.key] ? 'text-emerald-800' : 'text-slate-700'}`}>
                            {p.label}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                          roleForm.permissions[p.key]
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {roleForm.permissions[p.key] ? 'Allowed' : 'View only'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sidebar Visibility */}
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-bold text-slate-800">Sidebar Visibility</p>
                    <p className="text-xs text-slate-400 mt-0.5">Choose which sections appear in this role's sidebar. Hidden sections are completely inaccessible.</p>
                  </div>
                  <div className="space-y-4">
                    {NAV_SECTIONS.map(section => (
                      <div key={section.group}>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{section.group}</p>
                        <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                          {section.items.map(n => (
                            <label key={n.key}
                              className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition ${
                                roleForm.nav_visibility[n.key] ? 'bg-white hover:bg-blue-50' : 'bg-slate-50'
                              }`}>
                              <div className="shrink-0">
                                <input
                                  type="checkbox"
                                  checked={!!roleForm.nav_visibility[n.key]}
                                  onChange={e => setRoleForm(f => ({ ...f, nav_visibility: { ...f.nav_visibility, [n.key]: e.target.checked } }))}
                                  className="sr-only"
                                />
                                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition ${
                                  roleForm.nav_visibility[n.key]
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-slate-300 bg-white'
                                }`}>
                                  {roleForm.nav_visibility[n.key] && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${roleForm.nav_visibility[n.key] ? 'text-slate-800' : 'text-slate-400'}`}>
                                  {n.label}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{n.desc}</p>
                              </div>
                              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                                roleForm.nav_visibility[n.key]
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {roleForm.nav_visibility[n.key] ? 'Visible' : 'Hidden'}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {roleError && <p className="text-sm text-red-600">{roleError}</p>}

                <div className="flex gap-3 pt-1">
                  <Button type="submit" loading={roleSaving}>
                    {editingRole ? 'Update Role' : 'Create Role'}
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => setShowRoleForm(false)}>Cancel</Button>
                </div>
              </div>
            </form>
          )}

          {/* Roles list */}
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : roles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
              No roles yet. Create a role to start adding staff members.
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map(role => {
                const granted = grantedPerms(role)
                const hidden  = hiddenNav(role)
                return (
                  <div key={role.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {/* Role header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{role.role_name}</p>
                          <p className="text-xs text-slate-400">
                            {role.users.length} staff member{role.users.length !== 1 ? 's' : ''} assigned
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => openEditRole(role)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition">Edit</button>
                        <button onClick={() => deleteRole(role)}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Delete</button>
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      {/* Access control summary */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Access Control</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_PERMISSIONS.map(p => {
                            const has = role.permissions.find(rp => rp.permission === p.key)?.can_write
                            return (
                              <span key={p.key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                has
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {has
                                  ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                  : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9"/></svg>
                                }
                                {p.label}
                              </span>
                            )
                          })}
                        </div>
                        {granted.length === 0 && (
                          <p className="text-xs text-slate-400 mt-1">Read-only access to everything (no write permissions)</p>
                        )}
                      </div>

                      {/* Hidden nav summary */}
                      {hidden.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Hidden Sidebar Sections</p>
                          <div className="flex flex-wrap gap-1.5">
                            {hidden.map(n => (
                              <span key={n.key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-500">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                                {n.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {hidden.length === 0 && (
                        <p className="text-xs text-slate-400">All sidebar sections are visible</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ USERS TAB ══════════════ */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Each staff member is assigned a role. They log in with their email and password.
            </p>
            <Button onClick={openNewUser} disabled={roles.length === 0}>+ New Staff User</Button>
          </div>

          {roles.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Create at least one role before adding staff users.
            </div>
          )}

          {/* User form */}
          {showUserForm && (
            <form onSubmit={saveUser} className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <p className="font-semibold text-slate-900">
                  {editingUser ? `Edit Staff: ${editingUser.full_name}` : 'Add New Staff User'}
                </p>
                <button type="button" onClick={() => setShowUserForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>

              <div className="px-5 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={userForm.full_name}
                      onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="e.g. Rahul Patil"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="rahul@college.edu.in"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Password{' '}
                      {editingUser
                        ? <span className="font-normal text-slate-400">(leave blank to keep current)</span>
                        : <span className="text-red-500">*</span>
                      }
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={userForm.role_id}
                      onChange={e => setUserForm(f => ({ ...f, role_id: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">— Select role —</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Role preview */}
                {userForm.role_id && (() => {
                  const selectedRole = roles.find(r => String(r.id) === String(userForm.role_id))
                  if (!selectedRole) return null
                  const gp = grantedPerms(selectedRole)
                  return (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Role Preview — {selectedRole.role_name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {gp.length === 0
                          ? <span className="text-xs text-slate-400">Read-only access — no write permissions</span>
                          : gp.map(p => (
                              <span key={p.key} className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                                {p.label}
                              </span>
                            ))
                        }
                      </div>
                    </div>
                  )
                })()}

                {userError && <p className="text-sm text-red-600">{userError}</p>}

                <div className="flex gap-3 pt-1">
                  <Button type="submit" loading={userSaving}>
                    {editingUser ? 'Update User' : 'Create User'}
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => setShowUserForm(false)}>Cancel</Button>
                </div>
              </div>
            </form>
          )}

          {/* Users list */}
          {allUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
              No staff users yet. Add a user to give staff login access.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map(u => (
                    <tr key={u.id} className={`transition ${u.is_active ? 'hover:bg-slate-50' : 'opacity-50 bg-slate-50'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-semibold">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => openEditUser(u)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition">Edit</button>
                          <button onClick={() => toggleUser(u)}
                            className={`text-xs font-semibold transition ${u.is_active ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800'}`}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => deleteUser(u)}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Delete</button>
                        </div>
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
