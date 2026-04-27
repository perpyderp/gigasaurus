'use client'

import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressTrack,
  CircularProgressRange,
  CircularProgressValueText,
} from '@/components/ui/circular-progress'

export type StatDisplayStyle = 'circle' | 'bar' | 'value'

interface StatBarProps {
  label: string
  value: number
  display?: string
  /** Pre-formatted breeding value, shown alongside the observed value when provided. */
  breedingDisplay?: string
  max: number
  color?: string
  style?: StatDisplayStyle
  /** Estimated point count (fallback when wild/dom are unavailable). */
  points?: number
  topPercent?: string
  /** Solved wild level count. When provided, replaces the points estimate. */
  wildLevels?: number
  /** Solved domesticated level count. */
  domLevels?: number
  /** Whether the wild/dom solution was exact. */
  solved?: boolean
}

const ringToBg: Record<string, string> = {
  'text-red-500':      'bg-red-500',
  'text-emerald-500':  'bg-emerald-500',
  'text-cyan-400':     'bg-cyan-400',
  'text-orange-500':   'bg-orange-500',
  'text-yellow-500':   'bg-yellow-500',
  'text-rose-500':     'bg-rose-500',
  'text-fuchsia-500':  'bg-fuchsia-500',
  'text-violet-500':   'bg-violet-500',
}

export function StatBar({
  label, value, display, breedingDisplay, max,
  color = 'text-emerald-500', style = 'circle',
  points, topPercent,
  wildLevels, domLevels, solved,
}: StatBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const displayValue = display ?? (Number.isInteger(value) ? String(value) : value.toFixed(1))
  const barBg = ringToBg[color] ?? 'bg-emerald-500'

  const meta = (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      {wildLevels !== undefined ? (
        <span className={solved ? '' : 'opacity-60'}>
          Lw <span className="text-blue-500 dark:text-blue-400 font-medium tabular-nums">{wildLevels}</span>
          {domLevels !== undefined && (
            <> · Ld <span className="text-violet-500 dark:text-violet-400 font-medium tabular-nums">{domLevels}</span></>
          )}
        </span>
      ) : (
        points !== undefined && <span>~{points} pts</span>
      )}
      {breedingDisplay && (
        <span>
          Breed <span className="text-foreground font-mono tabular-nums">{breedingDisplay}</span>
        </span>
      )}
      {topPercent && <span className="text-emerald-600 dark:text-emerald-400">{topPercent}</span>}
    </div>
  )

  if (style === 'value') {
    return (
      <div className="border-border/60 flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0">
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-foreground font-mono text-sm tabular-nums">{displayValue}</span>
          {meta}
        </div>
      </div>
    )
  }

  if (style === 'bar') {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${color}`}>{label}</span>
          <span className="text-foreground font-mono text-sm tabular-nums">{displayValue}</span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div className={`${barBg} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        {meta}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <CircularProgress value={pct} max={100} size={56} thickness={5}>
        <CircularProgressIndicator>
          <CircularProgressTrack />
          <CircularProgressRange className={color} />
        </CircularProgressIndicator>
        <CircularProgressValueText className="text-[10px]" />
      </CircularProgress>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${color}`}>{label}</span>
          <span className="text-foreground font-mono text-sm tabular-nums">{displayValue}</span>
        </div>
        {meta}
      </div>
    </div>
  )
}
