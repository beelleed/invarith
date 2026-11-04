# Invarith

Know what your code actually does. Verify with evidence. Learn with confidence.

Invarith is an evidence-driven coding practice, debugging and interview workspace with English and Traditional Chinese interfaces. Manual verification and coding practice support 12 programming languages; advanced execution traces and several guided exercises currently use Python.

- Generate algorithm and debugging exercises, or bring your own code and cases.
- Execute code in isolated containers and compare actual outputs with explicit expectations; inspect Python execution traces for failing cases.
- Compare repairs against a saved baseline and check for regressions.
- Practice interviews with guided hints or an examiner that withholds hints.
- Practice system design across 25 topic families, with an editable architecture diagram, workload estimates, coaching or strict questioning, saved follow-ups and worked teaching walkthroughs.
- Learn through animated lessons, optional narration and learning progress records.

## How it works

The frontend uses React and CodeMirror. A Node.js HTTP backend manages accounts, saved work and verification workflows. Docker provides isolated execution; Modal is an optional Python runner. Records are saved as private server-side files. This repository does not require Next.js, FastAPI or a hosted database.

The configured Meta model proposes verification plans, generates original exercises, asks interview follow-ups and explains observed failures. It does not decide whether a program passes a test: the runner and application judge compare executed output against reviewed expectations. Generated questions are checked by comparing two generated implementations on application-created inputs; agreement is a consistency check, not proof of correctness.

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

## Accounts and personal records

Create an account on the sign-in page. Passwords are salted and hashed with scrypt; opaque sessions use HttpOnly, SameSite cookies. Records are stored on this server under `data/users/<account-id>/`, and browser drafts/preferences are scoped by account and practice workspace. The same server and account can be used from another device; unsaved browser drafts stay on the browser where they were edited. Registration grants access immediately. Change a known password from the account menu, or recover a forgotten password using an emailed code when the server has SMTP configured. A saved recovery key is an additional option. No separate email-verification step is required to practice.

For recording or a fresh practice run, open **Your account → Demo and practice workspaces → Review workspace records**. Starting a clean workspace requires the current password and the account email. It switches to an empty workspace while retaining the previous workspace as an archive. Reopen an archived workspace from the same menu to recover its records and local drafts. This does not permanently delete archive files or delete the account. A separate Demo account is useful for keeping recordings separate from personal study.

Existing single-user records are preserved separately and are never automatically assigned to the first registrant. After the intended owner creates an account, the machine operator can preview an import:

```sh
npm run accounts:import -- --email owner@example.com
```

Add `--apply` to copy the previewed records into that account's current workspace. Existing destination files are skipped, and originals remain in place. The import includes saved server records and generated audio; old unscoped browser drafts remain in the original browser storage.

For remote hosting, use HTTPS, configure `APP_ORIGIN` to the trusted public origin, and set `HOST` explicitly. Keep the `data/` directory private and back it up. The exported `createApp` is an internal unauthenticated application factory used for isolated tests; `backend/server.mjs` and `npm start` run the account-protected server.

## AI configuration

In `.env`, set `AI_CHAT_URL`, `AI_API_KEY` and `AI_MODEL` for your provider's OpenAI-compatible chat-completions endpoint. `.env.meta.example` is an example for Meta; use the endpoint and model currently available to your account. Never commit a populated environment file.

Meta can be used directly through its available chat-completions endpoint. Baseten is an optional alternative provider for a compatible model; it is not required to run the application. Only the configured provider handles a request; there is no automatic multi-provider fallback.

AI generation and hints use provider credits. Existing practice exercises and explicit test execution can be used without AI configuration. AI-generated expectations require review; passing cases establish evidence only for those inputs.

Open **Mock interview → System design** for the URL-shortener exercise. Starting, clarifying requirements, editing/saving the design, capacity calculations and finishing work without a model request. A session has up to four answers: requesting the next question uses the configured model for the first three answers; the final answer is saved without a model call. Coaching allows up to three requested hints, while strict mode suppresses hints. Optional AI feedback appears after finishing and is reused when reopened. Architecture diagrams and capacity calculations are hypothetical designs and estimates, not load-test evidence. Sessions are stored under the signed-in account's current workspace on the server; browser drafts preserve unsaved edits and explanations.

