export const ROLE_LABEL = { admin: 'Admin', ie_team: 'IE Team', viewer: 'Read-only' }

export const STATUS = {
  available: { label: 'Available', cls: 'b-green' },
  low_stock: { label: 'Low Stock', cls: 'b-amber' },
  out_of_stock: { label: 'Out of Stock', cls: 'b-red' },
}

export const TX = {
  issue: { label: 'Issued', cls: 'b-blue', color: '#1d5fd6', bg: '#eaf1fd' },
  return: { label: 'Returned', cls: 'b-green', color: '#16a34a', bg: '#e8f7ee' },
  damage: { label: 'Damaged', cls: 'b-red', color: '#dc2626', bg: '#fdecec' },
  repair: { label: 'Repaired', cls: 'b-teal', color: '#0d9488', bg: '#e3f5f3' },
  write_off: { label: 'Written off', cls: 'b-gray', color: '#4a5873', bg: '#eef1f6' },
  add: { label: 'Stock added', cls: 'b-purple', color: '#7c3aed', bg: '#f1eafd' },
  adjust: { label: 'Adjusted', cls: 'b-amber', color: '#d97706', bg: '#fdf3e2' },
  import: { label: 'Imported', cls: 'b-purple', color: '#7c3aed', bg: '#f1eafd' },
}

export function txSentence(t) {
  const f = t.folder.name
  switch (t.type) {
    case 'issue': return `${t.quantity} × ${f} issued to ${t.to_from}`
    case 'return': return `${t.quantity} × ${f} returned from ${t.to_from}${t.condition === 'damaged' ? ' (damaged)' : ''}`
    case 'damage': return `${t.quantity} × ${f} marked damaged`
    case 'repair': return `${t.quantity} × ${f} repaired`
    case 'write_off': return `${t.quantity} × ${f} written off`
    case 'add': return `${t.quantity} × ${f} added to stock`
    case 'import': return `${f} imported (${t.quantity})`
    default: return `${f} adjusted (${t.quantity > 0 ? '+' : ''}${t.quantity})`
  }
}

const pad = (n) => String(n).padStart(2, '0')
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

// Server timestamps are UTC without a zone suffix.
const parse = (v) => (typeof v === 'string' && /T\d\d:\d\d/.test(v) && !/[zZ+]/.test(v.slice(10)) ? new Date(v + 'Z') : new Date(v))

export function fmtDate(v) {
  if (!v) return '—'
  const d = typeof v === 'string' && v.length === 10 ? new Date(v + 'T00:00:00') : parse(v)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtRelative(v) {
  if (!v) return ''
  const d = parse(v)
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return `${fmtDate(v)}, ${time}`
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
