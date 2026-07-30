// Does an oxlint disable-comment suppress a CUSTOM JS-plugin rule?
//
// This repo bans suppressions outright (CLAUDE.md, "Never suppress"), and the
// GritQL rules are unsuppressable by construction — Biome has no way to turn a
// plugin off for a line. If oxlint's directives DO reach plugin rules, that is
// a hole this repo's conventions do not currently have, and it has to be
// closed deliberately rather than discovered later.
//
// Not real code — these exist to be linted, not run.
declare function fromZonedTime(value: string, timeZone: string): Date;

export function suppressedInline(day: string, time: string, zone: string) {
  // oxlint-disable-next-line common-pattern/no-glued-timestamp-via-variable
  const startStr = `${day}T${time}`;
  // oxlint-disable-next-line common-pattern/no-glued-timestamp-via-variable
  return fromZonedTime(startStr, zone);
}

/* oxlint-disable common-pattern/no-glued-timestamps */
export function suppressedByBlock(key: string) {
  return new Date(`${key}T00:00:00Z`);
}
/* oxlint-enable common-pattern/no-glued-timestamps */
