import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { api } from '../lib/api'
import { todayISO } from '../lib/format'
import { useToast } from '../lib/toast'
import { FolderPicker, Modal, QtyInput } from './ui'

function useLines() {
  const [lines, setLines] = useState([])
  useEffect(() => { api.get('/api/settings').then((s) => setLines(s.lines)).catch(() => {}) }, [])
  return lines
}

export function IssueForm({ folders, initialFolderId, onDone, compact }) {
  const toast = useToast()
  const lines = useLines()
  const blank = { folder_id: initialFolderId || null, quantity: 1, to_from: '', line_machine: '', receiver: '', date: todayISO(), remarks: '' }
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const folder = folders.find((f) => f.id === form.folder_id)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.folder_id) return setErr('Select a folder to issue')
    if (!form.to_from) return setErr('Select the line the folder is going to')
    setBusy(true); setErr('')
    try {
      const res = await api.post('/api/transactions/issue', { ...form, quantity: +form.quantity })
      toast(`Issued ${form.quantity} × ${res.folder.name} to ${form.to_from}`)
      setForm({ ...blank, folder_id: initialFolderId || null, to_from: form.to_from, date: form.date })
      onDone?.(res)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} id="issue-form">
      {err && <div className="alert err">{err}</div>}
      {!initialFolderId && (
        <div className="field">
          <label>Select folder *</label>
          <FolderPicker folders={folders.filter((f) => f.available_qty > 0)} value={form.folder_id} onChange={set('folder_id')} />
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>Quantity *</label>
          <QtyInput value={form.quantity} onChange={set('quantity')} max={folder?.available_qty} />
          {folder && <span className="hint">{folder.available_qty} available in store</span>}
        </div>
        <div className="field">
          <label>Issue to (line) *</label>
          <select className="select" value={form.to_from} onChange={set('to_from')} required>
            <option value="">Select line…</option>
            {lines.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field"><label>Machine / operation</label><input className="input" value={form.line_machine} onChange={set('line_machine')} placeholder="e.g. Waist band attach · M-14" /></div>
        <div className="field"><label>Received by</label><input className="input" value={form.receiver} onChange={set('receiver')} placeholder="Supervisor / mechanic" /></div>
      </div>
      <div className="row">
        <div className="field"><label>Issue date</label><input className="input" type="date" value={form.date} onChange={set('date')} max={todayISO()} /></div>
        {compact && <div />}
      </div>
      <div className="field"><label>Remarks (optional)</label><textarea className="textarea" style={{ minHeight: 60 }} value={form.remarks} onChange={set('remarks')} placeholder="e.g. For trial run" /></div>
      {!compact && <button className="btn btn-primary btn-block" style={{ height: 42 }} disabled={busy}><ArrowUpRight size={17} /> {busy ? 'Issuing…' : 'Issue Folder'}</button>}
    </form>
  )
}

export function ReturnForm({ folders, initialFolderId, onDone, compact }) {
  const toast = useToast()
  const [outstanding, setOutstanding] = useState([])
  const blank = { folder_id: initialFolderId || null, quantity: 1, to_from: '', condition: 'good', receiver: '', date: todayISO(), remarks: '' }
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const load = () => api.get('/api/transactions/lines/outstanding').then(setOutstanding).catch(() => {})
  useEffect(() => { load() }, [])

  const outFolders = useMemo(() => {
    const ids = new Set(outstanding.map((o) => o.folder_id))
    return folders.filter((f) => ids.has(f.id))
  }, [folders, outstanding])
  const linesForFolder = outstanding.filter((o) => o.folder_id === form.folder_id)
  const maxQty = linesForFolder.find((o) => o.line === form.to_from)?.qty

  useEffect(() => {
    // Pre-select the line when the folder is only out on one line.
    if (linesForFolder.length === 1 && form.to_from !== linesForFolder[0].line) setForm((f) => ({ ...f, to_from: linesForFolder[0].line }))
    else if (form.to_from && !linesForFolder.some((o) => o.line === form.to_from)) setForm((f) => ({ ...f, to_from: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.folder_id, outstanding])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.folder_id) return setErr('Select a folder to return')
    if (!form.to_from) return setErr('Select the line it is coming back from')
    setBusy(true); setErr('')
    try {
      const res = await api.post('/api/transactions/return', { ...form, quantity: +form.quantity })
      toast(`Returned ${form.quantity} × ${res.folder.name} from ${form.to_from}`)
      setForm({ ...blank, folder_id: initialFolderId || null, date: form.date })
      load()
      onDone?.(res)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  if (outFolders.length === 0 && !initialFolderId) {
    return <div className="alert info">Nothing is currently issued to any line, so there is nothing to return.</div>
  }

  return (
    <form onSubmit={submit} id="return-form">
      {err && <div className="alert err">{err}</div>}
      {!initialFolderId && (
        <div className="field">
          <label>Select folder *</label>
          <FolderPicker folders={outFolders} value={form.folder_id} onChange={set('folder_id')}
            extra={(f) => <span className="subtle num" style={{ fontSize: 12 }}>{f.issued_qty} out</span>} />
        </div>
      )}
      {initialFolderId && linesForFolder.length === 0 && <div className="alert info">This folder is not issued to any line.</div>}
      <div className="row">
        <div className="field">
          <label>Returned from (line) *</label>
          <select className="select" value={form.to_from} onChange={set('to_from')} required>
            <option value="">Select line…</option>
            {linesForFolder.map((o) => <option key={o.line} value={o.line}>{o.line} — {o.qty} out</option>)}
          </select>
        </div>
        <div className="field">
          <label>Quantity *</label>
          <QtyInput value={form.quantity} onChange={set('quantity')} max={maxQty} />
          {maxQty != null && <span className="hint">{maxQty} out on {form.to_from}</span>}
        </div>
      </div>
      <div className="field">
        <label>Condition</label>
        <div className="cond">
          {[['good', 'Good — back to stock'], ['damaged', 'Damaged — needs repair']].map(([v, l]) => (
            <label key={v} className={form.condition === v ? 'on' : ''}>
              <input type="radio" name="condition" checked={form.condition === v} onChange={() => set('condition')(v)} /> {l}
            </label>
          ))}
        </div>
      </div>
      <div className="row">
        <div className="field"><label>Returned by</label><input className="input" value={form.receiver} onChange={set('receiver')} placeholder="Name" /></div>
        <div className="field"><label>Return date</label><input className="input" type="date" value={form.date} onChange={set('date')} max={todayISO()} /></div>
      </div>
      <div className="field"><label>Remarks (optional)</label><textarea className="textarea" style={{ minHeight: 60 }} value={form.remarks} onChange={set('remarks')} /></div>
      {!compact && <button className="btn btn-primary btn-block" style={{ height: 42 }} disabled={busy}><ArrowDownLeft size={17} /> {busy ? 'Saving…' : 'Return Folder'}</button>}
    </form>
  )
}

export function TxModal({ kind, folder, onClose, onDone }) {
  const Form = kind === 'issue' ? IssueForm : ReturnForm
  return (
    <Modal title={`${kind === 'issue' ? 'Issue' : 'Return'} · ${folder.name}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form={`${kind}-form`}>{kind === 'issue' ? 'Issue Folder' : 'Return Folder'}</button>
    </>}>
      <Form compact folders={[folder]} initialFolderId={folder.id} onDone={(r) => { onDone?.(r); onClose() }} />
    </Modal>
  )
}

const STOCK_ACTIONS = {
  add: { label: 'Add stock', help: 'New folders received into the store.', max: () => undefined },
  damage: { label: 'Mark damaged', help: 'Move available folders to damaged.', max: (f) => f.available_qty },
  repair: { label: 'Repaired', help: 'Damaged folders fixed and back in stock.', max: (f) => f.damaged_qty },
  write_off: { label: 'Write off', help: 'Scrap damaged folders permanently (reduces total).', max: (f) => f.damaged_qty },
}

export function StockModal({ folder, onClose, onDone }) {
  const toast = useToast()
  const [action, setAction] = useState('add')
  const [quantity, setQuantity] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const max = STOCK_ACTIONS[action].max(folder)

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const res = await api.post('/api/transactions/stock', { folder_id: folder.id, action, quantity: +quantity, remarks })
      toast(`${STOCK_ACTIONS[action].label}: ${quantity} × ${folder.name}`)
      onDone?.(res); onClose()
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={`Adjust stock · ${folder.item_code}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={busy || max === 0}>{STOCK_ACTIONS[action].label}</button>
    </>}>
      {err && <div className="alert err">{err}</div>}
      <p className="muted" style={{ marginTop: 0 }}>{folder.name}</p>
      <div className="stock-tiles" style={{ marginTop: 0 }}>
        <div className="stock-tile"><small>Total</small><b className="num">{folder.total_qty}</b></div>
        <div className="stock-tile"><small>Available</small><b className="num" style={{ color: 'var(--green)' }}>{folder.available_qty}</b></div>
        <div className="stock-tile"><small>Issued</small><b className="num" style={{ color: 'var(--primary)' }}>{folder.issued_qty}</b></div>
        <div className="stock-tile"><small>Damaged</small><b className="num" style={{ color: 'var(--red)' }}>{folder.damaged_qty}</b></div>
      </div>
      <div className="field">
        <label>Action</label>
        <select className="select" value={action} onChange={(e) => { setAction(e.target.value); setQuantity(1) }}>
          {Object.entries(STOCK_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="hint">{STOCK_ACTIONS[action].help}{max != null && ` Up to ${max}.`}</span>
      </div>
      <div className="field"><label>Quantity</label><QtyInput value={quantity} onChange={setQuantity} max={max} /></div>
      <div className="field"><label>Remarks</label><input className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason / reference" /></div>
    </Modal>
  )
}
