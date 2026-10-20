/**
 * A map's art with spawn areas or resource nodes drawn over it. Server
 * component: the overlay is plain SVG in the page, so nothing ships to the
 * client but markup. Coordinates are in-game lon (x) / lat (y), 0–100, which
 * map linearly onto the square map art (viewBox 0 0 100 100).
 */

import Image from 'next/image'
import type { ReactNode } from 'react'

/** Wiki spawn-map palette, index = rarity 0 (very rare) … 5 (very common). */
export const RARITY = [
  { label: 'Very rare', color: '#ff0000' },
  { label: 'Rare', color: '#ff6600' },
  { label: 'Very uncommon', color: '#ffcc00' },
  { label: 'Uncommon', color: '#ffff00' },
  { label: 'Common', color: '#b2ff00' },
  { label: 'Very common', color: '#00ff00' },
] as const

/** Resource nodes: bright on any map art, with a dark edge so they don't vanish on snow or sand. */
export const NODE_COLOR = '#22d3ee'
export const CAVE_NODE_COLOR = '#f0abfc'
/** Regions and places: white reads on every biome and doesn't clash with the rarity ramp. */
export const PLACE_COLOR = '#ffffff'

const r1 = (n: number) => Math.round(n * 10) / 10
// Box sizes are differences of 2-decimal coordinates; round off the float noise (0.9699999999999989).
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * All nodes as one path of small diamonds; thousands of separate elements would
 * bloat the DOM. Nodes closer than a third of a marker would draw as one blob
 * anyway, so they're merged (Lost Colony lists 10k+ polymer nodes).
 */
function nodePath(nodes: [number, number][], size: number) {
  const h = size / 2
  const cell = size / 3
  const seen = new Set<string>()
  let d = ''
  for (const [x, y] of nodes) {
    const key = `${Math.round(x / cell)},${Math.round(y / cell)}`
    if (seen.has(key)) continue
    seen.add(key)
    d += `M${r1(x)} ${r1(y - h)}l${h} ${h}l-${h} ${h}l-${h} -${h}z`
  }
  return d
}

export function MapCanvas({
  image,
  label,
  regions = [],
  points = [],
  nodes = [],
  caveNodes = [],
  areas = [],
  pins = [],
  priority,
  children,
}: {
  image: string
  /** Describes what the overlay shows, for screen readers. */
  label: string
  regions?: [number, number, number, number, number][]
  points?: [number, number, number][]
  nodes?: [number, number][]
  caveNodes?: [number, number][]
  /** A highlighted place, e.g. a named region, as lat/lon boxes. */
  areas?: [number, number, number, number][]
  /** Labelled locations: caves, artifacts, obelisks, player spawns. */
  pins?: { x: number; y: number; label?: string }[]
  priority?: boolean
  /** Rendered over the map, e.g. an empty-state prompt. */
  children?: ReactNode
}) {
  // Draw the rarest areas last so they aren't hidden under common ones.
  const sorted = regions.toSorted((a, b) => b[4] - a[4])
  return (
    <div className="bg-plate ring-border relative aspect-square overflow-hidden rounded-xl ring-1">
      <Image src={image} alt="" fill priority={priority} sizes="(max-width: 1024px) 100vw, 760px" className="object-cover" />
      <svg viewBox="0 0 100 100" role="img" aria-label={label} className="absolute inset-0 size-full">
        {sorted.map(([x1, y1, x2, y2, r], i) => (
          <rect
            key={i}
            x={Math.min(x1, x2)}
            y={Math.min(y1, y2)}
            width={r2(Math.abs(x2 - x1))}
            height={r2(Math.abs(y2 - y1))}
            fill={RARITY[r].color}
            fillOpacity={0.35}
            stroke={RARITY[r].color}
            strokeWidth={0.25}
          />
        ))}
        {points.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={0.7} fill={RARITY[r].color} fillOpacity={0.85} stroke="#000" strokeWidth={0.15} />
        ))}
        {nodes.length > 0 && <path d={nodePath(nodes, 1.1)} fill={NODE_COLOR} stroke="#06202a" strokeWidth={0.12} />}
        {caveNodes.length > 0 && <path d={nodePath(caveNodes, 1.3)} fill={CAVE_NODE_COLOR} stroke="#2a0630" strokeWidth={0.12} />}
        {areas.map(([x1, y1, x2, y2], i) => (
          <rect
            key={`a${i}`}
            x={Math.min(x1, x2)}
            y={Math.min(y1, y2)}
            width={r2(Math.abs(x2 - x1))}
            height={r2(Math.abs(y2 - y1))}
            fill={PLACE_COLOR}
            fillOpacity={0.3}
            stroke={PLACE_COLOR}
            strokeWidth={0.3}
          />
        ))}
        {pins.map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={p.x} cy={p.y} r={1.1} fill={PLACE_COLOR} stroke="#000" strokeWidth={0.3} />
            {p.label && (
              <text
                x={p.x + 1.8}
                y={p.y + 0.9}
                fontSize={2.6}
                fill="#fff"
                stroke="#000"
                strokeWidth={0.5}
                paintOrder="stroke"
                // Labels near the right edge go on the pin's left so they stay on the map.
                textAnchor={p.x > 75 ? 'end' : 'start'}
                dx={p.x > 75 ? -3.6 : 0}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {children}
    </div>
  )
}
