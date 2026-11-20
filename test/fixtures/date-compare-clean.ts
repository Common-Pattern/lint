// The false-positive guard for `no-date-string-comparison`. Nothing here may be
// reported.
//
// Not real code — these exist to be linted, not run.
declare function format(date: Date, pattern: string): string;
declare function parseISO(value: string): Date;
declare function isBefore(a: Date, b: Date): boolean;
declare function toDayKey(value: Date, timeZone: string): string;

interface Order {
  start: string;
  finish: string;
  sessions: number;
}

const currency = new Intl.NumberFormat("en-IN");

export function parsedBeforeComparing(day: string, start: Date) {
  return isBefore(parseISO(day), start);
}

export function numbers(order: Order, limit: number) {
  return order.sessions < limit;
}

export function datesAsObjects(a: Date, b: Date) {
  return a < b;
}

export function equalityIsNotOrdering(day: string, start: Date) {
  return day === format(start, "yyyy-MM-dd");
}

export function aFormatMethodIsNotDateFns(a: number, b: number) {
  return currency.format(a) < currency.format(b);
}

export function unconfiguredHelper(order: Order, start: Date) {
  return order.start < toDayKey(start, "UTC");
}

export function fieldsAreNotFollowed(order: Order) {
  return order.start < order.finish;
}

export function nonIsoLiteral(label: string) {
  return label < "b";
}

export function sameNameInASiblingScope(order: Order) {
  const startStr = order.start;
  return startStr < order.finish;
}

export function siblingWithTheGlue(start: Date) {
  const startStr = format(start, "yyyy-MM-dd");
  return startStr.length;
}

export function templateWithExpressions(prefix: string, label: string) {
  return label < `${prefix}2026-11-05`;
}
