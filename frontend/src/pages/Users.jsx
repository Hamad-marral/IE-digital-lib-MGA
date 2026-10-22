import { useState } from 'react'
import { Pencil, Plus, ShieldCheck, UserX } from 'lucide-react'
import { ConfirmModal, Modal, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL, fmtDate, initials } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'

const ROLE_INFO = {
  admin: 'Full access, including users, settings and Excel import.',
  ie_team: 'Issue / return folders, edit inventory, upload photos.',
  viewer: 'Browse the library and reports. No changes.',
}
const ROLE_CLS = { admin: 'b-purple', ie_team: 'b-blue', viewer: 'b-gray' }

export default function UsersPage() {
  const { isAdmin, user: me } = useAuth()
  const toast = useToast()
  const { data, loading, reload } = useApi('/api/users')
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p>Role-based access for the IE team, admins and read-only users</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Add User</button>}
      </div>

      <div className="grid g-3" style={{ marginBottom: 18 }}>
        {Object.entries(ROLE_INFO).map(([r, txt]) => (
          <div key={r} className="card card-pad" style={{ display: 'flex', gap: 12 }}>
            <ShieldCheck size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div><b>{ROLE_LABEL[r]}</b> <span className="subtle num">· {(data || []).filter((u) => u.role === r && u.active).length}</span><div className="muted" style={{ fontSize: 13 }}>{txt}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        {loading && !data ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Created</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                    <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="avatar">{initials(u.name)}</span><b style={{ fontWeight: 600 }}>{u.name}</b>{u.id === me.id && <span className="subtle">(you)</span>}</div></td>
                    <td className="muted">{u.email}</td>
                    <td><span className={`badge plain ${ROLE_CLS[u.role]}`}>{ROLE_LABEL[u.role]}</span></td>
                    <td className="muted">{u.department}</td>
                    <td>{u.active ? <span className="badge b-green">Active</span> : <span className="badge b-gray">Disabled</span>}</td>
                    <td className="muted">{fmtDate(u.created_at)}</td>
                    {isAdmin && (
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        <button className="icon-btn" aria-label="Edit user" onClick={() => setEdit(u)}><Pencil size={16} /></button>
                        {u.id !== me.id && u.active && <button className="icon-btn" aria-label="Disable user" onClick={() => setDel(u)}><UserX size={16} /></button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && <UserForm user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
      {del && (
        <ConfirmModal danger title="Disable user?" confirmLabel="Disable" onClose={() => setDel(null)}
          message={`${del.name} will no longer be able to sign in. Their transaction history is kept.`}
          onConfirm={async () => { try { await api.del(`/api/users/${del.id}`); toast('User disabled'); reload() } catch (e) { toast(e.message, 'error') } setDel(null) }} />
      )}
    </div>
  )
}

function UserForm({ user, onClose, onSaved }) {
  const toast = useToast()
  const isNew = !user.id
  const [f, setF] = useState({ name: user.name || '', email: user.email || '', role: user.role || 'ie_team', department: user.department || 'Industrial Engineering', password: '', active: user.active ?? true })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = async (e) => {
    e.preventDefault(); setErr('')
    try {
      const body = { ...f, password: f.password || null }
      isNew ? await api.post('/api/users', body) : await api.put(`/api/users/${user.id}`, body)
      toast(isNew ? 'User created' : 'User updated'); onSaved()
    } catch (ex) { setErr(ex.message) }
  }
  return (
    <Modal title={isNew ? 'Add user' : `Edit ${user.name}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="user-form">{isNew ? 'Create user' : 'Save'}</button>
    </>}>
      <form id="user-form" onSubmit={save}>
        {err && <div className="alert err">{err}</div>}
        <div className="field"><label>Full name *</label><input className="input" value={f.name} onChange={set('name')} required /></div>
        <div className="field"><label>Email *</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div className="row">
          <div className="field">
            <label>Role</label>
            <select className="select" value={f.role} onChange={set('role')}>
              {Object.keys(ROLE_INFO).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="field"><label>Department</label><input className="input" value={f.department} onChange={set('department')} /></div>
        </div>
        <div className="field">
          <label>{isNew ? 'Password *' : 'New password'}</label>
          <input className="input" type="password" value={f.password} onChange={set('password')} required={isNew} minLength={6} placeholder={isNew ? 'At least 6 characters' : 'Leave blank to keep current'} autoComplete="new-password" />
        </div>
        {!isNew && <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Account active</label>}
      </form>
    </Modal>
  )
}
