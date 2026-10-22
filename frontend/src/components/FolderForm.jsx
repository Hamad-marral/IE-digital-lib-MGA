import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ImagePlus, Pencil, Trash2, Undo2 } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import FolderArt from './FolderArt'
import ImageEditor from './ImageEditor'
import { CategoryOptions, Modal } from './ui'

const TYPES = ['Single Part', 'Two Part', 'Two Part Straight', 'Two Part Contour', 'Two Part Piping', 'Hang Folder', 'Hemming Folder', 'Loop Folder', 'Press Folder', 'Folder', 'Gauge Set', 'Conversion Kit']

/* Create (no `folder`) or edit an existing folder's library details. */
export default function FolderForm({ folder, categories, defaultCategory, onClose, onSaved }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(() => folder ? {
    category_id: folder.category.id, name: folder.name, type: folder.type, size: folder.size, variant: folder.variant,
    material: folder.material, usage: folder.usage, specs: folder.specs, location: folder.location, min_qty: folder.min_qty,
    description: folder.description,
  } : {
    category_id: defaultCategory || categories[0]?.id || '', name: '', type: '', size: '', variant: '', material: '',
    usage: '', specs: '', location: '', min_qty: 1, total_qty: 1, description: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // photo.mode: keep | new (upload file) | edited (replace current attachment) | remove (clear main photo)
  const [photo, setPhoto] = useState({ mode: 'keep', file: null, preview: null })
  const [editor, setEditor] = useState(null)
  const currentAtt = folder?.attachments?.find((a) => a.url === folder.image_url)

  const savePhoto = async (saved) => {
    let res = saved
    if (photo.mode === 'new' && photo.file) {
      const fd = new FormData(); fd.append('file', photo.file); fd.append('kind', 'image')
      res = await api.post(`/api/folders/${saved.id}/attachments`, fd)
      const newest = res.attachments.filter((a) => a.kind === 'image').sort((a, b) => b.id - a.id)[0]
      if (newest && res.image_url !== newest.url) res = await api.put(`/api/folders/${saved.id}`, { image_url: newest.url })
    } else if (photo.mode === 'edited' && photo.file && currentAtt) {
      const fd = new FormData(); fd.append('file', photo.file)
      res = await api.put(`/api/folders/${saved.id}/attachments/${currentAtt.id}`, fd)
    }
    return res
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const body = { ...form, category_id: +form.category_id, min_qty: +form.min_qty || 0 }
      if (photo.mode === 'remove') body.image_url = ''
      if (folder) {
        const res = await savePhoto(await api.put(`/api/folders/${folder.id}`, body))
        toast('Folder updated')
        onSaved(res)
      } else {
        body.total_qty = +form.total_qty || 0
        const res = await savePhoto(await api.post('/api/folders', body))
        toast(`${res.name} added as ${res.item_code}`)
        onSaved(res)
        navigate(`/library/${res.id}`)
      }
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <Modal wide title={folder ? `Edit ${folder.item_code}` : 'Add new folder'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="folder-form" disabled={busy}>{busy ? 'Saving…' : folder ? 'Save changes' : 'Add folder'}</button>
    </>}>
      <form id="folder-form" onSubmit={save}>
        {err && <div className="alert err">{err}</div>}
        <PhotoField folder={folder} photo={photo} setPhoto={setPhoto} currentUrl={folder?.image_url}
          type={form.type} onEdit={(source, name, onSave) => setEditor({ source, name, onSave })} />
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Folder name *</label>
            <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Waist band Single part Folder 1*3/8M" />
            {!folder && <span className="hint">Size and type are detected from the name when left blank.</span>}
          </div>
          <div className="field">
            <label>Unit · category *</label>
            <select className="select" value={form.category_id} onChange={set('category_id')} required>
              <CategoryOptions categories={categories} />
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Type</label>
            <input className="input" list="folder-types" value={form.type} onChange={set('type')} placeholder="Auto" />
            <datalist id="folder-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="field"><label>Size</label><input className="input" value={form.size} onChange={set('size')} placeholder='e.g. 1-3/8"' /></div>
          <div className="field"><label>Variant</label><input className="input" value={form.variant} onChange={set('variant')} placeholder="e.g. M / L" /></div>
        </div>
        <div className="row">
          <div className="field"><label>Material</label><input className="input" value={form.material} onChange={set('material')} placeholder="e.g. Stainless steel" /></div>
          <div className="field"><label>Store location</label><input className="input" value={form.location} onChange={set('location')} placeholder="e.g. Shelf A · Rack 2" /></div>
          <div className="field"><label>Min stock alert</label><input className="input" type="number" min="0" value={form.min_qty} onChange={set('min_qty')} /></div>
          {!folder && <div className="field"><label>Opening quantity</label><input className="input" type="number" min="0" value={form.total_qty} onChange={set('total_qty')} /></div>}
        </div>
        <div className="field"><label>Usage / operation</label><input className="input" value={form.usage} onChange={set('usage')} placeholder="e.g. Waist band attach on 2-needle machine" /></div>
        <div className="field"><label>Specifications & notes</label><textarea className="textarea" value={form.specs} onChange={set('specs')} placeholder="Machine compatibility, fabric range, setting notes…" /></div>
      </form>
      {editor && (
        <ImageEditor source={editor.source} fileName={editor.name} onClose={() => setEditor(null)}
          onSave={(file) => { editor.onSave(file); setEditor(null) }} />
      )}
    </Modal>
  )
}

function PhotoField({ folder, photo, setPhoto, currentUrl, type, onEdit }) {
  const pick = useRef(null)
  const camera = useRef(null)
  useEffect(() => () => { if (photo.preview) URL.revokeObjectURL(photo.preview) }, [photo.preview])

  const shown = photo.mode === 'remove' ? null : photo.preview || currentUrl
  const pending = (mode, file) => setPhoto({ mode, file, preview: URL.createObjectURL(file) })
  const choose = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onEdit(file, file.name, (edited) => pending('new', edited))
  }
  const editCurrent = () => {
    if (photo.file) onEdit(photo.file, photo.file.name, (edited) => pending(photo.mode, edited))
    else if (currentUrl) onEdit(currentUrl, currentUrl.split('/').pop(), (edited) => pending('edited', edited))
  }

  return (
    <div className="photo-field">
      <div className="photo-preview">
        {shown ? <img src={shown} alt="Folder photo" /> : <FolderArt type={type || folder?.type} size={130} accent={folder?.category?.color} />}
        {photo.mode === 'new' && <span className="tag">New</span>}
        {photo.mode === 'edited' && <span className="tag">Edited</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Main photo</div>
        <div className="subtle" style={{ fontSize: 12.5, marginBottom: 10 }}>
          {shown ? 'Crop, rotate or adjust before saving. Changes apply when you save the folder.' : 'No photo yet — the illustration is shown instead.'}
        </div>
        <div className="photo-actions">
          <button type="button" className="btn btn-sm" onClick={() => pick.current?.click()}><ImagePlus size={15} /> {shown ? 'Replace' : 'Upload photo'}</button>
          <button type="button" className="btn btn-sm" onClick={() => camera.current?.click()}><Camera size={15} /> Take photo</button>
          {shown && <button type="button" className="btn btn-sm" onClick={editCurrent}><Pencil size={15} /> Edit photo</button>}
          {shown && photo.mode !== 'new' && currentUrl && <button type="button" className="btn btn-sm btn-danger" onClick={() => setPhoto({ mode: 'remove', file: null, preview: null })}><Trash2 size={15} /> Remove</button>}
          {photo.mode !== 'keep' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPhoto({ mode: 'keep', file: null, preview: null })}><Undo2 size={15} /> Undo</button>}
        </div>
        <input ref={pick} type="file" accept="image/*" hidden onChange={choose} />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={choose} />
      </div>
    </div>
  )
}
