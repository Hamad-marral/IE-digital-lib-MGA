import { useCallback, useEffect, useRef, useState } from 'react'
import { Crop, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, SlidersHorizontal, Undo2, ZoomIn } from 'lucide-react'
import { Modal } from './ui'

const ASPECTS = [['original', 'Original'], ['free', 'Free'], [1, '1 : 1'], [4 / 3, '4 : 3'], [16 / 9, '16 : 9']]
const DEFAULTS = { rot: 0, flipH: false, flipV: false, zoom: 1, ox: 0, oy: 0, brightness: 100, contrast: 100, saturate: 100, aspect: 'original', freeW: 1, freeH: 1 }

/* Canvas-based photo editor: crop (aspect + zoom + drag), rotate, flip, brightness/contrast/saturation.
   `source` is a File/Blob or an image URL. `onSave(file)` receives the edited image as a File. */
export default function ImageEditor({ source, fileName = 'photo.jpg', onSave, onClose, title = 'Edit image' }) {
  const [img, setImg] = useState(null)
  const [err, setErr] = useState('')
  const [s, setS] = useState(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const canvas = useRef(null)
  const drag = useRef(null)
  const set = (patch) => setS((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }))

  useEffect(() => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => setImg(image)
    image.onerror = () => setErr('This file could not be opened as an image.')
    image.src = url
    return () => { if (typeof source !== 'string') URL.revokeObjectURL(url) }
  }, [source])

  // Geometry of the crop frame, in rotated-image pixels (image centred at 0,0).
  const geometry = useCallback((st) => {
    if (!img) return null
    const sideways = st.rot % 180 !== 0
    const rw = sideways ? img.naturalHeight : img.naturalWidth
    const rh = sideways ? img.naturalWidth : img.naturalHeight
    const A = st.aspect === 'original' ? rw / rh : st.aspect === 'free' ? (rw * st.freeW) / (rh * st.freeH) : st.aspect
    let fw, fh
    if (rw / rh > A) { fh = rh; fw = rh * A } else { fw = rw; fh = rw / A }
    if (st.aspect === 'free') { fw = rw * st.freeW; fh = rh * st.freeH }
    fw /= st.zoom; fh /= st.zoom
    const mx = (rw - fw) / 2, my = (rh - fh) / 2
    return { rw, rh, fw, fh, ox: Math.max(-mx, Math.min(mx, st.ox)), oy: Math.max(-my, Math.min(my, st.oy)) }
  }, [img])

  const draw = useCallback((target, st, maxSide) => {
    const g = geometry(st)
    if (!g) return
    const k = Math.min(1, maxSide / Math.max(g.fw, g.fh))
    target.width = Math.max(1, Math.round(g.fw * k))
    target.height = Math.max(1, Math.round(g.fh * k))
    const ctx = target.getContext('2d')
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, target.width, target.height)
    ctx.filter = `brightness(${st.brightness}%) contrast(${st.contrast}%) saturate(${st.saturate}%)`
    ctx.translate(target.width / 2, target.height / 2)
    ctx.scale(k, k)
    ctx.translate(-g.ox, -g.oy)
    ctx.rotate((st.rot * Math.PI) / 180)
    ctx.scale(st.flipH ? -1 : 1, st.flipV ? -1 : 1)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    ctx.restore()
  }, [geometry, img])

  useEffect(() => { if (canvas.current && img) draw(canvas.current, s, 900) }, [s, img, draw])

  // Keep offsets inside bounds after zoom/rotate/aspect changes.
  useEffect(() => {
    const g = geometry(s)
    if (g && (g.ox !== s.ox || g.oy !== s.oy)) set({ ox: g.ox, oy: g.oy })
  }, [s, geometry])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: s.ox, oy: s.oy }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const g = geometry(s)
    const scale = g.fw / e.currentTarget.getBoundingClientRect().width
    set({ ox: drag.current.ox - (e.clientX - drag.current.x) * scale, oy: drag.current.oy - (e.clientY - drag.current.y) * scale })
  }
  const onWheel = (e) => set((p) => ({ zoom: Math.max(1, Math.min(4, p.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))) }))

  const save = async () => {
    setBusy(true)
    try {
      const out = document.createElement('canvas')
      draw(out, s, 1800)
      const isPng = /\.png$/i.test(fileName)
      const blob = await new Promise((res) => out.toBlob(res, isPng ? 'image/png' : 'image/jpeg', 0.9))
      const base = fileName.replace(/\.[^.]+$/, '') || 'photo'
      await onSave(new File([blob], `${base}${isPng ? '.png' : '.jpg'}`, { type: blob.type }))
    } finally { setBusy(false) }
  }

  const slider = (label, k, min, max, step = 1, suffix = '%') => (
    <div className="field" style={{ marginBottom: 10 }} key={k}>
      <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span className="num subtle">{Math.round(s[k] * (suffix === '×' ? 10 : 1)) / (suffix === '×' ? 10 : 1)}{suffix}</span></label>
      <input type="range" min={min} max={max} step={step} value={s[k]} onChange={(e) => set({ [k]: +e.target.value })} className="range" />
    </div>
  )

  return (
    <Modal wide title={title} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={() => setS(DEFAULTS)} style={{ marginRight: 'auto' }}><Undo2 size={16} /> Reset</button>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={!img || busy}>{busy ? 'Saving…' : 'Apply & save'}</button>
    </>}>
      {err ? <div className="alert err">{err}</div> : (
        <div className="editor">
          <div className="editor-stage">
            {!img ? <div className="skeleton" style={{ width: '100%', height: 340 }} /> : (
              <canvas ref={canvas} className="editor-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={() => { drag.current = null }} onWheel={onWheel} title="Drag to move · scroll to zoom" />
            )}
            <div className="subtle" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>Drag the picture to position it · scroll or use the slider to zoom</div>
          </div>
          <div className="editor-tools">
            <div className="editor-group">
              <h5><Crop size={14} /> Crop</h5>
              <div className="chip-row">
                {ASPECTS.map(([v, l]) => (
                  <button key={l} type="button" className={`chip-btn ${s.aspect === v ? 'on' : ''}`} onClick={() => set({ aspect: v, zoom: 1, ox: 0, oy: 0, freeW: 1, freeH: 1 })}>{l}</button>
                ))}
              </div>
              {s.aspect === 'free' && (
                <>
                  {slider('Crop width', 'freeW', 0.2, 1, 0.01, '×')}
                  {slider('Crop height', 'freeH', 0.2, 1, 0.01, '×')}
                </>
              )}
              <div className="field" style={{ marginBottom: 6 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between' }}><span><ZoomIn size={13} style={{ verticalAlign: -2 }} /> Zoom</span><span className="num subtle">{s.zoom.toFixed(1)}×</span></label>
                <input type="range" min={1} max={4} step={0.05} value={s.zoom} onChange={(e) => set({ zoom: +e.target.value })} className="range" />
              </div>
            </div>
            <div className="editor-group">
              <h5><RotateCw size={14} /> Rotate & flip</h5>
              <div className="chip-row">
                <button type="button" className="chip-btn" onClick={() => set((p) => ({ rot: (p.rot + 270) % 360, ox: 0, oy: 0 }))} aria-label="Rotate left"><RotateCcw size={15} /></button>
                <button type="button" className="chip-btn" onClick={() => set((p) => ({ rot: (p.rot + 90) % 360, ox: 0, oy: 0 }))} aria-label="Rotate right"><RotateCw size={15} /></button>
                <button type="button" className={`chip-btn ${s.flipH ? 'on' : ''}`} onClick={() => set((p) => ({ flipH: !p.flipH }))} aria-label="Flip horizontal"><FlipHorizontal2 size={15} /></button>
                <button type="button" className={`chip-btn ${s.flipV ? 'on' : ''}`} onClick={() => set((p) => ({ flipV: !p.flipV }))} aria-label="Flip vertical"><FlipVertical2 size={15} /></button>
              </div>
            </div>
            <div className="editor-group">
              <h5><SlidersHorizontal size={14} /> Adjust</h5>
              {slider('Brightness', 'brightness', 40, 180, 1, '%')}
              {slider('Contrast', 'contrast', 40, 180, 1, '%')}
              {slider('Saturation', 'saturate', 0, 200, 1, '%')}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
