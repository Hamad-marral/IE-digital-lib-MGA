import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, LogIn, MapPin, ScanLine } from 'lucide-react'
import FolderArt from '../components/FolderArt'
import { CountUp, Empty, StatusBadge } from '../components/ui'
import { useAuth } from '../lib/auth'

/* Public page opened by scanning a folder's QR code. No sign-in needed. */
export default function Scan() {
  const { code } = useParams()
  const { user } = useAuth()
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')
  const [img, setImg] = useState(null)

  useEffect(() => {
    fetch(`/api/public/folders/${encodeURIComponent(code)}`)
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).detail || 'Not found'); return r.json() })
      .then((d) => { setF(d); setImg(d.image_url || d.images[0] || null) })
      .catch((e) => setErr(e.message))
  }, [code])

  return (
    <div className="scan">
      <header className="scan-head">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-logo"><BookOpen size={18} /></div>
          <div><b>Folder and Gauge Set Library</b><span>Folder scan</span></div>
        </div>
        <ScanLine size={22} />
      </header>

      {err ? <div className="card" style={{ margin: 16 }}><Empty title="Folder not found">Code “{code}” is not in the library.</Empty></div>
        : !f ? <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 260, borderRadius: 14 }} /><div className="skeleton" style={{ height: 120, marginTop: 14, borderRadius: 14 }} /></div>
        : (
          <main className="scan-body">
            <div className="scan-photo">
              {img ? <img src={img} alt={f.name} /> : <FolderArt type={f.type} size={300} accent={f.category.color} />}
            </div>
            {f.images.length > 1 && (
              <div className="gallery-thumbs" style={{ marginTop: 0 }}>
                {f.images.map((u) => <button key={u} className={u === img ? 'on' : ''} onClick={() => setImg(u)}><img src={u} alt="" /></button>)}
              </div>
            )}

            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="badge plain b-gray mono">{f.item_code}</span>
                <StatusBadge status={f.status} />
              </div>
              <h1 style={{ fontSize: 20, margin: '10px 0 4px' }}>{f.name}</h1>
              <div className="muted" style={{ fontSize: 13.5 }}>
                <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: f.category.color, marginRight: 6 }} />
                {f.unit && <b style={{ color: f.unit.color }}>{f.unit.name} · </b>}{f.category.name} · {f.type}{f.size && ` · ${f.size}`}{f.variant && ` · ${f.variant}`}
              </div>
              <div className="stock-tiles">
                <div className="stock-tile"><small>Total</small><b className="num"><CountUp value={f.total_qty} /></b></div>
                <div className="stock-tile"><small>Available</small><b className="num" style={{ color: 'var(--green)' }}><CountUp value={f.available_qty} /></b></div>
                <div className="stock-tile"><small>Issued</small><b className="num" style={{ color: 'var(--primary)' }}><CountUp value={f.issued_qty} /></b></div>
                <div className="stock-tile"><small>Damaged</small><b className="num" style={{ color: 'var(--red)' }}><CountUp value={f.damaged_qty} /></b></div>
              </div>
              <div className="kv">
                <div>Location</div><div>{f.location ? <><MapPin size={13} style={{ verticalAlign: -2 }} /> {f.location}</> : <span className="subtle">Not set</span>}</div>
                <div>On lines</div><div>{f.on_lines.length ? f.on_lines.map((o) => `${o.line} (${o.qty})`).join(', ') : <span className="subtle">None</span>}</div>
                {f.material && <><div>Material</div><div>{f.material}</div></>}
                {f.usage && <><div>Usage</div><div>{f.usage}</div></>}
                {f.specs && <><div>Notes</div><div style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>{f.specs}</div></>}
              </div>
            </div>

            <Link to={`/library/${f.id}`} className="btn btn-primary btn-block" style={{ height: 46 }}>
              {user ? <><BookOpen size={17} /> Open full details</> : <><LogIn size={17} /> Sign in to issue / return</>}
            </Link>
          </main>
        )}
    </div>
  )
}
