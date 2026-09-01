import { useState, useEffect, useRef } from "react"

/**
 * Polling avec pause onglet caché + pas de chevauchement de requêtes.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMountedRef = useRef(true)
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const stableInterval = interval

  useEffect(() => {
    isMountedRef.current = true

    if (!enabled) {
      setLoading(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let inFlight = false

    const schedule = (ms: number) => {
      timeoutId = setTimeout(poll, ms)
    }

    const poll = async () => {
      if (cancelled || !isMountedRef.current) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule(stableInterval)
        return
      }
      if (inFlight) {
        schedule(stableInterval)
        return
      }

      inFlight = true
      try {
        const result = await fetchRef.current()
        if (isMountedRef.current && !cancelled) {
          setData(result)
          setLoading(false)
          setError(null)
        }
      } catch (err) {
        if (isMountedRef.current && !cancelled) {
          setError(err as Error)
          setLoading(false)
        }
      } finally {
        inFlight = false
        if (isMountedRef.current && !cancelled && enabled) {
          schedule(stableInterval)
        }
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !inFlight) {
        if (timeoutId) clearTimeout(timeoutId)
        void poll()
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    void poll()

    return () => {
      cancelled = true
      isMountedRef.current = false
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [stableInterval, enabled])

  return { data, loading, error }
}
