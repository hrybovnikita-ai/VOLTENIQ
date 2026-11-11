import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatPrice } from '../utils/format'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import OrderTrackingTimeline from '../components/orders/OrderTrackingTimeline'

export default function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading, updateProfile, logout, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [alerts, setAlerts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionsBusy, setSessionsBusy] = useState(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, loading])
  const highlight = params.get('order')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login')
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setAvatarUrl(user.avatarUrl || '')
    }
  }, [user])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    Promise.all([
      api.getOrders().catch(() => ({ data: { orders: [] } })),
      api.getPriceAlerts().catch(() => ({ data: { alerts: [] } })),
      api.getAlertNotifications().catch(() => ({ data: { notifications: [] } })),
      api.listSessions().catch(() => ({ data: { sessions: [] } })),
    ])
      .then(([ordersRes, alertsRes, notesRes, sessionsRes]) => {
        setOrders(ordersRes.data.orders || [])
        setAlerts(alertsRes.data.alerts || [])
        setNotifications(notesRes.data.notifications || [])
        setSessions(sessionsRes.data.sessions || [])
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const refreshSessions = async () => {
    const res = await api.listSessions()
    setSessions(res.data.sessions || [])
  }

  const handleLogout = async () => {
    setError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign-out failed. Please try again.')
    }
  }

  const revokeSession = async (id) => {
    setSessionsBusy(true)
    setError('')
    try {
      await api.revokeSession(id)
      if (sessions.find((s) => s.id === id)?.current) {
        await handleLogout()
        return
      }
      await refreshSessions()
    } catch (err) {
      setError(err.message || 'Could not revoke session')
    } finally {
      setSessionsBusy(false)
    }
  }

  const revokeOtherSessions = async () => {
    setSessionsBusy(true)
    setError('')
    try {
      await api.revokeOtherSessions({ keepCurrent: true })
      await refreshSessions()
      setMessage('Signed out of other devices')
    } catch (err) {
      setError(err.message || 'Could not revoke other sessions')
    } finally {
      setSessionsBusy(false)
    }
  }

  const removeAlert = async (id) => {
    try {
      await api.deletePriceAlert(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err.message || 'Could not remove alert')
    }
  }

  const onSave = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    if (password && password.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (password && !currentPassword) {
      setError('Enter your current password to set a new one')
      return
    }
    try {
      await updateProfile({
        name,
        avatarUrl: avatarUrl.trim() || null,
        ...(password ? { password, currentPassword } : {}),
      })
      setPassword('')
      setCurrentPassword('')
      setMessage('Profile updated')
    } catch (err) {
      setError(err.message || 'Update failed')
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="container-shell page-section">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="page-title">Profile</h1>
          <p className="text-muted mt-1 text-sm sm:text-base break-all">{user.email}</p>
          <p className="mt-2 text-sm">
            {user.emailVerifiedAt || user.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 text-volt">
                <span className="h-1.5 w-1.5 rounded-full bg-volt" aria-hidden />
                Email Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-silver/50" aria-hidden />
                Email not verified
                {' · '}
                <Link className="text-volt font-semibold hover:underline" to={`/verify-email?email=${encodeURIComponent(user.email || '')}`}>
                  Resend verification
                </Link>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button as={Link} to="/admin" variant="soft">
              Admin dashboard
            </Button>
          )}
          <Button variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {highlight && (
        <div className="mb-6 rounded-[14px] border border-volt/40 bg-volt/10 px-4 py-3 text-sm">
          Demo order <strong>{highlight}</strong> placed successfully. No payment was processed.
        </div>
      )}

      <div className="split-layout split-layout--profile">
        <form id="settings" style={{ scrollMarginTop: 80 }} onSubmit={onSave} className="glass rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 space-y-4 h-fit min-w-0">
          <h2 className="font-display text-xl font-bold">Account</h2>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-silver/30 bg-graphite text-xl font-bold text-volt">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (user.name || user.email || 'U').slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{user.name}</p>
              <p className="text-sm text-muted truncate">{user.email}</p>
              <p className="text-xs mt-1">
                {user.emailVerifiedAt || user.emailVerified ? (
                  <span className="text-volt">Email Verified</span>
                ) : (
                  <span className="text-muted">Email not verified</span>
                )}
                {user.hasGoogle ? <span className="text-muted"> · Google linked</span> : null}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Required only when changing password"
              autoComplete="current-password"
              className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
              minLength={8}
              className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
            />
          </div>
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full">
            Save changes
          </Button>

          <div id="security" style={{ scrollMarginTop: 80 }} className="pt-4 border-t border-silver/20 space-y-3">
            <h2 className="font-display text-lg font-bold">Signed-in devices</h2>
            <p className="text-sm text-muted">
              Revoke a session to sign out that browser. Idle sessions expire after 14 days.
            </p>
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {session.current ? 'This device' : (session.userAgent || 'Unknown device')}
                    </p>
                    <p className="text-xs text-muted">
                      Last seen {formatDate(session.lastSeenAt)}
                      {session.ip ? ` · ${session.ip}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={sessionsBusy}
                    onClick={() => revokeSession(session.id)}
                  >
                    {session.current ? 'Sign out' : 'Revoke'}
                  </Button>
                </li>
              ))}
            </ul>
            {sessions.length > 1 ? (
              <Button type="button" variant="soft" disabled={sessionsBusy} onClick={revokeOtherSessions}>
                Sign out other devices
              </Button>
            ) : null}
          </div>
        </form>

        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="font-display text-xl font-bold mb-4">Price drop alerts</h2>
            {loading && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}
            {!loading && !alerts.length && (
              <p className="text-sm text-muted mb-4">
                No alerts yet. Open a product and choose “Notify me when price drops”.
              </p>
            )}
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="glass rounded-[16px] p-4 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0 flex items-center gap-3">
                    {alert.product?.image ? (
                      <img
                        src={alert.product.image}
                        alt=""
                        className="h-12 w-12 rounded-[10px] object-contain bg-silver/10"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{alert.product?.name || 'Product'}</p>
                      <p className="text-xs text-muted">
                        Watching from {formatPrice(alert.subscribedPrice)} · now{' '}
                        {formatPrice(alert.currentPrice)}
                        {alert.dropped ? ' · dropped' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button as={Link} to={`/products/${alert.product?.slug || alert.productId}`} variant="soft">
                      View
                    </Button>
                    <Button variant="ghost" onClick={() => removeAlert(alert.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {notifications.length ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Recent notifications</p>
                {notifications.slice(0, 5).map((note) => (
                  <p key={note.id} className="text-sm glass rounded-[12px] px-3 py-2">
                    {note.message}
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          <section id="orders" style={{ scrollMarginTop: 80 }}>
            <h2 className="font-display text-xl font-bold mb-4">Order history</h2>
            {!loading && !orders.length && (
              <EmptyState
                title="No orders yet"
                description="Place a demo checkout to see your history here."
                actionLabel="Shop now"
                onAction={() => navigate('/catalog')}
              />
            )}
            <div className="space-y-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={`space-y-3 ${highlight === order.id ? 'ring-2 ring-volt rounded-[18px] p-1' : ''}`}
                >
                  <div className="glass rounded-[18px] p-5">
                    <div className="flex flex-wrap justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold">{order.orderNumber || `Order ${order.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(order.total)}</p>
                        <p className="text-xs uppercase tracking-wider text-volt">{order.status}</p>
                      </div>
                    </div>
                    <ul className="text-sm text-muted space-y-1 mb-3">
                      {order.items?.map((item) => (
                        <li key={item.id}>
                          {item.product?.name || 'Product'} × {item.quantity}
                          {item.storage ? ` · ${item.storage}` : ''}
                          {' · '}
                          {formatPrice(item.price)}
                        </li>
                      ))}
                    </ul>
                    {order.discountAmount > 0 ? (
                      <p className="text-sm text-volt mb-2">
                        Promo {order.promoCodeSnapshot}: −{formatPrice(order.discountAmount)}
                      </p>
                    ) : null}
                    <p className="text-xs text-volt">{order.demoNote || 'DEMO ORDER — no real payment'}</p>
                  </div>
                  <OrderTrackingTimeline order={order} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
