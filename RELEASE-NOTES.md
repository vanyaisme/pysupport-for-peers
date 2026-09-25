# First reliability release

Completed locally: 24 September 2026. Production has not been changed.

## Included

- Offline root and index navigation use the installed release's app shell, including query-string URLs. Icons and local styling are required cache assets.
- Missing/corrupt required downloads reject service-worker installation. The old release remains usable; a later update can retry.
- Cleanup removes only this application's old caches.
- Updates wait for all old site tabs to close. The page shows an update notice without reloading or interrupting Python input.
- `npm run build` generates hashed CSS, runner and worker files, a content-derived release ID and SHA-256 integrity metadata. HTML and runtime assets remain a matching set, including during offline reloads. Recovery from eviction accepts only matching release bytes.
- The operator table now correctly equates `x /= 2` with `x = x / 2` and `x **= 2` with `x = x ** 2`.
- The `rt_z` lesson now subtracts the mean before dividing by the sample standard deviation. A numerical regression check verifies mean zero and sample standard deviation one.
- GitHub Actions runs lint, formatting, runtime/UI, example, release and Chromium checks and uploads the generated deployment folder. `.nvmrc` pins Node for CI/development. New build/preview/smoke scripts are linted.

## Verification

| Check | Result |
| --- | --- |
| Runtime and UI | 23 passed |
| Example corpus, reverse order, syntax and z-score assertion | 265 test records passed |
| Release build/service-worker/content checks | 5 passed |
| Existing Chromium runtime regression suite | 10 passed |
| New Chromium offline/update/install/eviction suite | 6 passed |
| ESLint, Prettier and Git whitespace checks | Passed |
| Generated build and local deployment smoke | Passed |

Browser tests used the installed Chromium headless shell (Playwright browser revision 1223) and exact pinned Pyodide files from the local npm package/cache. Runtime integrity verification remained enabled. Fonts were stubbed and Prism came from the pinned package. These tests verify code and release transitions, not live CDN uptime or typography. Local test commands ran on Node 26.8.1; CI is configured for Node 22.22.0 but has not run remotely yet. Safari, Firefox and real-device testing remain future work.

Logs are in the workspace's sibling `verification/` directory: `release-unit.log`, `release-examples.log`, `release-browser.log`, and `release-runtime-browser.log`.

## Review and deployment

Use `npm run preview:release` to serve the built site at `http://127.0.0.1:8081` with local emulation of the release headers. The source preview remains available through `python3 serve.py`.

Publish only `dist/` as one Cloudflare Pages deployment. Configure project root `site/` if this folder is nested in the connected repository; if `site/` is itself the repository root, use that root. Build command: `npm run build`; output directory: `dist`.

Preserve `_headers`, disable host HTML rewriting/injection, and run `npm run smoke:deploy -- https://your-preview.pages.dev` on the hosted preview before production. It verifies actual file integrity, page/release agreement, and cache/isolation headers. This catches analytics injection, auto-minification and conflicting edge cache rules. The local smoke pass does not replace this hosting check.

Offline support covers reading after service-worker installation completes; offline Python execution is not guaranteed. Learners must finish work and close all site tabs to activate a waiting update. This intentional tradeoff protects active runs and temporary files from forced reloads.

All earlier uncommitted repairs were preserved. No commits, pushes or deployment were performed. Output limits, broader accessibility, CSP hardening and dependency upgrades remain outside this release.

## Second reliability and accessibility release

The user passed the first release's visual review in full. This follow-up adds:

- Bounded worker output and incremental, frame-batched rendering. A run retains at most 100,000 text code units / 1,000 output messages, plus a short truncation notice and terminal diagnostics. Input prompts still flush immediately. Stop remains available after truncation.
- Plot capture limits: five images, two million base64 characters per image, eight million total, and a four-million-pixel canvas. Excess figures are closed and explained in the output. Fixed canvas rendering prevents outlying labels from creating enormous tight bounding boxes.
- A single Reset Python circular-arrows icon above the floating sun button, matching its style. It appears after scrolling 500px. Its tooltip and accessible description explain that it stops code and clears temporary files. There are no reset controls in example output panels. Reset replaces the worker and all shared buffers, removes pending input/argument forms, and preserves displayed output.
- Restored animated topic names when hovering chapter numbers at narrower desktop widths. Labels show above 768px and appear to the right when the left gutter cannot accommodate them.
- Descriptive chapter-link names and sidebar reveal on keyboard focus; mouse clicks do not keep it pinned open. Named dialogs, focus filtering for hidden/collapsed controls, inert backgrounds, and Escape focus restoration across dialog transitions.
- Concise run/input/completion announcements, separate from the text and plots in output regions.

