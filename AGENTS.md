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

- **Head**: `style.css` (preload → stylesheet), `runner.js` (preload), normal Google Fonts stylesheets. No main-document Pyodide loader.
- **End of main**: deferred `runner.js` and local `vendor/prism.js` (core/Python/Bash, MIT). The release builder fingerprints and precaches both.
- **Worker**: Classic Worker via `new Worker("./pyodide-worker.js?v=18")`. CDN scripts are integrity-verified at runtime via `crypto.subtle` SHA-384 before execution.
- **CSP**: page scripts/workers are self-only, no inline/eval scripts. Worker response allows blob scripts plus `wasm-unsafe-eval`, not JS eval; connections to self and the pinned CDN directory. `_headers` supplies separate document, Python worker and service-worker policies; `serve.py` reads the same rules. Keep the document meta policy aligned with its headers.

### Tooling Note

- **Release build**: `npm run build` generates `dist/` with content-hashed runtime assets, an integrity manifest and a release-specific service worker. No bundler. Deploy only `dist/`.
- **Linting & Formatting**: ESLint v9 (flat config in `eslint.config.mjs`) + Prettier (`.prettierrc`). Run via `npm run lint` / `npm run format`.
- **Tests**: Node built-in test runner with actual Pyodide, JSDOM UI regressions, all tutorial examples, and Playwright Chromium. See README for commands.
- **CI**: `.github/workflows/verify.yml` runs checks and uploads the built release. Production deployment remains explicit.

## File Inventory

| File                | Purpose                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `index.html`        | Tutorial content (29 sections), semantic HTML structure.                              |
| `style.css`         | Design system, themes, and responsive layout.                                         |
| `runner.js`         | UI logic and Pyodide orchestration (IIFE pattern).                                    |
| `pyodide-worker.js` | Web Worker for isolated Python execution. Enforces SRI integrity via `crypto.subtle`. |
| `sw.js`             | Service Worker for caching and header injection.                                      |
| `serve.py`          | Local development server with isolation headers.                                      |
| `manifest.json`     | PWA manifest for "Add to Home Screen" support.                                        |
| `_headers`          | Cloudflare Pages configuration for COOP/COEP.                                         |
| `eslint.config.mjs` | ESLint v9 flat config for JS linting.                                                 |
| `.prettierrc`       | Prettier formatting configuration.                                                    |
| `jsconfig.json`     | JS/LSP project config (ES2022, DOM, WebWorker libs).                                  |
| `package.json`      | Dev dependencies and lint/format npm scripts.                                         |

## Architecture & Key Decisions

### 1. Synchronous Input Support

The site uses `SharedArrayBuffer` and `Atomics` to allow the Python `input()` function to block the worker thread while waiting for UI input.

- **CRITICAL**: Do not remove COOP (`Cross-Origin-Opener-Policy: same-origin`) or COEP (`Cross-Origin-Embedder-Policy: require-corp`) headers.
- Headers are managed in `_headers` (Cloudflare), `serve.py` (Local), and `sw.js` (Service Worker fallback).

**Protocol detail**: `stdinSAB` (8 bytes, `Int32Array[2]`) + `dataSAB` (65536 bytes).

| Flag value | Meaning           |
| ---------- | ----------------- |
| `0`        | Idle              |
| `1`        | Waiting for input |
| `2`        | Data ready        |

**Flow**: Worker sets flag=1, posts `need_input`, blocks with `Atomics.wait` (100ms loop) → Main renders `.py-form` with `#_py_input_field` → `submitInput` encodes UTF-8 into `dataSAB` → sets flag=2, `Atomics.notify` → Worker reads, decodes, resets flag=0.

**Interrupt (protocol v2)**: A separate 1-byte `interruptSAB` is registered with `setInterruptBuffer`; the main thread sets it to SIGINT (2). A 4-byte `cancelSAB` holds a persistent cancellation flag for blocked stdin/package-loading checks. Stop notifies stdin directly; it never relies on a queued worker message. If the run has not ended within 1.5 seconds, terminate and replace the worker and all shared buffers. A forced restart clears temporary files. Ignore messages from old workers and old run IDs.

