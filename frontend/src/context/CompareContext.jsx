import { browserStorage } from '../utils/browserStorage'
import { createContext, useContext, useEffect, useState } from 'react'

const CompareContext = createContext(null)
const STORAGE_KEY = 'volteniq_compare'

export function CompareProvider({ children }) {
  const [ids, setIds] = useState(() => {
    try {
      return JSON.parse(browserStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    browserStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }, [ids])

  const toggleCompare = (productId) => {
    setIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId)
      if (prev.length >= 4) {
        // Keep max 4 — drop the oldest so new picks can still be compared
        return [...prev.slice(1), productId]
      }
      return [...prev, productId]
    })
  }

  const clearCompare = () => setIds([])
  const isCompared = (productId) => ids.includes(productId)

  return (
    <CompareContext.Provider value={{ ids, toggleCompare, clearCompare, isCompared }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within CompareProvider')
  return ctx
}
