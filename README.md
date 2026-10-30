# Invarith

Know what your code actually does. Verify with evidence. Learn with confidence.

Invarith is a Python practice, verification and interview workspace with English and Traditional Chinese interfaces.

- Generate algorithm and debugging exercises, or bring your own code and cases.
- Run Python in isolation and inspect actual outputs, counterexamples and execution traces.
- Compare repairs against a saved baseline and check for regressions.
- Practice interviews with guided hints or an examiner that withholds hints.
- Learn through animated lessons, optional narration and learning progress records.

## Run locally

Install Node.js 20.12 or newer and Docker Desktop with Linux containers enabled. From the repository directory:

```sh
npm ci
docker pull python:3.12-alpine
```

Copy `.env.example` to `.env`, then start the app:

```sh
npm start
```

Open [English](http://127.0.0.1:3210/en/) or [Traditional Chinese](http://127.0.0.1:3210/zh-TW/). `npm start` builds the React interface and localized pages automatically. Use `npm run dev` for backend watch mode or `npm run build` to rebuild the interface.

## AI configuration

In `.env`, set `AI_CHAT_URL`, `AI_API_KEY` and `AI_MODEL` for your provider's OpenAI-compatible chat-completions endpoint. `.env.meta.example` is an example for Meta; use the endpoint and model currently available to your account. Never commit a populated environment file.

AI generation and hints use provider credits. Existing practice exercises and explicit test execution can be used without AI configuration. AI-generated expectations require review; passing cases establish evidence only for those inputs.

## Optional Python services

The default Docker runner needs no host Python installation. For optional services, use a separate Python virtual environment:

| Service | Dependencies | Environment |
| --- | --- | --- |
| Modal execution | `requirements-modal.txt` | `.venv` |
| Local Kokoro narration | `requirements-tts.txt` | `.venv-tts` |
| Online neural narration | `requirements-edge-tts.txt` | `.venv-tts` |

For Modal, install the dependencies in `.venv`, run `python -m modal setup` using that environment, and select Modal in the app. `MODAL_PYTHON` can point to a different trusted interpreter.

For local narration, create `.venv-tts`, activate it, install the CPU build of PyTorch and the speech dependencies:

```sh
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements-tts.txt
python backend/local-voice.py --setup
```

The speech models may require an initial download. Browser voices and captions remain available without optional speech packages. `requirements-tts.lock.txt` records the reference speech environment.

## Repository layout

- `backend/`: application services and isolated Python execution bridges.
- `frontend/`: React workspace, browser modules, styles and translations.
- `scripts/`: interface and localization build scripts.

Generated interface bundles, dependencies, credentials, local learning data, development checks, test suites and historical reports are excluded from this repository. Runtime practice cases and lesson examples are included because they power the application.

This application currently runs on your local machine. Learning records and generated audio are stored locally; cross-device synchronization is not provided. Keep it bound to localhost rather than exposing it as an authenticated public service.
