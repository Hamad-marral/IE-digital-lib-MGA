import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpDown, ArrowUpRight, Download, Plus, Search, SearchX, SlidersHorizontal } from 'lucide-react'
import FolderForm from '../components/FolderForm'
import { StockModal, TxModal } from '../components/TxForms'
import { CategoryOptions, CurrentUnitTag, Empty, QtyBar, Skeleton, StatusBadge, Thumb, UnitTag } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useUnit } from '../lib/unit'

const COLS = [
  ['item_code', 'Code'], ['name', 'Folder'], ['category', 'Category'], ['size', 'Size'],
  ['total_qty', 'Total'], ['available_qty', 'Available'], ['issued_qty', 'Issued'], ['damaged_qty', 'Damaged'],
  ['location', 'Location'], ['status', 'Status'],
]

export default function Inventory() {
  const { canEdit } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const rawCategory = params.get('category') || ''
  const { unit, all: allUnits, unitParams } = useUnit()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [modal, setModal] = useState(null)
  const folders = useApi('/api/folders', unitParams)
  const cats = useApi('/api/categories', unitParams)
  const category = (cats.data || []).some((c) => String(c.id) === rawCategory) ? rawCategory : ''

  const set = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }) }

  const all = folders.data || []
  const rows = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
    const out = all.filter((f) => {
      if (category && f.category.id !== +category) return false
      if (status === 'alerts' && f.status === 'available') return false
      if (status === 'issued' && f.issued_qty === 0) return false
      if (status === 'damaged' && f.damaged_qty === 0) return false
      if (['available', 'low_stock', 'out_of_stock'].includes(status) && f.status !== status) return false
      const hay = `${f.name} ${f.item_code} ${f.size} ${f.type} ${f.location} ${f.unit?.name}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
    if (!sort.key) return out // server order: category, then item code
    const val = (f) => (sort.key === 'category' ? f.category.name : sort.key === 'unit' ? f.unit?.name : f[sort.key]) ?? ''
    return out.sort((a, b) => {
      const x = val(a), y = val(b)
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir
    })
  }, [all, search, status, category, sort])

  const cols = allUnits ? [...COLS.slice(0, 2), ['unit', 'Unit'], ...COLS.slice(2)] : COLS
  const totals = rows.reduce((s, f) => ({ t: s.t + f.total_qty, a: s.a + f.available_qty, i: s.i + f.issued_qty, d: s.d + f.damaged_qty }), { t: 0, a: 0, i: 0, d: 0 })
  const replace = (res) => folders.setData(all.map((f) => (f.id === res.folder.id ? res.folder : f)))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title-row">Inventory <CurrentUnitTag /></h1>
          <p>Track total, available, issued and damaged quantities{allUnits ? ' for every unit' : ` for ${unit.name}`}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download('/api/reports/export/inventory', unitParams).catch((e) => toast(e.message, 'error'))}><Download size={16} /> Export Excel</button>
          {canEdit && <button className="btn btn-primary" onClick={() => setModal({ kind: 'add' })}><Plus size={17} /> Add Folder</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name, code, size or location…" aria-label="Filter inventory" />
        </div>
        <select className="select" value={category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          <CategoryOptions categories={cats.data || []} />
        </select>
        <select className="select" value={status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">All stock</option>
          <option value="alerts">Low + out of stock</option>
          <option value="available">Available</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="issued">Has issued qty</option>
          <option value="damaged">Has damaged qty</option>
        </select>
      </div>

      <div className="card">
        {folders.loading && !folders.data ? <Skeleton count={8} /> : rows.length === 0 ? <Empty icon={SearchX} title="No folders match" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {cols.map(([k, l]) => (
                    <th key={k} className={k.endsWith('_qty') ? 'r' : ''} style={{ cursor: 'pointer' }}
                      onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))}
                      aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                      {l} {sort.key === k && <ArrowUpDown size={11} />}
                    </th>
                  ))}
                  {canEdit && <th className="r">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{f.item_code}</td>
                    <td><Link to={`/library/${f.id}`} className="cell-folder"><Thumb folder={f} size={38} /><div style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{f.name}</b><QtyBar f={f} /></div></Link></td>
                    {allUnits && <td><UnitTag unit={f.unit} small /></td>}
                    <td style={{ whiteSpace: 'nowrap' }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: f.category.color, marginRight: 7 }} />{f.category.name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{f.size}{f.variant && ` · ${f.variant}`}</td>
                    <td className="r num"><b>{f.total_qty}</b></td>
                    <td className="r num" style={{ color: 'var(--green)', fontWeight: 600 }}>{f.available_qty}</td>
                    <td className="r num" style={{ color: f.issued_qty ? 'var(--primary)' : 'var(--text-3)' }}>{f.issued_qty}</td>
                    <td className="r num" style={{ color: f.damaged_qty ? 'var(--red)' : 'var(--text-3)' }}>{f.damaged_qty}</td>
                    <td className="muted">{f.location || '—'}</td>
                    <td><StatusBadge status={f.status} /></td>
                    {canEdit && (
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        <button className="icon-btn" title="Issue" aria-label="Issue" disabled={!f.available_qty} onClick={() => setModal({ kind: 'issue', f })}><ArrowUpRight size={16} /></button>
                        <button className="icon-btn" title="Return" aria-label="Return" disabled={!f.issued_qty} onClick={() => setModal({ kind: 'return', f })}><ArrowDownLeft size={16} /></button>
                        <button className="icon-btn" title="Adjust stock" aria-label="Adjust stock" onClick={() => setModal({ kind: 'stock', f })}><SlidersHorizontal size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', fontWeight: 600 }}>
                  <td colSpan={allUnits ? 5 : 4} style={{ padding: '12px 14px' }}>{rows.length} items</td>
                  <td className="r num" style={{ padding: '12px 14px' }}>{totals.t}</td>
                  <td className="r num" style={{ padding: '12px 14px' }}>{totals.a}</td>
                  <td className="r num" style={{ padding: '12px 14px' }}>{totals.i}</td>
                  <td className="r num" style={{ padding: '12px 14px' }}>{totals.d}</td>
                  <td colSpan={canEdit ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {modal?.kind === 'add' && <FolderForm categories={cats.data || []} defaultCategory={category} onClose={() => setModal(null)} onSaved={() => { setModal(null); folders.reload() }} />}
      {(modal?.kind === 'issue' || modal?.kind === 'return') && <TxModal kind={modal.kind} folder={modal.f} onClose={() => setModal(null)} onDone={replace} />}
      {modal?.kind === 'stock' && <StockModal folder={modal.f} onClose={() => setModal(null)} onDone={replace} />}
    </div>
  )
}
