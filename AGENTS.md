# Agent Guidelines: PySupport

This document provides essential context, architecture details, and style guidelines for AI agents working on this repository.

## Project Overview
A static single-page web application providing an interactive Python tutorial with in-browser execution via Pyodide.
- **Live URL**: peer-support.live
- **Deployment**: Cloudflare Pages (static files)
- **License**: Unlicense (Public Domain)

## Development Environment
### Dev Server Commands
- `python3 serve.py` — **PREFERRED**. Runs on port 8080. Injects COOP/COEP headers required for `SharedArrayBuffer` and synchronous `input()`.
- `python3 serve.py 3000` — Custom port.
- `python3 -m http.server 8765` — Simple alternative. **Warning**: No COOP/COEP headers; Pyodide `input()` will not work.

### Load Order & CSP
- **Head**: Pyodide CDN script (`defer` + SRI hash), `style.css` (preload → stylesheet), `runner.js` (preload).
- **End of main**: `runner.js` (`defer`), Prism scripts (`prism-core`, `prism-python`, `prism-bash` — no defer).
- **Worker**: Classic Worker via `new Worker("./pyodide-worker.js")`. CDN scripts are integrity-verified at runtime via `crypto.subtle` SHA-384 before execution.
- **CSP meta tag**: scripts from `self`/`inline`/`eval`/`cdn.jsdelivr.net`/`blob:`; `worker-src self blob:`.

### Tooling Note
- **No Build Process**: No bundlers. npm is used for dev tooling only (lint/format), not for builds.
- **Linting & Formatting**: ESLint v9 (flat config in `eslint.config.mjs`) + Prettier (`.prettierrc`). Run via `npm run lint` / `npm run format`.
- **No Testing**: No automated test framework.
- **No CI/CD**: Deployment is handled via direct static file hosting.

## File Inventory
| File | Purpose |
|---|---|
| `index.html` | Tutorial content (29 sections), semantic HTML structure. |
| `style.css` | Design system, themes, and responsive layout. |
| `runner.js` | UI logic and Pyodide orchestration (IIFE pattern). |
| `pyodide-worker.js` | Web Worker for isolated Python execution. Enforces SRI integrity via `crypto.subtle`. |
| `sw.js` | Service Worker for caching and header injection. |
| `serve.py` | Local development server with isolation headers. |
| `manifest.json` | PWA manifest for "Add to Home Screen" support. |
| `_headers` | Cloudflare Pages configuration for COOP/COEP. |
| `eslint.config.mjs` | ESLint v9 flat config for JS linting. |
| `.prettierrc` | Prettier formatting configuration. |
| `jsconfig.json` | JS/LSP project config (ES2022, DOM, WebWorker libs). |
| `package.json` | Dev dependencies and lint/format npm scripts. |

## Architecture & Key Decisions

### 1. Synchronous Input Support
The site uses `SharedArrayBuffer` and `Atomics` to allow the Python `input()` function to block the worker thread while waiting for UI input.
- **CRITICAL**: Do not remove COOP (`Cross-Origin-Opener-Policy: same-origin`) or COEP (`Cross-Origin-Embedder-Policy: require-corp`) headers.
- Headers are managed in `_headers` (Cloudflare), `serve.py` (Local), and `sw.js` (Service Worker fallback).

**Protocol detail**: `stdinSAB` (8 bytes, `Int32Array[2]`) + `dataSAB` (65536 bytes).

| Flag value | Meaning |
|---|---|
| `0` | Idle |
| `1` | Waiting for input |
| `2` | Data ready |

**Flow**: Worker sets flag=1, posts `need_input`, blocks with `Atomics.wait` (100ms loop) → Main renders `.py-form` with `#_py_input_field` → `submitInput` encodes UTF-8 into `dataSAB` → sets flag=2, `Atomics.notify` → Worker reads, decodes, resets flag=0.

**Interrupt**: Sets `interrupted=true`, notifies; worker throws `__interrupted__` sentinel → `KeyboardInterrupt`.

