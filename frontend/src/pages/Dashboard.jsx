import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, CalendarDays, CheckCircle2, FolderOpen, Layers } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CountUp, CurrentUnitTag, Empty, Skeleton, StatusBadge, Thumb, UnitTag } from '../components/ui'
import { TX, fmtRelative, pct, txSentence } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useUnit } from '../lib/unit'

const STATUS_COLORS = { available: '#16a34a', issued: '#1d5fd6', damaged: '#dc2626' }

export default function Dashboard() {
  const { unitParams, unit, all } = useUnit()
  const { data, loading } = useApi('/api/dashboard', unitParams)
  if (loading && !data) return <div className="page"><div className="skeleton" style={{ height: 52, width: 260, marginBottom: 22 }} /><Skeleton variant="stats" count={5} /><Skeleton variant="cards" count={3} className="g-dash" /></div>
  if (!data) return <div className="page"><Empty title="Could not load dashboard" /></div>
  const t = data.totals
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title-row">Dashboard <CurrentUnitTag /></h1>
          <p>{all ? 'Overview of every unit — pick a unit below or in the top bar to focus on it' : `Overview of the ${unit.name} folder and gauge set inventory`}</p>
        </div>
        <div className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><CalendarDays size={16} /> {today}</div>
      </div>

      {data.units?.length > 1 && <UnitCards units={data.units} />}

      <div className="grid g-stats" style={{ marginBottom: 18 }}>
        <Stat icon={FolderOpen} color="#1d5fd6" label="Total Folder Types" value={t.folder_types} sub={<>across <b>{t.categories}</b> categories</>} />
        <Stat icon={Layers} color="#0d9488" label="Total Quantity" value={t.total_qty} sub="folders owned" />
        <Stat icon={CheckCircle2} color="#16a34a" label="Available Stock" value={t.available} sub={<><b>{pct(t.available, t.total_qty)}%</b> of total in store</>} />
        <Stat icon={ArrowUpRight} color="#d97706" label="Issued Out" value={t.issued} sub={<><b>{t.issued_this_month}</b> issued · <b>{t.returned_this_month}</b> returned this month</>} />
        <Stat icon={AlertTriangle} color="#dc2626" label="Low / Out of Stock" value={t.low_stock + t.out_of_stock} sub={<><b>{t.out_of_stock}</b> out of stock · <b>{t.damaged}</b> damaged</>} to="/inventory?status=alerts" />
      </div>

      <div className="grid g-dash" style={{ marginBottom: 18 }}>
        <CategoryDonut cats={data.by_category} total={t.total_qty} showUnit={all} />
        <RecentActivity items={data.recent} />
        <StatusCard t={t} />
      </div>

      <div className="grid g-side">
        <TrendCard trend={data.trend} />
        <LowStockCard items={data.low_stock} />
      </div>
    </div>
  )
}

