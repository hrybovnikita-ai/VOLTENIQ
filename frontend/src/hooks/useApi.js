import { useEffect, useRef, useState } from 'react'

/**
 * Load backend data with axios-backed api helpers inside useEffect.
 * @param {() => Promise<any>} fetcher - async function that calls `api.*`
 * @param {unknown[]} deps - effect dependencies
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const result = await fetcherRef.current()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Request failed')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = () => setTick((n) => n + 1)

  return { data, loading, error, reload, setData, setError }
}
