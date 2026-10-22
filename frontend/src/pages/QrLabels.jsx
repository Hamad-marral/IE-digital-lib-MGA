import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { CategoryOptions, CurrentUnitTag, Spinner } from '../components/ui'
import { useApi } from '../lib/hooks'
import { scanUrl, useQrBase } from '../lib/qr'
import { useUnit } from '../lib/unit'

export default function QrLabels() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const ids = params.get('ids')
  const { unit, all, unitParams } = useUnit()
  const folders = useApi('/api/folders', ids ? {} : unitParams)
  const cats = useApi('/api/categories', unitParams)
  const qr = useQrBase()

  const list = useMemo(() => {
    const all = folders.data || []
    if (ids) { const set = new Set(ids.split(',').map(Number)); return all.filter((f) => set.has(f.id)) }
    return category ? all.filter((f) => f.category.id === +category) : all
  }, [folders.data, category, ids])

  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <h1 className="title-row">QR Labels {!ids && <CurrentUnitTag />}</h1>
          <p>Print QR labels for folder storage. Scanning opens the folder's detail page.</p>
        </div>
        <div className="page-actions">
          <select className="select" style={{ width: 'auto' }} value={ids ? '' : category}
            onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {})} aria-label="Category">
            <option value="">{ids ? 'Selected folder' : all ? 'All units · all categories' : `All ${unit.name} categories`}</option>
            <CategoryOptions categories={cats.data || []} />
          </select>
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Print {list.length} labels</button>
        </div>
      </div>
      {(folders.loading && !folders.data) || !qr ? <Spinner /> : (
        <>
        <div className="alert info no-print">QR codes open <b className="mono">{qr.base}/scan/…</b> — change this in Settings → QR codes.</div>
        <div className="labels">
          {list.map((f) => (
            <div key={f.id} className="label">
              <QRCodeSVG value={scanUrl(qr.base, f)} size={110} level="M" />
              <b className="mono" style={{ fontSize: 13 }}>{f.item_code}</b>
              <b>{f.name}</b>
              <small>{f.unit ? `${f.unit.name} · ` : ''}{f.category.name}{f.location && ` · ${f.location}`}</small>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