### 2. Python Execution
- **Pyodide**: Loaded from `cdn.jsdelivr.net` (v0.29.3). Main-thread script uses native SRI (`integrity` attribute). Worker scripts are integrity-verified at runtime via `crypto.subtle` SHA-384 hashes before execution (see `fetchWithIntegrity()` in `pyodide-worker.js`).
- **AST Execution**: The worker uses an AST-based `_run()` helper to provide REPL-style `repr()` output for the last expression in a block.
- **Mock files**: Written to Pyodide FS at init: `my_text_file.txt`, `some_data.txt`, `data.csv`, `output.txt`, `open.txt`.
- **Lazy packages**: `matplotlib`, `scipy`, `pandas` loaded per-snippet via `ensurePackage()`.

**Context Injection** (`addContext()`):
- Checks if a variable is **used but not assigned** (`\bname\b` present, `\bname\s*=` absent).
- Injects tutorial variables: `lst`, `list_a`, `list_b`, `record`, EEG data, numbers dataset.
- **Pandas scaffolding**: auto-imports `pd` when `pd.` is detected.
- **Scipy scaffolding**: injects synthetic EEG channels when `pearsonr` appears.
- **Placeholder expansion**: rewrites `[1, 2, ..., ]` into concrete arrays.
- **Key rule**: never overrides user-assigned variables.

### 3. Service Worker & Caching
- **Cache Name**: Currently `python-guide-v14`. Update this when making breaking changes to assets.
- **Offline Support**: Cache-first strategy for tutorial content.
- **ASSETS_TO_CACHE**: `/index.html`, `/style.css`, `/runner.js`, `/manifest.json`, `/pyodide-worker.js`, `/favicon.png?v=5`.
- **CDN bypass**: `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` are NOT intercepted.
- **COOP/COEP injection**: `addIsolationHeaders()` sets `COEP: require-corp` + `COOP: same-origin`.
- **Lifecycle**: Install → `skipWaiting` + precache. Activate → delete old caches + `clients.claim()`.

### 4. Contextual Lens Sidebar
The sidebar navigation (`.sidebar-nav`) reveals on `mousemove` near the left edge (≤ 60 px from left) and hides when the mouse leaves, via JS adding/removing the `.is-nav-open` class on `.sidebar-nav`.
- **Lens labels** (`.sidebar-lens-label`): each nav anchor contains an absolutely-positioned label shown via the `.is-lens-current`, `.is-lens-prev`, and `.is-lens-next` classes driven by `getSectionLevel()` and a `mousemove` handler. Current label is full-size; adjacent labels are smaller and muted.
- **Roadmap dot** (`.lens-roadmap-dot`): a coloured dot inside each anchor; colour class `.lens-dot-beginner` / `.lens-dot-intermediate` / `.lens-dot-advanced` is set by `getSectionLevel()`.
- **Reveal logic**: `getSectionLevel(sectionId)` returns `'beginner'`, `'intermediate'`, or `'advanced'` based on which section range the anchor targets.
- **Visibility**: Only shown on viewports ≥ 1200 px (lens labels hidden at smaller widths via CSS `@media (min-width: 1200px)`).
- **Mobile**: `.sidebar-nav` is `display: none` at ≤ 768 px; `.mobile-nav-btn` and `.mobile-nav-panel` are used instead.

## Code Style Guidelines
### General
- **Indentation**: 2 spaces for HTML, CSS, and JS.
- **Encoding**: UTF-8.

### JavaScript
- **Pattern**: Vanilla JS only. Use IIFEs with `"use strict"`.
- **Variables**: Use `const` and `let`. Avoid `var`.
- **Naming**: `camelCase` for variables and functions.
- **DOM**: Use `querySelector`, `classList`, and `document.createElement`.
- **Sectioning**: Use box-drawing characters for major sections:
  `// ── Section Name ──`

**Comments**:
- **Litmus test**: Does this comment add information a reader *cannot* get from the code itself? If no → delete it.
- **Comment WHY, not WHAT**: explain intent, design decisions, non-obvious constraints, and workarounds. Never restate what the code already says clearly (parrot comments).
- **Keep**: protocol flows, magic number explanations, guard condition rationale, SW/SAB lifecycle notes.
- **Delete**: `// Remove the panel` before `removePanel()`, `// Loop through items` before `forEach`, anything obvious.
- Section headers (`// ── Name ──`) are fine for orientation — they are not comments, they are structure.

