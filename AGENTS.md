# Agent Guidelines: Python Tutorial Site

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
- **Worker**: Classic Worker via `new Worker("pyodide-worker.js")` — no ES modules.
- **CSP meta tag**: scripts from `self`/`inline`/`eval`/`cdn.jsdelivr.net`/`blob:`; `worker-src self blob:`.

### Tooling Note
- **No Build Process**: No bundlers, no npm/yarn, no package manager.
- **No Linting**: No ESLint, Prettier, or Ruff configured.
- **No Testing**: No automated test framework.
- **No CI/CD**: Deployment is handled via direct static file hosting.

## File Inventory
| File | Purpose |
|---|---|
| `index.html` | Tutorial content (29 sections), semantic HTML structure. |
| `style.css` | Design system, themes, and responsive layout. |
| `runner.js` | UI logic and Pyodide orchestration (IIFE pattern). |
| `pyodide-worker.js` | Web Worker for isolated Python execution. |
| `sw.js` | Service Worker for caching and header injection. |
| `serve.py` | Local development server with isolation headers. |
| `manifest.json` | PWA manifest for "Add to Home Screen" support. |
| `_headers` | Cloudflare Pages configuration for COOP/COEP. |

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
- **Pyodide**: Loaded from `cdn.jsdelivr.net` (v0.26.4) with SRI hashes.
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
- **Cache Name**: Currently `python-guide-v4`. Update this when making breaking changes to assets.
- **Offline Support**: Cache-first strategy for tutorial content.
- **ASSETS_TO_CACHE**: `/index.html`, `/style.css`, `/runner.js`, `/manifest.json`, `/pyodide-worker.js`.
- **CDN bypass**: `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` are NOT intercepted.
- **COOP/COEP injection**: `addIsolationHeaders()` sets `COEP: require-corp` + `COOP: same-origin`.
- **Lifecycle**: Install → `skipWaiting` + precache. Activate → delete old caches + `clients.claim()`.

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

### CSS
- **Theming**: Use CSS Custom Properties.
  - `:root` for Dark Theme (default).
  - `[data-theme="light"]` for Light Theme.
- **Naming**: Dash-case (BEM-ish), e.g., `.py-output-bar`, `.scenario-title`.
- **Transitions**: Standardized at `0.15s` to `0.25s` ease.
- **Breakpoints**: Mobile breakpoint is `768px`.

**Animations & Responsive**:
- `@keyframes py-spin` (0.65s linear infinite) for loading toast.
- `@media (max-width: 768px)`: hides `.sidebar-nav`/`.sidebar-hover-zone`, enables `.mobile-nav-btn` + `.mobile-nav-panel`.
- `@media print`: hides interactive UI, forces collapsed scenarios open.

### HTML
- **Semantic**: Use proper tags (`<main>`, `<section>`, `<article>`).
- **Accessibility**: Maintain ARIA attributes (`aria-expanded`, `aria-label`, `tabindex`).
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

## Implementation Checklist for Agents
1. [ ] Verify changes with `python3 serve.py`.
2. [ ] Ensure `SharedArrayBuffer` support is not broken (check console for COOP/COEP errors).
3. [ ] Maintain 2-space indentation across all web files.
4. [ ] Update `CACHE_NAME` in `sw.js` if modifying core assets.
5. [ ] Use semantic HTML and ARIA attributes for any UI additions.
6. [ ] Test `input()` flow end-to-end if modifying worker or stdin logic.
7. [ ] Verify overlay focus management if adding modal/dialog elements.
