import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { formatPrice } from '../utils/format'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import Spinner from '../components/ui/Spinner'
import OrderTrackingTimeline from '../components/orders/OrderTrackingTimeline'

export default function OrderSuccessPage() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const { data, loading, error, reload } = useApi(async () => {
    if (!id) throw new Error('Select an order from your account to view its details.')
    return (await api.getOrder(id)).data.order
  }, [id])

  return (
    <section className="container-shell page-section">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="glass rounded-3xl p-6 sm:p-10">
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <>
              <CircleCheck className="text-volt mb-4" size={40} />
              <h1 className="page-title">Demo order confirmed</h1>
              <p className="mt-3 text-muted">
                Your order is saved in your account. No payment was collected.
              </p>
              <p className="my-5 text-sm break-all">
                {data.orderNumber || `Order ${data.id}`}
              </p>
              {data.items.map((item) => (
                <p key={item.id}>
                  {item.product?.name || 'Product'} × {item.quantity}
                </p>
              ))}
              {data.discountAmount > 0 ? (
                <p className="mt-3 text-sm text-volt">
                  Promo {data.promoCodeSnapshot}: −{formatPrice(data.discountAmount)}
                </p>
              ) : null}
              <p className="my-5 font-bold">Order total · {formatPrice(data.total)}</p>
            </>
          )}
          <div className="flex flex-wrap gap-3 mt-5">
            <Button as={Link} to="/profile#orders">
              View my orders
            </Button>
            <Button as={Link} to="/" variant="ghost">
              Continue shopping
            </Button>
          </div>
        </div>
        {!loading && !error && data ? <OrderTrackingTimeline order={data} /> : null}
      </div>
    </section>
  )
}