**Startup**: Python starts on the first Run (queuing that example), explicit Reset or Retry; reading does not start it. A 30-second watchdog runs from the initialization request. Failure or Reset discards pending execution. Loading, initialization failures, hard crashes and protocol mismatches have visible status and Retry. Every ready message must match protocol v2. Missing isolation shows a reload explanation.

### 2. Python Execution

- **Pyodide**: Loaded from `cdn.jsdelivr.net` (v0.29.3). Worker scripts are integrity-verified at runtime via `crypto.subtle` SHA-384 hashes before execution (see `fetchWithIntegrity()` in `pyodide-worker.js`).
- **AST Execution**: The worker uses an AST-based `_run()` helper to provide REPL-style `repr()` output for the last expression in a block.
- **Practice fixtures**: Synthetic text/CSV/EEG files are written at worker initialization. See README for the list. They persist across runs but are reset on worker replacement/reload.
- **Lazy packages**: `loadPackagesFromImports(code)` resolves all imported packages, including mixed scientific imports. Load failures are surfaced.
- **Execution scope**: Each Run has fresh Python variables. The code shown in HTML includes its own setup; do not silently inject variables or rewrite `sys.argv`. Arguments are sent separately, including a script filename.
- **Output**: Streaming UTF-8 decoders isolate stdout/stderr between runs. Bound worker text to 100,000 code units/1,000 messages; reserve terminal diagnostics. Batch DOM append operations by animation frame; do not rebuild prior output or put bulk output in live regions. Capture at most five plots within image/canvas budgets and close every figure, including skipped figures. Destroy PyProxies and restore stdin/argv before posting the terminal message.
- **Reset Python**: A single floating circular-arrows control above the theme button terminates/replaces the worker and shared buffers, clears pending forms and resets practice files. Existing output remains. Its tooltip and accessible description explain that temporary files are cleared. It appears after scrolling 500px, matching the floating theme control; do not duplicate it under examples.
- **Example metadata**: Stable `data-example-id` values support corpus tests. `data-run-mode="local"`/`"shell"` with `data-run-reason` identifies examples requiring another environment. `data-expected-error` records deliberate teaching errors. Keep test inputs in `tests/example-cases.cjs` in sync with the curriculum.

### 3. Service Worker & Caching

- **Cache name**: `python-guide-<release ID>` in deployments; `python-guide-v18` in source previews.
- **Build configuration**: `scripts/build-release.cjs` replaces the source `RELEASE` object with generated URLs and SHA-256 integrity. Keep its source-reference checks synchronized with source-preview URL versions.
- **Offline reading**: Required HTML, CSS, JavaScript, manifest, favicon, PWA icons and social image are atomically precached. Reject installation if any required fetch/integrity check fails. Fonts and Python CDN dependencies are not precached; do not promise offline execution.
- **Fetch strategy**: Cache-first app-shell navigation for `/` and `/index.html` (including queries), and exact required asset URLs. Cache eviction recovery verifies the same release's bytes. Unknown paths and external URLs pass through.
- **Lifecycle**: No `skipWaiting` or `clients.claim`. Show a waiting-update notice; activate after all old controlled tabs close. Delete only older caches in the `python-guide-` namespace.
- **Release headers**: HTML, service worker and manifests revalidate; content-hashed `/releases/*` assets are immutable. Preserve COOP/COEP. Disable host HTML rewriting/injection because precached HTML is integrity-checked.
- **Verification**: `npm run test:release`, `npm run test:release:browser`, and `npm run smoke:deploy -- <preview origin>`. The latter must be run against hosting before claiming production correctness.

### 4. Contextual Lens Sidebar

The sidebar navigation (`.sidebar-nav`) reveals on `mousemove` near the left edge (≤ 60 px from left) and hides when the mouse leaves, via JS adding/removing the `.is-nav-open` class on `.sidebar-nav`.

