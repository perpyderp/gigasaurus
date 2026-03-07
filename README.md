# Gigasaurus

![Gigasaurus](docs/images/gigasaurus%20banner.png)

An ARK: Survival Ascended companion app. Browse game data through a REST API, manage your tamed creatures with local storage, and optionally sync to Google Drive — all without a server-side account.

## Features

### REST API
A fully documented REST API powered by [Elysia](https://elysiajs.com/) with Scalar UI docs at `/api/openapi`.

- **Creatures** — 72 creatures (dinosaurs + fantasy) with stats, saddle info, and dossier images
- **Armor** — 9 armor sets with per-piece and full-set ingredient costs
- **Weapons** — 13 weapons with damage, durability, and crafting requirements
- **Resources** — 16 resources with descriptions and stack sizes

Query params: `?category=`, `?limit=`, `?offset=`

### My Creatures
Import your tamed dino export files (`.ini`) directly from ARK and manage them in your browser.

- Drag-and-drop `.ini` export files from `ShooterGame/Saved/DinoExports/`
- View stats, colors, ancestry, imprint quality, and mutations
- Rename creatures, re-import updated exports, or delete entries
- All data stored locally in **IndexedDB** — no account needed

### Google Drive Sync *(optional)*
Back up and restore your creature collection using your own Google Drive AppData folder. No data is shared or stored server-side.

- Sign in with Google using the Identity Services SDK
- Backup exports as a single JSON file in your Drive AppData
- Restore on any device with the same Google account

---

## Setup

### Prerequisites
- [Bun](https://bun.sh/) runtime

### Install

```bash
bun install
```

### Google Drive Sync (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Web application)
4. Add your domain to Authorized JavaScript Origins (e.g. `http://localhost:3000`)
5. Copy the Client ID into `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here
```

### Run

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Reference

Full interactive docs at `/api/openapi`.

| Endpoint | Description |
|---|---|
| `GET /api/creatures` | List all creatures |
| `GET /api/creatures/:slug` | Get a single creature |
| `GET /api/armor` | List all armor sets |
| `GET /api/armor/:slug` | Get a single armor set |
| `GET /api/weapons` | List all weapons |
| `GET /api/weapons/:slug` | Get a single weapon |
| `GET /api/resources` | List all resources |
| `GET /api/resources/:slug` | Get a single resource |

---

## Tech Stack

- [Next.js 16](https://nextjs.org/) + React 19 + TypeScript
- [Elysia v1](https://elysiajs.com/) — API framework
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [idb](https://github.com/jakearchibald/idb) — IndexedDB (creature storage)
- [Google Identity Services](https://developers.google.com/identity) — OAuth for Drive sync

---

![ARKniversary](docs/images/ARKniversary.png)
