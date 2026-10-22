import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Lock } from 'lucide-react'
import { IssueForm, ReturnForm } from '../components/TxForms'
import { Empty, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { TX, fmtRelative, txSentence } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useUnit } from '../lib/unit'
import { CurrentUnitTag } from '../components/ui'

export default function IssueReturn() {
  const { canEdit } = useAuth()
  const [tab, setTab] = useState('issue')
  const { unit, all, unitParams } = useUnit()
  const folders = useApi('/api/folders', unitParams)
  const recent = useApi('/api/transactions', { type: 'issue,return', page_size: 8, ...unitParams })
  const out = useApi('/api/transactions/lines/outstanding', unitParams)
  const [formKey, setFormKey] = useState(0)

  const done = () => { folders.reload(); recent.reload(); out.reload(); setFormKey((k) => k + 1) }

  const byLine = (out.data || []).reduce((acc, o) => { (acc[o.line] ||= []).push(o); return acc }, {})

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="title-row">Issue / Return <CurrentUnitTag /></h1>
          <p>{all ? 'Issue and return items of any unit. Pick a unit in the top bar to see only its items.' : `Issue and return ${unit.name} items between the IE store and sewing lines`}</p>
        </div>
      </div>

      <div className="grid g-side" style={{ marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="seg-tabs" role="tablist">
            <button className={tab === 'issue' ? 'on' : ''} onClick={() => setTab('issue')} role="tab" aria-selected={tab === 'issue'}><ArrowUpRight size={16} /> Issue</button>
            <button className={tab === 'return' ? 'on' : ''} onClick={() => setTab('return')} role="tab" aria-selected={tab === 'return'}><ArrowDownLeft size={16} /> Return</button>
          </div>
          {!canEdit ? <Empty icon={Lock} title="Read-only access">Ask an admin for IE Team access to issue or return folders.</Empty>
            : folders.loading && !folders.data ? <Spinner />
            : tab === 'issue' ? <IssueForm key={`i${formKey}`} folders={folders.data || []} onDone={done} />
            : <ReturnForm key={`r${formKey}`} folders={folders.data || []} onDone={done} />}
        </div>

        <div className="card">
          <div className="card-head"><h3>Recent Transactions</h3><Link className="link" to="/transactions">View all</Link></div>
          <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {!recent.data?.items.length ? <Empty title="No issues or returns yet" /> : (
              <div className="activity">
                {recent.data.items.map((t) => {
                  const s = TX[t.type]
                  return (
                    <Link key={t.id} to={`/library/${t.folder.id}`} className="activity-item">
                      <div className="activity-icon" style={{ background: s.bg, color: s.color }}>{t.type === 'issue' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}</div>
                      <div style={{ minWidth: 0 }}>
                        <p>{txSentence(t)}</p>
                        <small>{fmtRelative(t.created_at)}{t.user && ` · ${t.user}`}</small>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Currently on lines</h3><span className="subtle num" style={{ fontSize: 12.5 }}>{(out.data || []).reduce((s, o) => s + o.qty, 0)} folders out</span></div>
        {Object.keys(byLine).length === 0 ? <Empty title="No folders are out on lines" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Line</th><th>Folder</th>{all && <th>Unit</th>}<th>Code</th><th className="r">Qty out</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {Object.entries(byLine).map(([line, items]) => items.map((o, i) => (
                  <tr key={`${line}-${o.folder_id}`}>
                    {i === 0 && <td rowSpan={items.length} style={{ fontWeight: 600, verticalAlign: 'top' }}>{line}</td>}
                    <td><Link to={`/library/${o.folder_id}`}>{o.folder_name}</Link></td>
                    {all && <td className="muted">{o.unit}</td>}
                    <td className="mono">{o.item_code}</td>
                    <td className="r num"><b>{o.qty}</b></td>
                    {canEdit && <td className="r"><button className="btn btn-sm" onClick={() => setTab('return')}><ArrowDownLeft size={14} /> Return</button></td>}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
