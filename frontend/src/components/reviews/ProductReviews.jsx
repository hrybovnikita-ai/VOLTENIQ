import { useEffect, useState } from 'react'
import { BadgeCheck, Star, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/format'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'

function Stars({ value, onChange, size = 'md' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  return (
    <div className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={`${n} stars`}
          onClick={() => onChange?.(n)}
          className={onChange ? 'touch-manipulation' : 'pointer-events-none'}
        >
          <Star
            className={`${cls} ${n <= value ? 'fill-volt text-volt' : 'text-silver/50'}`}
          />
        </button>
      ))}
    </div>
  )
}

function readPhotoFiles(files) {
  const list = Array.from(files || []).slice(0, 3)
  return Promise.all(
    list.map(
      (file) =>
        new Promise((resolve, reject) => {
          if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
            reject(new Error('Use JPEG, PNG, or WebP photos.'))
            return
          }
          if (file.size > 140_000) {
            reject(new Error('Each photo must be under 140KB for demo uploads.'))
            return
          }
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Could not read photo.'))
          reader.readAsDataURL(file)
        })
    )
  )
}

export default function ProductReviews({ productId, onStats }) {
  const { isAuthenticated, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [data, setData] = useState(null)
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async (nextPage = page, nextSort = sort) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getReviews(productId, { page: nextPage, sort: nextSort, limit: 5 })
      setData(res.data)
      onStats?.(res.data.summary)
      if (res.data.mine && !editingId) {
        setRating(res.data.mine.rating)
        setTitle(res.data.mine.title || '')
        setBody(res.data.mine.body || '')
        setPhotos(res.data.mine.photos || [])
        setEditingId(res.data.mine.id)
      }
    } catch (err) {
      setError(err.message || 'Could not load reviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, sort)
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, sort])

  const submit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = { rating, title: title.trim() || null, body, photos }
      if (editingId) {
        await api.updateReview(productId, editingId, payload)
        setMessage('Review updated')
      } else {
        await api.createReview(productId, payload)
        setMessage('Review published')
      }
      await load(1, sort)
      setPage(1)
    } catch (err) {
      setError(err.message || 'Could not save review')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (reviewId) => {
    if (!confirm('Delete this review?')) return
    try {
      await api.deleteReview(productId, reviewId)
      setEditingId(null)
      setTitle('')
      setBody('')
      setPhotos([])
      setRating(5)
      setMessage('Review deleted')
      await load(1, sort)
      setPage(1)
    } catch (err) {
      setError(err.message || 'Could not delete review')
    }
  }

  const summary = data?.summary || { average: 0, reviewCount: 0, distribution: {} }
  const maxBar = Math.max(1, ...Object.values(summary.distribution || {}))

  return (
    <section className="mt-12 sm:mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Reviews & ratings</h2>
          <p className="text-sm text-muted mt-1">
            {summary.average ? `${summary.average.toFixed(1)} average` : 'No ratings yet'} ·{' '}
            {summary.reviewCount} reviews
          </p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6 mb-8">
        <div className="glass rounded-[18px] p-5">
          <p className="font-display text-4xl font-bold text-volt">{summary.average?.toFixed(1) || '—'}</p>
          <Stars value={Math.round(summary.average || 0)} />
          <div className="mt-4 space-y-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3">{n}</span>
                <div className="h-2 flex-1 rounded-full bg-silver/20 overflow-hidden">
                  <div
                    className="h-full bg-volt"
                    style={{ width: `${((summary.distribution?.[n] || 0) / maxBar) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted">{summary.distribution?.[n] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {isAuthenticated ? (
            <form onSubmit={submit} className="glass rounded-[18px] p-5 space-y-3">
              <h3 className="font-semibold">{editingId ? 'Edit your review' : 'Write a review'}</h3>
              <Stars value={rating} onChange={setRating} />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full rounded-[12px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-3 py-2 text-sm"
              />
              <textarea
                required
                minLength={10}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your experience (min 10 characters)"
                className="w-full rounded-[12px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-3 py-2 text-sm"
              />
              <div>
                <label className="text-xs text-muted">Photos (optional, max 3, under 140KB)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="mt-1 block w-full text-sm"
                  onChange={async (e) => {
                    try {
                      const next = await readPhotoFiles(e.target.files)
                      setPhotos(next)
                      setError('')
                    } catch (err) {
                      setError(err.message)
                    }
                  }}
                />
                {photos.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {photos.map((src, i) => (
                      <img key={i} src={src} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Update review' : 'Publish review'}
                </Button>
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={() => remove(editingId)}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted glass rounded-[16px] p-4">Sign in to leave a review.</p>
          )}

          {message ? <p className="text-sm text-green-600">{message}</p> : null}
          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.reviews || []).map((review) => (
                <article key={review.id} className="glass rounded-[16px] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold truncate">{review.user?.name || 'Customer'}</span>
                      {review.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-volt/15 text-volt text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                          <BadgeCheck className="w-3 h-3" /> Verified purchase
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
                  </div>
                  <Stars value={review.rating} size="sm" />
                  {review.title ? <p className="font-medium mt-2">{review.title}</p> : null}
                  <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{review.body}</p>
                  {review.photos?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.photos.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-20 w-20 rounded-xl object-cover" />
                      ))}
                    </div>
                  ) : null}
                  {user?.id === review.userId ? (
                    <button
                      type="button"
                      className="mt-3 text-xs text-muted hover:text-volt"
                      onClick={() => {
                        setEditingId(review.id)
                        setRating(review.rating)
                        setTitle(review.title || '')
                        setBody(review.body)
                        setPhotos(review.photos || [])
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                </article>
              ))}
              {!data?.reviews?.length ? (
                <p className="text-sm text-muted">No reviews yet. Be the first to share feedback.</p>
              ) : null}
            </div>
          )}

          {data && data.total > data.limit ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const next = page - 1
                  setPage(next)
                  load(next, sort)
                }}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page * data.limit >= data.total}
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  load(next, sort)
                }}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
