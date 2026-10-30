"""Executed only inside the disposable Docker worker, never by the API host."""
import contextlib
import io
import json
import sys
import time
import importlib
import importlib.abc
import importlib.util


class ProjectModules(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    """Load flat learner modules from memory only, inside the sandbox."""
    def __init__(self, files):
        self.sources = {}
        for filename, code in files.items():
            name = filename[:-3]
            if not filename.endswith('.py') or not name.isidentifier() or name.startswith('_') or name in sys.stdlib_module_names or name == 'submission':
                raise ValueError('Unsupported project module name: ' + filename)
            self.sources[name] = (filename, code)

    def find_spec(self, fullname, path=None, target=None):
        if fullname in self.sources:
            return importlib.util.spec_from_loader(fullname, self)
        return None

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        filename, code = self.sources[module.__name__]
        module.__file__ = 'workspace/' + filename
        exec(compile(code, module.__file__, 'exec'), module.__dict__)


@contextlib.contextmanager
def project_namespace(payload):
    finder = ProjectModules(payload['files'])
    previous = {name: sys.modules.get(name) for name in finder.sources}
    path = list(sys.meta_path)
    try:
        for name in finder.sources:
            sys.modules.pop(name, None)
        sys.meta_path.insert(0, finder)
        yield importlib.import_module(payload['entryModule']).__dict__
    finally:
        sys.meta_path[:] = path
        for name, module in previous.items():
            sys.modules.pop(name, None)
            if module is not None:
                sys.modules[name] = module


class BoundedOutput(io.TextIOBase):
    def __init__(self):
        self.value = ""

    def write(self, value):
        self.value += value[:max(0, 4000 - len(self.value))]
        return len(value)

    def flush(self):
        pass


def display_value(value, depth=0):
    """Bounded previews without invoking user-defined __repr__ methods."""
    kind = type(value)
    if kind is str:
        text = repr(value[:72]) + (" ..." if len(value) > 72 else "")
    elif value is None or kind is bool or kind is float:
        text = repr(value)
    elif kind is int:
        text = str(value) if value.bit_length() < 256 else "<large integer>"
    elif depth >= 2:
        text = "<nested value>"
    elif kind is list or kind is tuple:
        text = "[" + ", ".join(display_value(v, depth + 1) for v in value[:6]) + (", ..." if len(value) > 6 else "") + "]"
    elif kind is dict:
        parts = []
        for i, (key, item) in enumerate(value.items()):
            if i >= 6:
                parts.append("...")
                break
            parts.append(display_value(key, depth + 1) + ": " + display_value(item, depth + 1))
        text = "{" + ", ".join(parts) + "}"
    else:
        text = "<object not expanded>"
    return text[:120] + (" ..." if len(text) > 120 else "")


class ExecutionTrace:
    def __init__(self, budget, filenames=None):
        self.events = []
        self.budget = budget
        self.truncated = False
        self.filenames = filenames

    def capture(self, frame, event, arg):
        if frame.f_code.co_filename not in (self.filenames or {'submission.py'}) or frame.f_code.co_name == "<module>":
            return None
        if event not in ("call", "line", "return", "exception"):
            return self.capture
        if len(self.events) >= 80 or self.budget <= 0:
            self.truncated = True
            return None
        variables = {}
        for key, value in frame.f_locals.items():
            if not key.startswith("__"):
                variables[key[:60]] = display_value(value)
                if len(variables) >= 8:
                    break
        entry = {"event": event, "line": frame.f_lineno, "function": frame.f_code.co_name[:80], "variables": variables}
        if self.filenames is not None:
            entry['file'] = frame.f_code.co_filename
        if event == "return":
            entry["value"] = display_value(arg)
        elif event == "exception":
            entry["exception"] = arg[0].__name__[:80]
        size = len(json.dumps(entry, ensure_ascii=True))
        if size > self.budget:
            self.truncated = True
            self.budget = 0
        else:
            self.events.append(entry)
            self.budget -= size
        return self.capture


class ExecutionWork:
    # Counts Python source-line events only; no claim about built-in complexity.
    def __init__(self):
        self.events = []
        self.truncated = False
        self.lines = 0

    def capture(self, frame, event, arg):
        if frame.f_code.co_filename != "submission.py":
            return None
        if event == "line":
            self.lines += 1
            if self.lines > 1000000:
                raise RuntimeError("Practice work budget exceeded")
        return self.capture


def same_json(actual, expected):
    if type(actual) is not type(expected):
        # JSON has one numeric type, but booleans must not equal numbers.
        if type(actual) not in (int, float) or type(expected) not in (int, float):
            return False
    if isinstance(actual, dict):
        return actual.keys() == expected.keys() and all(same_json(actual[k], expected[k]) for k in actual)
    if isinstance(actual, list):
        return len(actual) == len(expected) and all(same_json(a, b) for a, b in zip(actual, expected))
    return actual == expected


def run(payload):
    results = []
    filenames = {'workspace/' + name for name in payload['files']} if payload.get('files') else None
    for index, case in enumerate(payload["cases"]):
        output = BoundedOutput()
        start = time.perf_counter()
        row = {"index": index, "expected": case["expected"]}
        trace = ExecutionWork() if payload.get("workMetrics") is True else ExecutionTrace(min(10000, 64000 // len(payload["cases"])), filenames)
        try:
            # Recreate the module for each test so globals cannot leak between cases.
            namespace = {"__name__": "submission"}
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                manager = project_namespace(payload) if filenames else contextlib.nullcontext(namespace)
                with manager as namespace:
                    if not filenames:
                        exec(compile(payload["code"], "submission.py", "exec"), namespace)
                    function = namespace.get(payload["functionName"])
                    if not callable(function):
                        raise ValueError("Callable function not found: " + payload["functionName"])
                    sys.settrace(trace.capture)
                    try:
                        actual = function(*case["args"], **case.get("kwargs", {}))
                    finally:
                        sys.settrace(None)
                # Require a JSON-compatible return value; normalize tuples to JSON arrays.
                actual = json.loads(json.dumps(actual, allow_nan=False))
                row.update(actual=actual, status="passed" if same_json(actual, case["expected"]) else "failed")
        except BaseException as error:
            row.update(status="error", error=(type(error).__name__ + ": " + str(error))[:2000])
            if type(error) is SyntaxError:
                row["errorLine"] = error.lineno
                if filenames and error.filename in filenames:
                    row['errorFile'] = error.filename
            else:
                tb = error.__traceback__
                while tb is not None:
                    if tb.tb_frame.f_code.co_filename in (filenames or {'submission.py'}):
                        row["errorLine"] = tb.tb_lineno
                        if filenames:
                            row['errorFile'] = tb.tb_frame.f_code.co_filename
                    tb = tb.tb_next
        finally:
            sys.settrace(None)
        row.update(durationMs=round((time.perf_counter() - start) * 1000, 2), stdout=output.value,
                   trace=trace.events, traceTruncated=trace.truncated,
                   traceNote="Line events show state before the line executes. Variable previews are bounded; custom objects are not expanded. Main-thread Python function frames only.")
        if payload.get("workMetrics") is True:
            row["workUnits"] = trace.lines
        results.append(row)
    return {"results": results}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    response = run(request)
    print(json.dumps(response, ensure_ascii=True, allow_nan=False))
