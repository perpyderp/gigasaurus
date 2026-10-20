import Image from 'next/image'
import Link from 'next/link'
import { MapService } from '@/services/map'
import { GlossaryHeader } from '@/components/Glossary'

export const metadata = {
  title: 'ARK Maps: Interactive Spawn & Resource Maps',
  description: 'Interactive ARK: Survival Ascended maps for The Island, The Center, Scorched Earth, Ragnarok, Aberration, Extinction, Valguero, Genesis, Crystal Isles, Lost Island, Fjordur, Astraeos and Lost Colony with creature spawns, resources and caves.',
  alternates: { canonical: '/maps' },
}

export default function MapsPage() {
  const { results } = MapService.getAll()

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <GlossaryHeader
        title="Maps"
        summary="Where every creature spawns and where to find metal, crystal, oil and the rest, map by map. Open one and pick a creature or resource."
      />

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((m, i) => (
          <li key={m.slug}>
            <Link href={`/maps/${m.slug}`} className="group block rounded-lg">
              <div className="bg-plate ring-border group-hover:ring-primary/70 relative aspect-square overflow-hidden rounded-lg ring-1 transition-shadow">
                {m.image && (
                  <Image
                    src={m.image}
                    alt=""
                    fill
                    priority={i < 4}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
                    className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <p className="font-display group-hover:text-primary mt-2 px-0.5 text-[19px] leading-tight transition-colors">
                {m.name}
              </p>
              <p className="text-muted-foreground px-0.5 text-sm">
                {m.creature_count} creatures, {m.resource_count} resource layers
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
