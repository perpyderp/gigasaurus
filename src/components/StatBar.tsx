'use client'

import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressTrack,
  CircularProgressRange,
  CircularProgressValueText,
} from '@/components/ui/circular-progress'

interface StatBarProps {
  label: string
  value: number
  display?: string
  max: number
  color?: string
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

export function StatBar({ label, value, display, max, color = 'text-emerald-500', points, topPercent, wildLevels, domLevels, solved }: StatBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const displayValue = display ?? (Number.isInteger(value) ? String(value) : value.toFixed(1))

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
          <span className="text-foreground text-sm font-medium">{label}</span>
          <span className="text-foreground font-mono text-sm">{displayValue}</span>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {wildLevels !== undefined ? (
            <span className={solved ? '' : 'opacity-60'}>
              Lw <span className="text-blue-500 dark:text-blue-400 font-medium">{wildLevels}</span>
              {domLevels !== undefined && domLevels > 0 && (
                <> / Ld <span className="text-violet-500 dark:text-violet-400 font-medium">{domLevels}</span></>
              )}
            </span>
          ) : (
            points !== undefined && <span>~{points} pts</span>
          )}
          {topPercent && <span className="text-emerald-600 dark:text-emerald-400">{topPercent}</span>}
        </div>
      </div>
    </div>
  )
}
