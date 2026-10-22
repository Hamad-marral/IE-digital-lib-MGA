import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/* Small data-fetching hook: const { data, loading, error, reload } = useApi('/api/x', params) */
export function useApi(path, params) {
  const key = JSON.stringify(params || {})
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const load = useCallback(() => {
    if (!path) return Promise.resolve()
    setState((s) => ({ ...s, loading: true }))
    return api.get(path, params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState((s) => ({ ...s, loading: false, error })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key])
  useEffect(() => { load() }, [load])
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) }
}

export function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t) }, [value, delay])
  return v
}
