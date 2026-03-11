# PySupport

A single-page, static web application providing an interactive Python tutorial for psychology students and researchers. It runs Python directly in the browser via [Pyodide](https://pyodide.org/) — no server-side backend, no build process, zero setup for the learner.

**Live site:** [peer-support.live](https://peer-support.live)

**License:** [Unlicense](LICENSE) (Public Domain)

---

## Getting Started

### Prerequisites

- Python 3.x (for the local dev server)
- Node.js (optional — for linting and formatting only)

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
npm install          # Install ESLint + Prettier
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

```
┌─────────────────────────────────────────────┐
│  Browser Main Thread (runner.js)            │
│  - UI, navigation, theme, overlays          │
│  - Spawns worker, streams output            │
│  - Handles input() prompts via SAB          │
├──────────────────────┬──────────────────────┤
│  SharedArrayBuffer   │  postMessage         │
│  (stdin protocol)    │  (stdout/stderr)     │
├──────────────────────┴──────────────────────┤
│  Web Worker (pyodide-worker.js)             │
│  - Loads Pyodide with SRI integrity checks  │
│  - Executes Python, streams output          │
│  - Blocks on Atomics.wait for input()       │
└─────────────────────────────────────────────┘
```

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

- **`index.html`**: The main Pyodide script uses native browser SRI via the `integrity` attribute.
- **`pyodide-worker.js`**: Worker-loaded scripts (`pyodide.mjs`, `pyodide.asm.js`, `pyodide.asm.wasm`) are fetched manually and verified at runtime via `crypto.subtle` SHA-384 hashes before execution.

Hashes are hardcoded in `pyodide-worker.js` and the `INTEGRITY` object is frozen to prevent tampering.

### Service Worker & Caching (`sw.js`)

- **Cache name:** `python-guide-v14` — bump this on any cached asset change.
- **Precached assets (6):** `index.html`, `style.css`, `runner.js`, `pyodide-worker.js`, `manifest.json`, `favicon.png?v=5`.
- **Strategy:** Stale-while-revalidate for static assets; CDN requests (`cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`) bypass the cache entirely.
- **Offline support:** Tutorial content is fully available offline after first visit.
- **COOP/COEP injection:** The SW injects isolation headers on all same-origin responses as a fallback.

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
- **Interrupt:** Re-clicking Run during execution sends `KeyboardInterrupt` to the worker.
- **Context injection:** `addContext()` auto-injects tutorial variables (`lst`, `record`, EEG data, pandas DataFrames) when code uses but doesn't define them.
- **Overlays:** Delegated click handler on `document` for `data-overlay-show`/`data-overlay-hide` attributes with focus trap management.

### `pyodide-worker.js`

Classic Web Worker for isolated Python execution:

- **SRI enforcement:** Fetches Pyodide CDN scripts, verifies SHA-384 hashes via `crypto.subtle` before execution.
- **AST execution:** Uses an AST-based `_run()` helper for REPL-style `repr()` output on the last expression.
- **Lazy packages:** `matplotlib`, `scipy`, `pandas` loaded on demand via `ensurePackage()` (checks `loadedPackages` before calling `loadPackage`).
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

Several version strings are coupled across files. Changing one without the others causes cache misses, stale assets, or broken offline support. Full coupling rules are documented in [`AGENTS.md`](AGENTS.md).

**Quick reference:**

| Change                    | Files to update                                                           |
| ------------------------- | ------------------------------------------------------------------------- |
| Any cached asset modified | `sw.js` → bump `CACHE_NAME`                                               |
| Favicon image changed     | `index.html` + `sw.js` (match `?vN` query string), bump `CACHE_NAME`      |
| Pyodide version upgrade   | `index.html` (SRI hash), `pyodide-worker.js` (CDN URL + integrity hashes) |
| Font CDN URL changed      | `index.html` (4 WOFF2 preload hrefs)                                      |

---

## Browser Requirements

- **Modern browser** with `SharedArrayBuffer` support (Chrome 91+, Firefox 79+, Safari 15.2+, Edge 91+).
- **Secure context** required (HTTPS or `localhost`) — `SharedArrayBuffer` is not available on plain HTTP.

---

## Deployment

The site is deployed as static files to **Cloudflare Pages**. No build step is needed — the repository contents are served directly.

- Production headers (COOP/COEP, HSTS, security) are configured in `_headers`.
- SEO files (`robots.txt`, `sitemap.xml`) are included at the root.
- The custom `404.html` is served by Cloudflare for missing routes.

---

## AI Agent Guidelines

Detailed architecture docs, code style conventions, and implementation checklists for AI agents are in [`AGENTS.md`](AGENTS.md). This includes the full SharedArrayBuffer protocol, context injection rules, overlay focus management patterns, and version coupling specifics.

---

## Companion Project

The interactive Jupyter notebooks that accompany this course are available at:
**[github.com/vanyaisme/python-for-psychologists-notebooks](https://github.com/vanyaisme/python-for-psychologists-notebooks)**
