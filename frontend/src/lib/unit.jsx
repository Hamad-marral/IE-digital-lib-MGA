import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'

/* The production unit the user is looking at ('' = all units). Remembered per browser. */
const KEY = 'ie_unit'
const UnitCtx = createContext(null)

const read = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const write = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY) } catch { /* storage blocked */ } }

export function UnitProvider({ children }) {
  const { user } = useAuth()
  const [units, setUnits] = useState([])
  const [unitId, setUnitId] = useState(read)

  const reloadUnits = useCallback(() => api.get('/api/units').then(setUnits).catch(() => {}), [])
  useEffect(() => { if (user) reloadUnits() }, [user, reloadUnits])

  const setUnit = useCallback((id) => { const v = id ? String(id) : ''; write(v); setUnitId(v) }, [])

  // Forget a unit that no longer exists.
  useEffect(() => { if (units.length && unitId && !units.some((u) => String(u.id) === unitId)) setUnit('') }, [units, unitId, setUnit])

  const value = useMemo(() => {
    const unit = units.find((u) => String(u.id) === unitId) || null
    return {
      units, unit, unitId: unit ? unitId : '', setUnit, reloadUnits,
      all: !unit,
      unitParams: unit ? { unit_id: unit.id } : {},
      label: unit ? unit.name : 'All units',
    }
  }, [units, unitId, setUnit, reloadUnits])

  return <UnitCtx.Provider value={value}>{children}</UnitCtx.Provider>
}

export const useUnit = () => useContext(UnitCtx)

/* Group a list by its unit, keeping unit order: [{ unit, items }] */
export function groupByUnit(items, units, getUnitId) {
  const groups = units.map((u) => ({ unit: u, items: items.filter((x) => getUnitId(x) === u.id) })).filter((g) => g.items.length)
  const rest = items.filter((x) => !units.some((u) => u.id === getUnitId(x)))
  if (rest.length) groups.push({ unit: null, items: rest })
  return groups
}
