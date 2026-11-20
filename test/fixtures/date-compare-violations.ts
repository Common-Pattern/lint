// Every shape `no-date-string-comparison` reports. Each function below holds
// exactly one diagnostic; the count in `test/run.sh` is the number of them.
//
// Not real code — these exist to be linted, not run.
declare function format(date: Date, pattern: string): string;
declare function formatISO(date: Date): string;
declare function formatInTimeZone(date: Date, timeZone: string, pattern: string): string;
declare function orgToday(timeZone: string): string;

interface Holiday {
  startDate: string;
  endDate: string;
}

export function literalOnTheRight(day: string) {
  return day < "2026-11-05";
}

export function literalOnTheLeft(day: string) {
  return "2026-11-05T09:00:00Z" >= day;
}

export function templateLiteralWithoutExpressions(day: string) {
  return day > `2026-11-05`;
}

export function formattedInline(h: Holiday, start: Date) {
  return h.endDate < format(start, "yyyy-MM-dd");
}

export function formattedThroughABinding(h: Holiday, start: Date) {
  const startStr = format(start, "yyyy-MM-dd");
  return h.startDate <= startStr;
}

export function throughAnAlias(h: Holiday, start: Date) {
  const iso = formatISO(start);
  const alias = iso;
  return h.startDate > alias;
}

export function zonedFormat(h: Holiday, start: Date, zone: string) {
  return h.startDate > formatInTimeZone(start, zone, "yyyy-MM-dd");
}

export function isoStringMethod(h: Holiday, start: Date) {
  return h.startDate < start.toISOString();
}

export function configuredHelper(startDate: string, zone: string) {
  const today = orgToday(zone);
  return startDate > today ? startDate : today;
}

export function reassignedLater(h: Holiday, start: Date) {
  let bound = h.startDate;
  bound = start.toJSON();
  return h.endDate > bound;
}

export function nullishBranch(h: Holiday, start: Date) {
  const pick = h.endDate ?? start.toISOString();
  return h.startDate < pick;
}

export function conditionalBranch(h: Holiday, start: Date, open: boolean) {
  return h.startDate < (open ? format(start, "yyyy-MM-dd") : h.endDate);
}

export function throughAnAssertion(h: Holiday, start: Date) {
  return h.startDate < (format(start, "yyyy-MM-dd") as string);
}
