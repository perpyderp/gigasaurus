/**
 * Shared building blocks for the glossary pages (creatures, armor, weapons,
 * resources). Server components: search and filters are plain GET links/forms,
 * so they work before hydration and every state is a shareable URL.
 */

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Search, PawPrint, type LucideIcon } from 'lucide-react'

export function GlossaryHeader({
  title,
  summary,
  children,
}: {
  title: string
  summary: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-none sm:text-5xl">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-[15px]">{summary}</p>
      </div>
      {children}
    </div>
  )
}

export function SearchField({
  action,
  defaultValue,
  placeholder,
  label,
  hidden = {},
}: {
  action: string
  defaultValue?: string
  placeholder: string
  label: string
  /** Other active filters to keep when the search is submitted. */
  hidden?: Record<string, string | undefined>
}) {
  return (
    <form method="GET" action={action} role="search" className="w-full md:w-80">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="border-input bg-card placeholder:text-muted-foreground focus-visible:border-ring h-11 w-full rounded-lg border pr-3 pl-9 text-[15px] outline-none"
        />
      </label>
    </form>
  )
}

export interface FilterOption {
  value: string
  label: string
  count?: number
}

export function FilterChips({
  basePath,
  param,
  options,
  active,
  allLabel = 'All',
  keep = {},
  label,
}: {
  basePath: string
  param: string
  options: FilterOption[]
  active?: string
  allLabel?: string
  /** Other query params to carry through (e.g. the search term). */
  keep?: Record<string, string | undefined>
  label: string
}) {
  const href = (value?: string) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(keep)) if (v) qs.set(k, v)
    if (value) qs.set(param, value)
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const chip = (value: string | undefined, text: string, count?: number) => {
    const selected = (active ?? '') === (value ?? '')
    return (
      <Link
        key={value ?? '__all'}
        href={href(value)}
        aria-current={selected ? 'true' : undefined}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
        }`}
      >
        {text}
        {count != null && (
          <span className={`tabular-nums ${selected ? 'text-primary-foreground/75' : 'text-muted-foreground/70'}`}>{count}</span>
        )}
      </Link>
    )
  }
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {chip(undefined, allLabel)}
      {options.map((o) => chip(o.value, o.label, o.count))}
    </nav>
  )
}

export function ResultCount({ shown, total, noun, query }: { shown: number; total: number; noun: string; query?: string }) {
  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      {shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`}
      {query ? <> matching <span className="text-foreground font-medium">&ldquo;{query}&rdquo;</span></> : null}
    </p>
  )
}

export function EmptyResults({ icon: Icon, message, resetHref }: { icon: LucideIcon; message: string; resetHref: string }) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <Icon aria-hidden className="text-muted-foreground/60 size-10" strokeWidth={1.5} />
      <p className="text-muted-foreground">{message}</p>
      <Link href={resetHref} className="text-primary text-sm font-medium underline-offset-4 hover:underline">
        Clear search and filters
      </Link>
    </div>
  )
}

/** Creature tile: the dossier art at its native 3:2 on a dark plate it blends into. */
export function DossierTile({
  href,
  name,
  image,
  meta,
}: {
  href: string
  name: string
  image: string | null
  meta: ReactNode
}) {
  return (
    <Link href={href} className="group block h-full rounded-lg">
      <div className="bg-plate ring-border group-hover:ring-primary/70 relative aspect-[3/2] overflow-hidden rounded-lg ring-1 transition-shadow">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <PawPrint aria-hidden className="absolute inset-0 m-auto size-10 text-white/15" strokeWidth={1.5} />
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
        <span className="font-display group-hover:text-primary truncate text-[17px] leading-tight transition-colors">{name}</span>
        <span className="text-muted-foreground shrink-0 text-xs">{meta}</span>
      </div>
    </Link>
  )
}

/**
 * Item tile in the style of an inventory slot: square, icon centered, the one
 * number a player compares (armor rating, damage, stack size) in the corner.
 */
export function SlotTile({
  name,
  image,
  fallbackIcon: Icon,
  corner,
  meta,
}: {
  name: string
  image: string | null
  fallbackIcon: LucideIcon
  corner?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="group h-full cursor-default">
      <div className="slot group-hover:ring-primary/70 relative aspect-square rounded-lg ring-0 ring-transparent transition-shadow group-hover:ring-2">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 33vw, 180px"
            className="object-contain p-[14%] drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] transition-transform duration-200 motion-safe:group-hover:scale-105"
          />
        ) : (
          <Icon aria-hidden className="text-muted-foreground/40 absolute inset-0 m-auto size-1/3" strokeWidth={1.5} />
        )}
        {corner != null && (
          <span className="bg-background/80 text-foreground absolute right-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums backdrop-blur-sm">
            {corner}
          </span>
        )}
      </div>
      <p className="mt-2 px-0.5 text-sm leading-snug font-semibold">{name}</p>
      {meta != null && <p className="text-muted-foreground px-0.5 text-xs">{meta}</p>}
    </div>
  )
}
