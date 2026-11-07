import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
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
  // Persist any extra option keys sent from the detail page
  for (const [key, value] of Object.entries(options)) {
    if (
      ['quantity', 'unitPrice', 'stock'].includes(key) ||
      value === undefined
    ) {
      continue
    }
    next[key] = value
  }
  return next
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = (product, options = {}) => {
    const selections = mergeSelections(product, options)
    const unitPrice =
      options.unitPrice != null
        ? Number(options.unitPrice)
        : getUnitPrice(product, selections)
    const stock = Number(product.stock) || 1
    const quantity = clampQuantity(options.quantity ?? 1, stock)
    const key = selectionKey(product.id, selections)

    setItems((prev) => {
      const existing = prev.find((i) => i.key === key)
      if (existing) {
        const nextQty = clampQuantity(existing.quantity + quantity, existing.stock || stock)
        return prev.map((i) =>
          i.key === key
            ? {
                ...i,
                quantity: nextQty,
                price: existing.price,
                unitPrice: existing.unitPrice ?? existing.price,
              }
            : i
        )
      }
      return [
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
    })
  }

  const updateQuantity = (key, quantity) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i
          const next = clampQuantity(quantity, i.stock || Infinity)
          return { ...i, quantity: next }
        })
        .filter((i) => i.quantity > 0)
    )
  }

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key))
  const clearCart = () => setItems([])

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
      value={{ items, addItem, updateQuantity, removeItem, clearCart, ...totals }}
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
