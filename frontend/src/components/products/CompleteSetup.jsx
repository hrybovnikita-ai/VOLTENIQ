import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useApi } from '../../hooks/useApi'
import { useCart } from '../../context/CartContext'
import { defaultSelections, getUnitPrice } from '../../utils/pricing'
import { formatPrice } from '../../utils/format'
import { setupProducts } from '../../utils/setupProducts'
import Button from '../ui/Button'

export default function CompleteSetup({ product, selections, unitPrice, quantity }) {
  const { data, loading, error, reload } = useApi(() => api.getProducts(), [])
  const [included, setIncluded] = useState({})
  const [notice, setNotice] = useState('')
  const { addItem } = useCart()
  const items = setupProducts(product, data?.data.products || [])
  const isIncluded = item => included[item.id] ?? !['airpods', 'magic-trackpad', 'ipad-air', 'macbook-air'].includes(item.slug)
  const chosen = items.filter(isIncluded)
  const price = item => getUnitPrice(item, defaultSelections(item))
  const total = chosen.reduce((sum, item) => sum + price(item), unitPrice * quantity)
  function addSetup() {
    addItem(product, { ...selections, unitPrice, quantity })
    chosen.forEach(item => addItem(item))
    setNotice('Setup added to your bag.')
  }
  return <section className="glass rounded-2xl p-5 sm:p-8 mt-6">
    <h2 className="text-2xl font-semibold">Complete Your Setup</h2>
    {loading ? <p role="status">Loading compatible products…</p> : error ? <button onClick={reload}>Retry loading accessories</button> :
      !items.length ? <p>No compatible additions are currently in stock.</p> : <>
      <p className="my-4">{quantity} × {product.name} · {formatPrice(unitPrice)} each</p>
      {items.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 border-t border-silver/20 py-3">
        <input type="checkbox" aria-label={'Include ' + item.name} checked={isIncluded(item)}
          onChange={event => setIncluded({ ...included, [item.id]: event.target.checked })} />
        <img src={item.image} alt="" className="w-12 h-12 object-contain" />
        <Link to={'/products/' + item.slug} className="flex-1 font-medium">{item.name}</Link>
        <span>{formatPrice(price(item))}</span>
        <Button variant="ghost" onClick={() => { addItem(item); setNotice(item.name + ' added to your bag.') }}>Add individually</Button>
      </div>)}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-silver/20">
        <strong aria-live="polite">Setup total · {formatPrice(total)}</strong>
        <Button disabled={!chosen.length || product.stock < 1} onClick={addSetup}>Add Complete Setup to Bag</Button>
      </div><p role="status">{notice}</p></>}
  </section>
}