**Error Handling**:
- Worker hard errors: `error` event listener → toast hide, reset button, show error output.
- Structured errors from worker: handle `type === "error"` messages.
- Clipboard: `.catch()` with visual feedback (`✗ failed`).
- Isolation guard: early return if `!window.crossOriginIsolated`, one-reload via `sessionStorage.__coi_reloaded`.
- Python exceptions: `_run()` catches and returns filtered traceback as stderr.
- Soft-fail: `ensurePackage()` catches and ignores load failures.

**Event Delegation**:
- Single delegated click listener on `document`.
- Uses `e.target.closest("[data-overlay-show],[data-overlay-hide]")`.
- Overlay attributes: `data-overlay-show="<id>"` and `data-overlay-hide="<id>"`.
- Focus management: saves `lastFocusedElement`, restores on close.
- **Escape key convention**: Every overlay that should close on Escape **must** include at least one pure-close button — an element with `data-overlay-hide="<id>"` but **without** `data-overlay-show`. The Escape handler uses `querySelector('[data-overlay-hide="…"]:not([data-overlay-show])')` to target it. Back buttons carry both attributes and are intentionally skipped. If an overlay has only Back-style controls and no pure-close button, Escape will silently do nothing.

### CSS
- **Theming**: Use CSS Custom Properties.
  - `:root` for Dark Theme (default).
  - `[data-theme="light"]` for Light Theme.
- **Naming**: Dash-case (BEM-ish), e.g., `.py-output-bar`, `.scenario-title`.
- **Transitions**: Standardized at `0.15s` to `0.25s` ease.
- **Breakpoints**: Mobile breakpoint is `768px`.

**Animations & Responsive**:
- `@keyframes py-spin` (0.65s linear infinite) for loading toast.
- `@media (max-width: 768px)`: hides `.sidebar-nav`, enables `.mobile-nav-btn` + `.mobile-nav-panel`.
- `@media print`: hides interactive UI, forces collapsed scenarios open.

### HTML
- **Semantic**: Use proper tags (`<main>`, `<section>`, `<article>`).
- **Accessibility**: Maintain ARIA attributes (`aria-expanded`, `aria-label`, `tabindex`). Always add `type="button"` to `<button>` elements that are not form-submit buttons. Always add `<title>` to inline `<svg>` elements.
- **Callouts**:
  - `.note`: Blue/Info
  - `.warn`: Orange/Warning
  - `.tip`: Green/Success
- **Badges**: `.badge-[color]` (blue, green, orange, purple, red, yellow).
- **Code**: `<pre><code class="language-python">`.

**Section Structure**:
- Sections: `<div class="section" id="sN">` with `.section-header` (`.section-num` + `h2`).
- Scenarios: `.scenario > .scenario-title` (`role=button`, `tabindex=0`, `aria-expanded`) + `.scenario-body`; toggle via `.collapsed` class.
- Nested solutions: `.scenario.sol-scenario.collapsed`.
- Code blocks: author writes `<pre><code class="language-python">`, JS auto-wraps in `.code-wrapper` and injects `.copy-btn` + `.run-btn`.

### Python (`serve.py`)
- **Standard**: PEP 8.
- **Naming**: `snake_case`.
- **Dependencies**: Standard library only.
- **Header**: Include `#!/usr/bin/env python3` and module docstring.

## Version Coupling Reference

Several version numbers are **coupled across multiple files**. Changing one without the others causes cache misses, stale assets, or broken offline support. Always update all coupled locations in the same commit.

### 1. Service Worker Cache Name — `CACHE_NAME`
| Location | What to change |
|---|---|
| `sw.js` → `const CACHE_NAME` | Increment `vN` → `v(N+1)` |
| `AGENTS.md` → §3 Cache Name note | Update the version number here too |

**When to bump**: Any time you modify `ASSETS_TO_CACHE` entries OR change any cached asset file (`index.html`, `style.css`, `runner.js`, `pyodide-worker.js`, `manifest.json`, `favicon.png`). This forces all clients to discard the old cache and re-fetch.

### 2. Favicon Cache-Bust Query String — `?vN`
| Location | What to change |
|---|---|
| `index.html` → `<link rel="icon" href="favicon.png?vN">` | Increment N |
| `sw.js` → `ASSETS_TO_CACHE` → `/favicon.png?vN` | Must match index.html exactly |

