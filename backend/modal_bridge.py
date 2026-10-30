"""Trusted local SDK bridge. Submitted Python runs only inside a fresh Modal Sandbox."""
import concurrent.futures
import json
import sys
from pathlib import Path


def collect(stream, limit=256000):
    chunks, length = [], 0
    for chunk in stream:
        chunk = chunk.encode() if isinstance(chunk, str) else chunk
        length += len(chunk)
        if length > limit:
            raise RuntimeError("Cloud output exceeded the capture limit.")
        chunks.append(chunk)
    return b"".join(chunks).decode("utf-8")


def execute(sandbox, source, payload, timeout):
    process = sandbox.exec("python", "-I", "-B", "-u", "-c", source, timeout=timeout, text=False, bufsize=-1)
    process.stdin.write(json.dumps(payload).encode())
    process.stdin.write_eof()
    process.stdin.drain()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        stdout = pool.submit(collect, process.stdout)
        stderr = pool.submit(collect, process.stderr, 8000)
        output, errors = stdout.result(), stderr.result()
    if process.wait() != 0:
        raise RuntimeError("Cloud Python process did not complete successfully.")
    return json.loads(output)


def main(payload):
    import modal
    if payload.get("mode") == "health":
        from modal.config import config
        configured = bool(config.get("token_id") and config.get("token_secret"))
        return {"ready": configured, "message": "Modal SDK and local credentials configured; cloud capacity and credits are not confirmed until a job runs." if configured else "Run .venv\\Scripts\\python.exe -m modal setup to connect Modal.", "execution": "modal-python"}
    root = Path(__file__).parent
    sandbox = None
    try:
        app = modal.App.lookup("invarith-verification", create_if_missing=True)
        sandbox = modal.Sandbox.create("sleep", "30", app=app, image=modal.Image.debian_slim(python_version="3.12"), cpu=(0.125, 0.5), memory=(128, 256), timeout=30, idle_timeout=20, block_network=True, secrets=[], volumes={})
        # Capture the trusted static scan before executing the untrusted submission.
        security = execute(sandbox, (root / "security_scan.py").read_text(encoding="utf-8"), {"code": payload["submission"]["code"]}, 6)
        if payload.get("mode") == "security":
            return {"security": security, "sandboxId": sandbox.object_id}
        result = execute(sandbox, (root / "runner.py").read_text(encoding="utf-8"), payload["submission"], 10)
        return {**result, "security": security, "sandboxId": sandbox.object_id}
    finally:
        if sandbox is not None:
            sandbox.terminate()


if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, "data": main(json.load(sys.stdin))}, ensure_ascii=True))
    except Exception as error:
        # Never emit exception text that might contain credentials or account configuration.
        print(json.dumps({"ok": False, "errorType": type(error).__name__, "error": "Modal request failed. Check authentication, available credits, permissions and limits. No Docker fallback was used."}))
