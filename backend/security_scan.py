"""Limited AST review. Parses submitted source; never imports or executes it."""
import ast
import json
import sys

RULES = {
    "PY001": ("Dynamic evaluation", "eval evaluates Python expressions. Untrusted input can execute code.", "Use an explicit parser for the required data format, such as JSON for JSON input. Avoid evaluating untrusted text.", "https://docs.python.org/3.12/library/functions.html#eval"),
    "PY002": ("Dynamic code execution", "exec executes Python code. Untrusted input can execute arbitrary statements.", "Replace dynamic execution with explicit functions or a restricted data format. Do not pass untrusted text to exec.", "https://docs.python.org/3.12/library/functions.html#exec"),
    "PY003": ("Pickle deserialization", "Unpickling untrusted or tampered data can execute code.", "Only unpickle authenticated, trusted data. For external simple data, consider JSON with schema validation.", "https://docs.python.org/3.12/library/pickle.html"),
    "PY004": ("Shell command execution", "This API invokes a shell. Untrusted command text may change the executed command.", "Prefer subprocess with a fixed executable, an argument list, and shell=False. Validate arguments for the target program.", "https://docs.python.org/3.12/library/os.html#os.system"),
    "PY005": ("Explicit shell=True", "The shell interprets command text. Whether this is exploitable depends on where the command comes from.", "Review the input source. Where possible use a fixed executable and argument list with shell=False; consider platform-specific subprocess behavior.", "https://docs.python.org/3.12/library/subprocess.html#security-considerations"),
}


def review_security(code):
    report = {"engine": "Invarith Python AST", "version": "1", "status": "completed", "source": "static_analysis", "rulesChecked": list(RULES), "findings": [], "truncated": False,
              "limitations": "Five limited rule families only. Import aliases are resolved approximately; shadowing, dynamic imports, variable shell flags, data flow, reachability, dependency vulnerabilities, and other security issues are not fully analyzed. Warnings are not confirmed exploits. No warnings does not establish safety."}
    try:
        tree = ast.parse(code, filename="submission.py")
    except SyntaxError as error:
        report.update(status="not_scanned", reason="Python syntax error prevents AST review.", errorLine=error.lineno)
        return report
    aliases = {}
    for item in ast.walk(tree):
        if isinstance(item, ast.Import):
            for name in item.names:
                aliases[name.asname or name.name.split(".")[0]] = name.name if name.asname else name.name.split(".")[0]
        elif isinstance(item, ast.ImportFrom) and item.module:
            for name in item.names:
                aliases[name.asname or name.name] = item.module + "." + name.name

    def name_of(item):
        if isinstance(item, ast.Name):
            return aliases.get(item.id, item.id)
        if isinstance(item, ast.Attribute):
            prefix = name_of(item.value)
            return prefix + "." + item.attr if prefix else ""
        return ""

    lines = code.splitlines()
    for item in ast.walk(tree):
        if not isinstance(item, ast.Call):
            continue
        name = name_of(item.func)
        rule = None
        if name in ("eval", "builtins.eval"):
            rule = "PY001"
        elif name in ("exec", "builtins.exec"):
            rule = "PY002"
        elif name in ("pickle.load", "pickle.loads"):
            rule = "PY003"
        elif name in ("os.system", "os.popen"):
            rule = "PY004"
        elif name in ("subprocess.run", "subprocess.call", "subprocess.Popen", "subprocess.check_call", "subprocess.check_output") and any(keyword.arg == "shell" and isinstance(keyword.value, ast.Constant) and keyword.value.value is True for keyword in item.keywords):
            rule = "PY005"
        if not rule:
            continue
        if len(report["findings"]) >= 100:
            report["truncated"] = True
            break
        title, reason, guidance, reference = RULES[rule]
        report["findings"].append({"ruleId": rule, "title": title, "line": item.lineno, "column": item.col_offset + 1, "call": name, "reason": reason, "guidance": guidance, "reference": reference, "snippet": lines[item.lineno - 1][:400], "classification": "static_warning", "exploitConfirmed": False})
    report["findings"].sort(key=lambda item: (item["line"], item["column"]))
    return report


if __name__ == "__main__":
    print(json.dumps(review_security(json.load(sys.stdin)["code"])))
