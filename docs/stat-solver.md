# Stat Solver — Reference

This document is the canonical reference for ARK's stat math as implemented in [src/lib/ark-stat-solver/](../src/lib/ark-stat-solver/). It exists so we don't have to re-derive the formula from scratch every time a bug surfaces.

> **The authoritative deep-dive now lives in the `ark-stat-calculation` skill**
> (`.claude/skills/ark-stat-calculation/`), which documents how ARKStatsExtractor
> computes and extracts stats. The preferred solver path is `extractor.ts` +
> `data/ase-species.json` (ASE-derived species data, regenerate with
> `bun scripts/extract-ase-species.ts`); the wiki-scraped params described below
> remain only as a fallback for species missing from that data.

## The canonical forward formula

Source: [ark.wiki.gg/wiki/Creature_stats_calculation](https://ark.wiki.gg/wiki/Creature_stats_calculation).

```
V = (B × (1 + Lw × Iw × IwM) × TBHM × (1 + IB × 0.2 × IBM) + Ta × TaM)
    × (1 + TE × Tm × TmM)
    × (1 + Ld × Id × IdM)
```

| Symbol | Meaning |
| --- | --- |
| `V`    | Final stat value (the post-tame, post-level value the game/`.ini` reports) |
| `B`    | Species base value for this stat |
| `Lw`   | Wild levels assigned to this stat (player + mutation) |
| `Iw`   | Wild-level increase as a fraction of `B` |
| `IwM`  | Server multiplier for wild levels (default `1.0`) |
| `TBHM` | Tamed-base-health multiplier — usually `1.0`; ≠ 1 only on a few species' Health |
| `IB`   | Imprinting bonus (`0–1`; only set for bred creatures) |
| `IBM`  | Per-stat imprint scale (1.0 for stats that imprint, **0.0 for Oxygen / Food**) |
| `Ta`   | Additive taming bonus (in absolute units, can be negative) |
| `TaM`  | Server multiplier on additive taming bonus (default `1.0`) |
| `TE`   | Taming effectiveness (`0–1`; `1.0` for bred) |
| `Tm`   | Multiplicative taming bonus (fraction) |
| `TmM`  | Server multiplier on multiplicative taming bonus (default `1.0`) |
| `Ld`   | Dom levels (post-tame player-allocated) |
| `Id`   | Dom-level increase as a fraction of post-tame value |
| `IdM`  | Server multiplier for dom levels (default `1.0`) |

In our solver we currently assume `IwM = TBHM = IBM = TaM = TmM = IdM = 1.0` (vanilla). Server-multiplier support is a future addition.

## Order of operations

1. Wild-level scale: `B × (1 + Lw × Iw)`
2. Tamed-base-health multiplier: `× TBHM`
3. Imprint bonus: `× (1 + IB × 0.2 × IBM)` — applies **only to** the `B × (...) × TBHM` term, not to `Ta`
4. Additive taming bonus: `+ Ta`
5. Multiplicative taming bonus + TE: `× (1 + TE × Tm)`
6. Dom-level scale: `× (1 + Ld × Id)`

## Inverting the formula (the solver)

Given an observed value `V` and species params, we want `(Lw, Ld, TE)`. With imprint, mutations, and TE bookkeeping:

For each candidate `Ld ∈ [0, 88]` and each candidate `TE` (when `Tm > 0`):

```
Lw = ((V / ((1 + TE·Tm) · (1 + Ld·Id)) − Ta) / (B · (1 + IB·0.2·IBM)) − 1) / Iw
```

We accept `(Lw, Ld, TE)` whose `Lw` is a non-negative integer within `INT_TOLERANCE`. Multiple solutions may exist when `Tm > 0` (TE is unknown); we return the first hit found, scanning TE from `1.0 → 0.0`.

## Imprint multipliers per stat

ARK does **not** apply the +20% imprint bonus to every stat, and there is no
hardcoded 0.2 in the game — the scale lives in a per-species array
(`statImprintMult` in ASE's values.json). The ASE defaults, expressed as `IBM`
in the formula above (`IBM = statImprintMult / 0.2`):

| Stat            | `IBM` |
| --- | --- |
| Health          | 1.0 |
| Stamina         | **0.0** |
| Oxygen          | **0.0** |
| Food            | 1.0 |
| Water           | 1.0 |
| Temperature     | 0.0 |
| Weight          | 1.0 |
| Melee Damage    | 1.0 |
| Movement Speed  | 1.0 (forced 0 when speed leveling is disabled — ASA default, ASE flyers) |
| Torpidity       | 1.0 |
| Fortitude       | 0.0 |
| Crafting Skill  | 0.0 |

**Stamina and Oxygen never imprint; Food and Torpidity DO.** (An earlier
version of this table claimed Stamina imprints and Food doesn't — that was
wrong and made imprinted extractions disagree with ARKStatsExtractor.)
Some species override the array entirely (e.g. ASA Ceratosaurus zeroes Speed).

## Mutation levels

Modern ARK's wild-level scale is `Lw_total = Lw_wild + Lmut × 2` — each mutation adds 2 stat points to the same `Iw` scale. The .ini export records totals per parent (`RandomMutationsMale + RandomMutationsFemale`) but **not per stat**. ASE infers per-stat mutations by comparing parent stat lines, which we don't currently track.

For our purposes:
- `solveStat` returns a combined `wild` count that includes any mutated levels.
- Total mutations on the creature are surfaced separately as a badge.
- A "true" Lw vs Lmut split needs parent stat data — out of scope for the legacy DinoExport format.

## Breeding value

```
Vbreed = B × (1 + Lw × Iw)
```

The value a baby would inherit from this creature for this stat — strips out taming bonuses, imprint, and dom levels, keeping only the wild contribution. Same units as the observed value.

## Max potential

```
Vmax = V × (1 + 88 × Id) / (1 + Ld × Id)
```

What this stat would be at full dom levels (88 in vanilla ASA), holding wild, TE, and imprint constant. Useful for evaluating breeding stock — answers "if I level this creature fully here, where does it cap?"

## Unit conventions in our scraped data

The wiki's "Base Stats and Growth" table is inconsistent across creatures. Our `data/creatures/<slug>.json` files therefore have inconsistent storage for `taming_bonus.additive`:

- Some creatures store it as a **fraction of base** (e.g., Achatina HP: `0.07` for "+7%").
- Some store it as the **raw absolute delta** (e.g., Griffin HP: `-450` or `-900`).

`buildStatParams` disambiguates by magnitude:

```
ta = |ta_frac| > 1 ? ta_frac : ta_frac × wikiBase
```

Long-term the right fix is to re-scrape and normalize, but the heuristic covers both cases. See `params.ts` for the details.

## Stat units in `.ini` exports

The `Max Character Status Values` section reports **final post-tame, post-level** values:

- Absolute stats (Health, Stamina, Oxygen, Food, Water, Weight, Torpidity, Temperature): raw HP/etc., e.g. `Health=5060`.
- Multiplier stats (Melee Damage, Movement Speed, Fortitude, Crafting Skill) are
  stored as **`multiplier − 1`** (the bonus fraction): `Melee Damage=0.85` means
  185%. `ark-parser.ts` adds 1 on parse so stored values are full multipliers
  (`1.0 = 100%`). (An earlier version of this doc claimed the file stores the
  full multiplier — wrong, and the source of melee/speed levels being off.)
- Key names in this section are **localized** — parse the 12 stats by position,
  not by name (file order: Health, Stamina, Torpidity, Oxygen, Food, Water,
  Temperature, Weight, Melee Damage, Movement Speed, Fortitude, Crafting Skill).

There is no per-stat level breakdown in the legacy export — the solver back-derives it.

## Sanity check: the level identity

```
creature.level == 1 + Σ(Lw across non-torpidity stats) + Σ(Ld across all stats)
```

Torpidity's wild count mirrors the total wild distribution (you can't level it manually), so it's excluded from the sum. `summarizeLevels()` exposes this delta — non-zero deltas usually mean (a) non-vanilla server multipliers, (b) scraped wiki data is off, or (c) we need a TBHM/ETHM entry the species needs and we don't have.

## References

- ARK Wiki — Creature Stats Calculation: <https://ark.wiki.gg/wiki/Creature_stats_calculation>
- ARK Wiki — Leveling: <https://ark.wiki.gg/wiki/Leveling>
- ASE source (dev branch): <https://github.com/cadon/ARKStatsExtractor/tree/dev>
- DodoDex — How creature levels work: <https://help.dododex.com/en/article/how-creature-levels-work-in-ark-survival-evolved>

When the solver disagrees with reality, start here and walk through which formula factor is unaccounted for.
