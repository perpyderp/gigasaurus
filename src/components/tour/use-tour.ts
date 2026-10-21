'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'

const storageKey = (id: string) => `gigasaurus:tour:${id}`

function hasSeen(id: string) {
  try {
    return localStorage.getItem(storageKey(id)) === 'done'
  } catch {
    // Private mode or blocked storage: treat as seen so the tour doesn't reopen on every visit.
    return true
  }
}

// "Seen" lives in localStorage; these let every useTour re-read it when it changes.
const listeners = new Set<() => void>()
function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(storageKey(id), 'done')
  } catch {
    /* nothing to remember it in */
  }
  for (const l of listeners) l()
}

export interface TourController {
  state: { open: boolean; index: number }
  actions: { start: () => void; goTo: (index: number) => void; close: () => void }
  meta: { id: string }
}

/**
 * State for one guided tour. Render it with <Tour tour={…} steps={…} /> and
 * start it from any control you like.
 *
 * `autoStart` opens it once per browser, as soon as it's true; pass a
 * condition (e.g. "the page has data") to wait for the right moment.
 */
export function useTour(id: string, { autoStart = false }: { autoStart?: boolean } = {}): TourController {
  // The server has no localStorage: report "seen" there so nothing renders until the client knows.
  const seen = useSyncExternalStore(subscribe, () => hasSeen(id), () => true)
  const [index, setIndex] = useState<number | null>(null)
  const open = index !== null || (autoStart && !seen)

  const start = useCallback(() => setIndex(0), [])
  const goTo = useCallback((i: number) => setIndex(i), [])
  // Finishing or skipping both count as seen: either way they know where to find it.
  const close = useCallback(() => {
    setIndex(null)
    markSeen(id)
  }, [id])

  return {
    state: { open, index: index ?? 0 },
    actions: { start, goTo, close },
    meta: { id },
  }
}