The practice desk starts with **New AI question** for newly generated contracts. Choose **Curated practice → Open ready practice** to open prepared coding or debugging questions without a model request. Supported optimization questions also open this way. Topic, difficulty and level filters still apply; prepared contracts and bug versions rotate within the finite collection rather than claiming unlimited new questions. Existing sessions and their test evidence are preserved.

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

- `backend/`: account-protected application services and isolated Python/polyglot execution bridges.
- `frontend/`: React workspace, browser modules, styles and translations.
- `scripts/`: interface and localization build scripts.

Generated interface bundles, dependencies, credentials, local learning data, development checks, test suites and historical reports are excluded from this repository. Runtime practice cases and lesson examples are included because they power the application.

By default the server runs on your local machine. Saved account records and generated audio live on that server. Another device can access the same saved records when it connects to the same running server; browser-only drafts and preferences are not synchronized. Public hosting still requires HTTPS, a trusted origin, persistent private storage, backups and a stable deployment. A temporary tunnel is a review link, not a production hosting setup.

## Practice backups

In Learning studio → Learning records, download a JSON backup of saved practice questions, submissions, solution notes, debug journals and practice lists. On another Invarith installation, choose that file, review the preview, then restore missing records. Existing records are preserved; lists with an existing ID or name are skipped.

Browser-only drafts, interviews, recordings and API settings are excluded. Backups contain saved code and test expectations, so keep them private. Restoring imports history without executing code or requesting AI feedback.

## Custom practice tests

Below the practice editor, choose **My tests → My custom tests** to save up to ten input/expected-return checks per question. Arguments use JSON arrays, optional named arguments use JSON objects, and expected returns use JSON values. Copy the first public example as a starting point, or add a boundary case of your own.

Save changes before running. Checks use isolated Python execution with no AI request. Results compare against your own expectations and do not change hidden-test grades, submission history or learning progress. Saved suites are included in practice backups; unsaved drafts stay in that browser. A fresh retry starts with an empty custom suite.

After running, choose **Explore this input** on a custom case to replay its saved input and current tested code. Inspect executed lines and local variables, or predict the next captured state. Passing cases can be explored too. Replays retain your expected value, flag results that differ from the saved run, and never replace your original evidence. Editing code or cases requires running the custom suite again before tracing.

Use **Pin this custom-test run** before editing your code to preserve a comparison baseline. Your next custom run shows fixes, regressions, additions/removals and a code comparison. Cases match by arguments, named arguments and expected return values; changing an expectation is never counted as a fix. Baselines are included in backups, can be replaced or cleared explicitly, and do not affect formal submissions or learning totals.

Once all custom cases match, choose **Challenge my tests** to try up to three supported comparison-operator changes. The original code is replayed first; variants run in isolation with expected answers compared outside submitted Python. Return-value changes, unchanged outputs, execution errors and inconclusive runs remain separate. An undetected variant may represent a missing case, unreachable code or equivalent behavior; this is not a coverage or correctness score. Checks use no AI credits, preserve the editor and saved results, and are cached only during the current server session.

For a change not distinguished by your suite, choose **Try to find a counterexample**. Supply an input and an expected return, then compare the original and changed versions. If their return values differ and the original matches your expectation, review that expectation against the question before adding the input to your test draft. Adding remains explicit; save and rerun the suite to retain the case. A difference does not establish which implementation is correct. Restarting the server or replacing the test challenge requires reopening the current challenge before probing.

After observing a difference, **Find a shorter input** can try deleting parts of a short first positional string or flat array while keeping other arguments unchanged. The bounded search checks at most four candidates and replays the selected pair before presenting it. Smaller inputs may violate the contract, and their expected-return proposal comes from the original execution rather than an independent oracle. Load the proposal back into the experiment, review the input and expected return, then compare again before adding it. This does not establish validity or minimality and never saves a case automatically.

After a custom run, **Download runnable custom tests** exports one Python file containing that tested code, your custom cases and the saved result metadata. It uses Python 3.12's standard-library `unittest`, recreates globals for each case, preserves named arguments, normalizes JSON-compatible return values and distinguishes booleans from numbers. Failing expectations remain failing tests; hidden cases and API settings are excluded.

