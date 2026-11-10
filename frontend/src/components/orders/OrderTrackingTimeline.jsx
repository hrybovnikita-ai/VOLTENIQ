import { Check, Package, Truck, XCircle } from 'lucide-react'
import { formatDate } from '../../utils/format'

const FLOW = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']

const META = {
  PENDING: { label: 'Pending', icon: Package },
  PROCESSING: { label: 'Processing', icon: Package },
  SHIPPED: { label: 'Shipped', icon: Truck },
  DELIVERED: { label: 'Delivered', icon: Check },
  CANCELLED: { label: 'Cancelled', icon: XCircle },
}

export default function OrderTrackingTimeline({ order }) {
  if (!order) return null
  const cancelled = order.status === 'CANCELLED'
  const currentIndex = FLOW.indexOf(order.status)
  const history = order.statusHistory?.length
    ? order.statusHistory
    : [{ status: order.status, createdAt: order.updatedAt || order.createdAt, note: 'Current status' }]

  return (
    <div className="glass rounded-[18px] p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Simulated tracking</p>
          <h3 className="font-display text-xl font-bold mt-1">
            {order.orderNumber || `Order ${order.id?.slice(0, 8)}`}
          </h3>
          <p className="text-sm text-muted mt-1">
            {order.trackingDemoNote || 'Simulated tracking for the VOLTENIQ demo store — no real shipment.'}
          </p>
        </div>
        <span className="rounded-full border border-volt/40 bg-volt/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-volt">
          {META[order.status]?.label || order.status}
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">Tracking number</p>
          <p className="font-semibold break-all">{order.trackingNumber || 'Assigned at ship time'}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Estimated delivery</p>
          <p className="font-semibold">
            {order.estimatedDelivery ? formatDate(order.estimatedDelivery) : 'Calculating…'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Discount</p>
          <p className="font-semibold">
            {order.promoCodeSnapshot
              ? `${order.promoCodeSnapshot} (−$${Number(order.discountAmount || 0).toFixed(2)})`
              : 'None'}
          </p>
        </div>
      </div>

      {!cancelled ? (
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FLOW.map((step, index) => {
            const Icon = META[step].icon
            const done = currentIndex >= index
            const active = order.status === step
            return (
              <li
                key={step}
                className={`rounded-[14px] border px-3 py-3 text-center ${
                  active
                    ? 'border-volt bg-volt/15'
                    : done
                      ? 'border-silver/40 bg-white/40 dark:bg-white/5'
                      : 'border-silver/20 opacity-50'
                }`}
              >
                <Icon className={`mx-auto mb-2 w-5 h-5 ${active || done ? 'text-volt' : ''}`} />
                <p className="text-xs font-semibold">{META[step].label}</p>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-[14px] border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm">
          This demo order was cancelled. No shipment will be created.
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted mb-3">Status history</p>
        <ol className="space-y-3 border-l border-silver/30 ml-2 pl-4">
          {history.map((event) => (
            <li key={event.id || `${event.status}-${event.createdAt}`}>
              <p className="text-sm font-semibold">{META[event.status]?.label || event.status}</p>
              <p className="text-xs text-muted">{formatDate(event.createdAt)}</p>
              {event.note ? <p className="text-xs text-muted mt-0.5">{event.note}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
