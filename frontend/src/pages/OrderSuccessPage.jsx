import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import Spinner from '../components/ui/Spinner'

export default function OrderSuccessPage() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const { data, loading, error, reload } = useApi(async () => {
    if (!id) throw new Error('Select an order from your account to view its details.')
    return (await api.getOrder(id)).data.order
  }, [id])
  return <section className="container-shell page-section"><div className="glass rounded-3xl p-6 sm:p-10 max-w-xl mx-auto">
    {loading ? <Spinner/> : error ? <ErrorState message={error} onRetry={reload}/> : <>
      <CircleCheck className="text-volt mb-4" size={40}/><h1 className="page-title">Demo order confirmed</h1>
      <p className="mt-3 text-muted">Your order is saved in your account. No payment was collected.</p>
      <p className="my-5 text-sm break-all">Order {data.id}</p>
      {data.items.map(item => <p key={item.id}>{item.product.name} Г— {item.quantity}</p>)}
      <p className="my-5 font-bold">Order total В· {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total)}</p>
    </>}
    <div className="flex flex-wrap gap-3 mt-5"><Button as={Link} to="/profile">View my orders</Button><Button as={Link} to="/" variant="ghost">Continue shopping</Button></div>
  </div></section>
}
