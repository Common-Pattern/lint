// Nothing here may be reported. This file is the false-positive guard, and it
// is the more important of the two fixtures: a date rule that cries wolf gets
// suppressed, and a suppressed rule protects nothing.
//
// Not real code — these exist to be linted, not run.
declare function toDate(value: string, opts: { timeZone: string }): Date;
declare function parseISO(value: string): Date;
declare function formatInTimeZone(value: unknown, timeZone: string, fmt: string): string;
declare function formatDayKey(key: string, fmt: string): string;
declare function formatDateTime(value: unknown, timeZone: string, fmt: string): string;
declare class TZDate {
  constructor(value: string | number | Date, timeZone: string);
  static tz(timeZone: string, year: number, monthIndex: number, day: number, hours: number, minutes: number): Date;
}

export function correctDayDerivation(instant: Date, timeZone: string) {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
}

export function correctParsing(key: string, timeZone: string) {
  return [toDate(key, { timeZone }), parseISO(key)];
}

export function correctRendering(key: string, instant: Date, timeZone: string) {
  // A bare calendar date gets no timezone; a real instant gets one.
  return [formatDayKey(key, "date"), formatDateTime(instant, timeZone, "datetime")];
}

export function arraySliceIsNotADateSlice<T>(items: T[]) {
  // The bare `.slice(0, 10)` form is not matched precisely so this stays legal.
  return items.slice(0, 10);
}

export function toISOStringWithoutSlicing(instant: Date) {
  // A full ISO timestamp is a legitimate way to store an instant.
  return instant.toISOString();
}

export function splittingSomethingAlreadyProjected(instant: Date, timeZone: string) {
  // `.split` is only banned on a `.toISOString()` receiver. This one has
  // already chosen a zone, so taking the date half of it is correct.
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd HH:mm").split(" ")[0];
}

export function splittingAStringThatIsNotAnInstant(csvRow: string) {
  // Nothing date-shaped about this at all.
  return csvRow.split(",")[0];
}

export function tzDateNearMisses(instant: Date, timeZone: string, epochMs: number, offsetMs: number) {
  // The COMPONENT constructor is the fix, not the bug: it reads the calendar
  // fields in `timeZone`, with no ambient zone in the computation.
  const a = TZDate.tz(timeZone, 2026, 6, 30, 18, 30);
  // An unambiguous ISO string carrying a `Z` is parsed as UTC whatever the
  // ambient zone is; the zone argument only chooses how it renders. Legal.
  const b = new TZDate("2026-07-30T13:00:00Z", timeZone);
  // An instant is an instant. Re-tagging one for display is the whole point of
  // the class.
  const c = new TZDate(instant, timeZone);
  // `+` inside a TZDate call is ordinary epoch arithmetic — the millisecond
  // constructor — so the concatenation branch requires a string literal operand.
  const d = new TZDate(epochMs + offsetMs, timeZone);
  return [a, b, c, d];
}

export function templateLiteralsThatAreNotTimestamps(key: string, count: number) {
  return [`${key} is a day key`, `Elapsed: ${count}ms`, `T12:00:00Z is a suffix, not interpolated`];
}

interface Wide {
  id: string;
  createdAt: string;
}

export function singleAssertionsAreChecked(value: Wide) {
  // `as T` is not banned by `no-double-assertion`: TypeScript still requires
  // the two types to be related, so it can narrow or widen but not invent.
  return [value as Wide, value.id as string];
}

export function unknownOnItsOwnIsFine(value: Wide) {
  // Widening to `unknown` is the safe direction and stops there — it is the
  // second hop, back down to a concrete type, that skips the check.
  const widened = value as unknown;
  return widened;
}

export function joiningTwoTypedFields(date: string, time: string) {
  // Serializing two independent, already-validated form fields into one wire
  // value. No instant and no zone: the server decides which moment this is.
  // Routing it through a date library would force a zone choice in the BROWSER,
  // which is how you'd introduce the bug rather than prevent it.
  return `${date}T${time}`;
}

export function offsetShapesOutsideADateCall(start: string, discount: number) {
  // `${x}-10:30` is only unambiguous inside a Date constructor. As a plain
  // string it is a range label or an arithmetic result, so the offset branches
  // are scoped to the call shapes and these stay legal.
  return [`${start}-10:30`, `${discount}-05:00 applied`];
}
