import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'

export default function PhotoSearch() {
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  async function search(event) {
    const file = event.target.files[0]
    if (!file) return
    event.target.value = ''
    setResults([])
    setBusy(true)
    setStatus('Finding similar products…')
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const { data } = await api.searchPhoto(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
      setResults(data.matches)
      setStatus(data.matches.length ? 'Visually similar products' : 'No catalog photos available.')
    } catch (err) {
      setStatus(err.status ? err.message : 'Could not search this photo. Try a JPEG or PNG.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="my-4">
    <label className="inline-block rounded-lg border border-silver/40 px-3 py-2 cursor-pointer focus-within:ring-2">
      Search by photo
      <input className="sr-only" type="file" accept="image/*" disabled={busy} onChange={search} />
    </label>
    <p role="status" className="text-sm my-2">{status}</p>
    <ul className="flex flex-wrap gap-3">{results.map(slug =>
      <li key={slug}><Link className="underline" to={'/products/' + slug}>{slug.replaceAll('-', ' ')}</Link></li>
    )}</ul>
  </div>
}
