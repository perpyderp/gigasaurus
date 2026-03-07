import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-20 space-y-12">

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Gigasaurus
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl">
            An ARK: Survival Ascended companion. Browse game data through the API,
            or manage your own tamed creatures locally.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/my-creatures"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-emerald-500 transition-colors space-y-2 block"
          >
            <div className="text-3xl">🦕</div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">My Creatures</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Import creature export files from ARK, track stats, mutations, and colors.
              Stored locally — optionally synced to Google Drive.
            </p>
          </Link>

          <Link
            href="/api/openapi"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-emerald-500 transition-colors space-y-2 block"
          >
            <div className="text-3xl">📖</div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">API Docs</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              PokéAPI-style REST API for creatures, armor, weapons, and resources.
              Interactive Scalar documentation.
            </p>
          </Link>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Quick API Links</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Creatures', href: '/api/creatures' },
              { label: 'Armor', href: '/api/armor' },
              { label: 'Weapons', href: '/api/weapons' },
              { label: 'Resources', href: '/api/resources' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