/* One card per unit: side-by-side comparison, click to switch the whole app to that unit. */
function UnitCards({ units }) {
  const { unitId, setUnit } = useUnit()
  return (
    <div className="unit-cards">
      {units.map((u) => {
        const on = String(u.id) === unitId
        return (
          <button key={u.id} className={`card unit-card ${on ? 'on' : ''}`} style={{ '--u': u.color }}
            onClick={() => setUnit(on ? '' : u.id)} aria-pressed={on}>
            <div className="unit-card-head">
              <span className="unit-badge">{u.code}</span>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <b>{u.name}</b>
                <small>{u.category_count} categories · {u.folder_count} item types</small>
              </div>
              <span className="unit-card-cta">{on ? 'Showing · tap for all' : 'View unit'}</span>
            </div>
            <div className="unit-card-stats">
              <div><small>Total pcs</small><b className="num"><CountUp value={u.total_qty} /></b></div>
              <div><small>Available</small><b className="num" style={{ color: 'var(--green)' }}><CountUp value={u.available_qty} /></b></div>
              <div><small>Issued</small><b className="num" style={{ color: 'var(--primary)' }}><CountUp value={u.issued_qty} /></b></div>
              <div><small>Alerts</small><b className="num" style={{ color: u.alerts ? 'var(--red)' : 'var(--text-3)' }}><CountUp value={u.alerts} /></b></div>
            </div>
            <div className="unit-card-bar" title={`${u.available_qty} available of ${u.total_qty}`}>
              <span style={{ width: `${pct(u.available_qty, u.total_qty)}%` }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Stat({ icon: Icon, color, label, value, sub, to }) {
  const body = (
    <div className="card stat" style={to ? { cursor: 'pointer' } : undefined}>
      <div className="stat-icon" style={{ background: color }}><Icon size={22} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value num"><CountUp value={value} /></div>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function ChartTip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5, boxShadow: 'var(--shadow-lg)' }}>
      {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{fmt ? fmt(label) : label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, background: p.payload?.color || p.color, display: 'inline-block' }} />
          <span className="muted">{p.name}</span><b className="num" style={{ marginLeft: 'auto' }}>{p.value}</b>
        </div>
      ))}
    </div>
  )
}

function CategoryDonut({ cats, total, showUnit }) {
  const navigate = useNavigate()
  return (
    <div className="card">
      <div className="card-head"><h3>Inventory by Category</h3><Link className="link" to="/library">Open library</Link></div>
      <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 170, height: 170, position: 'relative', flexShrink: 0 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={cats} dataKey="qty" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={1.5} stroke="#fff" strokeWidth={2} animationBegin={150} animationDuration={1100} animationEasing="ease-out"
                onClick={(d) => navigate(`/library?category=${d.id}`)} style={{ cursor: 'pointer' }}>
                {cats.map((c) => <Cell key={c.id} fill={c.color} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
            <div><div className="num" style={{ fontSize: 24, fontWeight: 700 }}><CountUp value={total} /></div><div className="subtle" style={{ fontSize: 11.5 }}>Total items</div></div>
          </div>
        </div>
        <div className="legend" style={{ flex: 1, minWidth: 170, maxHeight: 230, overflowY: 'auto', paddingRight: 4 }}>
          {cats.map((c) => (
            <Link key={c.id} to={`/library?category=${c.id}`} className="legend-row">
              <i style={{ background: c.color }} /><span>{c.name}{showUnit && c.unit && <small className="subtle"> · {c.unit}</small>}</span><b className="num"><CountUp value={c.qty} /></b><em className="num">{pct(c.qty, total)}%</em>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecentActivity({ items }) {
  return (
    <div className="card">
      <div className="card-head"><h3>Recent Activity</h3><Link className="link" to="/transactions">View all</Link></div>
      <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {items.length === 0 ? <Empty title="No activity yet" /> : (
          <div className="activity">
            {items.slice(0, 5).map((tx) => {
              const s = TX[tx.type] || TX.adjust
              const Icon = tx.type === 'return' ? ArrowDownLeft : tx.type === 'issue' ? ArrowUpRight : Boxes
              return (
                <Link to={`/library/${tx.folder.id}`} key={tx.id} className="activity-item">
                  <div className="activity-icon" style={{ background: s.bg, color: s.color }}><Icon size={17} /></div>
                  <div style={{ minWidth: 0 }}>
                    <p>{txSentence(tx)}</p>
                    <small>{fmtRelative(tx.created_at)}{tx.user ? ` · ${tx.user}` : ''}</small>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusCard({ t }) {
  const rows = [
    { key: 'available', label: 'Available', value: t.available },
    { key: 'issued', label: 'Issued', value: t.issued },
    { key: 'damaged', label: 'Damaged', value: t.damaged },
  ]
  const total = t.total_qty || 1
  return (
    <div className="card">
      <div className="card-head"><h3>Items by Status</h3></div>
      <div className="card-body" style={{ display: 'flex', gap: 22, alignItems: 'stretch' }}>
        <div style={{ width: 44, height: 190, display: 'flex', flexDirection: 'column-reverse', gap: 2, borderRadius: 6, overflow: 'hidden', background: '#edf1f7' }}
          role="img" aria-label={rows.map((r) => `${r.label} ${r.value}`).join(', ')}>
          {rows.filter((r) => r.value > 0).map((r) => (
            <div key={r.key} className="grow-y" title={`${r.label}: ${r.value}`} style={{ height: `${(r.value / total) * 100}%`, minHeight: 4, background: STATUS_COLORS[r.key] }} />
          ))}
        </div>
        <div className="legend" style={{ flex: 1, justifyContent: 'center' }}>
          {rows.map((r) => (
            <div key={r.key} className="legend-row">
              <i style={{ background: STATUS_COLORS[r.key], borderRadius: 3 }} /><span>{r.label}</span><b className="num"><CountUp value={r.value} /></b><em className="num">{pct(r.value, t.total_qty)}%</em>
            </div>
          ))}
          <div className="legend-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <i style={{ background: 'transparent' }} /><span>Total</span><b className="num">{t.total_qty}</b><em />
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendCard({ trend }) {
  const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const hasData = trend.some((d) => d.issue || d.return)
  return (
    <div className="card">
      <div className="card-head">
        <h3>Issue & Return — last 14 days</h3>
        <div className="legend" style={{ flexDirection: 'row', gap: 16 }}>
          <span className="legend-row"><i style={{ background: '#1d5fd6' }} /><span>Issued</span></span>
          <span className="legend-row"><i style={{ background: '#16a34a' }} /><span>Returned</span></span>
        </div>
      </div>
      <div className="card-body" style={{ height: 260 }}>
        {!hasData ? <Empty icon={ArrowUpRight} title="No issues or returns in the last 14 days">Record one from Issue / Return.</Empty> : (
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d5fd6" stopOpacity=".18" /><stop offset="1" stopColor="#1d5fd6" stopOpacity="0" /></linearGradient>
                <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16a34a" stopOpacity=".14" /><stop offset="1" stopColor="#16a34a" stopOpacity="0" /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#edf1f7" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11.5, fill: '#8592a8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: '#8592a8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ stroke: '#cfd8e6' }} />
              <Area type="monotone" dataKey="issue" name="Issued" stroke="#1d5fd6" strokeWidth={2} fill="url(#gi)" dot={false} animationDuration={1200} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
              <Area type="monotone" dataKey="return" name="Returned" stroke="#16a34a" strokeWidth={2} fill="url(#gr)" dot={false} animationDuration={1200} animationBegin={200} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function LowStockCard({ items }) {
  return (
    <div className="card">
      <div className="card-head"><h3>Low Stock Alerts</h3><Link className="link" to="/reports">Reports</Link></div>
      <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {items.length === 0 ? <Empty icon={CheckCircle2} title="All folders are above minimum stock" /> : (
          <div className="activity">
            {items.map((f) => (
              <Link key={f.id} to={`/library/${f.id}`} className="activity-item" style={{ alignItems: 'center' }}>
                <Thumb folder={f} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500 }}>{f.name}</p>
                  <small>{f.item_code} · {f.available_qty} of {f.total_qty} available · min {f.min_qty}</small>
                </div>
                <UnitTag unit={f.unit} small />
                <StatusBadge status={f.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
