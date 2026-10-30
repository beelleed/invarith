"""Parse and tokenize submitted source; never import or execute it."""
import ast
import io
import json
import sys
import tokenize

PAIRS = {ast.GtE: (">=", ">"), ast.Gt: (">", ">="), ast.LtE: ("<=", "<"), ast.Lt: ("<", "<="), ast.Eq: ("==", "!="), ast.NotEq: ("!=", "==")}


def scan(payload):
    source = payload["code"]
    tree = ast.parse(source)
    target = next((node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == payload["functionName"]), None)
    if target is None:
        return {"mutants": [], "note": "No supported top-level synchronous target function was found."}
    lines = source.splitlines(keepends=True)
    tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))

    def character_column(line, byte_column):
        return len(lines[line - 1].encode("utf-8")[:byte_column].decode("utf-8"))

    mutants = []
    comparisons = sorted((node for node in ast.walk(target) if isinstance(node, ast.Compare) and len(node.ops) == 1 and type(node.ops[0]) in PAIRS), key=lambda node: (node.lineno, node.col_offset))
    for node in comparisons:
        before, after = PAIRS[type(node.ops[0])]
        lower = (node.left.end_lineno, character_column(node.left.end_lineno, node.left.end_col_offset))
        right = node.comparators[0]
        upper = (right.lineno, character_column(right.lineno, right.col_offset))
        matches = [token for token in tokens if token.type == tokenize.OP and token.string == before and lower <= token.start and token.end <= upper]
        if len(matches) != 1:
            continue
        token = matches[0]
        prefix = "".join(lines[:token.start[0] - 1]) + lines[token.start[0] - 1][:token.start[1]]
        mutants.append({"line": token.start[0], "offset": len(prefix.encode("utf-8")), "before": before, "after": after})
        if len(mutants) == 3:
            break
    return {"mutants": mutants, "note": "Up to three single comparison-operator replacements in the target function; chained comparisons are excluded."}


try:
    print(json.dumps(scan(json.load(sys.stdin))))
except (SyntaxError, tokenize.TokenError, IndentationError, KeyError, TypeError, ValueError):
    print(json.dumps({"mutants": [], "note": "Source could not be parsed for supported comparison mutations."}))