The exported file executes the saved code. Use an isolated Python environment and run `python invarith-custom-tests-XXXXXXXX.py` with the downloaded filename. This is a conventional test replay, not Invarith's sandbox or trace capture; it does not reproduce the application's resource limits. Exporting itself executes nothing, uses no AI credits and leaves learning records unchanged.

## Solution planning

In a practice question, choose the **Plan** tab for **My solution plan** and the **Notes** tab for your solution notes. Work through understanding and approach, boundary cases, and time/space reasoning before coding. **Rehearse my explanation** gathers your written ideas into an outline for speaking practice. Plans are learner notes, not correctness or complexity assessments; they use no AI credits and do not affect grades or learning totals.

Drafts remain in the browser until you choose **Save solution plan**. Saved plans travel with practice backups. Conflicting saves require choosing a version, and fresh retries start with an empty plan.

In **Learning records → My learning notebook → Saved solution plans**, search your saved reasoning or filter by topic. The collection includes older saved questions with pagination. Choose **Recall this plan** to explain the approach before revealing your notes, or open the original question. Recall drafts last only while that review stays open; they are not graded and do not count as practice submissions.

## Practice workspace navigation

The question column has **Question**, **Plan**, **Notes** and **Practice options** tabs. Interview, lesson, retry and related-question actions live in Practice options. Your code editor stays visible above **Results**, **My tests**, **Debug journal**, **Explain aloud**, **Versions** and **AI assistant**. Panels keep their mounted state when switched; leaving the oral panel stops microphone capture and audio playback.

Use Ctrl/Command + Enter in the practice editor to run public examples, or add Shift to submit to hidden tests. These shortcuts do not trigger the separate verification workspace. Tab lists also support arrow keys, Home and End. Running public or hidden tests opens Results automatically.

Code inputs offer **Code editor** and **Whiteboard mode**. The code editor provides syntax highlighting, paired brackets and quotes, automatic indentation, undo/redo, and completion suggestions for language keywords, common standard libraries and names in the current document. Use Ctrl/Command + Space to open suggestions and Tab to accept one or indent. Suggestions are local; they do not send code to an AI service or inspect arbitrary installed packages. Whiteboard mode keeps plain text and manual indentation. Switching modes preserves the source, and each workspace remembers its mode in this browser.

In **Verify code → Description**, enter a **Question title**. Edits automatically save each question's current language, source, intended behavior and test-case draft, even when code or cases are unfinished. Use **New question** to start another draft and **Saved questions** to resume one. **Save now** flushes the pending save. Completed evidence and the selected comparison baseline remain linked to the question; edited code still needs a fresh verification run. Questions are stored with the signed-in account on the server, with a browser copy while synchronization is pending.

Reloading resumes the last question and its selected tool panels for that page language, using the browser's saved code draft when available. English and Traditional Chinese keep separate resume pointers. Missing questions clear only their pointer, not code drafts; a temporary load failure offers an explicit retry. Resuming only reads saved data and never generates a question or calls a model automatically. Browser resume preferences are not included in practice backups.

Unsent oral explanations are kept in the browser separately for each interview, question and round. Reloading restores that text without sending it. Failed submissions retain the draft; an accepted explanation clears only the completed round. Editing code does not discard the conversation, which remains labeled as referring to its earlier tested version. Audio recordings remain page-only and are not stored with text drafts. Browser explanation drafts are not part of practice backups.

Opening a solution lesson from practice preserves the complete function contract and function name. Public examples are included whole when they fit; oversized examples are omitted with a notice rather than cut in half. A contract that cannot fit the lesson request is rejected before any model request, leaving the existing lesson input unchanged. Generated teaching and code still need review and verification.

## Programming languages

Verification and coding practice support 12 languages: Python 3.12, JavaScript (Node 24), TypeScript 5.9, Java 17, C++17, Go 1.19, Rust 1.63, C# 7.2 (Mono), Kotlin 1.3, C17 (cJSON), Ruby 3.1 and PHP 8.2. Select a language above the editor. Each language keeps a separate browser draft; completed practice submissions also retain their language and source on the server. The same public and hidden expectations are used for every language. Switching languages clears the displayed result until that draft is run. Learning statistics include completed submissions in all 12 languages.

