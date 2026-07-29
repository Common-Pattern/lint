# @common-pattern/biome-plugins

Shared [GritQL](https://docs.grit.io/language/overview) plugins for [Biome](https://biomejs.dev).

Conventions that are easy to state and easy to forget. Writing one down helps
for a while; a linter is the version that still works in six months, and in
code nobody remembers writing.

MIT licensed, and not specific to any one codebase — each plugin encodes a
mistake that is general to JavaScript and TypeScript, with the reasoning in a
comment at the top of the file.

## Why Biome plugins rather than ESLint rules

Two practical reasons, both learned the hard way:

1. **They run where the linting actually happens.** In a monorepo where each
   package's `lint` script is `biome check`, an ESLint rule only runs in the
   packages that separately invoke ESLint — which may be none of the ones you
   care about. Check what your CI runs before choosing where a rule lives. A
   rule that is never executed looks exactly like a rule that always passes.
2. **A GritQL pattern is a code snippet.** `` `$x.toISOString().slice($_)` ``
   is the rule. There is no visitor, no AST vocabulary to learn, and no plugin
   package to publish — a `.grit` file and a path in `biome.json`.

The trade is expressive power. GritQL matches shapes of code, so a rule that
needs type information (is this column a `timestamptz`?) or that must match a
node the pattern language can't easily name (a bare template literal — the
syntax uses backticks as its own delimiters) is out of reach. Prefer a narrow
rule with no false positives over a broad one that gets suppressed: **a
suppressed rule protects nothing.**

## Install

```sh
pnpm add -D @common-pattern/biome-plugins
```

Or, without publishing to a registry, straight from GitHub:

```jsonc
// package.json
{
  "devDependencies": {
    "@common-pattern/biome-plugins": "github:Common-Pattern/biome-plugins"
  }
}
```

Then reference the plugins by path. Paths in `plugins` resolve relative to the
directory containing `biome.json`:

```jsonc
// biome.json
{
  "plugins": [
    "./node_modules/@common-pattern/biome-plugins/plugins/no-utc-calendar-day.grit",
    "./node_modules/@common-pattern/biome-plugins/plugins/no-glued-timestamps.grit"
  ],
  "linter": { "enabled": true }
}
```

⚠️ **`linter.enabled` must be `true`.** With the linter disabled, Biome
processes no files and plugins never run — and it reports this as "no files
were processed", not as a plugin error, which is a confusing way to find out.

## Plugins

### `no-utc-calendar-day`

Bans `.toISOString().slice(…)` — deriving a calendar date from an instant.

It reads as "today". It means *the UTC calendar day*, which is a different day
from the user's for a window as wide as their UTC offset: 05:30 every morning
in `Asia/Kolkata`, the whole evening in the Americas. That value then gets
compared against a `date` column holding a local calendar date, and the
comparison runs across two different calendars.

This one is unusually good at hiding. Test suites commonly pin `TZ=UTC`,
production is commonly a UTC datacentre, and nobody develops at 03:00 — so the
expression is correct in every context anyone inspects it in, and wrong only in
the answer given to the user.

### `no-glued-timestamps`

Bans `` `${dayKey}T00:00:00Z` `` and its noon-anchored cousin
`` `${dayKey}T12:00:00Z` ``, which hide two different mistakes.

**The interpolation hides the timezone question.** A glued
`` `${date}T00:00:00` `` with no `Z` parses in whatever zone the runtime is in
— the server's, not the user's. `toDate(date, { timeZone })` has nowhere to put
that mistake, because the zone is a required argument rather than an accident
of deployment.

**The noon anchor hides a category error.** It exists because
`` `${key}T00:00:00Z` `` renders as the *previous* day west of UTC, so someone
moved the anchor to noon to buy ±12h of slack. That is a fix sized to the zones
its author had in mind: at UTC+13/+14 (`Pacific/Apia`, `Pacific/Kiritimati`)
noon UTC is already the next day and it renders tomorrow. The deeper problem is
that a day key has no instant behind it at all — "28 July" is a calendar fact,
not a moment — so asking which zone to project it into is the wrong question.

Matches three call shapes (`new Date(…)`, `fromZonedTime(…)`,
`formatDateTime(…)`) rather than every template literal, for the reason in the
trade-off note above.

## Tests

```sh
pnpm install
pnpm test
```

Two fixtures. `violations.ts` must produce exactly N diagnostics;
`clean.ts` must produce zero. The second is the more important one — it is the
false-positive guard, and false positives are how a rule ends up suppressed.

## Adding a plugin

1. Write `plugins/<name>.grit`, with the reasoning at the top. Explain the bug
   it prevents, not just the pattern it matches — the comment is the part that
   survives contact with the next reader.
2. Add a case to both fixtures in `test/fixtures/`, and bump
   `EXPECTED_VIOLATIONS` in `test/run.sh`.
3. Register it in `biome.json` so the repo lints itself with it.
4. **Verify it actually fires** by planting a violation in a real consumer and
   watching the lint fail. A plugin that silently fails to compile, or that is
   registered where the linter never runs, is indistinguishable from one that
   passes.
