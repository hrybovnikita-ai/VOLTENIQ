import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import Button from '../ui/Button'

export default function PriceAlertButton({ product, onPriceChanged }) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !product?.id) {
      setAlert(null)
      return
    }
    let alive = true
    api
      .getPriceAlerts()
      .then((res) => {
        if (!alive) return
        const match = (res.data.alerts || []).find((a) => a.productId === product.id)
        setAlert(match || null)
      })
      .catch(() => {
        if (alive) setAlert(null)
      })
    return () => {
      alive = false
    }
  }, [isAuthenticated, product?.id])

  const subscribe = async () => {
    setError('')
    setMessage('')
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${product.slug || product.id}` } })
      return
    }
    setLoading(true)
    try {
      const res = await api.createPriceAlert({ productId: product.id })
      setAlert(res.data.alert)
      setMessage('We will notify you if this demo price drops.')
    } catch (err) {
      setError(err.message || 'Could not create alert')
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    if (!alert?.id) return
    setLoading(true)
    setError('')
    try {
      await api.deletePriceAlert(alert.id)
      setAlert(null)
      setMessage('Price alert removed.')
    } catch (err) {
      setError(err.message || 'Could not remove alert')
    } finally {
      setLoading(false)
    }
  }

  const simulateDrop = async () => {
    if (!product?.id) return
    setLoading(true)
    setError('')
    try {
      const drop = await api.demoPriceDrop(product.id, 8)
      const res = await api.getPriceAlerts()
      const match = (res.data.alerts || []).find((a) => a.productId === product.id)
      setAlert(match || null)
      setMessage(`Demo price moved ${formatDrop(drop.data)}.`)
      onPriceChanged?.(drop.data)
    } catch (err) {
      setError(err.message || 'Demo drop failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {alert ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="soft"
            className="w-full sm:w-auto justify-center"
            disabled={loading}
            onClick={unsubscribe}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
            Alert active · Unsubscribe
          </Button>
          <Button
            variant="ghost"
            className="w-full sm:w-auto justify-center"
            disabled={loading}
            onClick={simulateDrop}
          >
            Simulate demo drop
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="w-full sm:w-auto justify-center"
          disabled={loading}
          onClick={subscribe}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Notify me when price drops
        </Button>
      )}
      {alert?.dropped ? (
        <p className="text-sm text-volt font-medium">
          Demo price dropped from {money(alert.subscribedPrice)} to {money(alert.currentPrice)}.
        </p>
      ) : null}
      {message ? <p className="text-xs text-muted">{message}</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatDrop(data) {
  if (!data) return ''
  return `${money(data.previousPrice)} → ${money(data.price)}`
}
