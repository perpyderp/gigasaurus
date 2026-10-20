'use client'

import type { ReactNode } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

/**
 * One tab per map. The map panels are rendered on the server and passed in,
 * so this only switches between them. Tabs wrap onto extra rows instead of
 * overflowing; a creature can spawn on a dozen maps.
 */
export function SpawnMap({ maps }: { maps: { key: string; label: string; content: ReactNode }[] }) {
  if (maps.length === 0) return null
  return (
    <TabsPrimitive.Root defaultValue={maps[0].key}>
      <TabsPrimitive.List aria-label="Map" className="flex flex-wrap gap-1.5">
        {maps.map((m) => (
          <TabsPrimitive.Tab
            key={m.key}
            value={m.key}
            className="border-border text-muted-foreground hover:text-foreground data-active:border-primary data-active:bg-primary data-active:text-primary-foreground inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors"
          >
            {m.label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
      {maps.map((m) => (
        <TabsPrimitive.Panel key={m.key} value={m.key} className="mt-4 outline-none">
          {m.content}
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  )
}
