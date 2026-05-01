# DinoExport `.ini` Format — Reference

ARK lets you export a tamed creature's stats to a flat-file via the in-game `cheat saveplayer` / export gun. This document describes the **legacy** format produced into `ShooterGame/Saved/DinoExports/DinoExport_NNNNN.ini`. (Modern ASA "Export Gun" output is a separate JSON-ish format we don't currently parse.)

Our parser lives in [src/lib/ark-parser.ts](../src/lib/ark-parser.ts).

## File structure

A Windows `.ini` with custom sections:

```ini
[Dino Data]
DinoName=Mistral
DinoNameTag=Griffin
DinoClass=Griffin_Character_BP_C
bIsFemale=False
bNeutered=False
TamedName=
TribeName=
TamerString=
ImprinterName=
DinoID1=2376510412
DinoID2=918887153
CharacterLevel=210
BabyAge=1.000000
DinoImprintingQuality=0.000000
RandomMutationsMale=0
RandomMutationsFemale=0

[Colorization]
ColorSet[0]=(R=0.479320,G=0.000000,B=0.051269,A=0.000000)
... up to ColorSet[5]

[Max Character Status Values]
Health=5060.000000
Stamina=...
Torpidity=...
Oxygen=...
Food=...
Water=...
Temperature=...
Weight=...
Melee Damage=1.500000
Movement Speed=1.000000
Fortitude=...
Crafting Skill=...

[Dino Ancestry]
... (ancestor metadata)

[DinoAncestors]
DinoAncestors0=MaleName=...;MaleDinoID1=...;FemaleName=...;...
DinoAncestors1=...
...

[DinoAncestorsMale]
DinoAncestorsMale0=...
...
```

## Key fields

### `[Dino Data]`

| Key | Meaning | Notes |
| --- | --- | --- |
| `DinoNameTag` | Short species tag (e.g. `Griffin`, `RexAA`) | The `AA` suffix on some tags marks ASA variants. |
| `DinoClass` | Full blueprint class path | Used for cross-referencing internal entity IDs. |
| `bIsFemale` | `True` / `False` | Determines colour-trail in some species. |
| `bNeutered` | Sterilized flag | Disables breeding. |
| `TamedName` | Player-given nickname | May be empty. |
| `CharacterLevel` | Total level = `1 + ΣLw + ΣLd` | Useful for the level-sanity check. |
| `BabyAge` | `0–1`, `1` = adult | < 1 means the creature is still maturing. |
| `DinoImprintingQuality` | Imprint % as `0–1` | `0.85` = 85% imprint. Bred creatures only. |
| `RandomMutationsMale` / `Female` | Total mutations from each parent | Per-stat split is **not** stored. |
| `DinoID1` / `DinoID2` | Two halves of the unique 64-bit ARK ID | Combine via [src/lib/ark-id.ts](../src/lib/ark-id.ts). |

### `[Colorization]`

Six colour slots (`ColorSet[0]` through `ColorSet[5]`), each storing `(R=…,G=…,B=…,A=…)` in **linear float** space.

`A=1.0` means the slot is unused — ARK's encoding for "no paint here". Empty slots get the species default colour at render time.

### `[Max Character Status Values]`

Final post-tame, post-level stat values. ASE reads these in a fixed order (no labels):

`Health, Stamina, Torpidity, Oxygen, Food, Water, Temperature, Weight, Melee Damage, Movement Speed, Fortitude, Crafting Skill`

- **Absolute stats** (everything except Melee Damage / Movement Speed): raw values in game units (e.g. `Health=5060.000000`).
- **Multiplier stats** (Melee Damage, Movement Speed): full multiplier where `1.0 = 100%` (e.g. `Melee Damage=1.5` for 150%).

These values are what the **stat solver** has to invert into `(Lw, Ld)` — see [stat-solver.md](./stat-solver.md). The legacy export does **not** include per-stat wild/dom/mutation counts.

### `[Dino Ancestry]` / `[DinoAncestors]` / `[DinoAncestorsMale]`

Generation-by-generation parent records. Each row is a semicolon-separated key-value list:

```
MaleName=Rex - Lvl 202;MaleDinoID1=371375654;MaleDinoID2=158510339;FemaleName=Rex - Lvl 209;…
```

- `DinoAncestors0` — direct parents (creature's mother + father)
- `DinoAncestors1` — mother's parents
- `DinoAncestors2` — mother's mother's parents
- `DinoAncestorsMale0` — father's parents
- `DinoAncestorsMaleN` — paternal-line ancestors `N` generations back

Maximum depth is 3 generations (8 great-grandparents). Stats of ancestors are **not** recorded — only names and IDs.

## Edge cases

- **Wild creatures** can also be exported but have no `TamedName` and `BabyAge=0`. Treat them as untamed for stat solving (no Ta, no dom levels).
- **Bred creatures** have `DinoImprintingQuality > 0` *or* a populated `DinoAncestors` — either flag is sufficient to set TE = 1.0 in the solver.
- **Empty colour slots**: `ColorSet[i]=(R=0.000000,G=0.000000,B=0.000000,A=1.000000)` — recognise `A=1.0` and skip.
- **Server-side multipliers** (e.g. `PerLevelStatsMultiplier_Dino*`): not stored in the export. If the user is on a non-vanilla server, the solver's output drifts.

## Parsing summary

1. Read text, split into sections by `[…]` headers.
2. For each section, key=value lines into a `Record<string, string>`.
3. Convert types (parse floats / ints / booleans).
4. Normalise colours (linear → sRGB for display) — see [creature-colorize.ts](../src/lib/creature-colorize.ts).
5. Run stat solver against species-data from the wiki API to recover Lw / Ld.

That's the whole flow.
