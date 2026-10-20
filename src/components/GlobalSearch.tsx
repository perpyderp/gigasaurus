'use client'

/**
 * Home page search with suggestions across every glossary. Picking a suggestion
 * opens it; submitting without one still searches the creature list, so the
 * form keeps working before hydration.
 */

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { Search } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'

export interface SearchEntry {
  name: string
  kind: 'Creature' | 'Armor' | 'Weapon' | 'Resource'
  href: string
  image: string | null
}

const MAX_SUGGESTIONS = 8

// Names starting with the query (or with a word that does) rank above names that merely contain it.
function rankEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: SearchEntry[] = []
  const contains: SearchEntry[] = []
  for (const entry of entries) {
    const name = entry.name.toLowerCase()
    if (name.startsWith(q) || name.split(/[\s-]+/).some((word) => word.startsWith(q))) starts.push(entry)
    else if (name.includes(q)) contains.push(entry)
  }
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
}

export function GlobalSearch({ entries }: { entries: SearchEntry[] }) {
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => rankEntries(entries, query), [entries, query])

  return (
    <Autocomplete.Root
      items={entries}
      filteredItems={suggestions}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(entry: SearchEntry) => entry.name}
    >
      <form method="GET" action="/creatures" role="search" className="mt-8 flex max-w-xl gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search creatures, armor, weapons and resources</span>
          <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2" />
          <Autocomplete.Input
            type="search"
            name="q"
            placeholder="Rex, Argentavis, Shadowmane…"
            className="border-input bg-card/95 placeholder:text-muted-foreground focus-visible:border-ring h-13 w-full rounded-lg border pr-4 pl-12 text-base shadow-lg outline-none backdrop-blur-sm"
          />
        </label>
        <button type="submit" className={buttonVariants({ className: 'h-13 px-5 text-base shadow-lg' })}>
          Search
        </button>
      </form>
      <Suggestions />
    </Autocomplete.Root>
  )
}

function Suggestions() {
  return (
    <Autocomplete.Portal>
      <Autocomplete.Positioner sideOffset={6} align="start" className="isolate z-50">
        <Autocomplete.Popup className="bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 max-h-[min(24rem,var(--available-height))] w-(--anchor-width) overflow-y-auto overscroll-contain rounded-lg border p-1 shadow-lg outline-none data-[empty]:hidden">
          <Autocomplete.List>
            {(entry: SearchEntry) => <Suggestion key={entry.href} entry={entry} />}
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  )
}

function Suggestion({ entry }: { entry: SearchEntry }) {
  // Some creatures have no artwork yet; leave the slot empty rather than show a broken image.
  const [imageFailed, setImageFailed] = useState(false)
  return (
    <Autocomplete.Item
      value={entry}
      render={<Link href={entry.href} />}
      className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 outline-none select-none"
    >
      <span className="slot relative size-9 shrink-0 rounded-md">
        {entry.image && !imageFailed && (
          <Image src={entry.image} alt="" fill sizes="36px" className="object-contain p-1" onError={() => setImageFailed(true)} />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
      <span className="text-muted-foreground text-xs">{entry.kind}</span>
    </Autocomplete.Item>
  )
}
