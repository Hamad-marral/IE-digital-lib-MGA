import { useEffect, useState } from 'react'
import { api } from './api'

const LOCAL = ['localhost', '127.0.0.1', '::1', '[::1]']
let cache = null

/* Resolves the address a phone should open when it scans a QR code.
   Priority: Settings → "QR code address"; the address this page was opened on (if not localhost);
   otherwise this PC's detected network address. */
async function resolve() {
  const info = await fetch('/api/public/server-info').then((r) => r.json()).catch(() => ({ lan_urls: [] }))
  let configured = ''
  try { configured = (await api.get('/api/settings')).qr_base_url || '' } catch { /* not signed in */ }
  const origin = window.location.origin
  const onLocalhost = LOCAL.includes(window.location.hostname)
  const base = configured || (!onLocalhost ? origin : info.lan_urls?.[0] || origin)
  return { base, configured, detected: info.lan_urls || [], hostnameUrl: info.hostname_url, localOnly: LOCAL.includes(new URL(base).hostname) }
}

export function refreshQrBase() { cache = null }

export function useQrBase() {
  const [state, setState] = useState(null)
  useEffect(() => {
    let alive = true
    cache = cache || resolve()
    cache.then((s) => alive && setState(s))
    return () => { alive = false }
  }, [])
  return state
}

export const scanUrl = (base, folder) => `${base}/scan/${encodeURIComponent(folder.item_code)}`
