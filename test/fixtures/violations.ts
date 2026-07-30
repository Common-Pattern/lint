// Every line here MUST be reported. `test/run.sh` asserts the count, so adding
// a case means updating EXPECTED_VIOLATIONS in that script.
//
// Not real code — these exist to be linted, not run.
declare function fromZonedTime(value: unknown, timeZone: string): Date;
declare function formatDateTime(value: unknown, timeZone: string, fmt: string): string;
declare function toDate(value: string, opts: { timeZone: string }): Date;
declare class TZDate {
  constructor(value: string | number | Date, timeZone: string);
  static tz(timeZone: string, year: number, monthIndex: number, day: number, hours: number, minutes: number): Date;
}

export function utcCalendarDay(instant: Date, timeZone: string) {
  const today = new Date().toISOString().slice(0, 10); // no-utc-calendar-day
  const day = instant.toISOString().slice(0, 10); // no-utc-calendar-day
  return [today, day, timeZone];
}

export function utcCalendarDayViaSplit(instant: Date, timeZone: string) {
  // The `.split("T")` spelling of the same bug — a different shape, an
  // identical wrong answer, and it outlived the `.slice` ban by months.
  const day = instant.toISOString().split("T")[0]; // no-utc-calendar-day
  // `[1]` is no better: that is the UTC wall clock.
  const clock = new Date().toISOString().split("T")[1]; // no-utc-calendar-day
  return [day, clock, timeZone];
}

export function gluedTZDate(date: string, time: string, timeZone: string) {
  // Reads as the zone-aware thing to do; is wrong by the tenant's UTC offset.
  // The STRING constructor parses in the ambient zone and only re-tags.
  const a = new TZDate(`${date}T${time}:00`, timeZone); // no-glued-timestamps
  // Same glue, spelled with `+`.
  const b = new TZDate(`${date}T` + time + ":00", timeZone); // no-glued-timestamps
  const c = new TZDate(date + "T00:00:00", timeZone); // no-glued-timestamps
  return [a, b, c];
}

export function gluedTimestamps(key: string, timeZone: string) {
  const a = new Date(`${key}T00:00:00Z`); // no-glued-timestamps
  const b = new Date(`${key}T12:00:00.000Z`); // no-glued-timestamps
  const c = fromZonedTime(`${key}T00:00:00`, timeZone); // no-glued-timestamps
  const d = formatDateTime(`${key}T12:00:00Z`, timeZone, "date"); // no-glued-timestamps
  return [a, b, c, d];
}

export function gluedOffsets(wallClock: string, timeZone: string) {
  // The zone spelled as a number: correct today, a code edit when the zone moves.
  const a = new Date(`${wallClock}+05:30`); // no-glued-timestamps
  // Worse than redundant — the embedded offset overrides the timeZone option.
  const b = toDate(`${wallClock}-08:00`, { timeZone }); // no-glued-timestamps
  return [a, b];
}

interface Wide {
  id: string;
  createdAt: string;
}
interface Narrow {
  id: string;
  suggestedStart: string;
}

export function doubleAssertions(value: unknown, narrow: Narrow) {
  // Nothing checks either claim — that is the whole objection.
  const a = value as unknown as Wide; // no-double-assertion
  const b = narrow as unknown as Wide; // no-double-assertion
  return [a, b];
}