Build the additional isolated runtime once before using non-Python languages:

```powershell
docker build -t invarith-polyglot:2 backend/polyglot
```

The optional POLYGLOT_IMAGE environment variable selects a trusted prebuilt equivalent. Never put learner code or secrets in the image. This runtime uses a fresh network-disabled, read-only container, a bounded temporary filesystem, CPU/memory/process/output limits, compiler timeouts, and a per-case runtime limit. The API host judges returned JSON; hidden expected values are not passed to learner processes. Containers are removed on completion or failure.

Use a named function with positional arguments and JSON-compatible inputs/return values. Java uses a method in a Solution class (static or instance), with Gson available for JSON-shaped values. C++ uses a free function; standard containers and nlohmann::json are available. Main functions are supplied by the runner. Generated starter types are inferred from public examples and can be edited when a contract needs a different type.

TypeScript is compiled with [TypeScript's strict checking and noEmitOnError](https://www.typescriptlang.org/docs/handbook/compiler-options.html); type errors stop execution. It supports compiler transformations such as enums, not just erasable type annotations. JavaScript/TypeScript functions may return promises. Go, Rust and Kotlin use a named top-level function without main; Go includes package main. C# uses a named method in Solution. Ruby uses a named method and PHP uses a named function with a <?php opening tag. C takes const cJSON* arguments and returns an owned cJSON* result; NULL is an execution error, while cJSON_CreateNull() returns JSON null. Rust supports JSON-compatible scalars, Vec, Option, string-keyed maps, two-element tuples and serde_json::Value; arbitrary custom serialization types are not part of the adapter contract. C++ is compiled with [GCC's C++17 mode](https://gcc.gnu.org/projects/cxx-status.html). External packages, custom object protocols, framework projects and named Python-style arguments are outside this runner's contract.

Python-specific prepared debug/optimization exercises, line-event traces, mutation/static analysis, custom-probe tools, interview/OA runners and teaching code remain Python features. Other languages are available for writing solutions to coding questions and for manual verification. Selecting another language does not translate Python code or lessons automatically.

Non-Python execution rejects unsafe JSON integers rather than silently rounding them, rejects NaN/infinity, and compares booleans separately from numbers. Floats use exact JSON numeric equality, without an implicit tolerance. Typed Java, Kotlin, Go, Rust, C# and C++ parameters reject incompatible primitive JSON shapes rather than coercing strings or fractions into integers. Each case starts a fresh learner process. New languages share the same explicit expectations and private judge as existing practice; this improves reproducibility but cannot establish that AI-generated expectations are correct.

## Password recovery by email

Registration grants access without a separate email-verification step or unverified-email badge. Users can select **Forgot your password? Reset by email** on the sign-in page and prove ownership with the emailed eight-digit code. Recovery keys remain available as a backup. Changing an email clears its verified status; a password reset preserves the account and records, rotates its recovery key, and invalidates previous sessions.

Set `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` (465 or 587), `MAIL_SMTP_USER`, `MAIL_SMTP_PASSWORD` and `MAIL_FROM` privately in the server environment, then restart the service. These are backend-only settings. The SMTP adapter requires encrypted delivery using [Nodemailer's TLS options](https://nodemailer.com/smtp). No mail is sent on application startup. Users explicitly request password-reset codes. Existing accounts can receive password-reset codes even if they have not completed email verification. Successfully entering the reset code proves ownership of the registered address and marks it verified.

Without these settings, the interface clearly marks delivery as unavailable and keeps recovery-key access. Entering settings enables the flow, but successful end-to-end delivery must still be checked with the chosen provider; local tests use fake mailboxes and do not prove inbox delivery. A separate sender account and any provider-specific sender verification are deployment prerequisites.

Codes expire after ten minutes, allow at most five incorrect attempts, and are bound to a purpose, request, account, address and credential version. Only hashes are stored. Resends invalidate the prior code and have a one-minute cooldown. Reset requests use the same public response for verified, unverified and missing accounts, with delivery dispatched separately, following the principles in [OWASP's password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). API responses never include the emailed code. No reset link is built from an untrusted request host; users enter the code in their existing application page.