Source preview assets use v17; deployed release versions are generated from content. Output caps are not a general memory quota for arbitrary Python code. Screen-reader, Safari and Firefox testing remain separate work. Hosting and production remain unchanged.

### Follow-up verification and preview

The current application build is `5f59c4f7874774366c2d`. The verified staging preview is https://approved-preview.python-peer-support-ref.pages.dev. See STAGING-VALIDATION.md for checkpoints, evidence and coverage limits. Existing controlled tabs must close after the waiting update is ready to activate this release.

- `npm run check` passed: lint, formatting, 27 runtime/UI tests, 265 example records, 5 release tests and the generated build.
- All 13 execution/accessibility Chromium scenarios passed during this implementation, including output floods, cooperative/forced Stop, Reset, dialog keyboard transitions and 320px/640px reflow.
- The dedicated hover-label regression reproduced the missing labels at 1024px before the fix and passed afterward at 1024px, 1440px and 2400px. Screenshots were inspected. Moving over numbers reveals topic names without changing the page location.
- All 6 release-browser tests passed on the final build, including successive Unicode input during a waiting update, offline reading and failed installation/recovery.
- The final running preview passed the integrity/header smoke check; Git whitespace checks passed.

Logs are under `../verification/`: `second-check.log`, `second-browser.log`, `hover-labels-before.log`, `hover-labels-after.log`, `second-release-browser.log`, and `second-local-smoke.log`. The broad browser log also includes an exploratory smooth-scroll test; that unrelated change/test was removed after the user clarified that the missing effect was hovering topic labels. The replacement hover-label test is in the current browser suite.

No commit, push or production deployment was performed. Remote CI, hosted-preview validation, Safari/Firefox, real-device and actual screen-reader testing remain outstanding.

The hover labels retain the original plain-text appearance: no background, outline, shadow or rounded box. Right-side placement remains available on narrower desktop viewports. Formatting, five release tests, the hover-label browser check at three widths and the local deployment smoke passed after this styling correction.

The floating reset placement passed 14 UI tests, five release tests, two focused browser scenarios (including actual reset during blocked input and narrow-screen layout), lint, formatting and the build. Desktop positioning was verified against the sun button and visually inspected.

Label-side selection now measures the displayed topic names and available left gutter, preferring the left instead of using a fixed window-width breakpoint. Browser checks passed at 1024, 1440, 1600, 1920 and 2400px, including short names fitting left and long names requiring right at the same width. Fourteen UI tests, five release tests, lint, formatting, build and the running-preview smoke also passed.

The follow-up removes topic-dependent side switching. Labels now stay left when the gutter provides at least 180px, otherwise stay right. Long names wrap within the available width; neighbouring names shift vertically to avoid overlap. Plain-text styling and animation remain. The focused Chromium check passed at five desktop widths with pointer and keyboard navigation, alongside 14 UI tests, five release tests, lint and formatting. Source HTML content was not edited.

## Staging verification checkpoint — 24 September 2026

The approved version was saved in Git as `dc71876` before staging checks. Real iPhone review passed input, Stop, Reset, navigation and rotation, but found the floating theme button hidden on mobile. Removed that desktop-only restriction and retained Reset/theme/Back-to-top ordering at all screen widths. The WebKit check verifies theme switching and non-overlapping controls at 320px and 640px.

The browser harness now accepts `TEST_BROWSER`, preserves isolation headers in injected worker failures, and isolates runtime fault tests from service-worker caching. The separate offline/update suite compares offline content with the actual online title instead of an outdated title string. These harness changes do not alter site content. Hosted validation results are recorded separately under `../verification/`. Production has not been deployed.