- **Lens labels** (`.sidebar-lens-label`): each nav anchor contains an absolutely-positioned label shown via the `.is-lens-current`, `.is-lens-prev`, and `.is-lens-next` classes driven by `getSectionLevel()` and a `mousemove` handler. Current label is full-size; adjacent labels are smaller and muted.
- **Roadmap dot** (`.lens-roadmap-dot`): a coloured dot inside each anchor; colour class `.lens-dot-beginner` / `.lens-dot-intermediate` / `.lens-dot-advanced` is set by `getSectionLevel()`.
- **Reveal logic**: `getSectionLevel(sectionId)` returns `'beginner'`, `'intermediate'`, or `'advanced'` based on which section range the anchor targets.
- **Visibility**: Labels appear wherever the desktop sidebar is shown (> 768 px). Choose the side from the actual left gutter, independently of the hovered topic: use left when at least 180px is available, otherwise add `lens-labels-right`. Wrap long labels within the available width and space adjacent labels around the current title to avoid overlap. Recalculate geometry on hover, keyboard focus, resize and font readiness; changing titles must not change sides at a fixed viewport. Preserve current/previous/next hover and keyboard labels.
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

- **Litmus test**: Does this comment add information a reader _cannot_ get from the code itself? If no → delete it.
- **Comment WHY, not WHAT**: explain intent, design decisions, non-obvious constraints, and workarounds. Never restate what the code already says clearly (parrot comments).
- **Keep**: protocol flows, magic number explanations, guard condition rationale, SW/SAB lifecycle notes.
- **Delete**: `// Remove the panel` before `removePanel()`, `// Loop through items` before `forEach`, anything obvious.
- Section headers (`// ── Name ──`) are fine for orientation — they are not comments, they are structure.

**Error Handling**:

- Worker hard errors: terminate worker, finish any active output, disable Run and show visible Retry.
- Structured errors from worker: handle `type === "error"` messages.
- Clipboard: `.catch()` with visual feedback (`✗ failed`).
- Isolation guard: early return if `!window.crossOriginIsolated`, one-reload via `sessionStorage.__coi_reloaded`.
- Python exceptions: `_run()` catches and returns filtered traceback as stderr.
- Package-load failures are terminal errors for the current run; the next run can retry.

**Event Delegation**:

- Single delegated click listener on `document`.
- Uses `e.target.closest("[data-overlay-show],[data-overlay-hide]")`.
- Overlay attributes: `data-overlay-show="<id>"` and `data-overlay-hide="<id>"`.
- Focus management: saves the launcher in `lastFocusedElement`, restores on close. Dialog launchers are native named buttons. Inert siblings along the active dialog path, preserving previous inert state; move runtime status regions into the active dialog and back to the body on close. Exclude hidden/collapsed descendants from the focus trap.
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

Production assets, integrity values and release cache IDs are generated by `scripts/build-release.cjs`. Do not hand-edit `dist/`. Any core source change requires rebuilding and verifying the release. Stable runtime URLs must not appear in built HTML or the built runner.

Source-preview versions remain coupled: `index.html` CSS/runner references, `runner.js` worker URL, `sw.js` `RELEASE.id` and asset URLs, and `scripts/build-release.cjs` source URL checks currently use v18. Update them together when bumping the preview version. Close all local site tabs before reopening to activate an update, or use the release preview for isolated verification.

Pyodide version changes still require coordinated CDN version and SRI changes in `pyodide-worker.js`, `_headers` and browser fixtures. Check official compatibility notes before upgrades. Favicon URLs in the page, source SW and builder must agree. Required icons/images are now precached and integrity-checked by the release builder.

Deployment uses Cloudflare Pages with `npm run build` and output directory `dist`. Do not publish the repository root or `node_modules`. CI uses the Node version pinned in `.nvmrc`. Preserve old hashed assets when possible during deployment transitions; never mutate a published hashed URL. See README for update/rollback and host HTML-transformation constraints.

## Implementation Checklist for Agents

1. [ ] Verify changes with `python3 serve.py`.
2. [ ] Ensure `SharedArrayBuffer` support is not broken (check console for COOP/COEP errors).
3. [ ] Maintain 2-space indentation across all web files.
4. [ ] Rebuild release assets and run release tests when modifying core assets.
5. [ ] Use semantic HTML and ARIA attributes for any UI additions.
6. [ ] Test `input()` flow end-to-end if modifying worker or stdin logic.
7. [ ] Verify overlay focus management if adding modal/dialog elements.
