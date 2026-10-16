'use client'

/**
 * Preview cards for list items. Creatures are links to a species page, so they
 * get a hover/focus preview card. Armor, weapons and resources have no page of
 * their own, so their tile is a button that opens the same summary on hover,
 * tap or keyboard — crafting costs stay reachable on phones.
 */

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import type { CreatureDetail } from '@/schemas/creature'
import type { ArmorDetail } from '@/schemas/armor'
import type { WeaponDetail } from '@/schemas/weapon'
import type { ResourceDetail } from '@/schemas/resource'

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground text-right font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-border mt-3 border-t pt-3">
      <p className="text-muted-foreground mb-1.5 text-xs font-medium">{title}</p>
      {children}
    </div>
  )
}

function Header({ image, title, tags }: { image: string | null; title: string; tags: string[] }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {image && (
        <div className="slot relative size-12 shrink-0 rounded-md">
          <Image src={image} alt="" fill className="object-contain p-1.5" sizes="48px" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-display truncate text-lg leading-tight">{title}</p>
        {tags.length > 0 && <p className="text-muted-foreground mt-0.5 text-xs first-letter:uppercase">{tags.join(', ')}</p>}
      </div>
    </div>
  )
}

function Ingredients({ items }: { items: { name: string; quantity: number }[] }) {
  if (!items.length) return null
  return (
    <Section title="Crafting cost">
      <ul className="space-y-1">
        {items.map((ing, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground truncate">{ing.name}</span>
            <span className="text-primary shrink-0 font-semibold tabular-nums">{ing.quantity.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function ItemPopover({ label, children, content }: { label: string; children: ReactNode; content: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={`${label} details`}
        className="block h-full w-full rounded-lg text-left"
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={10} collisionPadding={12} className="isolate z-50">
          <Popover.Popup className="bg-popover text-popover-foreground border-border data-starting-style:opacity-0 data-ending-style:opacity-0 w-72 rounded-lg border p-4 shadow-xl outline-none transition-opacity duration-150">
            {content}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ─── Creature ────────────────────────────────────────────────────────────────

export function CreatureHoverCard({ creature, children }: { creature: CreatureDetail; children: ReactNode }) {
  const bs = creature.base_stats_growth
  const stat = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString())
  const traits = [
    creature.tameable && 'Tameable',
    creature.rideable && 'Rideable',
    creature.breedable && 'Breedable',
  ].filter(Boolean) as string[]
  return (
    <HoverCard>
      <HoverCardTrigger render={<div className="h-full" />}>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72 p-4">
        <Header
          image={null}
          title={creature.name}
          tags={[creature.diet ?? creature.dossier?.diet, creature.dossier?.temperament].filter(Boolean) as string[]}
        />
        <dl className="space-y-1">
          <Row label="Health" value={stat(bs.health?.base)} />
          <Row label="Stamina" value={stat(bs.stamina?.base)} />
          <Row label="Melee" value={stat(bs.melee?.base)} />
          <Row label="Weight" value={stat(bs.weight?.base)} />
        </dl>
        {traits.length > 0 && (
          <Section title="Can be">
            <p className="text-sm">{traits.join(', ')}</p>
          </Section>
        )}
        <Section title="Found on">
          <p className="text-sm leading-snug">
            {creature.maps && creature.maps.length ? creature.maps.join(', ') : 'No known spawn maps'}
          </p>
        </Section>
      </HoverCardContent>
    </HoverCard>
  )
}

// ─── Armor ───────────────────────────────────────────────────────────────────

export function ArmorHoverCard({ armor, children }: { armor: ArmorDetail; children: ReactNode }) {
  return (
    <ItemPopover
      label={armor.set_name}
      content={
        <>
          <Header
            image={armor.image}
            title={armor.set_name}
            tags={[armor.unlock_level !== null ? `Unlocks at level ${armor.unlock_level}` : 'Tekgram']}
          />
          <dl className="space-y-1">
            <Row label="Armor rating" value={armor.armor_rating} />
            <Row label="Cold protection" value={armor.cold_protection} />
            <Row label="Heat protection" value={armor.heat_protection} />
            <Row label="Weight" value={armor.weight} />
            {armor.durability !== null && <Row label="Durability" value={armor.durability} />}
          </dl>
          <Ingredients items={armor.set_ingredients} />
        </>
      }
    >
      {children}
    </ItemPopover>
  )
}

// ─── Weapon ──────────────────────────────────────────────────────────────────

export function WeaponHoverCard({ weapon, children }: { weapon: WeaponDetail; children: ReactNode }) {
  return (
    <ItemPopover
      label={weapon.name}
      content={
        <>
          <Header image={weapon.image} title={weapon.name} tags={[weapon.category]} />
          <dl className="space-y-1">
            {weapon.damage !== null && <Row label="Damage" value={weapon.damage} />}
            {weapon.ammo_type && <Row label="Ammo" value={weapon.ammo_type} />}
            <Row label="Unlocks at" value={weapon.unlock_level !== null ? `Level ${weapon.unlock_level}` : 'Tekgram'} />
          </dl>
          <Ingredients items={weapon.ingredients} />
        </>
      }
    >
      {children}
    </ItemPopover>
  )
}

// ─── Resource ────────────────────────────────────────────────────────────────

export function ResourceHoverCard({ resource, children }: { resource: ResourceDetail; children: ReactNode }) {
  const flags = [
    resource.renewable && 'Renewable',
    resource.refinable && 'Refinable',
    resource.combustible && 'Combustible',
  ].filter(Boolean) as string[]
  return (
    <ItemPopover
      label={resource.name}
      content={
        <>
          <Header image={resource.image} title={resource.name} tags={[resource.rarity, ...flags]} />
          <dl className="space-y-1">
            <Row label="Weight" value={resource.weight} />
            <Row label="Stack size" value={resource.stack_size.toLocaleString()} />
          </dl>
          {resource.found_in.length > 0 && (
            <Section title="Where to find it">
              <p className="text-sm leading-snug">{resource.found_in.join(', ')}</p>
            </Section>
          )}
        </>
      }
    >
      {children}
    </ItemPopover>
  )
}
