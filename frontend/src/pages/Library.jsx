import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Grid3x3, LayoutGrid, List, Plus, Search, SearchX } from 'lucide-react'
import FolderArt from '../components/FolderArt'
import FolderForm from '../components/FolderForm'
import { CurrentUnitTag, Empty, QtyBar, Skeleton, StatusBadge, Thumb, UnitTag } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/hooks'
import { groupByUnit, useUnit } from '../lib/unit'

export default function Library() {
  const { canEdit } = useAuth()
  const [params, setParams] = useSearchParams()
  const { units, unit, all, unitParams } = useUnit()
  const rawCategory = params.get('category') || ''
  const search = params.get('search') || ''
  const type = params.get('type') || ''
  const status = params.get('status') || ''
  const [view, setView] = useState('grid')
  const [adding, setAdding] = useState(false)

  const cats = useApi('/api/categories', unitParams)
  const folders = useApi('/api/folders', unitParams)
  // A category from another unit (e.g. after switching unit) is ignored.
  const category = (cats.data || []).some((c) => String(c.id) === rawCategory) ? rawCategory : ''
  const catGroups = groupByUnit(cats.data || [], units, (c) => c.unit_id)

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    if (key === 'category') next.delete('type')
    setParams(next, { replace: true })
  }

  const allFolders = folders.data || []
  const types = useMemo(() => [...new Set(allFolders.filter((f) => !category || f.category.id === +category).map((f) => f.type))].sort(), [allFolders, category])
  const list = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
    return allFolders.filter((f) => {
      if (category && f.category.id !== +category) return false
      if (type && f.type !== type) return false
      if (status && f.status !== status) return false
      const hay = `${f.name} ${f.item_code} ${f.size} ${f.type} ${f.category.name} ${f.variant} ${f.unit?.name}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [allFolders, category, type, status, search])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title-row">Digital Library <CurrentUnitTag /></h1>
          <p>{all ? 'Folders and gauge sets of every unit, grouped by unit and category' : `Browse ${unit.name} folders and gauge sets by category`}</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={17} /> Add Folder</button>}
      </div>

      <div className="cat-tabs" role="tablist">
        <CatTab on={!category} onClick={() => set('category', '')} color={unit?.color || '#1d5fd6'} label={all ? 'All units' : `All ${unit.name}`} count={allFolders.length} icon={<Grid3x3 size={18} />} />
        {catGroups.map((g) => (
          <div key={g.unit?.id ?? 'none'} className={`cat-group ${catGroups.length > 1 ? 'labelled' : ''}`} style={{ '--u': g.unit?.color || '#8592a8' }}>
            {catGroups.length > 1 && <span className="cat-group-label">{g.unit?.name || 'No unit'}</span>}
            <div className="cat-group-tabs">
              {g.items.map((c) => (
                <CatTab key={c.id} on={+category === c.id} onClick={() => set('category', String(c.id))} color={c.color}
                  label={c.name} count={c.folder_count} icon={<b style={{ fontSize: 11 }}>{c.code}</b>} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={17} />
          <input value={search} onChange={(e) => set('search', e.target.value)} placeholder="Search by name, size, type or item code…" aria-label="Search library" />
        </div>
        <select className="select" value={type} onChange={(e) => set('type', e.target.value)} aria-label="Folder type">
          <option value="">All types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => set('status', e.target.value)} aria-label="Stock status">
          <option value="">Any status</option>
          <option value="available">Available</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid size={17} /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view"><List size={17} /></button>
        </div>
      </div>

      <div className="subtle" style={{ fontSize: 12.5, marginBottom: 12 }}>
        Showing <b className="num">{list.length}</b> of {allFolders.length} items{all ? ' across all units' : ` in ${unit.name}`}
      </div>

      {folders.loading && !folders.data ? <Skeleton variant="cards" count={8} /> : list.length === 0 ? (
        <div className="card"><Empty icon={SearchX} title="No folders match these filters">Try a different search or clear the filters.</Empty></div>
      ) : view === 'grid' ? (
        <div className="grid g-folders" key={`${category}|${type}|${status}`}>
          {list.map((f) => <FolderCard key={f.id} f={f} showUnit={all} />)}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Folder</th>{all && <th>Unit</th>}<th>Category</th><th>Type</th><th>Size</th><th className="r">Available</th><th className="r">Total</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id}>
                  <td><Link to={`/library/${f.id}`} className="cell-folder"><Thumb folder={f} /><div><b style={{ fontWeight: 600 }}>{f.name}</b><div className="subtle mono">{f.item_code}</div></div></Link></td>
                  {all && <td><UnitTag unit={f.unit} small /></td>}<td>{f.category.name}</td><td>{f.type}</td><td>{f.size}{f.variant && ` · ${f.variant}`}</td>
                  <td className="r num">{f.available_qty}</td><td className="r num">{f.total_qty}</td><td><StatusBadge status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <FolderForm categories={cats.data || []} defaultCategory={category} onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); folders.reload(); cats.reload() }} />}
    </div>
  )
}

function CatTab({ on, onClick, color, label, count, icon }) {
  return (
    <button className={`cat-tab ${on ? 'on' : ''}`} onClick={onClick} role="tab" aria-selected={on}>
      <span className="ic" style={{ background: `${color}1a`, color }}>{icon}</span>
      <b>{label}</b>
      <small className="num">{count} types</small>
    </button>
  )
}

function FolderCard({ f, showUnit }) {
  return (
    <Link to={`/library/${f.id}`} className="card folder-card">
      <div className="folder-media">
        {f.image_url ? <img src={f.image_url} alt={f.name} loading="lazy" /> : <FolderArt type={f.type} size={190} accent={f.category.color} />}
        <span className="code mono">{f.item_code}</span>
        {showUnit && f.unit && <span className="unit-corner" style={{ '--u': f.unit.color }}>{f.unit.name}</span>}
        <StatusBadge status={f.status} />
      </div>
      <div className="folder-body">
        <h4>{f.name}</h4>
        <div className="folder-meta">
          <span className="chip">{f.type}</span>
          {f.size && <span className="chip">{f.size}</span>}
          {f.variant && <span className="chip">{f.variant}</span>}
        </div>
        <QtyBar f={f} />
        <div className="folder-foot">
          <span className="muted" style={{ fontSize: 12.5 }}>
            <b className="num" style={{ color: 'var(--text)', fontSize: 14 }}>{f.available_qty}</b> / {f.total_qty} available
          </span>
          <span className="btn btn-sm btn-primary">View Details</span>
        </div>
      </div>
    </Link>
  )
}
