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

export function templateLiteralsThatAreNotTimestamps(key: string, count: number) {
  return [`${key} is a day key`, `Elapsed: ${count}ms`, `T12:00:00Z is a suffix, not interpolated`];
}