**When to bump**: When the favicon image itself changes. Both files must use the identical query string or the SW will never serve the favicon offline (cache key mismatch). After changing, also bump `CACHE_NAME`.

### 3. Pyodide Version + SRI Hash
| Location | What to change |
|---|---|
| `index.html` → `<script src="cdn.jsdelivr.net/.../pyodide.js"` | Version path segment + `integrity` SRI hash |
| `pyodide-worker.js` → `PYODIDE_CDN` constant (line 7) | Version path segment |
| `pyodide-worker.js` → `INTEGRITY` object (lines 11–17) | SHA-384 hashes for `pyodide.mjs` and `pyodide.asm.js` — recompute via `openssl dgst -sha384 -binary <file> \| openssl base64 -A` |
| `pyodide-worker.js` → `indexURL: PYODIDE_CDN` (in `initPyodide`) | Uses `PYODIDE_CDN` constant — no separate update needed |
| `AGENTS.md` → §2 Python Execution note | Update version string |

**When to bump**: When upgrading Pyodide. The `PYODIDE_CDN` constant, `INTEGRITY` hashes, and `index.html` script tag must all reference the same Pyodide version. The worker enforces integrity at runtime via `crypto.subtle` — a hash mismatch will throw `Integrity check failed` and abort loading. Compute new hashes by fetching the CDN files and running `openssl dgst -sha384 -binary <file> | openssl base64 -A`, then prefix with `sha384-`.

### 4. Font Preload WOFF2 URLs
| Location | What to change |
|---|---|
| `index.html` lines 51–53 → 3× `<link rel="preload" as="font" href="https://fonts.gstatic.com/s/firacode/...">`  | All three Fira Code WOFF2 URLs |
| `index.html` line 54 → `<link rel="preload" as="font" href="https://fonts.gstatic.com/s/dancingscript/...">` | The Dancing Script WOFF2 URL |

**When to bump**: When the `preload-not-used` console warning reappears, it means Google Fonts changed their CDN URL. Fix: fetch `https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap` with a Chrome User-Agent, extract the `src: url(...)` WOFF2 value from the response, and replace the hardcoded `href`. Repeat for Fira Code (`family=Fira+Code:wght@400;500`) — there are **three** WOFF2 entries for Fira Code (different subsets). Do **not** guess — fetch the live CSS to get the real URLs.

### 5. runner.js and style.css — No Direct Versioning
These files have **no version query string** and are not referenced by any integrity hash. Versioning is handled entirely by `CACHE_NAME` in `sw.js`. When you modify either file, only bump `CACHE_NAME` — nothing else needs changing.
### 6. Quick Coupling Checklist

| Change | Files to touch |
|---|---|
| Favicon image updated | `index.html` (bump `?vN`), `sw.js` (match query string + bump `CACHE_NAME`), `AGENTS.md` |
| Any cached asset modified (`index.html`, `style.css`, `runner.js`, `pyodide-worker.js`, `manifest.json`) | `sw.js` (bump `CACHE_NAME`), `AGENTS.md` |
| Pyodide version upgrade | `index.html` (version + SRI hash), `pyodide-worker.js` (`PYODIDE_CDN` + `INTEGRITY` hashes), `AGENTS.md` |
| Font CDN URL changed | `index.html` (all 4 WOFF2 preload hrefs — 3× Fira Code + 1× Dancing Script) |
| manifest.json icons changed (`icon-192.png`, `icon-512.png`) | `manifest.json` only — icons are **not** in `ASSETS_TO_CACHE` and will not be served offline |

## Implementation Checklist for Agents
1. [ ] Verify changes with `python3 serve.py`.
2. [ ] Ensure `SharedArrayBuffer` support is not broken (check console for COOP/COEP errors).
3. [ ] Maintain 2-space indentation across all web files.
4. [ ] Update `CACHE_NAME` in `sw.js` if modifying core assets.
5. [ ] Use semantic HTML and ARIA attributes for any UI additions.
6. [ ] Test `input()` flow end-to-end if modifying worker or stdin logic.
7. [ ] Verify overlay focus management if adding modal/dialog elements.
