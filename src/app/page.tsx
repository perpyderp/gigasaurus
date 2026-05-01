import Image from 'next/image'
import Link from 'next/link'
import {
  IconBook,
  IconApi,
  IconDeviceFloppy,
  IconCloudUpload,
  IconBrandGithub,
  IconArrowRight,
  IconSearch,
  IconChartBar,
  IconPalette,
} from '@tabler/icons-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { Separator } from '@/components/ui/separator'
import { CreatureService } from '@/services/creature'
import { ArmorService } from '@/services/armor'
import { WeaponService } from '@/services/weapon'
import { ResourceService } from '@/services/resource'

const REPO_URL = 'https://github.com/perpyderp/gigasaurus'

const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: 'Creatures',  href: '/creatures',  description: 'Browse stats, taming, breeding' },
  { label: 'Armor',      href: '/armor',      description: 'Set crafting costs and protection' },
  { label: 'Weapons',    href: '/weapons',    description: 'Damage, ammo, unlock levels' },
  { label: 'Resources',  href: '/resources',  description: 'Rarity, weight, where to find' },
]

const FEATURES: Array<{ title: string; description: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }>; cta: string }> = [
  {
    title: 'My Creatures',
    description: 'Drop in .ini exports from ShooterGame/Saved/DinoExports/. Stats, levels, breeding values, and ancestry are solved automatically. Stored in your browser — optionally backed up to your own Google Drive AppData.',
    href: '/my-creatures',
    icon: IconDeviceFloppy,
    cta: 'Manage your creatures',
  },
  {
    title: 'Stat Solver',
    description: 'Imported creatures are run through an ARK Smart Breeding-style solver: wild levels, tamed levels, and breeding value per stat — with a level-sanity check against the export.',
    href: '/my-creatures',
    icon: IconChartBar,
    cta: 'See the solver',
  },
  {
    title: 'Live Color Render',
    description: 'See your imported creature with its actual coat painted on, region-by-region — composited live from ARK Smart Breeding-style mask images.',
    href: '/my-creatures',
    icon: IconPalette,
    cta: 'View imported creatures',
  },
  {
    title: 'REST API',
    description: 'Every page on this site is backed by a public, fully-typed REST API. PokéAPI-style endpoints with interactive Scalar docs at /api/openapi.',
    href: '/api/openapi',
    icon: IconApi,
    cta: 'Read the API docs',
  },
]

export default function Home() {
  // Server-side counts for the stats strip
  const creatureCount = CreatureService.getAll({ limit: 1000 }).count
  const armorCount    = ArmorService.getAll({ limit: 1000 }).count
  const weaponCount   = WeaponService.getAll({ limit: 1000 }).count
  const resourceCount = ResourceService.getAll({ limit: 1000 }).count

  return (
    <main className="bg-background min-h-screen">
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="relative h-80 w-full sm:h-[440px]">
          <Image
            src="/images/ARKniversary.png"
            alt="ARKniversary"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="from-background/40 via-background/30 to-background absolute inset-0 bg-gradient-to-b" />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-10">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-foreground text-5xl font-bold tracking-wide drop-shadow-md sm:text-6xl">
              Gigasaurus
            </h1>
            <p className="text-foreground/90 mt-3 max-w-2xl text-base drop-shadow sm:text-lg">
              An ARK: Survival Ascended companion — browse the entire creature, armor, weapon, and resource glossary,
              import your tamed creatures from in-game export files, and explore breeding stats with a built-in solver.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/creatures" className={buttonVariants({ size: 'lg' })}>
                <IconSearch size={16} /> Browse Creatures
              </Link>
              <Link href="/my-creatures" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                <IconDeviceFloppy size={16} /> Import a Creature
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-12">
        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Creatures', value: creatureCount, href: '/creatures' },
            { label: 'Armor sets', value: armorCount, href: '/armor' },
            { label: 'Weapons', value: weaponCount, href: '/weapons' },
            { label: 'Resources', value: resourceCount, href: '/resources' },
          ].map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="text-foreground text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">{s.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* What it is */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">What is Gigasaurus?</h2>
            <Separator className="flex-1" />
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Gigasaurus is an open-source ARK: Survival Ascended companion app. It pairs a <strong className="text-foreground font-medium">browsable
            glossary</strong> of every creature, armor set, weapon, and resource with a <strong className="text-foreground font-medium">local-first
            creature manager</strong> that imports your in-game <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">.ini</code> dino
            exports, runs them through a stat solver, and renders them in their true colors.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            All game data is also exposed as a public, type-safe REST API so other tools can build on top of it.
            Imported creature data lives in your browser&apos;s IndexedDB; nothing is shared server-side
            unless you opt into Google Drive AppData backup.
          </p>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">Highlights</h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ title, description, href, icon: Icon, cta }) => (
              <Card key={title} className="hover:border-primary/50 group h-full transition-colors">
                <CardHeader>
                  <div className="text-foreground flex items-center gap-2">
                    <Icon size={18} className="text-primary" />
                    <CardTitle className="text-base">{title}</CardTitle>
                  </div>
                  <CardDescription className="leading-relaxed">{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={href}
                    className="text-primary group-hover:underline inline-flex items-center gap-1 text-sm font-medium"
                  >
                    {cta} <IconArrowRight size={14} />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick links */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">Browse the glossary</h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {QUICK_LINKS.map(({ label, href, description }) => (
              <Link key={href} href={href} className="block">
                <Card className="hover:border-primary/50 h-full transition-colors">
                  <CardContent className="space-y-1 p-4">
                    <div className="text-foreground font-semibold">{label}</div>
                    <p className="text-muted-foreground text-xs">{description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Tech / API */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">For developers</h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconApi size={18} className="text-primary" />
                  <CardTitle className="text-base">Public REST API</CardTitle>
                </div>
                <CardDescription>
                  Every page is powered by an Elysia-based REST API with full schema validation.
                  Try it interactively at <code className="bg-muted rounded px-1 font-mono text-xs">/api/openapi</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {[
                  'GET /api/creatures',
                  'GET /api/creatures/:slug',
                  'GET /api/armor',
                  'GET /api/weapons',
                  'GET /api/resources',
                ].map((row) => (
                  <div key={row} className="flex items-center justify-between">
                    <code className="text-muted-foreground font-mono">{row}</code>
                    <Badge variant="secondary" className="font-mono text-[10px]">JSON</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconBook size={18} className="text-primary" />
                  <CardTitle className="text-base">Open-source</CardTitle>
                </div>
                <CardDescription>
                  Built with Next.js 16, Elysia, Tailwind v4, shadcn/ui, and Bun.
                  All scraping scripts and creature data live in the repo — contributions welcome.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <IconBrandGithub size={14} /> Source
                </a>
                <a href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <IconBook size={14} /> Project docs
                </a>
                <Link href="/api/openapi" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <IconCloudUpload size={14} /> API reference
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
