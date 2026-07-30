/**
 * Ban lint and typecheck suppressions outright.
 *
 * "Never suppress — fix the root cause" is a convention almost every codebase
 * states somewhere and almost none enforces, for a mechanical reason: the
 * suppressions are comments. GritQL cannot match comments at all, because they
 * are not in the AST it queries, and Biome ships no rule banning its own
 * `biome-ignore`. So the convention has only ever been enforceable by review,
 * which means it holds for as long as the reviewer remembers.
 *
 * An ESLint-shaped rule gets `sourceCode.getAllComments()`, so it is
 * enforceable here.
 *
 * This is not a nice-to-have alongside the other four. Oxlint's own disable
 * directives DO suppress custom JS-plugin rules — verified: a fixture with
 * `// oxlint-disable-next-line common-pattern/no-glued-timestamp-via-variable`
 * reports nothing, and reports two diagnostics with the directive removed.
 * The GritQL flavour has no such escape hatch, because Biome cannot switch a
 * plugin off for a line or even for a glob. So adopting the JS rules WITHOUT
 * this one would trade a gap in the rules for a gap in the enforcement: every
 * ported rule becomes opt-out, silently, on the day it moves.
 *
 * `oxlint-disable`/`eslint-disable` are included for that reason.
 * `@ts-ignore` is here too even though Biome's `noTsIgnore` already covers it,
 * so that this rule is complete on its own if it ever runs somewhere Biome
 * does not.
 */

const PATTERNS = [
  { re: /@ts-ignore\b/, what: "@ts-ignore" },
  { re: /@ts-expect-error\b/, what: "@ts-expect-error" },
  { re: /@ts-nocheck\b/, what: "@ts-nocheck" },
  { re: /\bbiome-ignore\b/, what: "biome-ignore" },
  { re: /\boxlint-disable(?:-next-line|-line)?\b/, what: "oxlint-disable" },
  { re: /\beslint-disable(?:-next-line|-line)?\b/, what: "eslint-disable" },
];

export default {
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          for (const { re, what } of PATTERNS) {
            if (!re.test(comment.value)) continue;
            context.report({
              node: comment,
              message: `\`${what}\` suppresses a check rather than satisfying it. Fix the root cause — a suppression is a claim that the tool is wrong, and it goes stale silently while the code around it changes.`,
            });
            break;
          }
        }
      },
    };
  },
};
