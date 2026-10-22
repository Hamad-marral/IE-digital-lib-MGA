import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, ReceiptText, Search } from 'lucide-react'
import { CurrentUnitTag, Empty, Skeleton, TxBadge, UnitTag } from '../components/ui'
import { api } from '../lib/api'
import { TX, fmtDate } from '../lib/format'
import { useApi, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useUnit } from '../lib/unit'

export default function Transactions() {
  const toast = useToast()
  const [f, setF] = useState({ type: '', search: '', date_from: '', date_to: '', line: '' })
  const [page, setPage] = useState(1)
  const search = useDebounced(f.search)
  const settings = useApi('/api/settings')
  const { unit, all, unitParams } = useUnit()
  const { data, loading } = useApi('/api/transactions', { ...f, search, page, page_size: 25, ...unitParams })
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1) }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title-row">Transactions <CurrentUnitTag /></h1>
          <p>Audit trail of every issue, return and stock movement{all ? ' in all units' : ` in ${unit.name}`}</p>
        </div>
        <button className="btn" onClick={() => api.download('/api/reports/export/transactions', { date_from: f.date_from, date_to: f.date_to, ...unitParams }).catch((e) => toast(e.message, 'error'))}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div className="toolbar">
        <div className="search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={17} />
          <input value={f.search} onChange={set('search')} placeholder="Search folder, code, line, person or remarks…" aria-label="Search transactions" />
        </div>
        <select className="select" value={f.type} onChange={set('type')} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(TX).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="select" value={f.line} onChange={set('line')} aria-label="Line">
          <option value="">All lines</option>
          {(settings.data?.lines || []).map((l) => <option key={l}>{l}</option>)}
        </select>
        <input className="input" type="date" style={{ width: 'auto' }} value={f.date_from} onChange={set('date_from')} aria-label="From date" />
        <span className="subtle">to</span>
        <input className="input" type="date" style={{ width: 'auto' }} value={f.date_to} onChange={set('date_to')} aria-label="To date" />
      </div>

      <div className="card">
        {loading && !data ? <Skeleton count={8} /> : !data?.items.length ? <Empty icon={ReceiptText} title="No transactions found" /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Folder</th><th className="r">Qty</th><th>Line</th><th>Machine</th><th>Person</th><th>Recorded by</th><th>Remarks</th></tr></thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                      <td><TxBadge type={t.type} /></td>
                      <td><Link to={`/library/${t.folder.id}`}><b style={{ fontWeight: 500 }}>{t.folder.name}</b><div className="subtle mono">{t.folder.item_code}</div></Link>{all && <UnitTag unit={t.folder.unit} small />}</td>
                      <td className="r num"><b>{t.type === 'adjust' && t.quantity > 0 ? '+' : ''}{t.quantity}</b></td>
                      <td>{t.to_from || '—'}</td>
                      <td className="muted">{t.line_machine || '—'}</td>
                      <td className="muted">{t.receiver || '—'}</td>
                      <td className="muted">{t.user || 'System'}</td>
                      <td className="muted" style={{ maxWidth: 260 }}>{[t.condition === 'damaged' && 'Returned damaged', t.remarks].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span className="num">{(page - 1) * data.page_size + 1}–{Math.min(page * data.page_size, data.total)} of {data.total}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                <span className="num">Page {page} / {pages}</span>
                <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
