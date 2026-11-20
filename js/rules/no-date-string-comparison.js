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
 * WHAT IS CHECKED. A relational comparison (`<`, `<=`, `>`, `>=`), or an
 * `a.localeCompare(b)`, where either operand is provably a date string; and a
 * bare `.sort()` or `.toSorted()`, with no comparator, on an array built from
 * date strings. An operand is a date string when it is:
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
 *   date-string branch;
 * - a member access, optional or not, ending in a property named in the
 *   `properties` option (`a.date`, `row?.period_start`). There is no default
 *   list: which names hold date strings is a fact about one codebase;
 * - a parameter of a `.sort`/`.toSorted` comparator, or the first parameter of
 *   an element callback (`.filter`, `.map`, `.some`, `.find`, ...), called on
 *   an array built from date strings.
 *
 * An array is built from date strings when it is an array literal holding
 * one; a `.map`, `.flatMap` or `Array.from` whose callback returns one (from
 * an expression body, a top-level `return`, or a configured helper passed by
 * name); a spread or `new Set(...)` of such an array; `.filter`, `.slice`,
 * `.concat`, `.reverse`, `.toReversed`, `.sort` or `.toSorted` of one; or a
 * binding written from any of those.
 *
 * WHAT IS DELIBERATELY NOT CHECKED. Object fields not named in `properties`
 * (`order.start < order.end`), function parameters other than the array
 * elements above, and anything else whose string-ness only a type checker
 * could establish. oxlint's JS plugins get no type information, and guessing
 * from names (`start`, `date`, `key`) collides with numbers, `Date` objects and
 * unrelated strings constantly. A rule with that false-positive rate gets
 * switched off, and a switched-off rule protects nothing; `properties` is
 * opt-in for that reason. Arrays from `[...map.keys()]`, bindings from
 * `for...of`, and a callback's `return` nested inside an inner block are not
 * followed. Equality (`===`) is not checked either: two day keys are equal
 * exactly when their days are, and equality is how a `Map` keyed by day
 * already works.
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

const SORT_METHODS = new Set(["sort", "toSorted"]);

const ELEMENT_CALLBACK_METHODS = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "some",
]);

const ARRAY_PRESERVING_METHODS = new Set([
  "concat",
  "filter",
  "reverse",
  "slice",
  "sort",
  "toReversed",
  "toSorted",
]);

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
      current.type === "ChainExpression" ||
      current.type === "AwaitExpression")
  ) {
    current = current.type === "AwaitExpression" ? current.argument : current.expression;
  }
  return current;
}

function propertyName(member) {
  if (member?.type !== "MemberExpression") return null;
  if (!member.computed && member.property?.type === "Identifier") return member.property.name;
  if (member.computed && member.property?.type === "Literal" && typeof member.property.value === "string") {
    return member.property.value;
  }
  return null;
}

