import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const API_LINKS = [
  { label: 'Creatures', href: '/api/creatures' },
  { label: 'Armor', href: '/api/armor' },
  { label: 'Weapons', href: '/api/weapons' },
  { label: 'Resources', href: '/api/resources' },
]

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      {/* Hero */}
      <div className="relative h-72 w-full overflow-hidden sm:h-96">
        <Image
          src="/images/ARKniversary.png"
          alt="ARKniversary"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-background" />
        <div className="absolute bottom-8 left-0 right-0 px-4 text-center">
          <h1 className="text-foreground drop-shadow-lg text-5xl font-bold tracking-wide sm:text-6xl">
            Gigasaurus
          </h1>
          <p className="text-foreground/80 drop-shadow mt-2 text-sm sm:text-base">
            Your ARK: Survival Ascended companion
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {/* Feature cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/my-creatures" className="block">
            <Card className="hover:border-primary/50 h-full transition-colors">
              <CardHeader>
                <div className="text-3xl">🦕</div>
                <CardTitle>My Creatures</CardTitle>
                <CardDescription>
                  Import creature export files from ARK, track stats, mutations, colors, and ancestry.
                  Stored locally in your browser — optionally synced to Google Drive.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/api/openapi" className="block">
            <Card className="hover:border-primary/50 h-full transition-colors">
              <CardHeader>
                <div className="text-3xl">📖</div>
                <CardTitle>API Docs</CardTitle>
                <CardDescription>
                  PokéAPI-style REST API for creatures, armor, weapons, and resources.
                  Interactive Scalar documentation.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Quick API links */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Quick API Links</p>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {API_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className="block">
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <span className="font-mono text-sm">{label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">GET</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
