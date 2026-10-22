import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, Download, FileSpreadsheet, QrCode } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CurrentUnitTag, Empty, Skeleton, StatusBadge } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useUnit } from '../lib/unit'

const S = { available: '#16a34a', issued: '#1d5fd6', damaged: '#dc2626', returned: '#16a34a' }
const axis = { fontSize: 11.5, fill: '#8592a8' }

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{payload[0]?.payload?.name || label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span className="muted">{p.name}</span><b className="num" style={{ marginLeft: 'auto', paddingLeft: 12 }}>{p.value}</b>
        </div>
      ))}
    </div>
  )
}

const Legend = ({ items }) => (
  <div className="legend" style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
    {items.map(([l, c]) => <span key={l} className="legend-row"><i style={{ background: c, borderRadius: 3 }} /><span>{l}</span></span>)}
  </div>
)

export default function Reports() {
  const toast = useToast()
  const [range, setRange] = useState({ date_from: '', date_to: '' })
  const { unit, all, unitParams } = useUnit()
  const { data, loading } = useApi('/api/reports/summary', { ...range, ...unitParams })
  const dl = (path, params) => api.download(path, { ...params, ...unitParams }).catch((e) => toast(e.message, 'error'))
  const scope = all ? 'all units' : unit.name

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title-row">Reports <CurrentUnitTag /></h1>
          <p>Stock, usage by line, low stock alerts and Excel export for {scope}</p>
        </div>
        <div className="page-actions">
          <input className="input" type="date" style={{ width: 'auto' }} value={range.date_from} onChange={(e) => setRange((r) => ({ ...r, date_from: e.target.value }))} aria-label="From date" />
          <span className="subtle">to</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={range.date_to} onChange={(e) => setRange((r) => ({ ...r, date_to: e.target.value }))} aria-label="To date" />
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 18 }}>
        <ExportCard icon={FileSpreadsheet} title="Inventory report" text={`${all ? 'Every unit' : unit.name}: all items with total, available, issued, damaged and status.`} onClick={() => dl('/api/reports/export/inventory')} />
        <ExportCard icon={FileSpreadsheet} title="Transaction log" text={`Every issue, return and stock movement in ${scope} for the selected dates.`} onClick={() => dl('/api/reports/export/transactions', range)} />
        <ExportCard icon={AlertTriangle} title="Low stock list" text={`Items in ${scope} at or below their minimum stock level.`} onClick={() => dl('/api/reports/export/low-stock')} />
      </div>

      {loading && !data ? <Skeleton variant="cards" count={4} className="g-2" /> : data && (
        <>
          <div className="grid g-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="card-head"><h3>Stock by category</h3><Legend items={[['Available', S.available], ['Issued', S.issued], ['Damaged', S.damaged]]} /></div>
              <div className="card-body" style={{ height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={data.categories} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#edf1f7" />
                    <XAxis dataKey="code" tick={axis} axisLine={false} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill: '#f3f6fb' }} />
                    <Bar dataKey="available" name="Available" stackId="s" fill={S.available} maxBarSize={56} animationDuration={900} />
                    <Bar dataKey="issued" name="Issued" stackId="s" fill={S.issued} maxBarSize={56} animationDuration={900} />
                    <Bar dataKey="damaged" name="Damaged" stackId="s" fill={S.damaged} maxBarSize={56} animationDuration={900} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Issued vs returned by month</h3><Legend items={[['Issued', S.issued], ['Returned', S.returned]]} /></div>
              <div className="card-body" style={{ height: 280 }}>
                {data.by_month.length === 0 ? <Empty icon={BarChart3} title="No issue or return activity in this period" /> : (
                  <ResponsiveContainer>
                    <BarChart data={data.by_month} margin={{ top: 4, right: 8, left: -18, bottom: 0 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke="#edf1f7" />
                      <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} cursor={{ fill: '#f3f6fb' }} />
                      <Bar dataKey="issued" name="Issued" fill={S.issued} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="returned" name="Returned" fill={S.returned} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid g-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="card-head"><h3>Usage by line</h3><span className="subtle" style={{ fontSize: 12 }}>Folders issued</span></div>
              {data.by_line.length === 0 ? <Empty title="No folders issued in this period" /> : (
                <div className="card-body">
                  {data.by_line.map((l) => {
                    const max = data.by_line[0].issued || 1
                    return (
                      <div key={l.line} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 12, alignItems: 'center', padding: '7px 0' }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{l.line}</span>
                        <div style={{ background: '#edf1f7', borderRadius: 4, height: 10 }} title={`${l.issued} issued, ${l.returned} returned`}>
                          <div className="grow-x" style={{ width: `${(l.issued / max) * 100}%`, background: S.issued, height: '100%', borderRadius: 4 }} />
                        </div>
                        <span className="num" style={{ fontSize: 12.5, textAlign: 'right' }}><b>{l.issued}</b> <span className="subtle">/ {l.returned} ret.</span></span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-head"><h3>Most issued folders</h3></div>
              {data.top_folders.length === 0 ? <Empty title="No folders issued in this period" /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>#</th><th>Folder</th><th className="r">Times</th><th className="r">Qty issued</th></tr></thead>
                    <tbody>
                      {data.top_folders.map((f, i) => (
                        <tr key={f.folder_id}>
                          <td className="subtle num">{i + 1}</td>
                          <td><Link to={`/library/${f.folder_id}`}>{f.name}</Link> <span className="subtle mono">{f.item_code}</span></td>
                          <td className="r num">{f.times}</td><td className="r num"><b>{f.issued}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid g-2">
            <div className="card">
              <div className="card-head"><h3>Category summary</h3></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Category</th>{all && <th>Unit</th>}<th className="r">Types</th><th className="r">Total</th><th className="r">Available</th><th className="r">Issued</th><th className="r">Damaged</th></tr></thead>
                  <tbody>
                    {data.categories.map((c) => (
                      <tr key={c.id}>
                        <td><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: c.color, marginRight: 8 }} />{c.name}</td>
                        {all && <td className="muted">{c.unit}</td>}
                        <td className="r num">{c.types}</td><td className="r num"><b>{c.total}</b></td><td className="r num">{c.available}</td><td className="r num">{c.issued}</td><td className="r num">{c.damaged}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Low stock alerts</h3><Link className="link" to="/qr-labels"><QrCode size={14} style={{ verticalAlign: -2 }} /> QR labels</Link></div>
              {data.alerts.length === 0 ? <Empty title="All folders are above minimum stock" /> : (
                <div className="table-wrap" style={{ maxHeight: 360 }}>
                  <table className="table">
                    <thead><tr><th>Folder</th><th className="r">Available</th><th className="r">Min</th><th>Status</th></tr></thead>
                    <tbody>
                      {data.alerts.map((f) => (
                        <tr key={f.id}>
                          <td><Link to={`/library/${f.id}`}>{f.name}</Link> <span className="subtle mono">{f.item_code}</span></td>
                          <td className="r num"><b>{f.available_qty}</b></td><td className="r num">{f.min_qty}</td><td><StatusBadge status={f.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ExportCard({ icon: Icon, title, text, onClick }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div className="stat-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary)', borderRadius: 12 }}><Icon size={22} /></div>
      <div style={{ flex: 1 }}>
        <b>{title}</b>
        <p className="muted" style={{ margin: '4px 0 12px', fontSize: 13 }}>{text}</p>
        <button className="btn btn-sm" onClick={onClick}><Download size={15} /> Download .xlsx</button>
      </div>
    </div>
  )
}
