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

interface Member {
  name: string;
  joinedOn: string;
}

declare function compareAsc(a: Date, b: Date): number;

export function localeCompareOnNames(members: Member[]) {
  return members.sort((a, b) => a.name.localeCompare(b.name));
}

export function localeCompareOnAnUnlistedProperty(members: Member[]) {
  return members.toSorted((a, b) => a.joinedOn.localeCompare(b.joinedOn));
}

export function localeCompareOnParameters(names: string[]) {
  return names.sort((a, b) => a.localeCompare(b));
}

export function localeCompareOnANonIsoLiteral(label: string) {
  return label.localeCompare("b");
}

export function parsedComparator(days: string[]) {
  return days.sort((a, b) => compareAsc(parseISO(a), parseISO(b)));
}

export function bareSortOfNames(members: Member[]) {
  return members.map((m) => m.name).sort();
}

export function bareSortOfAnUnconfiguredHelper(starts: Date[]) {
  return starts.map((s) => toDayKey(s, "UTC")).sort();
}

export function sortWithAComparatorIsNotBare(starts: Date[]) {
  return starts.map((s) => format(s, "yyyy-MM-dd")).sort((a, b) => compareAsc(parseISO(a), parseISO(b)));
}

export function parameterOfAnUnrelatedCallback(members: Member[], keys: string[]) {
  return keys.sort((a, b) => a.localeCompare(b)) && members.map((m) => format(new Date(), m.name));
}

export function formattedSortOfObjects(starts: Date[]) {
  return starts.map((s) => ({ day: format(s, "yyyy-MM-dd") })).sort();
}
