# Security and loading stage — 25 September 2026

## Changes

- Python initializes only on Run, Reset or Retry. The first Run queues the selected code and executes once initialization succeeds. Loading still has the 30-second watchdog; a failed or reset worker discards pending execution.
- Removed the unused main-document Pyodide loader and the unnecessary CDN preconnection.
- Replaced the three Prism CDN scripts with a local, unmodified Prism 1.30.0 core/Python/Bash bundle and its MIT license. It is fingerprinted and integrity-precached for offline highlighting. The release test compares its bytes and license against the pinned npm package.
- Restricted the document to same-origin scripts and workers, with no inline script handlers or JavaScript eval. Font stylesheet loading no longer uses inline handlers. Existing inline layout styles remain allowed.
- Added separate response policies for Python workers and the service worker. Python permits verified blob scripts, WebAssembly compilation and connections to this origin or the pinned Pyodide CDN directory. It does not permit JavaScript eval. The service worker may connect only to its origin.
- The local server and release preview use the hosting header rules. Service-worker cached responses retain the policies.
- Updated the Node 22 LTS pin to 22.23.3 and applied compatible lockfile fixes for `@humanfs/node`, `brace-expansion`, `flatted` and `js-yaml`. A clean install reports zero npm advisories. Pyodide stays on 0.29.3.
- Source preview assets/cache advance together to v18; deployment versions remain content-derived.

## Validation

- Clean `npm ci --ignore-scripts` using Node 22.23.3/npm 10.9.9 passed and reported zero advisories. The Node archive was SHA-256 checked against the official release checksum.
- `npm run check` on that clean Node 22 install passed lint, formatting, 28 runtime/UI tests, 265 example checks, six release tests and build.
- Chromium and WebKit each passed all 15 browser scenarios, including first-click startup, no automatic Python downloads while reading, blocked inline/remote script injection, blocked JavaScript eval inside Python, verified loader recovery, input/Stop/Reset, and scientific plots.
- Chromium passed all six built-release browser scenarios on Node 22, including real header checks, offline syntax highlighting, failed installations/upgrades, safe updates during active input and integrity-checked cache recovery.
- Final application release: `305840a9490ddfce4ec0` (ten required assets). Live staging validation is pending.

The first Node 22 run, made alongside browser tests, timed out in the CPU-loop interrupt test. The focused isolated recheck and complete isolated clean-install check both passed. The application timeout/fallback was not relaxed. This remains timing-sensitive coverage, consistent with the prior stage's cancellation findings.

Evidence in `../verification/`: `security-clean-install.log`, `security-check.log` (initial timing failure), `security-check-final.log`, `security-browser.log`, `security-webkit.log`, `security-release-browser.log`.

## Scope and limits

This change does not make arbitrary Python code safe to run or impose a general memory quota. Python retains its JavaScript bridge and approved network access; core loader integrity checks cover the three pinned runtime files, not every possible package or learner action. Inline CSS remains allowed to preserve the existing lesson layout. Offline reading and highlighting are supported after installation; Python execution and web fonts still require network or existing browser caches.

Chromium and WebKit test engines are available here. Full native Firefox automation is unavailable on this Mac, as recorded in STAGING-VALIDATION.md. The previous real-iPhone sign-off predates this stage; it is not evidence that this new loading/CSP behavior has received a new physical-device check. No production deployment is part of this stage.

## References

- [Node 22.23.3 LTS release](https://nodejs.org/en/blog/release/v22.23.3)
- [CSP script sources and WebAssembly allowance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)
- [Pyodide 0.29.3 documentation](https://pyodide.org/en/0.29.3/usage/quickstart.html)
