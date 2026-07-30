// A second gap, found while porting, and independent of the variable one.
//
// `no-glued-timestamps.grit` decides "is this glued?" with a regex over the
// argument's SOURCE TEXT: `\$\{[^}]*\}T[0-2][0-9]:[0-5][0-9]`. It requires
// LITERAL DIGITS after the `T`. So a timestamp whose time half is itself
// interpolated does not match — even written inline, with no variable
// indirection anywhere.
//
// That is the shape `schedule-service` wore. The rule missed it twice over:
// once for the variable, and once for this. Fixing only the variable half
// would have left the inline spelling shipping.
//
// Everything here MUST be reported by the oxlint port and is NOT reported by
// Biome today.
//
// Not real code — these exist to be linted, not run.
declare function fromZonedTime(value: string, timeZone: string): Date;
declare function formatDateTime(value: string, timeZone: string, fmt: string): string;

export function inlineGlueWithAnInterpolatedTime(dateStr: string, normalizedTime: string, timezone: string) {
  return fromZonedTime(`${dateStr}T${normalizedTime}`, timezone); // MISSED BY BIOME
}

export function inlineGlueIntoDate(day: string, time: string) {
  return new Date(`${day}T${time}`); // MISSED BY BIOME
}

export function inlineGlueIntoFormatDateTime(day: string, time: string, timeZone: string) {
  return formatDateTime(`${day}T${time}`, timeZone, "datetime"); // MISSED BY BIOME
}

export function inlineConcatGlue(dateStr: string, time: string, timezone: string) {
  // The `+` spelling of the same thing. GritQL's source regex needs a `${`,
  // so a concatenation cannot match it at all for these consumers.
  return fromZonedTime(dateStr + "T" + time, timezone); // MISSED BY BIOME
}
