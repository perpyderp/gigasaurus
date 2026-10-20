import Image from 'next/image'
import Link from 'next/link'
import { Upload, Github, BookOpen, Braces } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { GlobalSearch, type SearchEntry } from '@/components/GlobalSearch'
import { CreatureService } from '@/services/creature'
import { ArmorService } from '@/services/armor'
import { WeaponService } from '@/services/weapon'
import { ResourceService } from '@/services/resource'

const REPO_URL = 'https://github.com/perpyderp/gigasaurus'

const IMPORT_STEPS = [
  {
    title: 'Export from ARK',
    body: 'Open a creature’s options wheel in game and choose Export. ARK writes an .ini file to ShooterGame/Saved/DinoExports.',
  },
  {
    title: 'Drop the files here',
    body: 'Drag in one export or a whole folder. Point Gigasaurus at the folder once and it picks up new exports while the tab is open.',
  },
  {
    title: 'Read the real numbers',
    body: 'Wild and tamed levels per stat, breeding values, mutations, imprint and the creature in its actual colors.',
  },
]

export default function Home() {
  const creatures = CreatureService.getAll({ limit: 1000 }).results
  const armor = ArmorService.getAll({ limit: 1000 }).results
  const weapons = WeaponService.getAll({ limit: 1000 }).results
  const resources = ResourceService.getAll({ limit: 1000 }).results
  const creatureCount = creatures.length
  const armorCount = armor.length
  const weaponCount = weapons.length
  const resourceCount = resources.length

  // Creatures have their own pages; the other glossaries open filtered to the picked item.
  const searchEntries: SearchEntry[] = [
    ...creatures.map((c) => ({ name: c.name, kind: 'Creature' as const, href: `/creatures/${c.slug}`, image: c.image })),
    ...armor.map((a) => ({ name: a.set_name, kind: 'Armor' as const, href: `/armor?q=${encodeURIComponent(a.set_name)}`, image: a.image })),
    ...weapons.map((w) => ({ name: w.name, kind: 'Weapon' as const, href: `/weapons?q=${encodeURIComponent(w.name)}`, image: w.image })),
    ...resources.map((r) => ({ name: r.name, kind: 'Resource' as const, href: `/resources?q=${encodeURIComponent(r.name)}`, image: r.image })),
  ]

  const items = [
    { href: '/armor', label: 'Armor', count: armorCount, noun: 'sets', image: '/images/armor/riot.png', blurb: 'Armor rating, cold and heat protection, full-set cost.' },
    { href: '/weapons', label: 'Weapons', count: weaponCount, noun: 'weapons', image: '/images/weapons/longneck_rifle.png', blurb: 'Damage, ammo and the level you unlock them.' },
    { href: '/resources', label: 'Resources', count: resourceCount, noun: 'resources', image: '/images/resources/element.png', blurb: 'Weight, stack size and where to farm them.' },
  ]

  return (
    <main>
      {/* Hero: the ARKniversary mural is the subject itself; search suggests from every glossary and falls back to the creature list. */}
      <section className="relative isolate flex min-h-[560px] items-end overflow-hidden bg-plate sm:min-h-[min(78vh,760px)]">
        <Image
          src="/images/ARKniversary.png"
          alt="Hundreds of ARK creatures gathered around a river, from a Giganotosaurus to a Mosasaurus"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_35%]"
        />
        <div className="from-background via-background/70 absolute inset-0 -z-10 bg-gradient-to-t to-transparent" />
        <div className="from-background/80 absolute inset-0 -z-10 bg-gradient-to-r via-transparent to-transparent" />

        <div className="mx-auto w-full max-w-7xl px-4 pt-32 pb-12 sm:pb-16">
          <h1 className="font-display text-foreground text-[clamp(3.5rem,12vw,9.5rem)] leading-[0.85] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
            Gigasaurus
          </h1>
          <p className="text-foreground/90 mt-5 max-w-xl text-lg leading-relaxed sm:text-xl">
            Look up any creature, armor set, weapon or resource in ARK: Survival Ascended, and keep tabs on your own tames.
          </p>

          <GlobalSearch entries={searchEntries} />
          <p className="text-muted-foreground mt-3 text-sm">
            Or{' '}
            <Link href="/my-creatures" className="text-foreground font-medium underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
              import your creatures
            </Link>{' '}
            from in-game exports.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 py-14 sm:py-20">
        {/* Glossary index */}
        <section aria-labelledby="browse-heading" className="space-y-6">
          <h2 id="browse-heading" className="font-display text-3xl sm:text-4xl">Browse the glossary</h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-5">
            <Link
              href="/creatures"
              className="group bg-card ring-border hover:ring-primary/70 flex flex-col overflow-hidden rounded-xl ring-1 transition-shadow col-span-3 lg:col-span-2"
            >
              <div className="bg-plate relative aspect-[3/2] overflow-hidden">
                <Image
                  src="/images/creatures/giganotosaurus.png"
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 520px"
                  className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 items-end justify-between gap-4 p-5">
                <div>
                  <p className="font-display group-hover:text-primary text-2xl transition-colors">Creatures</p>
                  <p className="text-muted-foreground mt-1 text-sm">Dossiers, base stats, taming food, breeding timers.</p>
                </div>
                <p className="text-right">
                  <span className="block text-3xl font-semibold tabular-nums">{creatureCount}</span>
                  <span className="text-muted-foreground text-xs">species</span>
                </p>
              </div>
            </Link>

            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group bg-card ring-border hover:ring-primary/70 flex flex-col rounded-xl p-2.5 ring-1 transition-shadow sm:p-4"
              >
                <div className="slot relative aspect-square rounded-lg">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 220px"
                    className="object-contain p-[16%] drop-shadow-[0_6px_8px_rgba(0,0,0,0.4)] transition-transform duration-300 motion-safe:group-hover:scale-105"
                  />
                </div>
                <div className="mt-3 flex flex-col gap-0.5 sm:mt-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <p className="font-display group-hover:text-primary text-lg transition-colors sm:text-2xl">{item.label}</p>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    <span className="text-foreground font-semibold">{item.count}</span> {item.noun}
                  </p>
                </div>
                <p className="text-muted-foreground mt-1 hidden text-sm sm:block">{item.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* My Creatures: the import flow is a real sequence, so it is numbered. */}
        <section aria-labelledby="tames-heading" className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <h2 id="tames-heading" className="font-display text-3xl sm:text-4xl">Track your tames</h2>
            <p className="text-muted-foreground mt-4 max-w-md text-[17px] leading-relaxed">
              See exactly where a creature&apos;s points went before you breed it. Everything stays in your browser. Back it up to your own Google Drive if you want it on another PC.
            </p>
            <Link href="/my-creatures" className={buttonVariants({ size: 'lg', className: 'mt-6 h-11 px-5 text-base' })}>
              <Upload aria-hidden /> Import creatures
            </Link>
          </div>
          <ol className="divide-border border-border divide-y border-y">
            {IMPORT_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-5 py-5">
                <span className="font-display text-primary w-8 shrink-0 text-3xl leading-none tabular-nums">{i + 1}</span>
                <div>
                  <p className="text-lg font-semibold">{step.title}</p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Developers: compact, secondary audience. */}
        <section aria-labelledby="api-heading" className="bg-card ring-border flex flex-col gap-6 rounded-xl p-6 ring-1 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 id="api-heading" className="text-lg font-semibold">Building a tool or a Discord bot?</h2>
            <p className="text-muted-foreground mt-1">
              All of this data is a free JSON API, for example{' '}
              <Link href="/api/creatures/rex" className="text-foreground font-mono text-sm underline-offset-4 hover:underline">
                /api/creatures/rex
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/api/openapi" className={buttonVariants({ variant: 'outline' })}>
              <Braces aria-hidden /> API reference
            </Link>
            <a href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline' })}>
              <BookOpen aria-hidden /> Docs
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline' })}>
              <Github aria-hidden /> Source
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
