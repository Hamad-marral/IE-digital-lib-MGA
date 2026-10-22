import { useEffect, useRef, useState } from 'react'
import { Building2, CheckCircle2, ExternalLink, FileSpreadsheet, KeyRound, Pencil, Plus, QrCode, Save, Tags, Trash2, Upload, X } from 'lucide-react'
import { Modal, Spinner, UnitTag } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { refreshQrBase, useQrBase } from '../lib/qr'
import { groupByUnit, useUnit } from '../lib/unit'

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>{isAdmin ? 'Units, Excel import, production lines, categories, stock alerts and your account' : 'Your account'}</p>
        </div>
      </div>
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        {isAdmin && <ExcelImport />}
        {isAdmin && <Units />}
        {isAdmin && <QrSettings />}
        {isAdmin && <LinesAndAlerts />}
        {isAdmin && <Categories />}
        <PasswordCard />
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, sub, children }) {
  return (
    <div className="card">
      <div className="card-head" style={{ justifyContent: 'flex-start' }}>
        <div className="stat-icon" style={{ width: 36, height: 36, background: 'var(--primary-50)', color: 'var(--primary)', borderRadius: 10 }}><Icon size={18} /></div>
        <div><h3>{title}</h3>{sub && <div className="subtle" style={{ fontSize: 12.5 }}>{sub}</div>}</div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

function QrSettings() {
  const toast = useToast()
  const qr = useQrBase()
  const [value, setValue] = useState(null)
  const [test, setTest] = useState(null)
  const current = value ?? qr?.configured ?? ''

  const save = async (v) => {
    try {
      await api.put('/api/settings', { qr_base_url: v })
      refreshQrBase(); setValue(v)
      toast(v ? `QR codes now open ${v}` : 'QR address set to automatic')
    } catch (e) { toast(e.message, 'error') }
  }
  const check = async () => {
    const url = (current || qr?.base || '').replace(/\/$/, '')
    setTest({ state: 'checking' })
    try {
      const r = await fetch(`${url}/api/health`, { mode: 'cors' })
      setTest({ state: r.ok ? 'ok' : 'fail', url })
    } catch { setTest({ state: 'fail', url }) }
  }

  if (!qr) return <Spinner />
  return (
    <Section icon={QrCode} title="QR codes" sub="The address phones open when they scan a folder label">
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Phones must be on the <b>same network</b> as this PC. <span className="mono">localhost</span> only works on this PC itself, so pick this PC's network address.
        Scanning shows the folder's details without signing in.
      </p>
      <div className="field">
        <label>Detected addresses of this PC</label>
        <div className="chip-row">
          {qr.detected.map((u) => (
            <button key={u} type="button" className={`chip-btn ${current === u ? 'on' : ''}`} onClick={() => save(u)}>{u}</button>
          ))}
          <button type="button" className={`chip-btn ${!current ? 'on' : ''}`} onClick={() => save('')}>Automatic</button>
        </div>
        <span className="hint">Addresses starting with 172. are usually virtual adapters (WSL/Docker) that phones can't reach.</span>
      </div>
      <div className="field">
        <label>Or enter an address</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input mono" value={current} onChange={(e) => setValue(e.target.value)} placeholder="http://192.168.1.20:8000" />
          <button className="btn" onClick={() => save(current)}><Save size={16} /> Save</button>
        </div>
      </div>
      <div className="alert info" style={{ marginBottom: 10 }}>
        <span>QR codes currently open <b className="mono">{qr.base}/scan/WB-001</b></span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={check}>Test address</button>
        <a className="btn btn-sm" href={`${qr.base}/scan/WB-001`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open sample scan</a>
        {test?.state === 'checking' && <span className="subtle">Checking…</span>}
        {test?.state === 'ok' && <span style={{ color: 'var(--green)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={16} /> Reachable from this PC</span>}
        {test?.state === 'fail' && <span style={{ color: 'var(--red)' }}>Not reachable. Check the address and that the server is running.</span>}
      </div>
    </Section>
  )
}

function ExcelImport() {
  const toast = useToast()
  const { units, unitId, reloadUnits } = useUnit()
  const input = useRef(null)
  const [target, setTarget] = useState(unitId)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const targetUnit = units.find((u) => String(u.id) === String(target))

  const send = async (f, dry, uid = target) => {
    const fd = new FormData(); fd.append('file', f)
    return api.post(`/api/import/excel?unit_id=${uid}${dry ? '&preview=true' : ''}`, fd)
  }
  const load = async (f, uid = target) => {
    if (!f) return
    setFile(f); setResult(null); setErr('')
    if (!uid) { setPreview(null); return }
    setBusy(true)
    try { setPreview((await send(f, true, uid)).preview) } catch (e) { setErr(e.message); setPreview(null) } finally { setBusy(false) }
  }
  const run = async () => {
    setBusy(true)
    try { const r = await send(file, false); setResult(r.result); toast(`Imported into ${r.unit}`); reloadUnits() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const choose = (uid) => { setTarget(uid); if (file) load(file, uid) }

  return (
    <Section icon={FileSpreadsheet} title="Import from Excel" sub="Add new items or sync quantities for one unit">
      <div className="field">
        <label>1. Which unit is this sheet for? *</label>
        <div className="unit-pick">
          {units.map((u) => (
            <button key={u.id} type="button" className={String(u.id) === String(target) ? 'on' : ''} style={{ '--u': u.color }} onClick={() => choose(String(u.id))}>
              <span className="unit-badge">{u.code}</span>
              <span><b>{u.name}</b><small>{u.folder_count} items · {u.total_qty} pcs</small></span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>2. Choose the .xlsx file</label>
        {err && <div className="alert err">{err}</div>}
        <div className="dropzone" onClick={() => input.current?.click()}>
          <Upload size={22} style={{ marginBottom: 6 }} />
          <div><b>{file ? file.name : 'Choose an .xlsx file'}</b></div>
          <div className="subtle" style={{ fontSize: 12 }}>Unit 1 layout (SR# · Description · Qty) and Unit 2 layout (sizes × Single Part / 2 Part / kit) are both read automatically</div>
          <input ref={input} type="file" hidden accept=".xlsx,.xlsm" onChange={(e) => { load(e.target.files[0]); e.target.value = '' }} />
        </div>
        {file && !target && <span className="hint" style={{ color: 'var(--amber)' }}>Pick the unit above to see the preview.</span>}
      </div>
      {busy && <Spinner />}
      {preview && !result && targetUnit && (
        <div>
          <label className="subtle" style={{ fontSize: 12.5, fontWeight: 500 }}>3. Check and import</label>
          <div className="table-wrap" style={{ maxHeight: 300, marginTop: 6 }}>
            <table className="table">
              <thead><tr><th>Category in sheet</th><th className="r">Items</th><th className="r">Pcs</th></tr></thead>
              <tbody>{preview.map((p) => (
                <tr key={p.category}>
                  <td><b style={{ fontWeight: 600 }}>{p.category}</b><div className="subtle" style={{ fontSize: 11.5 }}>{p.sample.join(' · ')}{p.items > p.sample.length && ' …'}</div>
                    {p.skipped > 0 && <div className="subtle" style={{ fontSize: 11.5 }}>{p.skipped} “nil” / empty cells skipped</div>}</td>
                  <td className="r num">{p.items}</td><td className="r num">{p.qty}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="alert info" style={{ marginTop: 12 }}>
            <span>Goes into <UnitTag unit={targetUnit} small /> only. Items already in {targetUnit.name} (same category + description) get their total updated; other units are not touched.</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={run} disabled={busy}><Upload size={16} /> Import {preview.reduce((s, p) => s + p.items, 0)} items into {targetUnit.name}</button>
        </div>
      )}
      {result && (
        <div className="alert info" style={{ marginTop: 14 }}>
          Done: {result.created} new items, {result.updated} quantities updated, {result.unchanged} unchanged across {result.categories} categories in {targetUnit?.name}.
        </div>
      )}
    </Section>
  )
}

function Units() {
  const toast = useToast()
  const { units, reloadUnits } = useUnit()
  const [edit, setEdit] = useState(null)
  const remove = async (u) => {
    try { await api.del(`/api/units/${u.id}`); toast('Unit deleted'); reloadUnits() } catch (e) { toast(e.message, 'error') }
  }
  return (
    <Section icon={Building2} title="Units" sub="Each unit keeps its own categories, stock and QR codes">
      {units.map((u) => (
        <div key={u.id} className="settings-row">
          <span className="unit-badge" style={{ '--u': u.color }}>{u.code}</span>
          <div style={{ flex: 1 }}>
            <b style={{ fontWeight: 600 }}>{u.name}</b> <span className="subtle mono">{u.item_prefix ? `${u.item_prefix}XX-001` : 'XX-001'}</span>
            <div className="subtle" style={{ fontSize: 12 }}>{u.category_count} categories · {u.folder_count} items · {u.total_qty} pcs</div>
          </div>
          <button className="icon-btn" aria-label={`Edit ${u.name}`} onClick={() => setEdit(u)}><Pencil size={15} /></button>
          {u.category_count === 0 && <button className="icon-btn" aria-label={`Delete ${u.name}`} onClick={() => remove(u)}><Trash2 size={15} /></button>}
        </div>
      ))}
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEdit({})}><Plus size={16} /> New unit</button>
      {edit && <UnitForm unit={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reloadUnits() }} />}
    </Section>
  )
}

function UnitForm({ unit, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ name: unit.name || '', code: unit.code || '', description: unit.description || '', color: unit.color || '#7c3aed' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    try { unit.id ? await api.put(`/api/units/${unit.id}`, f) : await api.post('/api/units', f); toast('Unit saved'); onSaved() } catch (ex) { setErr(ex.message) }
  }
  return (
    <Modal title={unit.id ? `Edit ${unit.name}` : 'New unit'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="unit-form">Save</button>
    </>}>
      <form id="unit-form" onSubmit={save}>
        {err && <div className="alert err">{err}</div>}
        <div className="row">
          <div className="field" style={{ flex: 2 }}><label>Name *</label><input className="input" value={f.name} onChange={set('name')} required placeholder="e.g. Unit 3" /></div>
          <div className="field"><label>Code</label><input className="input mono" value={f.code} onChange={set('code')} maxLength={6} disabled={!!unit.id} placeholder="U3" /></div>
          <div className="field"><label>Color</label><input className="input" type="color" value={f.color} onChange={set('color')} style={{ padding: 4 }} /></div>
        </div>
        {!unit.id && <span className="hint subtle" style={{ display: 'block', marginTop: -6, marginBottom: 12, fontSize: 12 }}>Item codes in this unit start with the code, e.g. {(f.code || 'U3').toUpperCase()}-WB-001.</span>}
        <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={set('description')} /></div>
      </form>
    </Modal>
  )
}

function LinesAndAlerts() {
  const toast = useToast()
  const { data, setData } = useApi('/api/settings')
  const [lines, setLines] = useState([])
  const [newLine, setNewLine] = useState('')
  const [minQty, setMinQty] = useState(1)
  const [applyAll, setApplyAll] = useState(false)
  useEffect(() => { if (data) { setLines(data.lines); setMinQty(data.default_min_qty) } }, [data])

  const save = async () => {
    try {
      setData(await api.put('/api/settings', { lines, default_min_qty: +minQty, apply_min_qty_to_all: applyAll }))
      toast(applyAll ? 'Settings saved and min stock applied to all folders' : 'Settings saved')
      setApplyAll(false)
    } catch (e) { toast(e.message, 'error') }
  }
  const add = () => { const v = newLine.trim(); if (v && !lines.includes(v)) setLines([...lines, v]); setNewLine('') }

  if (!data) return <Spinner />
  return (
    <Section icon={Tags} title="Production lines & stock alerts" sub="Used in the Issue / Return forms">
      <div className="field">
        <label>Lines</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {lines.map((l) => (
            <span key={l} className="chip" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '4px 6px 4px 10px' }}>
              {l}<button className="icon-btn" style={{ width: 20, height: 20 }} aria-label={`Remove ${l}`} onClick={() => setLines(lines.filter((x) => x !== l))}><X size={12} /></button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input" value={newLine} onChange={(e) => setNewLine(e.target.value)} placeholder="e.g. Line 13 - Finishing" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <button className="btn" onClick={add}><Plus size={16} /> Add</button>
        </div>
      </div>
      <div className="field">
        <label>Default minimum stock</label>
        <input className="input" type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} style={{ maxWidth: 140 }} />
        <span className="hint">A folder shows as Low Stock when available ≤ its minimum.</span>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text)' }}>
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} /> Apply this minimum to all existing folders
        </label>
      </div>
      <button className="btn btn-primary" onClick={save}><Save size={16} /> Save settings</button>
    </Section>
  )
}

function Categories() {
  const toast = useToast()
  const { units, unitId } = useUnit()
  const { data, reload } = useApi('/api/categories')
  const [edit, setEdit] = useState(null)
  const remove = async (c) => {
    try { await api.del(`/api/categories/${c.id}`); toast('Category deleted'); reload() } catch (e) { toast(e.message, 'error') }
  }
  return (
    <Section icon={Tags} title="Categories" sub="Item groups shown in the library, per unit">
      {groupByUnit(data || [], units, (c) => c.unit_id).map((g) => (
        <div key={g.unit?.id ?? 'none'} style={{ marginBottom: 10 }}>
          <div className="settings-group-head">{g.unit ? <UnitTag unit={g.unit} small /> : 'No unit'} <span className="subtle">{g.items.length} categories</span></div>
          {g.items.map((c) => (
            <div key={c.id} className="settings-row">
              <i style={{ width: 12, height: 12, borderRadius: 4, background: c.color }} />
              <div style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{c.name}</b> <span className="subtle mono">{c.code}</span><div className="subtle" style={{ fontSize: 12 }}>{c.folder_count} types · {c.total_qty} pcs</div></div>
              <button className="icon-btn" aria-label="Edit category" onClick={() => setEdit(c)}><Pencil size={15} /></button>
              {c.folder_count === 0 && <button className="icon-btn" aria-label="Delete category" onClick={() => remove(c)}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      ))}
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEdit({ unit_id: unitId ? +unitId : units[0]?.id })}><Plus size={16} /> New category</button>
      {edit && <CategoryForm cat={edit} units={units} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
    </Section>
  )
}

function CategoryForm({ cat, units, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ unit_id: cat.unit_id || '', name: cat.name || '', code: cat.code || '', description: cat.description || '', color: cat.color || '#2563eb' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    const body = { ...f, unit_id: +f.unit_id || null }
    try { cat.id ? await api.put(`/api/categories/${cat.id}`, body) : await api.post('/api/categories', body); toast('Category saved'); onSaved() } catch (ex) { setErr(ex.message) }
  }
  return (
    <Modal title={cat.id ? `Edit ${cat.name}` : 'New category'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="cat-form">Save</button>
    </>}>
      <form id="cat-form" onSubmit={save}>
        {err && <div className="alert err">{err}</div>}
        <div className="field">
          <label>Unit *</label>
          <select className="select" value={f.unit_id} onChange={set('unit_id')} required disabled={!!cat.id}>
            <option value="">Select unit…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 2 }}><label>Name *</label><input className="input" value={f.name} onChange={set('name')} required /></div>
          <div className="field"><label>Code *</label><input className="input mono" value={f.code} onChange={set('code')} required maxLength={6} disabled={!!cat.id} placeholder="e.g. HM" /></div>
          <div className="field"><label>Color</label><input className="input" type="color" value={f.color} onChange={set('color')} style={{ padding: 4 }} /></div>
        </div>
        <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={set('description')} /></div>
      </form>
    </Modal>
  )
}

function PasswordCard() {
  const toast = useToast()
  const [f, setF] = useState({ current_password: '', new_password: '' })
  const [err, setErr] = useState('')
  const save = async (e) => {
    e.preventDefault(); setErr('')
    try { await api.post('/api/auth/password', f); toast('Password changed'); setF({ current_password: '', new_password: '' }) } catch (ex) { setErr(ex.message) }
  }
  return (
    <Section icon={KeyRound} title="Change password" sub="Applies to your own account">
      <form onSubmit={save}>
        {err && <div className="alert err">{err}</div>}
        <div className="field"><label>Current password</label><input className="input" type="password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} required /></div>
        <div className="field"><label>New password</label><input className="input" type="password" autoComplete="new-password" minLength={6} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required /></div>
        <button className="btn btn-primary"><KeyRound size={16} /> Update password</button>
      </form>
    </Section>
  )
}
