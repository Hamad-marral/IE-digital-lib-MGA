import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ArrowDownLeft, ArrowUpRight, Camera, ChevronRight, Download, FileText, History, Image as ImageIcon, ImagePlus, Pencil,
  Maximize2, Printer, SlidersHorizontal, Star, Trash2, TriangleAlert, Upload, X,
} from 'lucide-react'
import FolderArt from '../components/FolderArt'
import ImageEditor from '../components/ImageEditor'
import FolderForm from '../components/FolderForm'
import { StockModal, TxModal } from '../components/TxForms'
import { ConfirmModal, CountUp, Empty, Skeleton, StatusBadge, TxBadge, UnitTag } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fmtDate, fmtRelative } from '../lib/format'
import { useApi } from '../lib/hooks'
import { scanUrl, useQrBase } from '../lib/qr'
import { useToast } from '../lib/toast'
import { useUnit } from '../lib/unit'

export default function FolderDetail() {
  const { id } = useParams()
  const { canEdit } = useAuth()
  const { setUnit } = useUnit()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: f, loading, error, reload, setData } = useApi(`/api/folders/${id}`)
  const history = useApi(`/api/folders/${id}/transactions`)
  const outstanding = useApi(`/api/folders/${id}/outstanding`)
  const cats = useApi('/api/categories')
  const [tab, setTab] = useState('specs')
  const [modal, setModal] = useState(null)
  const [active, setActive] = useState(null)
  const [editor, setEditor] = useState(null)
  const [viewer, setViewer] = useState(null)
  const pickRef = useRef(null)
  const cameraRef = useRef(null)

  if (loading && !f) return <div className="page"><div className="skeleton" style={{ height: 60, width: 420, marginBottom: 22 }} /><div className="skeleton" style={{ height: 420, borderRadius: 12 }} /></div>
  if (error || !f) return <div className="page"><Empty title="Folder not found"><Link to="/library" className="link">Back to library</Link></Empty></div>

  const refresh = () => { reload(); history.reload(); outstanding.reload() }
  const images = f.attachments.filter((a) => a.kind === 'image')
  const docs = f.attachments.filter((a) => a.kind !== 'image')
  const shown = images.find((i) => i.url === active) ? active : (f.image_url || null)
  const shownAtt = images.find((i) => i.url === shown)

  // Upload a new photo (after editing) and make it the main photo.
  const uploadMain = async (file) => {
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('kind', 'image')
      let res = await api.post(`/api/folders/${f.id}/attachments`, fd)
      const newest = res.attachments.filter((a) => a.kind === 'image').sort((a, b) => b.id - a.id)[0]
      if (newest && res.image_url !== newest.url) res = await api.put(`/api/folders/${f.id}`, { image_url: newest.url })
      setData(res); setActive(null); toast('Photo uploaded')
    } catch (ex) { toast(ex.message, 'error') }
  }
  // Replace an existing image with its edited version.
  const replaceImage = (att) => async (file) => {
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.put(`/api/folders/${f.id}/attachments/${att.id}`, fd)
      setData(res); setActive(att.url === f.image_url ? null : res.attachments.find((a) => a.id === att.id)?.url); toast('Image updated')
    } catch (ex) { toast(ex.message, 'error') }
  }
  const openEditorForFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setEditor({ source: file, name: file.name, onSave: uploadMain, title: 'Edit new photo' })
  }

  return (
    <div className="page">
      <div className="crumbs">
        <Link to="/library">Digital Library</Link><ChevronRight size={14} />
        {f.unit && <><Link to="/library" onClick={() => setUnit(f.unit.id)}>{f.unit.name}</Link><ChevronRight size={14} /></>}
        <Link to={`/library?category=${f.category.id}`} onClick={() => f.unit && setUnit(f.unit.id)}>{f.category.name}</Link><ChevronRight size={14} />
        <span>{f.item_code}</span>
      </div>
      <div className="page-head">
        <div>
          <h1 className="title-row">{f.name} <UnitTag unit={f.unit} /></h1>
          <p>{f.type}{f.size && ` · ${f.size}`}{f.variant && ` · Variant ${f.variant}`}</p>
        </div>
        {canEdit && (
          <div className="page-actions">
            <button className="btn" onClick={() => setModal('edit')}><Pencil size={16} /> Edit</button>
            <button className="btn" onClick={() => setModal('stock')}><SlidersHorizontal size={16} /> Adjust stock</button>
            <button className="btn" onClick={() => setModal('return')} disabled={f.issued_qty === 0}><ArrowDownLeft size={16} /> Return</button>
            <button className="btn btn-primary" onClick={() => setModal('issue')} disabled={f.available_qty === 0}><ArrowUpRight size={16} /> Issue</button>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="detail-grid">
          <div>
            <div className="gallery-wrap">
              <div className="gallery-main">
                {shown ? <img src={shown} alt={f.name} onClick={() => setViewer(shown)} style={{ cursor: 'zoom-in' }} /> : <FolderArt type={f.type} size={360} accent={f.category.color} />}
              </div>
              {shown && <button className="icon-btn gallery-expand" onClick={() => setViewer(shown)} aria-label="View full size"><Maximize2 size={17} /></button>}
              {canEdit && (
                <div className="gallery-tools">
                  {shownAtt && <button className="btn btn-sm" onClick={() => setEditor({ source: shownAtt.url, name: shownAtt.filename, onSave: replaceImage(shownAtt), title: 'Edit image' })}><Pencil size={15} /> Edit image</button>}
                  <button className="btn btn-sm" onClick={() => cameraRef.current?.click()}><Camera size={15} /> Take photo</button>
                  <button className="btn btn-sm btn-primary" onClick={() => pickRef.current?.click()}><ImagePlus size={15} /> {f.image_url ? 'Upload new' : 'Upload photo'}</button>
                </div>
              )}
              <input ref={pickRef} type="file" accept="image/*" hidden onChange={openEditorForFile} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={openEditorForFile} />
            </div>
            <div className="gallery-thumbs">
              <button className={!shown ? 'on' : ''} onClick={() => setActive(null)} aria-label="Illustration" style={{ display: f.image_url ? 'none' : undefined }}>
                <FolderArt type={f.type} size={70} accent={f.category.color} />
              </button>
              {images.map((img) => (
                <button key={img.id} className={shown === img.url ? 'on' : ''} onClick={() => setActive(img.url)} aria-label={img.filename}>
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
            {!f.image_url && <p className="subtle" style={{ fontSize: 12, marginTop: 10 }}>Illustration shown — upload real photos in the Images tab.</p>}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="badge plain b-gray mono">{f.item_code}</span>
              <StatusBadge status={f.status} />
            </div>
            <div className="stock-tiles">
              <div className="stock-tile"><small>Total</small><b className="num"><CountUp value={f.total_qty} /></b></div>
              <div className="stock-tile"><small>Available</small><b className="num" style={{ color: 'var(--green)' }}><CountUp value={f.available_qty} /></b></div>
              <div className="stock-tile"><small>Issued</small><b className="num" style={{ color: 'var(--primary)' }}><CountUp value={f.issued_qty} /></b></div>
              <div className="stock-tile"><small>Damaged</small><b className="num" style={{ color: 'var(--red)' }}><CountUp value={f.damaged_qty} /></b></div>
            </div>
            <div className="kv">
              <div>Unit</div><div>{f.unit ? <UnitTag unit={f.unit} small /> : '—'}</div>
              <div>Category</div><div><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: f.category.color, marginRight: 8 }} />{f.category.name}</div>
              <div>Folder type</div><div>{f.type || '—'}</div>
              <div>Size</div><div>{f.size || '—'}</div>
              <div>Variant</div><div>{f.variant || '—'}</div>
              <div>Store location</div><div>{f.location || <span className="subtle">Not set</span>}</div>
              <div>Min stock alert</div><div className="num">{f.min_qty}</div>
              <div>Currently on lines</div>
              <div>{outstanding.data?.length ? outstanding.data.map((o) => `${o.line} (${o.qty})`).join(', ') : <span className="subtle">None</span>}</div>
              <div>Excel description</div><div className="muted" style={{ fontWeight: 400 }}>{f.description}{f.sr_no != null && ` · SR# ${f.sr_no}`}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g-side">
        <div className="card card-pad">
          <div className="tabs" role="tablist">
            {[['specs', 'Specifications', FileText], ['images', 'Images', ImageIcon, images.length], ['docs', 'Documents', FileText, docs.length], ['history', 'History', History, history.data?.length]].map(([k, l, Icon, n]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
                <Icon size={15} /> {l} {n > 0 && <span className="n num">{n}</span>}
              </button>
            ))}
          </div>
          <div key={tab} className="tab-panel">
          {tab === 'specs' && (
            <div className="kv">
              <div>Description</div><div>{f.name}</div>
              <div>Material</div><div>{f.material || <span className="subtle">Not set</span>}</div>
              <div>Dimensions</div><div>{[f.size, f.variant].filter(Boolean).join(' · ') || '—'}</div>
              <div>Usage</div><div>{f.usage || <span className="subtle">Not set</span>}</div>
              <div>Notes</div><div style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>{f.specs || <span className="subtle">No specification notes yet{canEdit ? ' — use Edit to add them.' : '.'}</span>}</div>
              <div>Added</div><div>{fmtDate(f.created_at)}</div>
            </div>
          )}
          {tab === 'images' && <Attachments kind="image" items={images} folder={f} canEdit={canEdit} onChange={setData} toast={toast}
            onEditImage={(a) => setEditor({ source: a.url, name: a.filename, onSave: replaceImage(a), title: 'Edit image' })} />}
          {tab === 'docs' && <Attachments kind="document" items={docs} folder={f} canEdit={canEdit} onChange={setData} toast={toast} />}
          {tab === 'history' && (
            !history.data?.length ? <Empty icon={History} title="No history yet" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th className="r">Qty</th><th>Line</th><th>By</th><th>Remarks</th></tr></thead>
                  <tbody>
                    {history.data.map((t) => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td><td><TxBadge type={t.type} /></td>
                        <td className="r num">{t.quantity}</td><td>{t.to_from || '—'}</td><td>{t.user || '—'}</td>
                        <td className="muted">{[t.condition === 'damaged' && 'Damaged', t.line_machine, t.remarks].filter(Boolean).join(' · ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          </div>
        </div>

        <QrCard f={f} />
      </div>

      {viewer && <Lightbox src={viewer} alt={f.name} onClose={() => setViewer(null)} />}
      {editor && (
        <ImageEditor source={editor.source} fileName={editor.name} title={editor.title} onClose={() => setEditor(null)}
          onSave={async (file) => { await editor.onSave(file); setEditor(null) }} />
      )}
      {modal === 'edit' && <FolderForm folder={f} categories={cats.data || []} onClose={() => setModal(null)} onSaved={(res) => { setData(res); setModal(null) }} />}
      {(modal === 'issue' || modal === 'return') && <TxModal kind={modal} folder={f} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === 'stock' && <StockModal folder={f} onClose={() => setModal(null)} onDone={refresh} />}
      {canEdit && (
        <div style={{ marginTop: 18, textAlign: 'right' }}>
          <button className="btn btn-ghost btn-danger btn-sm" onClick={() => setModal('delete')}><Trash2 size={15} /> Delete folder</button>
        </div>
      )}
      {modal === 'delete' && (
        <ConfirmModal danger title="Delete folder?" confirmLabel="Delete"
          message={`${f.name} (${f.item_code}) and its full history will be removed. This cannot be undone.`}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            try { await api.del(`/api/folders/${f.id}`); toast('Folder deleted'); navigate('/library') } catch (ex) { toast(ex.message, 'error'); setModal(null) }
          }} />
      )}
    </div>
  )
}

function Attachments({ kind, items, folder, canEdit, onChange, toast, onEditImage }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)

  const upload = async (files) => {
    setBusy(true)
    try {
      let res
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file); fd.append('kind', kind)
        res = await api.post(`/api/folders/${folder.id}/attachments`, fd)
      }
      if (res) { onChange(res); toast(`${files.length} file(s) uploaded`) }
    } catch (ex) { toast(ex.message, 'error') } finally { setBusy(false) }
  }
  const remove = async (a) => {
    try { onChange(await api.del(`/api/folders/${folder.id}/attachments/${a.id}`)); toast('File removed') } catch (ex) { toast(ex.message, 'error') }
  }
  const makePrimary = async (a) => {
    try { onChange(await api.put(`/api/folders/${folder.id}`, { image_url: a.url })); toast('Main photo updated') } catch (ex) { toast(ex.message, 'error') }
  }

  return (
    <div>
      {canEdit && (
        <div className={`dropzone ${drag ? 'drag' : ''}`} style={{ marginBottom: 16 }} onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]) }}>
          <Upload size={22} style={{ marginBottom: 6 }} />
          <div><b>{busy ? 'Uploading…' : `Drop ${kind === 'image' ? 'photos' : 'drawings or documents'} here`}</b> or click to browse</div>
          <div className="subtle" style={{ fontSize: 12 }}>{kind === 'image' ? 'PNG, JPG, WEBP' : 'PDF, DWG, DXF, Office files, images'} · up to 15 MB</div>
          <input ref={input} type="file" hidden multiple accept={kind === 'image' ? 'image/*' : undefined} onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />
        </div>
      )}
      {items.length === 0 ? <Empty icon={kind === 'image' ? ImageIcon : FileText} title={`No ${kind === 'image' ? 'images' : 'documents'} yet`} /> : (
        <div className="attach-grid">
          {items.map((a) => (
            <div key={a.id} className="attach">
              {kind === 'image' ? <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.filename} /></a> : (
                <a href={a.url} target="_blank" rel="noreferrer" style={{ height: 90, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--primary)' }}><FileText size={34} /></a>
              )}
              <div className="meta">
                <span title={a.filename}>{a.filename}</span>
                {kind === 'image' && canEdit && (
                  <button className="icon-btn" style={{ width: 26, height: 26 }} title="Use as main photo" onClick={() => makePrimary(a)}>
                    <Star size={14} fill={folder.image_url === a.url ? '#f59e0b' : 'none'} color={folder.image_url === a.url ? '#f59e0b' : 'currentColor'} />
                  </button>
                )}
                {kind === 'image' && canEdit && <button className="icon-btn" style={{ width: 26, height: 26 }} title="Edit image" onClick={() => onEditImage(a)}><Pencil size={14} /></button>}
                {canEdit && <button className="icon-btn" style={{ width: 26, height: 26 }} title="Delete" onClick={() => remove(a)}><Trash2 size={14} /></button>}
              </div>
              <div className="subtle" style={{ fontSize: 11, padding: '0 10px 8px' }}>{fmtRelative(a.uploaded_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
      <a className="btn btn-sm" href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Download size={15} /> Original</a>
    </div>,
    document.body,
  )
}

function QrCard({ f }) {
  const wrap = useRef(null)
  const qr = useQrBase()
  const url = qr ? scanUrl(qr.base, f) : ''
  const download = () => {
    const canvas = wrap.current?.querySelector('canvas')
    if (!canvas) return
    const a = Object.assign(document.createElement('a'), { href: canvas.toDataURL('image/png'), download: `${f.item_code}_QR.png` })
    a.click()
  }
  return (
    <div className="card card-pad qr-card">
      <h3 style={{ fontSize: 15, alignSelf: 'flex-start' }}>QR Code</h3>
      <div className="qr-box" ref={wrap}>
        {url ? <QRCodeCanvas value={url} size={180} level="M" marginSize={1} /> : <div className="skeleton" style={{ width: 180, height: 180 }} />}
      </div>
      <div>
        <b className="mono">{f.item_code}</b>
        <div className="subtle" style={{ fontSize: 12 }}>Scan with a phone camera — no sign-in needed</div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="mono qr-url">{url}</a>}
      </div>
      {qr?.localOnly && (
        <div className="alert warn" style={{ textAlign: 'left', margin: 0 }}>
          <TriangleAlert size={16} style={{ flexShrink: 0 }} />
          <span>This QR points to <b>localhost</b>, which phones can't open. Set the network address in <Link to="/settings">Settings → QR codes</Link>.</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={download}><Download size={15} /> PNG</button>
        <Link className="btn btn-sm" to={`/qr-labels?ids=${f.id}`}><Printer size={15} /> Print label</Link>
      </div>
    </div>
  )
}
