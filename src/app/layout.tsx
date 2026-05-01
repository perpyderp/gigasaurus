import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Link from 'next/link'
import Image from 'next/image'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

const arkFont = localFont({
  src: './fonts/ARK-Regular.ttf',
  variable: '--font-ark',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gigasaurus',
  description: 'ARK: Survival Ascended companion — creatures, armor, weapons, resources.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${arkFont.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NuqsAdapter>
            <TooltipProvider>
              <nav className="bg-background/80 sticky top-0 z-10 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
                  <Link href="/" className="flex items-center gap-2">
                    <Image src="/giga-glasses.png" alt="Gigasaurus" width={28} height={28} className="rounded-sm" />
                    <span className="text-foreground text-lg font-semibold tracking-wide">Gigasaurus</span>
                  </Link>
                  <Separator orientation="vertical" className="h-5" />
                  <Link
                    href="/creatures"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Creatures
                  </Link>
                  <Link
                    href="/armor"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Armor
                  </Link>
                  <Link
                    href="/weapons"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Weapons
                  </Link>
                  <Link
                    href="/resources"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Resources
                  </Link>
                  <Link
                    href="/my-creatures"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    My Creatures
                  </Link>
                  <div className="ml-auto flex items-center gap-2">
                    <Link
                      href="/api/openapi"
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      API Docs
                    </Link>
                    <ThemeToggle />
                  </div>
                </div>
                <Separator />
              </nav>
              <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </div>
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  )
}
