'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { colorizeCreature, arkColorToTint, type RGB } from '@/lib/creature-colorize'
import type { ArkColor } from '@/lib/ark-parser'

const ARKUTILS_BASE = 'https://raw.githubusercontent.com/arkutils/species-images/main/images'

function imageUrls(speciesName: string): { base: string; mask: string } {
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

function imageToData(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

interface Props {
  /** Wiki display name, e.g. "Achatina" — used to construct arkutils URLs. */
  speciesName: string
  colors: ArkColor[]
  className?: string
  /** Square render size in CSS pixels. */
  size?: number
}

export function CreatureColorRender({ speciesName, colors, className, size = 256 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const requestKey = useMemo(
    () => `${speciesName}|${colors.map((c) => `${c.r},${c.g},${c.b},${c.empty ? 1 : 0}`).join(';')}`,
    [speciesName, colors],
  )
  const [resolved, setResolved] = useState<{ key: string; status: 'ready' | 'missing' } | null>(null)
  const status: 'loading' | 'ready' | 'missing' =
    resolved?.key === requestKey ? resolved.status : 'loading'

  useEffect(() => {
    let cancelled = false
    const { base, mask } = imageUrls(speciesName)

    Promise.all([loadImage(base), loadImage(mask)])
      .then(([baseImg, maskImg]) => {
        if (cancelled) return
        const baseData = imageToData(baseImg)
        const maskData = imageToData(maskImg)
        const tints: (RGB | null)[] = colors.slice(0, 6).map(arkColorToTint)
        while (tints.length < 6) tints.push(null)
        const out = colorizeCreature(baseData, maskData, tints)

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = out.width
        canvas.height = out.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.putImageData(out, 0, 0)
        setResolved({ key: requestKey, status: 'ready' })
      })
      .catch(() => {
        if (cancelled) return
        setResolved({ key: requestKey, status: 'missing' })
      })

    return () => {
      cancelled = true
    }
  }, [requestKey, speciesName, colors])

  return (
    <div className={className} style={{ width: size, height: size }}>
      {status === 'loading' && (
        <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-md text-xs">
          Rendering…
        </div>
      )}
      {status === 'missing' && (
        <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-md p-4 text-center text-xs">
          No color render available
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-md"
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  )
}
