import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'
import {
  cartSelections,
  clampQuantity,
  defaultSelections,
  getUnitPrice,
  getVariantImage,
  selectionKey,
} from '../utils/pricing'

const CartContext = createContext(null)
const STORAGE_KEY = 'volteniq_cart'

function mergeSelections(product, options = {}) {
  const defaults = defaultSelections(product)
  const next = { ...defaults }
  for (const key of Object.keys(defaults)) {
    if (options[key] !== undefined) next[key] = options[key]
  }
  for (const [key, value] of Object.entries(options)) {
    if (['quantity', 'unitPrice', 'stock'].includes(key) || value === undefined) continue
    next[key] = value
  }
  return next
}

function toApiItems(items) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    selection: cartSelections(item),
  }))
}

function fromApiItems(apiItems) {
  return (apiItems || []).map((item) => {
    const product = item.product || {}
    const selections = item.selection || {}
    const unitPrice =
      item.unitPrice != null
        ? Number(item.unitPrice)
        : getUnitPrice(
            { ...product, price: product.price ?? 0, variantPricing: product.variantPricing },
            selections
          )
    return {
      key: selectionKey(item.productId, selections),
      productId: item.productId,
      name: product.name || 'Product',
      image: getVariantImage(product, selections) || product.image || '',
      price: unitPrice,
      unitPrice,
      quantity: item.quantity,
      stock: product.stock || 99,
      ...selections,
    }
  })
}

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [version, setVersion] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const hydrated = useRef(false)
  const skipNextPersist = useRef(false)
  const versionRef = useRef(0)

  useEffect(() => {
    versionRef.current = version
  }, [version])

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    if (!isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  }, [items, isAuthenticated])

  const persistRemote = useCallback(
    async (nextItems, nextVersion) => {
      if (!isAuthenticated) return
      setSyncing(true)
      setError('')
      try {
        const res = await api.saveCart({ items: toApiItems(nextItems), version: nextVersion })
        setVersion(res.data.version)
      } catch (err) {
        if (err.status === 409) {
          const fresh = await api.getCart()
          skipNextPersist.current = true
          setItems(fromApiItems(fresh.data.items))
          setVersion(fresh.data.version ?? 0)
          setError('Cart was updated on another device. Reloaded your saved bag.')
        } else {
          setError(err.message || 'Could not save cart')
        }
      } finally {
        setSyncing(false)
      }
    },
    [isAuthenticated]
  )

  useEffect(() => {
    let active = true
    async function hydrate() {
      if (!isAuthenticated) {
        hydrated.current = true
        return
      }
      setSyncing(true)
      try {
        const localItems = (() => {
          try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
          } catch {
            return []
          }
        })()
        const remote = await api.getCart()
        const remoteItems = remote.data.items || []
        const remoteVersion = remote.data.version ?? 0

        if (!remoteItems.length && localItems.length) {
          const saved = await api.saveCart({ items: toApiItems(localItems), version: remoteVersion })
          if (!active) return
          skipNextPersist.current = true
          setItems(saved.data.items?.length ? fromApiItems(saved.data.items) : localItems)
          setVersion(saved.data.version)
          localStorage.removeItem(STORAGE_KEY)
        } else {
          if (!active) return
          skipNextPersist.current = true
          setItems(fromApiItems(remoteItems))
          setVersion(remoteVersion)
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        // Keep local cart if sync is unavailable.
      } finally {
        if (active) {
          hydrated.current = true
          setSyncing(false)
        }
      }
    }
    hydrate()
    return () => {
      active = false
    }
  }, [isAuthenticated])

  const addItem = (product, options = {}) => {
    const selections = mergeSelections(product, options)
    const unitPrice =
      options.unitPrice != null ? Number(options.unitPrice) : getUnitPrice(product, selections)
    const stock = Number(product.stock) || 1
    const quantity = clampQuantity(options.quantity ?? 1, stock)
    const key = selectionKey(product.id, selections)

    setItems((prev) => {
      const existing = prev.find((i) => i.key === key)
      let next
      if (existing) {
        const nextQty = clampQuantity(existing.quantity + quantity, existing.stock || stock)
        next = prev.map((i) =>
          i.key === key
            ? {
                ...i,
                quantity: nextQty,
                price: existing.price,
                unitPrice: existing.unitPrice ?? existing.price,
              }
            : i
        )
      } else {
        next = [
          ...prev,
          {
            key,
            productId: product.id,
            name: product.name,
            image: getVariantImage(product, selections),
            price: unitPrice,
            unitPrice,
            quantity,
            stock,
            ...selections,
          },
        ]
      }
      if (isAuthenticated && hydrated.current) persistRemote(next, versionRef.current)
      return next
    })
  }

  const updateQuantity = (key, quantity) => {
    setItems((prev) => {
      const next = prev
        .map((i) => {
          if (i.key !== key) return i
          const nextQty = clampQuantity(quantity, i.stock || Infinity)
          return { ...i, quantity: nextQty }
        })
        .filter((i) => i.quantity > 0)
      if (isAuthenticated && hydrated.current) persistRemote(next, versionRef.current)
      return next
    })
  }

  const removeItem = (key) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key)
      if (isAuthenticated && hydrated.current) persistRemote(next, versionRef.current)
      return next
    })
  }

  const clearCart = async () => {
    setItems([])
    if (isAuthenticated) {
      try {
        const res = await api.clearCart()
        setVersion(res.data.version ?? 0)
      } catch {
        await persistRemote([], versionRef.current)
      }
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const totals = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0)
    const subtotal = items.reduce((sum, i) => {
      const unit = Number(i.unitPrice ?? i.price) || 0
      return sum + unit * i.quantity
    }, 0)
    return { count, subtotal: Math.round(subtotal * 100) / 100 }
  }, [items])

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncing,
        error,
        ...totals,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
