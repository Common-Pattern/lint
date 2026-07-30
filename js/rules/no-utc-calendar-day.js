/**
 * Ban deriving a calendar date from an instant with `.toISOString().slice(…)`
 * or `.toISOString().split(…)`.
 *
 * Direct port of `../../biome/no-utc-calendar-day.grit`; the rationale there is
 * the authority and is not repeated. The mechanics differ in one way worth
 * knowing: GritQL matched the snippet `$instant.toISOString().slice($_)`,
 * which pins the arity of `slice` to exactly one argument. This matches any
 * arity, so `.toISOString().slice(0, 10)` and `.toISOString().slice(0)` are
 * both caught by one branch instead of needing a pattern each.
 */

const BANNED_METHODS = new Set(["slice", "split"]);

const MESSAGES = {
  slice:
    "This is the UTC calendar day, not the user's or tenant's. Derive the day in an explicit timezone — e.g. formatInTimeZone(value, timeZone, 'yyyy-MM-dd') — rather than slicing an ISO string.",
  split:
    "Splitting an ISO string on 'T' gives the UTC calendar day (and the UTC wall clock), not the user's or tenant's. Derive the day in an explicit timezone — e.g. formatInTimeZone(value, timeZone, 'yyyy-MM-dd').",
};

/** `<something>.toISOString()` — the receiver that makes the intent unambiguous. */
function isToISOStringCall(node) {
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property?.type === "Identifier" &&
    node.callee.property.name === "toISOString"
  );
}

export default {
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.computed) return;
        if (callee.property?.type !== "Identifier") return;

        const method = callee.property.name;
        if (!BANNED_METHODS.has(method)) return;
        if (!isToISOStringCall(callee.object)) return;

        // Span the receiver, as the GritQL rule did — the reader needs to see
        // WHICH instant is being flattened, not just that a `.slice` happened.
        context.report({ node: callee.object.callee.object, message: MESSAGES[method] });
      },
    };
  },
};
