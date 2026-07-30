/**
 * Ban the double assertion `x as unknown as T`.
 *
 * Direct port of `../../biome/no-double-assertion.grit`.
 *
 * One capability the GritQL version did not have: the `<T>` angle-bracket
 * spelling of the same bridge (`<T><unknown>x`) parses to `TSTypeAssertion`
 * rather than `TSAsExpression`, and is matched here too. It is vanishingly
 * rare in `.tsx` (it is a syntax error there) but free to cover once the rule
 * is working on a real AST rather than a source snippet.
 */

const MESSAGE =
  "`as unknown as T` disables the assignability check rather than satisfying it — nothing verifies this claim. Name the shape both sides share (Omit/Pick/an interface), or narrow with a `value is T` type guard.";

function isUnknownKeyword(typeNode) {
  return typeNode?.type === "TSUnknownKeyword";
}

/** The inner half of a bridge: `x as unknown` / `<unknown>x`. */
function isWidenToUnknown(node) {
  if (node?.type === "TSAsExpression") return isUnknownKeyword(node.typeAnnotation);
  if (node?.type === "TSTypeAssertion") return isUnknownKeyword(node.typeAnnotation);
  return false;
}

export default {
  create(context) {
    return {
      TSAsExpression(node) {
        // The outer hop must land on something concrete. `x as unknown` on its
        // own is the safe direction and stops there.
        if (isUnknownKeyword(node.typeAnnotation)) return;
        if (!isWidenToUnknown(node.expression)) return;
        context.report({ node: node.typeAnnotation, message: MESSAGE });
      },
      TSTypeAssertion(node) {
        if (isUnknownKeyword(node.typeAnnotation)) return;
        if (!isWidenToUnknown(node.expression)) return;
        context.report({ node: node.typeAnnotation, message: MESSAGE });
      },
    };
  },
};
