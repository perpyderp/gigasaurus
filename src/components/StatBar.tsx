'use client'

interface StatBarProps {
  label: string
  value: number
  /** Displayed value (formatted). Defaults to Math.round(value) */
  display?: string
  /** Max reference value for bar width calculation */
  max: number
  color?: string
}

export function StatBar({ label, value, display, max, color = 'bg-emerald-500' }: StatBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  const displayValue = display ?? (Number.isInteger(value) ? String(value) : value.toFixed(1))

  return (
    <div className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2">
      <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{label}</span>
      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-right text-zinc-700 dark:text-zinc-300">{displayValue}</span>
    </div>
  )
}
