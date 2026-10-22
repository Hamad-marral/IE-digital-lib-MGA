import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight, BarChart3, Bell, BookOpen, Boxes, ChevronDown, LayoutDashboard, LogOut, Menu,
  QrCode, ReceiptText, Search, Settings, ShieldCheck, Users,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL, initials } from '../lib/format'
import { useDebounced } from '../lib/hooks'
import { useUnit } from '../lib/unit'
import { StatusBadge, Thumb, UnitTag } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Digital Library', icon: BookOpen },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/issue-return', label: 'Issue / Return', icon: ArrowLeftRight },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/qr-labels', label: 'QR Labels', icon: QrCode },
  { to: '/users', label: 'Users', icon: Users },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const location = useLocation()
  const { unitId, unitParams } = useUnit()

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    api.get('/api/folders', unitParams).then((fs) => setAlerts(fs.filter((f) => f.status !== 'available'))).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, unitId])

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo"><BookOpen size={20} /></div>
          <div><b>Folder and Gauge Set Library</b><span>Industrial Engineering</span></div>
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} /> {label}
              {to === '/inventory' && alerts.length > 0 && <span className="count">{alerts.length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot nav">
          <NavLink to="/settings"><Settings size={18} /> Settings</NavLink>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <GlobalSearch />
          <UnitSwitcher />
          <div className="topbar-right">
            <Notifications alerts={alerts} />
            <UserMenu user={user} logout={logout} />
          </div>
        </header>
        <div key={`${location.pathname}|${unitId}`} className="route-fade">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function useOutside(ref, cb) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && cb()
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, cb])
}

/* Pick which unit every page shows. Pills on wide screens, a dropdown on phones. */
function UnitSwitcher() {
  const { units, unitId, setUnit } = useUnit()
  if (units.length < 2) return null
  const opts = [{ id: '', name: 'All units', color: '#4a5873' }, ...units]
  return (
    <>
      <div className="unit-switch" role="radiogroup" aria-label="Unit">
        {opts.map((u) => {
          const on = String(u.id) === unitId
          return (
            <button key={u.id || 'all'} role="radio" aria-checked={on} className={on ? 'on' : ''} style={{ '--u': u.color }}
              onClick={() => setUnit(u.id)} title={u.id ? `${u.folder_count} items · ${u.total_qty} pcs` : 'Show every unit'}>
              <i />{u.name}
              {u.id ? <small className="num">{u.folder_count}</small> : null}
            </button>
          )
        })}
      </div>
      <select className="select unit-select" value={unitId} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
        {opts.map((u) => <option key={u.id || 'all'} value={u.id}>{u.name}</option>)}
      </select>
    </>
  )
}

function GlobalSearch() {
  const { unitId, unitParams, label } = useUnit()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const dq = useDebounced(q, 200)
  const ref = useRef(null)
  const navigate = useNavigate()
  useOutside(ref, () => setOpen(false))

  useEffect(() => {
    if (!dq.trim()) { setResults([]); return }
    api.get('/api/folders', { search: dq, ...unitParams }).then((r) => { setResults(r.slice(0, 8)); setHi(0) }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, unitId])

  const go = (f) => { navigate(`/library/${f.id}`); setOpen(false); setQ('') }

  return (
    <div className="search" ref={ref}>
      <Search size={17} />
      <input value={q} placeholder={`Search ${unitId ? label : 'all units'} by name, category, size or code…`} aria-label="Search folders"
        onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
          if (e.key === 'Enter') {
            if (results[hi]) go(results[hi])
            else if (q.trim()) { navigate(`/library?search=${encodeURIComponent(q)}`); setOpen(false) }
          }
          if (e.key === 'Escape') setOpen(false)
        }} />
      {open && q.trim() && (
        <div className="search-results">
          {results.length === 0 && <div className="subtle" style={{ padding: 12 }}>No folders match “{q}” in {unitId ? label : 'any unit'}</div>}
          {results.map((f, i) => (
            <button key={f.id} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => go(f)}>
              <Thumb folder={f} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{f.name}</div>
                <div className="subtle" style={{ fontSize: 12 }}>{f.item_code} · {f.category.name} · {f.available_qty}/{f.total_qty} available</div>
              </div>
              {!unitId && <UnitTag unit={f.unit} small />}
              <StatusBadge status={f.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Notifications({ alerts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  useOutside(ref, () => setOpen(false))
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`${alerts.length} stock alerts`}>
        <Bell size={19} />{alerts.length > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="dropdown" style={{ width: 340 }}>
          <div className="dropdown-head"><b>Stock alerts</b> <span className="subtle">({alerts.length})</span></div>
          {alerts.length === 0 && <div className="subtle" style={{ padding: 12 }}>All folders are above minimum stock.</div>}
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {alerts.map((f) => (
              <button key={f.id} className="dropdown-item" onClick={() => { navigate(`/library/${f.id}`); setOpen(false) }}>
                <Thumb folder={f} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{f.name}</div>
                  <div className="subtle" style={{ fontSize: 12 }}>{f.unit ? `${f.unit.name} · ` : ''}{f.available_qty} available · min {f.min_qty}</div>
                </div>
                <StatusBadge status={f.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  useOutside(ref, () => setOpen(false))
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="user-chip" onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{initials(user?.name)}</span>
        <div><b>{user?.name}</b><small>{ROLE_LABEL[user?.role]}</small></div>
        <ChevronDown size={15} className="subtle" />
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <b>{user?.name}</b>
            <div className="subtle" style={{ fontSize: 12 }}>{user?.email}</div>
          </div>
          <button className="dropdown-item" onClick={() => { navigate('/settings'); setOpen(false) }}><ShieldCheck size={16} /> Account & settings</button>
          <button className="dropdown-item" onClick={logout} style={{ color: 'var(--red)' }}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  )
}
