'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { colorizeCreature, arkColorToTint, type RGB } from '@/lib/creature-colorize'
import type { ArkColor } from '@/lib/ark-parser'
import { cn } from '@/lib/utils'

const ARKUTILS_BASE = 'https://raw.githubusercontent.com/arkutils/species-images/main/images'
const LOCAL_BASE = '/images/creature-renders'

function localUrls(slug: string): { base: string; mask: string } {
  return { base: `${LOCAL_BASE}/${slug}.png`, mask: `${LOCAL_BASE}/${slug}_m.png` }
}

function arkutilsUrls(speciesName: string): { base: string; mask: string } {
  const enc = encodeURIComponent(speciesName)
  return {
    base: `${ARKUTILS_BASE}/${enc}_ASA.png`,
    mask: `${ARKUTILS_BASE}/${enc}_ASA_m.png`,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

async function loadPair(urls: { base: string; mask: string }): Promise<[HTMLImageElement, HTMLImageElement]> {
  return Promise.all([loadImage(urls.base), loadImage(urls.mask)])
}

function imageToData(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

/**
 * Crop to the creature's visible pixels. The source renders sit off-center in a
 * mostly transparent square, so without this the creature looks small and shifted.
 */
function cropToContent(data: ImageData): HTMLCanvasElement {
  const { width, height } = data
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data.data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    minX = 0; minY = 0; maxX = width - 1; maxY = height - 1
  }
  const full = document.createElement('canvas')
  full.width = width
  full.height = height
  full.getContext('2d')!.putImageData(data, 0, 0)
  const cropped = document.createElement('canvas')
  cropped.width = maxX - minX + 1
  cropped.height = maxY - minY + 1
  cropped.getContext('2d')!.drawImage(full, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
  return cropped
}

interface Props {
  /** Wiki display name, e.g. "Achatina" — used as upstream fallback when no local mask exists. */
  speciesName?: string | null
  /** Slug for the local bundled image (matches data/creatures/{slug}.json). */
  slug?: string | null
  colors: ArkColor[]
  /** Size the render through the container (e.g. `absolute inset-0`); the creature is fitted and centered inside. */
  className?: string
  /** Shown when no color render (base + mask) can be loaded. Falls back to this image instead of an empty state. */
  fallbackSrc?: string | null
}

/** Never enlarge the 256-px source art beyond this, so it stays sharp; it's centered with space around instead. */
const MAX_UPSCALE = 1.5
/** Breathing room around the creature, as a fraction of the container. */
const PADDING = 0.06

export function CreatureColorRender({ speciesName, slug, colors, className, fallbackSrc = null }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const requestKey = useMemo(
    () => `${slug ?? ''}|${speciesName ?? ''}|${colors.map((c) => `${c.r},${c.g},${c.b},${c.empty ? 1 : 0}`).join(';')}`,
    [slug, speciesName, colors],
  )
  const [rendered, setRendered] = useState<
    { key: string; status: 'ready'; image: HTMLCanvasElement } | { key: string; status: 'missing' } | null
  >(null)
  const status: 'loading' | 'ready' | 'missing' = rendered?.key === requestKey ? rendered.status : 'loading'

  // Track the container's displayed size so the canvas is drawn 1:1 with screen pixels.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load base + mask, tint the regions, crop to the creature.
  useEffect(() => {
    let cancelled = false

    async function tryLoad() {
      // Prefer locally-bundled images; fall back to arkutils upstream.
      if (slug) {
        try {
          return await loadPair(localUrls(slug))
        } catch {
          // local miss — fall through to upstream
        }
      }
      if (speciesName) return await loadPair(arkutilsUrls(speciesName))
      throw new Error('no slug or species name to resolve a color render')
    }

    tryLoad()
      .then(([baseImg, maskImg]) => {
        if (cancelled) return
        const tints: (RGB | null)[] = colors.slice(0, 6).map(arkColorToTint)
        while (tints.length < 6) tints.push(null)
        const out = colorizeCreature(imageToData(baseImg), imageToData(maskImg), tints)
        setRendered({ key: requestKey, status: 'ready', image: cropToContent(out) })
      })
      .catch(() => {
        if (!cancelled) setRendered({ key: requestKey, status: 'missing' })
      })

    return () => {
      cancelled = true
    }
  }, [requestKey, slug, speciesName, colors])

  // Fit the cropped creature into the container and draw at CSS size × device pixel ratio.
  const image = rendered?.key === requestKey && rendered.status === 'ready' ? rendered.image : null
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image || !box || box.w === 0 || box.h === 0) return
    const scale = Math.min(
      (box.w * (1 - 2 * PADDING)) / image.width,
      (box.h * (1 - 2 * PADDING)) / image.height,
      MAX_UPSCALE,
    )
    const cssW = Math.max(1, Math.round(image.width * scale))
    const cssH = Math.max(1, Math.round(image.height * scale))
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  }, [image, box])

  return (
    <div ref={containerRef} className={cn('flex items-center justify-center overflow-hidden', className)}>
      {status === 'loading' && (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">Rendering…</div>
      )}
      {status === 'missing' &&
        (fallbackSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fallbackSrc} alt={speciesName ?? 'creature'} className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center p-4 text-center text-xs">
            No color render available
          </div>
        ))}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${speciesName ?? 'Creature'} in its colors`}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  )
}
