/**
 * "Where it spawns" on a creature page: one map per tab with the same
 * rarity-coloured spawn areas as the map pages, plus the regions it's mostly
 * found in. Server component; SpawnMap only switches tabs.
 */

import Link from 'next/link'
import { MapService } from '@/services/map'
import { MapCanvas, RARITY } from '@/components/MapCanvas'
import { SpawnMap } from '@/components/SpawnMap'
import { regionsForSpawns } from '@/lib/map-geometry'
import { toSlug } from '@/lib/slug'

export function CreatureSpawnMaps({ slug, name }: { slug: string; name: string }) {
  const spawns = MapService.forCreature(slug)
  if (spawns.length === 0) return null

  const maps = spawns.map((s) => {
    const map = MapService.getBySlug(s.map)!
    const mostlyIn = regionsForSpawns(map.regions, s.regions, s.points, 3)
    return {
      key: s.map,
      label: s.name,
      content: (
        <div className="space-y-3">
          <div className="mx-auto w-full max-w-[560px]">
            <MapCanvas image={map.image!} label={`Spawn areas for ${name} on ${s.name}`} regions={s.regions} points={s.points} />
          </div>
          <div className="flex flex-col items-center gap-1 text-center text-sm">
            {mostlyIn.length > 0 && (
              <p>
                <span className="text-muted-foreground">Mostly in </span>
                {mostlyIn.map((region, i) => (
                  <span key={region}>
                    {i > 0 && ', '}
                    <Link
                      href={`/maps/${s.map}?tab=places&place=region-${toSlug(region)}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {region}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            <Link href={`/maps/${s.map}?creature=${slug}`} className="text-primary font-medium underline-offset-4 hover:underline">
              Open {/^the\s/i.test(s.name) ? s.name : `the ${s.name}`} map
            </Link>
            <Link href={`/maps/${s.map}/${slug}`} className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              {name} spawn locations on {s.name}
            </Link>
          </div>
        </div>
      ),
    }
  })

  return (
    <div className="space-y-4">
      <SpawnMap maps={maps} />
      <ul aria-label="Spawn rarity" className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {RARITY.toReversed().map((r) => (
          <li key={r.label} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm ring-1 ring-black/30" style={{ backgroundColor: r.color }} />
            {r.label}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Spawn areas mined from the game files by the ARK Wiki; Ascended data where the wiki has it. Creatures roam a little outside their areas.
      </p>
    </div>
  )
}
