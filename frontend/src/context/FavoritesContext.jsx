import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'

const FavoritesContext = createContext(null)
const STORAGE_KEY = 'volteniq_favorites'

export function FavoritesProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [ids, setIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [products, setProducts] = useState([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }, [ids])

  useEffect(() => {
    if (!isAuthenticated) return
    api
      .getFavorites()
      .then((res) => {
        const favs = res.data.favorites || []
        setIds(favs.map((f) => f.productId || f.product?.id).filter(Boolean))
        setProducts(favs.map((f) => f.product).filter(Boolean))
      })
      .catch(() => {})
  }, [isAuthenticated])

  const isFavorite = (productId) => ids.includes(productId)

  const toggleFavorite = async (product) => {
    const productId = product.id
    const currently = isFavorite(productId)

    setIds((prev) =>
      currently ? prev.filter((id) => id !== productId) : [...prev, productId]
    )
    setProducts((prev) =>
      currently ? prev.filter((p) => p.id !== productId) : [...prev, product]
    )

    if (isAuthenticated) {
      try {
        await api.toggleFavorite(productId)
      } catch {
        setIds((prev) =>
          currently ? [...prev, productId] : prev.filter((id) => id !== productId)
        )
      }
    }
  }

  return (
    <FavoritesContext.Provider value={{ ids, products, isFavorite, toggleFavorite, setProducts }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
