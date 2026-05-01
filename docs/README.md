# Gigasaurus Docs

Project documentation for contributors.

## Contents

- [Testing](./testing.md) — how to run the suite (`bun test`), what each spec covers, and patterns for adding new tests.
- [Data Models](./data-models.md) — JSON schemas for creatures, armor, weapons, and resources, plus rules for adding or modifying entries.
- [Stat Solver](./stat-solver.md) — canonical ARK stat formula, the inverse-solver approach, imprint multipliers per stat, breeding/max-potential math.
- [DinoExport Format](./dinoexport-format.md) — legacy `DinoExport_NNN.ini` file structure and what each section means.

## See also

- The top-level [README](../README.md) for setup and the high-level feature list.
- Live API docs at `/api/openapi` (Scalar UI) when running `bun dev`.
- Schema source-of-truth in [`src/schemas/`](../src/schemas/).