function isFunction(node) {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          functions: { type: "array", items: { type: "string" }, uniqueItems: true },
          properties: { type: "array", items: { type: "string" }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const extra = context.options?.[0]?.functions ?? [];
    const functions = new Set([...FORMATTING_FUNCTIONS, ...extra]);
    const properties = new Set(context.options?.[0]?.properties ?? []);

    function returnSourceOf(callback, seen) {
      const fn = unwrap(callback);
      if (fn?.type === "Identifier") return functions.has(fn.name) ? `${fn.name}()` : null;
      if (!isFunction(fn)) return null;
      if (fn.body?.type !== "BlockStatement") return sourceOf(fn.body, seen);
      for (const statement of fn.body.body) {
        if (statement.type !== "ReturnStatement" || statement.argument == null) continue;
        const found = sourceOf(statement.argument, seen);
        if (found != null) return found;
      }
      return null;
    }

    function arraySourceOf(node, seen) {
      const expr = unwrap(node);
      if (expr == null) return null;

      if (expr.type === "ArrayExpression") {
        for (const element of expr.elements) {
          if (element == null) continue;
          const found =
            element.type === "SpreadElement" ? arraySourceOf(element.argument, seen) : sourceOf(element, new Set());
          if (found != null) return found;
        }
        return null;
      }

      if (expr.type === "NewExpression") {
        return expr.callee?.type === "Identifier" && expr.callee.name === "Set" && expr.arguments[0] != null
          ? arraySourceOf(expr.arguments[0], seen)
          : null;
      }

      if (expr.type === "CallExpression") {
        const callee = expr.callee;
        const method = methodName(callee);
        if (method == null) return null;
        if (callee.object?.type === "Identifier" && callee.object.name === "Array" && method === "from") {
          if (expr.arguments[1] != null) return returnSourceOf(expr.arguments[1], new Set());
          return expr.arguments[0] != null ? arraySourceOf(expr.arguments[0], seen) : null;
        }
        if (method === "map" || method === "flatMap") {
          return expr.arguments[0] != null ? returnSourceOf(expr.arguments[0], new Set()) : null;
        }
        return ARRAY_PRESERVING_METHODS.has(method) ? arraySourceOf(callee.object, seen) : null;
      }

      if (expr.type === "ConditionalExpression") {
        return arraySourceOf(expr.consequent, seen) ?? arraySourceOf(expr.alternate, seen);
      }

      if (expr.type === "LogicalExpression") {
        return arraySourceOf(expr.left, seen) ?? arraySourceOf(expr.right, seen);
      }

      if (expr.type === "Identifier") {
        const variable = resolveVariable(sourceCode, expr);
        if (variable == null || seen.has(variable)) return null;
        seen.add(variable);
        for (const write of writesTo(variable)) {
          const found = arraySourceOf(write, seen);
          if (found != null) return found;
        }
      }

      return null;
    }

    function elementParameterSourceOf(variable) {
      for (const def of variable.defs ?? []) {
        if (def.type !== "Parameter" || !isFunction(def.node)) continue;
        const fn = def.node;
        const call = fn.parent;
        if (call?.type !== "CallExpression" || call.arguments[0]?.start !== fn.start) continue;
        const method = methodName(call.callee);
        const index = fn.params.findIndex((param) => param.type === "Identifier" && param.name === variable.name);
        const isElement = SORT_METHODS.has(method)
          ? index === 0 || index === 1
          : ELEMENT_CALLBACK_METHODS.has(method) && index === 0;
        if (!isElement) continue;
        const found = arraySourceOf(call.callee.object, new Set());
        if (found != null) return `an element of an array built from ${found}`;
      }
      return null;
    }

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

      if (expr.type === "MemberExpression") {
        const name = propertyName(expr);
        return name != null && properties.has(name) ? `the \`${name}\` property` : null;
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
        return elementParameterSourceOf(variable);
      }

      return null;
    }

    const parseAdvice =
      "Parse both sides and compare the dates (`compareAsc(parseISO(a), parseISO(b))`), " +
      "or use a comparator that does the same for day keys.";

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
      CallExpression(node) {
        const method = methodName(node.callee);
        if (method === "localeCompare") {
          const source =
            sourceOf(node.callee.object, new Set()) ??
            (node.arguments[0] != null ? sourceOf(node.arguments[0], new Set()) : null);
          if (source == null) return;
          context.report({
            node,
            message:
              `\`localeCompare\` orders a date string from ${source} as text, ` +
              "which orders dates only while both sides share one zero-padded ISO shape. " +
              parseAdvice,
          });
          return;
        }
        if (SORT_METHODS.has(method) && node.arguments.length === 0) {
          const source = arraySourceOf(node.callee.object, new Set());
          if (source == null) return;
          context.report({
            node,
            message:
              `\`.${method}()\` with no comparator orders date strings from ${source} by UTF-16 code unit, ` +
              "which orders dates only while every element shares one zero-padded ISO shape. " +
              "Pass a comparator that parses and compares the dates " +
              "(`(a, b) => compareAsc(parseISO(a), parseISO(b))`), or one that does the same for day keys.",
          });
        }
      },
    };
  },
};
