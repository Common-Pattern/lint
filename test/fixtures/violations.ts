// Every line here MUST be reported. `test/run.sh` asserts the count, so adding
// a case means updating EXPECTED_VIOLATIONS in that script.
//
// Not real code — these exist to be linted, not run.
declare function fromZonedTime(value: unknown, timeZone: string): Date;
declare function formatDateTime(value: unknown, timeZone: string, fmt: string): string;

export function utcCalendarDay(instant: Date, timeZone: string) {
  const today = new Date().toISOString().slice(0, 10); // no-utc-calendar-day
  const day = instant.toISOString().slice(0, 10); // no-utc-calendar-day
  return [today, day, timeZone];
}

export function gluedTimestamps(key: string, timeZone: string) {
  const a = new Date(`${key}T00:00:00Z`); // no-glued-timestamps
  const b = new Date(`${key}T12:00:00.000Z`); // no-glued-timestamps
  const c = fromZonedTime(`${key}T00:00:00`, timeZone); // no-glued-timestamps
  const d = formatDateTime(`${key}T12:00:00Z`, timeZone, "date"); // no-glued-timestamps
  return [a, b, c, d];
}
