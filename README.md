# PySupport

A single-page, static web application providing an interactive Python tutorial for psychology students and researchers. It runs Python directly in the browser via [Pyodide](https://pyodide.org/) — no server-side backend and zero setup for the learner. A small release script prepares immutable deployment assets; no bundler is used.

**Live site:** [peer-support.live](https://peer-support.live)

**License:** [Unlicense](LICENSE) (Public Domain)

---

## Getting Started

### Prerequisites

- Python 3.x (for the local dev server)
- Node.js 22+ (optional — for development checks and tests)

### Run Locally

1. **Clone the repository:**

   ```bash
   git clone git@github.com:vanyaisme/python-peer-support-ref.git
   cd python-peer-support-ref
   ```

2. **Start the dev server:**

   ```bash
   python3 serve.py
   # or on a custom port:
   python3 serve.py 3000
   ```

   This starts a local server on **port 8080** with the COOP/COEP isolation headers required for `SharedArrayBuffer` and synchronous `input()`.

   > **Note:** `python3 -m http.server` works for read-only browsing, but `input()` will not function without the isolation headers.

3. **Open in browser:** Navigate to `http://127.0.0.1:8080`.

### Dev Tooling (optional)

```bash
npm ci               # Install locked development dependencies
npm run lint         # Lint JS files (ESLint v9, flat config)
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format JS, CSS, JSON (Prettier)
npm run format:check # Check formatting without writing
```

---

## Project Structure

```
.
├── index.html           # Tutorial content (29 sections, 9-stage roadmap)
├── style.css            # Design system, themes, responsive layout
├── runner.js            # UI logic, Pyodide orchestration, overlays
├── pyodide-worker.js    # Web Worker — isolated Python execution + SRI verification
├── sw.js                # Service Worker — caching, offline support, COOP/COEP injection
├── serve.py             # Local dev server with isolation headers
├── _headers             # Cloudflare Pages production headers
├── manifest.json        # PWA manifest ("Add to Home Screen")
├── favicon.png          # Favicon
├── icon-192.png         # PWA icon (192×192)
├── icon-512.png         # PWA icon (512×512)
├── assets/
│   └── og-image.png     # Open Graph social sharing image
├── 404.html             # Custom 404 page
├── robots.txt           # Search engine crawl rules
├── sitemap.xml          # Sitemap for SEO
├── llms.txt             # LLM context file
├── eslint.config.mjs    # ESLint v9 flat config
├── .prettierrc          # Prettier config
├── jsconfig.json        # JS/LSP project config (ES2022, DOM, WebWorker)
├── package.json         # Dev dependencies and npm scripts
├── AGENTS.md            # AI agent guidelines (conventions, architecture, coupling rules)
├── LICENSE              # Unlicense (Public Domain)
└── README.md            # This file
```

---

## Architecture

### Overview

The site is a **static single-page application** deployed to **Cloudflare Pages**. All Python execution happens client-side in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) via Pyodide v0.29.3. There is no backend.

The main thread manages controls and output. A dedicated worker executes Python. Shared memory carries input and cancellation; worker messages carry output and completion. Each worker generation owns its buffers and is checked against protocol v2.

### Synchronous `input()` Support

The site uses `SharedArrayBuffer` + `Atomics` to allow Python's `input()` to block the worker thread while the main thread collects user input from the UI.

**This requires Cross-Origin Isolation headers:**

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These headers are set in three places for redundancy:
| Context | File |
|---|---|
| Local development | `serve.py` |
| Production (Cloudflare) | `_headers` |
| Service Worker fallback | `sw.js` |

> **Do not remove these headers.** Without them, `SharedArrayBuffer` is unavailable and `input()` will not work.

### Security: SRI Integrity Verification

All Pyodide CDN scripts are integrity-verified before execution:

- **Page**: Python loads only after Run (or Reset) is requested. The first Run queues that example and executes it after initialization. The page no longer loads its own unused Pyodide copy.
- **`pyodide-worker.js`**: Worker-loaded scripts (`pyodide.mjs`, `pyodide.asm.js`, `pyodide.asm.wasm`) are fetched manually and verified at runtime via `crypto.subtle` SHA-384 hashes before execution.

Hashes are pinned in `pyodide-worker.js` and the `INTEGRITY` object is frozen. These cover the core loader and WebAssembly binary; they are not a sandbox for arbitrary learner code.

The document permits only same-origin scripts, blocks inline script handlers and JavaScript evaluation, and limits workers to this origin. Inline styles remain allowed for the existing lesson layout. Fonts load as normal stylesheets with `display=swap`, without inline `onload` handlers. The worker has a separate response CSP: verified blob scripts and WebAssembly compilation are permitted; JavaScript eval is blocked, and connections are limited to this origin and the pinned Pyodide CDN directory. The service worker may connect only to this origin. `_headers` is used by Cloudflare, `serve.py`, and the release preview; cached responses preserve these policies.

`vendor/prism.js` concatenates the unmodified core, Python and Bash components from pinned `prismjs@1.30.0`; its MIT license is included. Release builds fingerprint and precache it. The release test checks its bytes against the installed package, so an upgrade requires deliberately refreshing the vendor bundle and license. No runtime JavaScript is loaded from the Prism CDN.

### Service Worker & Caching (`sw.js`)

- **Release cache:** `python-guide-<content-derived release ID>` in built deployments; `python-guide-v19` in the source preview.
- **Required assets:** HTML, hashed CSS/runner/Python worker/Prism, manifest, favicon, both PWA icons and social image. Installation rejects any failed download or integrity mismatch; the previous release stays active.
- **Strategy:** Controlled `/` and `/index.html` navigations use that release's cached HTML, including query-string navigation. Required assets stay tied to the same release. Missing cached entries may be fetched only with that release's integrity check.
- **Updates:** An installed update waits until every tab using the old release is closed. A notice asks learners to finish their work, close all site tabs, then reopen. No forced reload, `skipWaiting()` or takeover with `clients.claim()`.
- **Cleanup:** Only older `python-guide-` caches are removed; unrelated application caches remain.
- **Offline promise:** Reading with local styling/icons and syntax highlighting after installation completes. Fonts, Python runtime and scientific packages depend on network/browser caching; offline execution is not guaranteed.
- **COOP/COEP:** Isolation headers remain enabled on same-origin responses.

### PWA Support

The site is installable as a Progressive Web App via `manifest.json`. Icons at 192×192 and 512×512 are provided. Offline reading is enabled by the Service Worker cache.

---

## Codebase Overview

### `index.html`

All 29 tutorial sections organised into a 9-stage learning roadmap. Structure:

- **Sections:** `<div class="section" id="sN">` with a `.section-header` and collapsible `.scenario` cards.
- **Code blocks:** `<pre><code class="language-python">` — JS auto-wraps these with Run/Copy buttons.
- **Callouts:** `.note` (blue/info), `.warn` (orange/warning), `.tip` (green/success).
- **PIP projects:** Four guided project overlays with collapsible code walkthroughs.
- **Badges:** `.badge-[color]` for difficulty and topic tags.

### `runner.js`

Vanilla JavaScript (IIFE, `"use strict"`). Responsibilities:

- **Navigation:** Generates sidebar (desktop, contextual lens with roadmap dots) and mobile nav panel. Scroll-based section highlighting.
- **Theme:** Dark-mode default with light theme toggle. Floating desktop-only theme button (appears on scroll) + TOC toggle — both stay synced.
- **Code execution:** Spawns `pyodide-worker.js`, manages Run/Copy buttons (Python blocks only), streams stdout/stderr to live output panels, renders matplotlib plots inline.
- **Input flow:** SharedArrayBuffer + Atomics protocol — worker blocks, UI shows input prompt, user submits, worker resumes.
- **Startup/recovery:** A 30-second watchdog reports initialization failure with Retry. Old worker messages are ignored.
- **Output limits:** Each run forwards at most 100,000 text code units and 1,000 output messages, with a truncation notice. The page batches incremental DOM updates per animation frame and independently bounds retained text. Terminal diagnostics are reserved up to 4,000 code units. Bulk output is a named region, separate from concise live runtime announcements.
- **Plots:** Capture retains at most five PNGs and eight million base64 characters per run; each image is limited to two million base64 characters and a four-million-pixel canvas. Excess plots are closed and a truncation notice is shown. These are output limits, not a general Python memory quota.
- **Reset Python:** The circular-arrows icon above the floating theme control (above Back to top on mobile) terminates the worker immediately and recreates its buffers and practice files. It stops running code, removes pending input forms, and clears temporary files; existing output remains readable.
- **Keyboard access:** Sidebar links have descriptive names and reveal on keyboard focus. Pointer clicks do not lock the animated panel open. Dialogs have accessible names, filter hidden/collapsed controls out of their focus trap, and make background content inert until closing. Escape restores focus to the opener.
- **Interrupt:** Stop sets a shared SIGINT flag and wakes blocked input. Unresponsive code triggers a new worker after 1.5 seconds, clearing temporary files with a visible explanation.
- **Example fidelity:** Execute the displayed code with fresh variables. Pass real `sys.argv` separately; setup values/imports appear in the examples themselves.
- **Overlays:** Delegated click handler on `document` for `data-overlay-show`/`data-overlay-hide` attributes with focus trap management.

### `pyodide-worker.js`

Classic Web Worker for isolated Python execution:

- **SRI enforcement:** Fetches Pyodide CDN scripts, verifies SHA-384 hashes via `crypto.subtle` before execution.
- **AST execution:** Uses an AST-based `_run()` helper for REPL-style `repr()` output on the last expression.
- **Lazy packages:** `loadPackagesFromImports()` loads all packages a snippet imports, including mixed pandas/scipy/matplotlib usage. Failures are visible.
- **Mock files:** Writes tutorial text files to Pyodide's in-memory filesystem at init.
- **Run-ID correlation:** Each execution is tagged with a unique ID to prevent stale output from cancelled runs.

### `style.css`

Complete design system via CSS custom properties:

- **Themes:** Dark-first (`:root`) with light override (`[data-theme="light"]`).
- **Typography:** System sans-serif for body, `Fira Code` for code, `Dancing Script` for decorative headings.
- **Layout:** Flexbox/Grid. Mobile breakpoint at `768px`. Sidebar lens visible at `≥ 1200px`.
- **Transitions:** Standardised `0.15s` to `0.25s` ease.

**Color system:**

| Variable    | Dark Theme | Light Theme | Usage                           |
| ----------- | ---------- | ----------- | ------------------------------- |
| `--bg`      | `#0f1117`  | `#f5f0e8`   | Page background                 |
| `--surface` | `#1a1d27`  | `#ece6da`   | Card/container background       |
| `--text`    | `#e2e8f0`  | `#2c2a26`   | Main text color                 |
| `--accent`  | `#5b8dee`  | `#4a72b8`   | Primary accent (links, buttons) |
| `--accent2` | `#a78bfa`  | `#7c5cbf`   | Secondary accent (highlights)   |
| `--green`   | `#34d399`  | `#1a8a5e`   | Success states                  |
| `--red`     | `#f87171`  | `#c44040`   | Error states                    |

### `sw.js`

Service Worker handling caching and header injection. See [Service Worker & Caching](#service-worker--caching-swjs) above for details.

### `serve.py`

Minimal Python 3 dev server (standard library only, PEP 8). Injects COOP/COEP headers on every response. Default port 8080, accepts custom port as CLI argument.

---

## Version Coupling

Production release metadata is generated by `npm run build`. `scripts/build-release.cjs` hashes CSS and both JavaScript assets, rewrites page-to-worker references, and embeds an integrity manifest in the service worker. The generated `dist/release-manifest.json` identifies the exact required bytes. Rebuilding unchanged sources produces the same release ID.

Source preview URLs remain coupled at `?v=19` in `index.html`, `runner.js` and `sw.js`; update these and the builder's source-reference checks together when changing the source-preview version. Production release IDs change automatically. Pyodide's pinned version, CDN URLs and runtime SRI hashes must still be updated together.

---

## Browser Requirements

- **Modern browser** with `SharedArrayBuffer` support (Chrome 91+, Firefox 79+, Safari 15.2+, Edge 91+).
- **Secure context** required (HTTPS or `localhost`) — `SharedArrayBuffer` is not available on plain HTTP.

---

## Deployment

Publish **only `dist/`** to Cloudflare Pages, with this repository (`site/`) as the project root and `npm run build` as the build command. Do not upload the source directory, dependencies or test tooling.

```bash
nvm use                      # .nvmrc pins Node 22.23.3
npm ci
npm run check                # lint, formatting, runtime/UI, corpus, release tests, build
npx playwright install chromium
npm run test:browser
npm run test:release:browser
npm run preview:release      # http://127.0.0.1:8081, built files + local header emulation
npm run smoke:deploy -- https://your-preview.pages.dev
```

The generated `_headers` preserves isolation and security headers, makes HTML/service-worker/manifest responses revalidate, and marks `/releases/*` immutable. Rebuilding into an existing `dist/` retains prior hashed assets to support older network-loaded pages; a fresh CI build contains only the current release. Cloudflare Pages must publish the directory as one deployment.

Disable HTML rewriting/injection (including automatic minification or injected analytics) for this site: precached HTML is integrity-checked against the build. The deployment smoke command detects changed HTML bytes, stale release files and incorrect cache/isolation headers. Run it on a hosted preview and again after deployment; local header emulation does not certify Cloudflare configuration. Rules follow [Cloudflare's headers documentation](https://developers.cloudflare.com/pages/configuration/headers/); lifecycle behavior follows [the service-worker update model](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

`.github/workflows/verify.yml` runs the checks on pushes/pull requests and publishes the tested `dist/` as a downloadable artifact. It does not deploy automatically. The custom 404 and SEO files are included in the artifact. To roll back, publish a previously verified complete artifact and let existing tabs finish before its service worker activates.

---

## AI Agent Guidelines

Detailed architecture docs, code style conventions, and implementation checklists for AI agents are in [`AGENTS.md`](AGENTS.md). This includes the full SharedArrayBuffer protocol, execution and cancellation rules, overlay focus management patterns, and version coupling specifics.

---

## Companion Project

The interactive Jupyter notebooks that accompany this course are available at:
**[github.com/vanyaisme/python-for-psychologists-notebooks](https://github.com/vanyaisme/python-for-psychologists-notebooks)**

## Practice files and execution behavior

Each Run starts with fresh variables and a real `sys.argv` (default script name `snippet.py`, or `data-script-name`). Imports are taken from the displayed code. Four error-handling examples deliberately raise their documented exceptions; tests expect these outcomes.

The worker supplies **synthetic practice data**, not research measurements: `my_text_file.txt`, `rt_data.txt`, `some_data.txt`, `data.csv`, `participants.csv`, `words.txt`, `file.txt`, `output.txt`, `open.txt`, `closed.txt`, and `eeg_data.txt`. Normal runs share this temporary filesystem. Reloading or a forced worker restart restores the initial files. The average-writing example uses `rt_average.txt` to avoid overwriting the reaction-time input dataset.

Of 261 Python-marked blocks, 247 execute in Pyodide. Eleven turtle examples and two network examples provide local-run instructions, and one block is a terminal command. Their classification is explicit in the HTML.

## Regression tests

```bash
npm ci
npm test                    # Real Pyodide + UI state regressions
npm run test:examples       # All snippets, reverse-order execution, Python syntax
npx playwright install chromium
npm run test:browser        # Actual worker/browser behavior; starts serve.py itself
npm run lint
npm run format:check
```

The tests require Python 3 and Node.js 22+. Scientific packages are downloaded on first use. Browser tests use pinned Pyodide CDN resources unless `PYODIDE_CACHE_DIR` points to a mirror of that release's files. The mirror must contain the core runtime and package archives from `pyodide-lock.json`; the production worker's integrity checks still run in browser tests. The Node adapter uses the npm Pyodide runtime to test worker execution logic independently of CDN loading. Prism is served from the checked-in vendor bundle, and font CSS is stubbed for browser tests.

Optional environment variables: `TEST_BROWSER=chromium|firefox|webkit` selects the Playwright engine (default Chromium); `CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium binary; `PYTHON` selects the Python executable; `PYODIDE_CACHE_DIR` selects cached runtime/package files. Browser tests cover normal execution, download failure/retry, integrity failure/retry, cooperative and forced cancellation, Unicode input, argv, plotting, theme/collapse, and mobile navigation. Automated engine tests do not replace native Safari/Firefox, screen-reader, real-device or hosted deployment checks.

The GitHub workflow installs the locked dependencies on Linux, runs the complete code/example/release checks, and then runs both browser suites in Chromium, Firefox and WebKit. A configured workflow is not evidence of a successful run: inspect its actual result before release. See `RELEASE-CHECK.md` for the latest evidence and blockers.

Lifecycle tests use browser offline emulation in Chromium/Firefox and a verified origin outage in WebKit because its offline emulation currently rejects service-worker navigations. Firefox request interception is removed before entering offline mode: the combination otherwise rejects even a literal service-worker response in the tested version. Requests after that point use the browser's normal network handling. The development server handles concurrent connections so browser pre-opened sockets cannot stall page loading. The release-check report records the test methods and their limits. [VM-VALIDATION.md](VM-VALIDATION.md) records a clean Ubuntu run of the same checks as an alternative while GitHub Actions is billing-blocked.

Cloudflare's connected Git project uses `main` for automatic production deployments and other branches for previews. Its build command must be `npm run build`, with output directory `dist` and the repository root as the working directory. The local `site/` folder is the Git root, so do not enter `site` as Cloudflare's root directory. These settings were corrected on 26 September 2026; the preceding settings were blank. Pushing or merging to remote `main` publishes production independently of GitHub Actions, so do that only after explicit release approval and passing checks. Use a release-check branch for validation.

### Dependency maintenance

Use `.nvmrc` (Node 22.23.3 LTS) and `npm ci` for the locked toolchain. Run `npm audit` periodically and before releases; audit results describe that check's date, not a permanent guarantee. The 25 September 2026 check resolved four development-tool advisories with compatible lockfile updates. Pyodide remains pinned to 0.29.3, with its existing verified loader hashes. See `SECURITY-VALIDATION.md` for this stage's evidence and remaining coverage limits.


### Downloading results and local examples

Each displayed plot has a **Download plot (PNG)** link. When an example creates or changes files, its output includes **Files from this run** with individual downloads. Text, CSV, JSON, PDF and binary files retain their bytes; nested paths are flattened into safe download filenames. Files are snapshots of that run: a later run or Reset does not change existing links. Closing that output panel releases its file downloads. Downloads require a click and are never started automatically.

Only regular files in the initial lesson workspace are offered. Unchanged practice files, dotfiles, Python caches, symlinks and files outside that workspace are excluded. Each run can offer up to 20 files, 4 MiB per file and 8 MiB total. Workspace inspection also has entry/depth/read limits (500 entries, six directory levels and 16 MiB per scan); an omission notice appears when limits prevent export. These limits bound export work, not arbitrary Python memory or filesystem use. Files written before a Python exception may still be offered; a forced worker termination cannot recover unfinished exports.

Local-only examples now show **Run locally** instead of Run. Their panel explains the requirement and offers the exact displayed code as an `.py` file; it does not invent missing setup for illustrative fragments. The terminal example has a **Terminal** action with copy/paste guidance. Both work without initializing Python and remain available during a runtime failure or when cross-origin isolation is unavailable. Existing Copy buttons remain available.
