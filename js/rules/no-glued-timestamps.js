/**
 * Ban gluing a timestamp together from a date string, AT THE CALL SITE.
 *
 * Direct port of `../../biome/no-glued-timestamps.grit` — that file's rationale
 * for each branch is the authority and is not repeated here. The branches are
 * the same six; what changed is how "glued" is decided (see `../lib/glue.js`:
 * a shape derived from the AST rather than a regex over source text).
 *
 * The variable-indirection case that this rule explicitly gives up on lives in
 * its sibling, `no-glued-timestamp-via-variable`.
 */

import { isAssembledString, isGluedDateTime, isGluedOffset } from "../lib/glue.js";

const MESSAGES = {
  tzdate:
    "new TZDate(string, zone) parses in the AMBIENT zone and only re-tags for display, so a glued wall-clock string lands off by the tenant's UTC offset. Use TZDate.tz(zone, year, monthIndex, day, hours, minutes) — the component constructor, which reads the fields IN that zone.",
  newDate:
    "Don't glue a timestamp out of a date string — it parses in whatever zone the runtime is in. Use toDate(key, { timeZone }) for an instant, or parseISO(key) for a local-fields Date.",
  fromZonedTime: "fromZonedTime over a glued wall-clock string is exactly toDate(key, { timeZone }) — use that instead.",
  formatDateTime:
    "This is a bare calendar date, not an instant — there is no zone to render it in. Format the day key directly, with no timezone.",
  newDateOffset:
    "Don't append a numeric UTC offset to a date string. That hard-codes today's offset as source text, so a zone that gains DST (or changes its offset by decree, as several have) becomes a code edit. Use toDate(s, { timeZone }) with an IANA zone name.",
  toDateOffset:
    "An embedded offset takes precedence over the timeZone option, so this silently ignores the zone you passed. Drop the offset and let toDate apply the zone.",
};

function calleeName(node) {
  return node.callee?.type === "Identifier" ? node.callee.name : null;
}

export default {
  create(context) {
    return {
      NewExpression(node) {
        const name = calleeName(node);
        const arg = node.arguments?.[0];
        if (arg == null || arg.type === "SpreadElement") return;

        if (name === "TZDate") {
          // Two-argument form only: a one-argument `new TZDate(x)` has no zone
          // to be wrong about.
          if (node.arguments.length < 2) return;
          if (isAssembledString(arg)) context.report({ node: arg, message: MESSAGES.tzdate });
          return;
        }

        if (name === "Date") {
          if (isGluedDateTime(arg)) context.report({ node: arg, message: MESSAGES.newDate });
          else if (isGluedOffset(arg)) context.report({ node: arg, message: MESSAGES.newDateOffset });
        }
      },

      CallExpression(node) {
        const name = calleeName(node);
        const arg = node.arguments?.[0];
        if (arg == null || arg.type === "SpreadElement") return;

        if (name === "fromZonedTime" && node.arguments.length >= 2) {
          if (isGluedDateTime(arg)) context.report({ node: arg, message: MESSAGES.fromZonedTime });
          return;
        }

        if (name === "formatDateTime" && node.arguments.length >= 3) {
          if (isGluedDateTime(arg)) context.report({ node: arg, message: MESSAGES.formatDateTime });
          return;
        }

        if (name === "toDate" && node.arguments.length >= 2) {
          if (isGluedOffset(arg)) context.report({ node: arg, message: MESSAGES.toDateOffset });
        }
      },
    };
  },
};
