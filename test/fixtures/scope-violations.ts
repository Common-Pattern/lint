// The payoff fixture. Every function here MUST be reported by
// `no-glued-timestamp-via-variable`, and none of these shapes is reachable by
// the call-site rule — that is the entire point of the new rule.
//
// Not real code — these exist to be linted, not run.
declare function fromZonedTime(value: string, timeZone: string): Date;
declare function parseISO(value: string): Date;
declare function toDate(value: string, opts: { timeZone: string }): Date;
declare class TZDate {
  constructor(value: string | number | Date, timeZone: string);
}

// ---------------------------------------------------------------------------
// 1. The real bug, verbatim.
//
// This is `createSlotForDateAndTime` from api-ts/src/services/schedule-service.ts
// as it stood before commit 8f02443e. It passed `biome check` with
// `no-glued-timestamps` enabled and shipped a slot generator that was wrong by
// the org's UTC offset on every host but a UTC one.
// ---------------------------------------------------------------------------
export function scheduleServiceAsShipped(dateStr: string, time: string, timezone: string) {
  const normalizedTime = time.length === 5 ? `${time}:00` : time.slice(0, 8);
  const startStr = `${dateStr}T${normalizedTime}`;
  const startDate = fromZonedTime(startStr, timezone); // no-glued-timestamp-via-variable
  return startDate;
}

// ---------------------------------------------------------------------------
// 2. The same indirection through each of the other consumers.
// ---------------------------------------------------------------------------
export function gluedIntoTZDate(day: string, time: string, zone: string) {
  const stamp = `${day}T${time}:00`;
  return new TZDate(stamp, zone); // no-glued-timestamp-via-variable
}

export function gluedIntoNewDate(day: string) {
  const midnight = `${day}T00:00:00`;
  return new Date(midnight); // no-glued-timestamp-via-variable
}

export function gluedIntoParseISO(day: string, time: string) {
  const wallClock = `${day}T${time}`;
  return parseISO(wallClock); // no-glued-timestamp-via-variable
}

export function offsetGluedIntoToDate(wallClock: string, timeZone: string) {
  const withOffset = `${wallClock}+05:30`;
  return toDate(withOffset, { timeZone }); // no-glued-timestamp-via-variable
}

// ---------------------------------------------------------------------------
// 3. Spelled with `+` instead of a template literal. Same value, same bug.
// ---------------------------------------------------------------------------
export function gluedByConcatenation(dateStr: string, time: string, timezone: string) {
  const startStr = dateStr + "T" + time;
  return fromZonedTime(startStr, timezone); // no-glued-timestamp-via-variable
}

// ---------------------------------------------------------------------------
// 4. Through an alias, and through a closure. Scope analysis follows both;
//    a name match would have needed neither and would have been wrong about
//    the file below.
// ---------------------------------------------------------------------------
export function gluedThroughAnAlias(day: string, time: string, zone: string) {
  const raw = `${day}T${time}`;
  const alias = raw;
  return fromZonedTime(alias, zone); // no-glued-timestamp-via-variable
}

export function gluedThroughAClosure(day: string, time: string, zone: string) {
  const startStr = `${day}T${time}`;
  const build = () => fromZonedTime(startStr, zone); // no-glued-timestamp-via-variable
  return build();
}

// ---------------------------------------------------------------------------
// 5. Reassigned later. One glued write is enough: which branch runs is not
//    something a linter gets to know.
// ---------------------------------------------------------------------------
export function gluedOnOneBranchOnly(day: string, time: string, zone: string, wantMidnight: boolean) {
  let startStr = "2026-07-30T00:00:00Z";
  if (!wantMidnight) startStr = `${day}T${time}`;
  return fromZonedTime(startStr, zone); // no-glued-timestamp-via-variable
}
