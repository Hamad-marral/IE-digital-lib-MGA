import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Inbox, Minus, Plus, Search, X } from 'lucide-react'
import FolderArt from './FolderArt'
import { STATUS, TX } from '../lib/format'
import { groupByUnit, useUnit } from '../lib/unit'

export function Modal({ title, onClose, children, footer, wide }) {
  const overlay = useRef(null)
  useEffect(() => {
    // Only the top-most modal reacts to Escape (e.g. image editor opened over the folder form).
    const onKey = (e) => {
      const all = document.querySelectorAll('.overlay')
      if (e.key === 'Escape' && all[all.length - 1] === overlay.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="overlay" ref={overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}
        onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{confirmLabel}</button>
    </>}>
      <p style={{ margin: 0 }} className="muted">{message}</p>
    </Modal>
  )
}

export const StatusBadge = ({ status }) => <span className={`badge ${STATUS[status]?.cls || 'b-gray'}`}>{STATUS[status]?.label || status}</span>
export const TxBadge = ({ type }) => <span className={`badge ${TX[type]?.cls || 'b-gray'}`}>{TX[type]?.label || type}</span>

/* Small coloured pill naming a unit, e.g. "● Unit 2". */
export const UnitTag = ({ unit, small }) => unit
  ? <span className={`unit-tag ${small ? 'sm' : ''}`} style={{ '--u': unit.color }}><i />{unit.name}</span>
  : null

/* Tag shown next to a page title: the selected unit, or "All units". */
export function CurrentUnitTag() {
  const { unit } = useUnit()
  return unit ? <UnitTag unit={unit} /> : <span className="unit-tag all"><i />All units</span>
}

/* <option>s for a category <select>, grouped by unit when more than one unit is listed. */
export function CategoryOptions({ categories }) {
  const { units } = useUnit()
  const groups = groupByUnit(categories, units, (c) => c.unit_id)
  if (groups.length <= 1) return categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
  return groups.map((g) => (
    <optgroup key={g.unit?.id ?? 'none'} label={g.unit?.name || 'No unit'}>
      {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </optgroup>
  ))
}

export const Spinner = () => <div className="spinner" aria-label="Loading" />

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* Animated number: counts from the previous value to the new one. */
export function CountUp({ value = 0, duration = 900 }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0)
  const from = useRef(reducedMotion() ? value : 0)
  useEffect(() => {
    if (reducedMotion()) { setShown(value); return }
    const start = performance.now(), a = from.current, b = Number(value) || 0
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(a + (b - a) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = b
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = b }
  }, [value, duration])
  return <>{shown}</>
}

/* Shimmer placeholders shown while data loads. */
export function Skeleton({ variant = 'row', count = 6, className = '' }) {
  if (variant === 'cards') {
    return <div className={`grid ${className || 'g-folders'}`}>{Array.from({ length: count }, (_, i) => <div key={i} className="skeleton skeleton-card" />)}</div>
  }
  if (variant === 'stats') {
    return <div className="grid g-stats" style={{ marginBottom: 18 }}>{Array.from({ length: count }, (_, i) => <div key={i} className="skeleton skeleton-stat" />)}</div>
  }
  return <div style={{ padding: '6px 0' }}>{Array.from({ length: count }, (_, i) => <div key={i} className="skeleton skeleton-row" style={{ opacity: 1 - i * 0.12 }} />)}</div>
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <div className="ic"><Icon size={26} /></div>
      <h4>{title}</h4>
      {children && <div className="subtle">{children}</div>}
    </div>
  )
}

export function Thumb({ folder, size = 44 }) {
  return (
    <div className="thumb" style={{ width: size, height: size }}>
      {folder.image_url ? <img src={folder.image_url} alt="" /> : <FolderArt type={folder.type} size={size + 8} accent={folder.category?.color} />}
    </div>
  )
}

export function QtyInput({ value, onChange, max, min = 1 }) {
  const clamp = (n) => Math.max(min, max != null ? Math.min(max, n) : n)
  return (
    <div className="qty-input">
      <button type="button" onClick={() => onChange(clamp((+value || 0) - 1))} aria-label="Decrease"><Minus size={14} /></button>
      <input className="input num" type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : clamp(parseInt(e.target.value, 10) || 0))} />
      <button type="button" onClick={() => onChange(clamp((+value || 0) + 1))} aria-label="Increase"><Plus size={14} /></button>
    </div>
  )
}

/* Searchable folder picker used by Issue / Return / Stock forms. */
export function FolderPicker({ folders, value, onChange, placeholder = 'Search folder by name, size or code…', extra }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef(null)
  const selected = folders.find((f) => f.id === value)

  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return folders.filter((f) => {
      const hay = `${f.name} ${f.item_code} ${f.size} ${f.type} ${f.category?.name} ${f.unit?.name}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    }).slice(0, 60)
  }, [folders, q])

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (f) => { onChange(f.id); setOpen(false); setQ('') }

  return (
    <div className="combo" ref={ref}>
      <div className="search" style={{ maxWidth: 'none' }}>
        <Search size={17} />
        <input value={q} placeholder={selected ? selected.name : placeholder} onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
            if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(list[hi]) }
          }} />
      </div>
      {open && (
        <div className="combo-list">
          {list.length === 0 && <div className="subtle" style={{ padding: 12 }}>No matching folders</div>}
          {list.map((f, i) => (
            <button type="button" key={f.id} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => pick(f)}>
              <Thumb folder={f} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{f.name}</div>
                <div className="subtle" style={{ fontSize: 11.5 }}>{f.item_code} · {f.unit ? `${f.unit.name} · ` : ''}{f.category?.name}</div>
              </div>
              {extra ? extra(f) : <span className="subtle num" style={{ fontSize: 12 }}>{f.available_qty} avail.</span>}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="picked">
          <Thumb folder={selected} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.name}</div>
            <div className="subtle" style={{ fontSize: 12 }}>{selected.item_code} · {selected.unit ? `${selected.unit.name} · ` : ''}{selected.category?.name}</div>
          </div>
          <StatusBadge status={selected.status} />
        </div>
      )}
    </div>
  )
}

export function QtyBar({ f }) {
  const t = f.total_qty || 1
  return (
    <div className="qty-bar" title={`Available ${f.available_qty} · Issued ${f.issued_qty} · Damaged ${f.damaged_qty}`}>
      <span style={{ width: `${(f.available_qty / t) * 100}%`, background: '#16a34a' }} />
      <span style={{ width: `${(f.issued_qty / t) * 100}%`, background: '#1d5fd6' }} />
      <span style={{ width: `${(f.damaged_qty / t) * 100}%`, background: '#dc2626' }} />
    </div>
  )
}
