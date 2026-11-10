import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'
import { useApi } from '../../hooks/useApi'
import { getVariantImage } from '../../utils/pricing'
import Button from '../ui/Button'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function Receipt({ userId, storageKey, orderId }) {
  const [dismissed, setDismissed] = useState(false)
  const { data: order } = useApi(async () => (await api.getOrder(orderId)).data.order, [orderId])
  if (dismissed || !order || order.userId !== userId) return null
  return <aside aria-labelledby="confirmed-title" className="container-shell pt-5">
    <div className="purchase-receipt relative rounded-3xl border border-emerald-500/40 bg-emerald-50/90 dark:bg-emerald-950/50 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_34px_rgba(16,185,129,.12)]">
      <button className="absolute right-3 top-3 p-2" aria-label="Dismiss purchase confirmation" onClick={() => {
        setDismissed(true)
        try { localStorage.removeItem(storageKey) } catch { /* already hidden */ }
      }}><X size={18}/></button>
      <h2 id="confirmed-title" className="flex items-center gap-2 pr-8 font-bold text-xl text-emerald-700 dark:text-emerald-300"><CircleCheck/>Purchase successful!</h2>
      <p className="my-2 text-sm break-all">Order {order.orderNumber || order.id}</p>
      {order.items.map(item => {
        const selected = { ...item.configuration, color: item.color || item.configuration?.color, storage: item.storage || item.configuration?.storage }
        return <div key={item.id} className="flex gap-4 items-center border-t border-emerald-500/20 py-3">
          <img className="w-16 h-20 object-contain rounded-xl bg-white" src={getVariantImage(item.product, selected)} alt="" />
          <div><strong>{item.product?.name || 'Product'}</strong><p className="text-sm">{[selected.color, selected.storage, 'Quantity ' + item.quantity].filter(Boolean).join(' · ')}</p></div>
        </div>
      })}
      <p className="font-bold">Order total · {currency.format(order.total)}</p>
      <div className="flex flex-wrap gap-3 my-3"><Button as={Link} to={'/profile?order=' + encodeURIComponent(order.id) + '#orders'}>View my orders</Button><Button as={Link} variant="ghost" to="/catalog">Continue shopping</Button></div>
      <p className="text-sm">Demo purchase · No payment was collected.</p>
    </div>
  </aside>
}

export default function PurchaseReceipt() {
  const { user } = useAuth()
  if (!user) return null
  const storageKey = 'volteniq:purchase:' + user.id
  let orderId
  try { orderId = localStorage.getItem(storageKey) } catch { return null }
  return orderId ? <Receipt key={user.id + orderId} userId={user.id} storageKey={storageKey} orderId={orderId} /> : null
}
