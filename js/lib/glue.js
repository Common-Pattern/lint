/**
 * Shared "is this string glued together?" helpers.
 *
 * The GritQL originals answered this by running a regex over the SOURCE TEXT of
 * the argument (`$arg <: r".*\$\{[^}]*\}T[0-2][0-9]:[0-5][0-9].*"`). That works,
 * but it conflates two different things — the literal characters an author typed
 * and the structure of the value being built — and it cannot see through a
 * nested template or a concatenation.
 *
 * Here we instead flatten the expression into a SHAPE: literal text stays
 * literal, and every interpolated sub-expression collapses to one sentinel
 * character. `` `${dayKey}T00:00:00Z` `` becomes `"<EXPR>T00:00:00Z"`, and
 * `dateStr + "T" + time` becomes the same `"<EXPR>T<EXPR>"` a template literal
 * would. Matching then happens against structure rather than syntax, so the two
 * spellings of one bug cannot diverge — which is the exact failure mode the
 * `.slice`/`.split` history in `no-utc-calendar-day` records.
 */

/**
 * Stands in for an interpolated sub-expression in a shape string. A Private Use
 * Area codepoint, so it cannot collide with anything in real source.
 */
export const EXPR = "\uE000";

/** True for a string literal node — ESTree spells these `Literal`. */
function isStringLiteral(node) {
  return node != null && node.type === "Literal" && typeof node.value === "string";
}

/**
 * Flatten `node` into a shape string, or return `null` if it is not a
 * string-building expression at all.
 *
 * Only template literals that actually interpolate something, and `+` chains
 * that contain at least one string literal, count as "building a string". A
 * bare `a + b` of two identifiers is arithmetic as far as we can tell without
 * types, and `new TZDate(base + offsetMs, zone)` is the legitimate millisecond
 * constructor — flagging it would teach people to ignore the rule.
 */
export function glueShape(node) {
  if (node == null) return null;

  if (node.type === "TemplateLiteral") {
    if (node.expressions.length === 0) return null;
    let out = "";
    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      out += quasi.value.cooked ?? quasi.value.raw;
      if (i < node.expressions.length) out += EXPR;
    }
    return out;
  }

  if (node.type === "BinaryExpression" && node.operator === "+") {
    if (!containsStringLiteral(node)) return null;
    return concatShape(node);
  }

  return null;
}

function containsStringLiteral(node) {
  if (isStringLiteral(node)) return true;
  if (node?.type === "BinaryExpression" && node.operator === "+") {
    return containsStringLiteral(node.left) || containsStringLiteral(node.right);
  }
  if (node?.type === "TemplateLiteral") {
    return node.quasis.some((q) => (q.value.cooked ?? q.value.raw).length > 0);
  }
  return false;
}

function concatShape(node) {
  if (isStringLiteral(node)) return node.value;
  if (node.type === "TemplateLiteral") {
    const shape = glueShape(node);
    return shape ?? node.quasis.map((q) => q.value.cooked ?? q.value.raw).join("");
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return concatShape(node.left) + concatShape(node.right);
  }
  return EXPR;
}

/**
 * An interpolated value immediately followed by the ISO date/time separator.
 *
 * The trailing alternation is the one place this is deliberately WIDER than the
 * GritQL rule it ports. That rule required literal digits after the `T`
 * (`\$\{[^}]*\}T[0-2][0-9]:[0-5][0-9]`), so it matched `` `${key}T00:00:00Z` ``
 * but not `` `${dateStr}T${normalizedTime}` `` — the shape the real
 * `schedule-service` bug wore. A rule that catches the timestamp whose time
 * half is hard-coded and misses the one whose time half is a variable has the
 * relationship backwards: the second is the more dangerous of the two, because
 * nothing about it is inspectable at the call site.
 */
export const ISO_DATETIME_GLUE = new RegExp(`${EXPR}T(?:${EXPR}|[0-2]\\d)`);

/**
 * An interpolated value immediately followed by a hard-coded numeric UTC
 * offset. Same source regex as the GritQL rule, transposed onto shapes.
 */
export const OFFSET_GLUE = new RegExp(`${EXPR}[+-][0-2]\\d:?[0-5]\\d`);

/** Does this expression build a `<something>T<time>` timestamp? */
export function isGluedDateTime(node) {
  const shape = glueShape(node);
  return shape != null && ISO_DATETIME_GLUE.test(shape);
}

/** Does this expression build a string carrying a hard-coded numeric offset? */
export function isGluedOffset(node) {
  const shape = glueShape(node);
  return shape != null && OFFSET_GLUE.test(shape);
}

/**
 * Any string assembled at this site, whatever its shape.
 *
 * Only `new TZDate(…, zone)` uses this. There, the enclosing call has already
 * established that the argument is meant to be a moment in time, so any string
 * built on the spot is one with no zone in it — which is precisely the bug. An
 * unambiguous ISO literal (`new TZDate("2026-07-30T13:00:00Z", tz)`) is not
 * assembled and stays legal.
 */
export function isAssembledString(node) {
  return glueShape(node) != null;
}
