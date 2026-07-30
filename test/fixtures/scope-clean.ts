// The false-positive guard for `no-glued-timestamp-via-variable`, and the more
// important of its two fixtures.
//
// The GritQL attempt at this rule was abandoned because it matched by NAME
// across the whole file: one glued `startStr` anywhere condemned every
// `startStr` everywhere. Every function below is named to trigger exactly that
// failure — the file deliberately reuses `startStr`, `stamp` and `key` for
// both a glued value and a legitimate one — so if the port had silently fallen
// back to name matching, this file would light up.
//
// Nothing here may be reported.
//
// Not real code — these exist to be linted, not run.
declare function fromZonedTime(value: string, timeZone: string): Date;
declare function parseISO(value: string): Date;
declare function toDate(value: string, opts: { timeZone: string }): Date;
declare function trackEvent(name: string, payload: unknown): void;
declare class TZDate {
  constructor(value: string | number | Date, timeZone: string);
}

// ---------------------------------------------------------------------------
// THE DISCRIMINATING PAIR.
//
// `scope-violations.ts` glues a `startStr` and passes it to `fromZonedTime`.
// This `startStr` holds a real, unambiguous, zone-carrying ISO constant and
// goes to the same function. Both files are linted together. If the rule
// reported this one, it would be resolving by name.
// ---------------------------------------------------------------------------
export function unrelatedStartStrHoldingAnIsoConstant(zone: string) {
  const startStr = "2026-07-30T13:00:00Z";
  return fromZonedTime(startStr, zone);
}

// A glued `startStr` and a clean `startStr` in two sibling functions in ONE
// file — the precise collision the GritQL note describes.
export function gluesAStartStrForALabel(day: string, time: string) {
  const startStr = `${day}T${time}`;
  trackEvent("session.previewed", { startStr });
  return startStr;
}

export function consumesADifferentStartStr(zone: string) {
  const startStr = "2026-07-30T13:00:00Z";
  return new TZDate(startStr, zone);
}

// ---------------------------------------------------------------------------
// SHADOWING. The inner binding is the one the call refers to, and it is clean.
// A scope-chain walk gets this right; a file-wide name match does not.
// ---------------------------------------------------------------------------
export function shadowedByACleanBinding(day: string, time: string, zone: string) {
  const stamp = `${day}T${time}`;
  function inner() {
    const stamp = "2026-07-30T13:00:00Z";
    return fromZonedTime(stamp, zone);
  }
  return [stamp, inner()];
}

// ---------------------------------------------------------------------------
// The legitimate parses. A day key is not a glued timestamp.
// ---------------------------------------------------------------------------
export function parsesADayKeyProperly(key: string, timeZone: string) {
  return [toDate(key, { timeZone }), parseISO(key)];
}

export function parsesAStoredInstant(row: { start: string }, timeZone: string) {
  const start = row.start;
  return toDate(start, { timeZone });
}

// ---------------------------------------------------------------------------
// Strings that are assembled but are not timestamps. The shape check is what
// keeps these out, so it has to be tested independently of the scope walk.
// ---------------------------------------------------------------------------
export function assemblesACacheKey(orgId: string, day: string, zone: string) {
  const key = `slots:${orgId}:${day}`;
  trackEvent("cache.miss", { key });
  const iso = "2026-07-30T13:00:00Z";
  return fromZonedTime(iso, zone);
}

export function assemblesALabelWithATimeInIt(count: number, zone: string) {
  const label = `${count} sessions before 09:00`;
  trackEvent("report.rendered", { label });
  const iso = "2026-07-30T13:00:00Z";
  return new TZDate(iso, zone);
}

// ---------------------------------------------------------------------------
// A glued string that never reaches a timezone-sensitive consumer. Serialising
// two already-validated form fields onto the wire is legitimate — the SERVER
// decides which moment it is — and this is the shape `clean.ts` already
// protects at the call site.
// ---------------------------------------------------------------------------
export function gluesForTheWireOnly(date: string, time: string) {
  const wire = `${date}T${time}`;
  return { startsAt: wire };
}

// ---------------------------------------------------------------------------
// Epoch arithmetic. `+` here is addition, not concatenation, and the
// millisecond constructor is the correct API.
// ---------------------------------------------------------------------------
export function epochArithmetic(epochMs: number, offsetMs: number, zone: string) {
  const shifted = epochMs + offsetMs;
  return new TZDate(shifted, zone);
}
