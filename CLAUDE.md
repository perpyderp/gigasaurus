# Gigasaurus

ARK: Survival Ascended companion app. Next.js 16 (App Router, RSC) + React 19, Elysia API under `src/app/api`, Tailwind v4, shadcn (`base-nova` style on `@base-ui/react`), lucide icons. Package manager: bun.

## UI work: required skills

Any change under `src/app/**` (pages, layouts) or `src/components/**` is UI work. Load the matching skills from `.claude/skills/` before writing or reviewing that code:

| Situation | Skill |
|---|---|
| Writing, refactoring or reviewing any React/Next.js component, page, data fetching or bundle-affecting import | `vercel-react-best-practices` |
| Designing a component's API: variants, boolean props piling up, compound components, context providers | `vercel-composition-patterns` |
| Layout, color, typography, spacing, interaction, responsive or accessibility decisions | `ui-ux-pro-max` |
| A new page or a visual redesign of an existing one | `frontend-design`, then `ui-ux-pro-max` for the details |
| Finishing a UI change, or when asked to review/audit UI | `web-design-guidelines` against the changed files |

### Precedence when skills disagree

1. **The existing design system wins.** Colors, radii and fonts come from the tokens in `src/app/globals.css` (`--font-ark` is the brand font) and the primitives in `src/components/ui/`. Extend these; don't introduce parallel palettes, fonts or one-off components.
2. `frontend-design` sets direction only for genuinely new surfaces or an explicit redesign request. It doesn't override established styling on routine edits.
3. `ui-ux-pro-max` design-system output (`--design-system`) is advisory here. Don't `--persist` a `design-system/` folder unless asked.
4. React correctness and performance rules (`vercel-react-best-practices`) beat stylistic preferences.

### Project conventions the skills should respect

- Server Components by default; add `'use client'` only where state, effects or browser APIs are needed.
- Add shadcn primitives with the shadcn CLI (`components.json` aliases: `@/components/ui`, `@/lib/utils`) rather than hand-rolling them.
- Icons: `lucide-react` (configured `iconLibrary`).
- Dark mode is class-based via `next-themes` (`@custom-variant dark`). Every UI change must work in both themes.
