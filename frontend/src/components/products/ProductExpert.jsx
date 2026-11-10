import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import Button from '../ui/Button'
import { formatPrice } from '../../utils/format'

const prompts = ['Best for me', 'Compare options', 'Storage advice', 'Performance', 'Battery', 'Camera']

export default function ProductExpert({ product, selections, unitPrice }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (window.location.hash === '#product-expert') document.getElementById('product-expert')?.scrollIntoView()
  }, [])
  async function ask(text) {
    if (!text.trim() || busy) return
    setBusy(true)
    setQuestion(text)
    setAnswer('')
    try {
      const { data } = await api.askProduct(product.id, selections, text)
      setAnswer(data.reply)
    } catch {
      setAnswer('The expert is temporarily unavailable. Catalog details: ' + product.description +
        ' · ' + Object.values(selections).join(', ') + ' · ' + formatPrice(unitPrice))
    } finally { setBusy(false) }
  }
  return <section id="product-expert" className="glass rounded-2xl p-5 sm:p-8 mt-6 scroll-mt-24">
    <h2 className="text-2xl font-semibold">AI Product Expert</h2>
    <p className="text-muted my-3">{product.name} · {formatPrice(unitPrice)}</p>
    <div className="flex flex-wrap gap-2">{prompts.map(text =>
      <button key={text} disabled={busy} className="rounded-full border border-silver/35 px-3 py-2 hover:border-volt" onClick={() => ask(text)}>{text}</button>)}</div>
    <form className="flex flex-wrap gap-3 mt-4" onSubmit={event => { event.preventDefault(); ask(question) }}>
      <input aria-label="Question about this product" placeholder="Ask about this configuration" className="flex-1 min-w-0 rounded-xl bg-transparent border border-silver/40 px-3 py-2" maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} />
      <Button type="submit" disabled={!question.trim() || busy}>Ask expert</Button>
    </form>
    <p role="status" className="whitespace-pre-line leading-relaxed mt-3">{busy ? 'Checking product details…' : answer}</p>
  </section>
}
