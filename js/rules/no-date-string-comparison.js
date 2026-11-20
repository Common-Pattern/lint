/**
 * Ban ordering dates by comparing their strings.
 *
 *     if (holiday.endDate < format(start, "yyyy-MM-dd")) continue;
 *     const from = schedule.startDate > today ? schedule.startDate : today;
 *
 * Both work, today, because a zero-padded `yyyy-MM-dd` happens to sort the
 * same way as the days it names. That is a property of one string shape, not
 * of dates, and nothing at the comparison says which shape it is holding:
 *
 * - `"2026-11-05" < "2026-11-05T00:00:00Z"` is true, so a day key against a
 *   timestamp puts a day before its own midnight.
 * - `"2026-11-05T10:00:00+05:30" > "2026-11-05T04:31:00Z"` is true, and the
 *   first instant is the earlier one. Two offsets make lexical order wrong.
 * - `"9 Nov 2026" < "10 Nov 2026"` is false. A display string compared by
 *   accident is wrong for most pairs.
 * - `"" < anything` is true, so a missing value seeded into a `reduce` as `""`
 *   wins every "earliest" contest silently.
 *
 * Parse, then compare: `isBefore(parseISO(a), parseISO(b))`, `max([...])`,
 * `compareAsc`, or a project helper that does the same on day keys. The
 * comparison then fails loudly (`Invalid Date`) on a shape it does not expect
 * instead of returning an answer.
 *
 * WHAT IS CHECKED. A relational comparison (`<`, `<=`, `>`, `>=`) where either
 * operand is provably a date string:
 *
 * - a string literal, or a template literal with no expressions, that starts
 *   with an ISO date (`"2026-11-05"`, `"2026-11-05T09:00:00Z"`);
 * - a call to a function that formats a date into a string: date-fns'
 *   `format`, `formatISO`, `formatISO9075`, `formatRFC3339`, `formatRFC7231`,
 *   `lightFormat`, `formatDate` and date-fns-tz's `formatInTimeZone`, called
 *   by bare name; and the `Date` methods `toISOString`, `toJSON`,
 *   `toDateString`, `toLocaleDateString`, called on anything. A method call
 *   named `format` is not matched: `Intl.NumberFormat#format` and every
 *   formatter object share that name;
 * - a call to a function named in the `functions` option — a codebase's own
 *   helpers that return a date string (`orgToday`, `toDayKey`);
 * - a binding written from any of the above, resolved through scope analysis
 *   and followed through aliases, as `no-glued-timestamp-via-variable` does.
 *   One date-string write is enough;
 * - a conditional or logical expression (`a ?? b`, `c ? a : b`) with a
 *   date-string branch.
 *
 * WHAT IS DELIBERATELY NOT CHECKED. Object fields (`order.start < order.end`),
 * function parameters, and anything else whose string-ness only a type checker
 * could establish. oxlint's JS plugins get no type information, and guessing
 * from names (`start`, `date`, `key`) collides with numbers, `Date` objects and
 * unrelated strings constantly. A rule with that false-positive rate gets
 * switched off, and a switched-off rule protects nothing. Equality (`===`) is
 * not checked either: two day keys are equal exactly when their days are, and
 * equality is how a `Map` keyed by day already works.
 */

import { resolveVariable, writesTo } from "../lib/scope.js";

const RELATIONAL = new Set(["<", "<=", ">", ">="]);

const FORMATTING_FUNCTIONS = [
  "format",
  "formatDate",
  "formatISO",
  "formatISO9075",
  "formatRFC3339",
  "formatRFC7231",
  "formatInTimeZone",
  "lightFormat",
];

const FORMATTING_METHODS = new Set(["toISOString", "toJSON", "toDateString", "toLocaleDateString"]);

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function isIsoLiteral(node) {
  if (node.type === "Literal") return typeof node.value === "string" && ISO_DATE_PREFIX.test(node.value);
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return ISO_DATE_PREFIX.test(node.quasis[0]?.value?.cooked ?? "");
  }
  return false;
}

function methodName(callee) {
  if (callee?.type === "MemberExpression" && !callee.computed && callee.property?.type === "Identifier") {
    return callee.property.name;
  }
  return null;
}

function unwrap(node) {
  let current = node;
  while (
    current != null &&
    (current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ParenthesizedExpression" ||
      current.type === "AwaitExpression")
  ) {
    current = current.type === "AwaitExpression" ? current.argument : current.expression;
  }
  return current;
}

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          functions: { type: "array", items: { type: "string" }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const extra = context.options?.[0]?.functions ?? [];
    const functions = new Set([...FORMATTING_FUNCTIONS, ...extra]);

    function sourceOf(node, seen) {
      const expr = unwrap(node);
      if (expr == null) return null;

      if (isIsoLiteral(expr)) return "an ISO date literal";

      if (expr.type === "CallExpression") {
        const callee = expr.callee;
        if (callee?.type === "Identifier") return functions.has(callee.name) ? `${callee.name}()` : null;
        const method = methodName(callee);
        return method != null && FORMATTING_METHODS.has(method) ? `.${method}()` : null;
      }

      if (expr.type === "ConditionalExpression") {
        return sourceOf(expr.consequent, seen) ?? sourceOf(expr.alternate, seen);
      }

      if (expr.type === "LogicalExpression") {
        return sourceOf(expr.left, seen) ?? sourceOf(expr.right, seen);
      }

      if (expr.type === "Identifier") {
        const variable = resolveVariable(sourceCode, expr);
        if (variable == null || seen.has(variable)) return null;
        seen.add(variable);
        for (const write of writesTo(variable)) {
          const found = sourceOf(write, seen);
          if (found != null) return found;
        }
      }

      return null;
    }

    return {
      BinaryExpression(node) {
        if (!RELATIONAL.has(node.operator)) return;
        const source = sourceOf(node.left, new Set()) ?? sourceOf(node.right, new Set());
        if (source == null) return;
        context.report({
          node,
          message:
            `\`${node.operator}\` compares a date string from ${source} character by character, ` +
            "which orders dates only while both sides share one zero-padded ISO shape. " +
            "Parse both sides and compare the dates (`isBefore`, `isAfter`, `max`, `min`, `compareAsc`).",
        });
      },
    };
  },
};
