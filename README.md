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

Then reference `all.grit` — one entry, every rule:

```jsonc
// biome.json
{
  "plugins": ["./node_modules/@common-pattern/biome-plugins/plugins/all.grit"],
  "linter": { "enabled": true }
}
```

Want only some of the rules? List the individual files instead:

```jsonc
{
  "plugins": [
    "./node_modules/@common-pattern/biome-plugins/plugins/no-utc-calendar-day.grit"
  ]
}
```

**Why an aggregate file rather than an index that imports the others.** Biome
resolves each `plugins` entry as one explicit file path and loads it in
isolation. Measured against 2.5: globs (`plugins/*.grit`), directories, and
bare package specifiers are all rejected, and a `.grit` file cannot reference a
pattern defined in another file — `import`, `include`, and a bare call to a
pattern defined elsewhere all fail to compile. (The standalone Grit CLI has a
module system; Biome does not implement it.) So `all.grit` is *generated*:
`scripts/build-all.mjs` wraps each plugin body in a named GritQL pattern and
composes them with `or`. The individual files stay the source of truth, and
`pnpm test` fails if the generated file is stale.

⚠️ **`linter.enabled` must be `true`.** With the linter disabled, Biome
processes no files and plugins never run — and it reports this as "no files
were processed", not as a plugin error, which is a confusing way to find out.

### Why this isn't on npm (yet)

Consume it as a pinned git dependency, as above. `pnpm` resolves that to a
codeload tarball at the exact SHA — no clone, no auth, no publish step, and
reproducible.

The trade is that there is no semver: upgrading means editing a 40-character
SHA in every consumer. Fine for one or two; annoying beyond that.

The obvious alternative — GitHub Packages (`npm.pkg.github.com`) — is worse
here: it requires an authentication token even to *read* public packages, so
every consumer's CI and every developer would need a PAT in their `.npmrc` in
order to install a lint plugin.

If the SHA-bumping becomes the annoying part, the answer is npmjs.com, which
needs no token to consume and supports trusted publishing over OIDC from GitHub
Actions (so no long-lived npm token either).

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

**It also bans the offset variant** — `` new Date(`${wallClock}+05:30`) `` and
`` toDate(`${wallClock}-08:00`, { timeZone }) ``. This is the same habit with
the zone spelled as a number, and it is more tempting because it looks
deliberate: the author obviously thought about timezones. What they wrote down
is a fact with an expiry date. An offset is the tz database's *current answer*
for a zone, not the zone itself — Egypt reinstated DST in 2023, and Chile,
Morocco and Samoa have all moved — and when one changes, an IANA name is a
package update while a literal offset is a code edit nobody knows to make.

The `toDate` form fails a second way worth its own message: an embedded offset
takes **precedence** over the `timeZone` option, so the zone argument isn't
merely redundant, it is silently discarded.

Matches call shapes (`new Date(…)`, `fromZonedTime(…)`, `formatDateTime(…)`,
and `toDate(…)` for the offset form) rather than every template literal, for
the reason in the trade-off note above. The offset branches are deliberately
scoped to `new Date`/`toDate`: `` `${x}-10:30` `` is not inherently date-shaped
— it could be a range label — so the enclosing call is what makes the intent
unambiguous.

Not matched, and deliberately legal: `` `${date}T${time}` ``, joining two
already-validated fields into a wire value. There is no instant and no zone in
it, and "fixing" it with a date library would force a zone choice at the wrong
layer.

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
3. Run `pnpm build` to regenerate `plugins/all.grit`, and commit it. Consumers
   pointing at the aggregate pick the new rule up on their next version bump,
   with no change to their `biome.json`.
4. **Verify it actually fires** by planting a violation in a real consumer and
   watching the lint fail. A plugin that silently fails to compile, or that is
   registered where the linter never runs, is indistinguishable from one that
   passes.
