# Release check — 26 September 2026

Status: local and hosted release checks completed within the scope below. Independent GitHub CI and actual screen-reader speech verification remain outstanding, so this is not an unconditional release sign-off. Enhancements and production publication are deferred.

Application release: `59be8795f96d0c8d137e` (source preview v19). Approved staging snapshot: https://3d022f16.python-peer-support-ref.pages.dev. Release-check branch: `release/validation-2026-09-26`.

## Scope and evidence

| Requested area | Implemented behavior | Release evidence / limits |
| --- | --- | --- |
| Offline and upgrades | Atomic required precache, integrity, app-shell fallback, scoped cache cleanup, waiting updates and hashed assets | Six current lifecycle tests pass in Chromium and WebKit; earlier hosted update probes are recorded in STAGING-VALIDATION.md and SECURITY-VALIDATION.md. WebKit uses an origin outage, as explained below. Offline Python execution is not promised. |
| Lesson correctness | Both operator equivalences corrected; z-score subtracts the mean before dividing by sample standard deviation | Fresh corpus checks pass, including the displayed z-score mean/deviation assertion. Corpus execution is not a comprehensive editorial review of every explanation. |
| Output and recovery | Bounded text/plots/export snapshots, incremental rendering, Stop and global Reset | Runtime/UI and browser checks pass. One initial Chromium CPU-stop test used the safe hard-restart fallback and failed its stricter cooperative-interrupt assertion; the isolated test and complete repeat passed. The cause of that timing-sensitive result is not proven. No general Python memory quota is claimed. |
| Keyboard and dialogs | Visible keyboard navigation, named dialogs, background inertness and focus trapping/restoration | Browser checks cover these interactions. Actual VoiceOver speech could not be observed through the native control tool; this is pending, not a screen-reader pass. |
| Security and startup | Separate restrictive page/worker policies, verified core Python loader, local Prism, first-Run loading and locked dependencies | Fresh lint, formatting, 32 runtime/UI checks, 265 corpus checks, six release tests and build pass on Node 22.23.3. The 26 September dependency audit reports zero known advisories. See SECURITY-VALIDATION.md for security scope; scientific package archives are not all covered by custom SRI. |
| Git, CI and deployment | Approved checkpoints pushed on a dedicated release-check branch; Linux CI now includes all three browser engines | GitHub blocked the job before any test step because of an account billing lock. Cloudflare automatic build settings were corrected; live production did not change. |

## Independent CI blocker

Run: https://github.com/vanyaisme/pysupport-for-peers/actions/runs/36207999681

Commit: `fa8e857f51648c6617979b1dfd6264cc9a2490c0`.

GitHub's annotation says: “The job was not started because your account is locked due to a billing issue.” No job steps ran. This is neither a test pass nor a code-test failure. Browser jobs were skipped. The code/history push succeeded. Hosting and local testing do not require this lock to be resolved, but independent GitHub checks remain unverified until a successful rerun. Do not mark the workflow green based on local results.

## Hosting correction

The Cloudflare Git integration still had empty build/output settings. It would publish source files rather than the fingerprinted release prepared by `scripts/build-release.cjs`. The project now builds with `npm run build`, publishes `dist`, and runs from the repository root (empty root setting). The project refers to the repository's former name `python-peer-support-ref`; its repository ID matches `vanyaisme/pysupport-for-peers`.

The production deployment remained `26833db9-7df1-4270-add0-ca3e0150def2` before and after this settings correction. Remote `main` remains at the old release. Automatic production deployment on a push to `main` is enabled; merging this branch must therefore be treated as publishing and requires release approval. GitHub Actions is not currently an enforced deployment gate.

The first automatic preview, `beb8daad`, used the old blank settings and is not the approved release preview. The corrected Git-triggered preview at https://6b0aad92.python-peer-support-ref.pages.dev (commit `78c5381`) successfully built release `59be8795f96d0c8d137e`. Its homepage and ten required assets passed integrity, isolation, CSP and caching-header checks. Chromium and WebKit passed actual source/CSV/captured-PNG/savefig-PNG downloads, exact bytes, first-Run startup, local actions without Python startup, and download retention after Reset. No uncaught page errors were recorded. The application bytes match the iPhone-approved snapshot; the current changes concern release tooling and documentation.

## Test infrastructure corrections

- WebKit's first source-page navigation reproducibly stalled with the single-threaded Python development server. An idle TCP connection blocked later asset requests. A targeted probe reproduced the old behavior and verified that `ThreadingHTTPServer` serves the asset with isolation headers while that connection stays open. The focused startup test and full 17-scenario WebKit suite passed after the change. This only changes the development server, which is excluded from the deployed release. See [Python's server documentation](https://docs.python.org/3/library/http.server.html#http.server.ThreadingHTTPServer).
- The lifecycle suite previously used Playwright's Chromium-only worker-inspection event. It now observes the standard page service-worker registration and verifies activation through a real new page after old clients close. Old pages still must retain their release during input, and unrelated caches must survive.
- WebKit's `setOffline(true)` emulation rejected cached navigations with an internal error, matching [Playwright issue 42775](https://github.com/microsoft/playwright/issues/42775). For WebKit, the test server now drops actual origin connections and independently verifies that an uncached request fails before testing cached navigation. Chromium still uses browser offline emulation. The WebKit result verifies origin-unavailable reading; it does not test `navigator.onLine`, airplane mode, or loss of every external network connection. Both engines passed all six lifecycle scenarios using these methods. No assertions were removed or tests skipped. [Playwright documents the worker-inspection limitation](https://playwright.dev/docs/service-workers).

## Native and real-device scope

- Native Safari 27.2 on macOS 27.2 completed the hosted name/age example and displayed the correct age result. The native tool exposed only a partial accessibility tree; this is not sufficient evidence for VoiceOver accessibility or a full native Safari suite.
- Native Firefox 156.0.1 completed name/age input, stopped a blocked input run, reset Python and completed another run with exact pasted Unicode `Zoë 🧠`. Its Answers dialog had an accessible name, background content disappeared from the accessibility tree, initial focus went to Close, Shift+Tab wrapped to the last button, and Tab wrapped back to Close. The native Escape/focus-return check was interrupted when the test tab was closed; automated Chromium/WebKit checks cover that interaction. Firefox's complete automated suite remains unverified on this Mac because its Playwright binary cannot launch here; the Linux CI matrix is intended to fill that gap.
- With user approval, VoiceOver was temporarily enabled via System Settings. The caption setting was already enabled, but the tool could not read VoiceOver's announcement window. VoiceOver was restored to its original **off** state; caption preferences were not changed. No actual spoken-output pass is claimed.
- The user previously passed iPhone navigation, panels, input/Stop/Reset, theme switching and CSV/plot downloads. Device model and iOS version were not supplied. See the prior validation reports for the tested snapshots.

## Local evidence

Operator logs are in `../verification/`: `release-check-2026-09-26.log`, `release-chromium-2026-09-26.log`, `release-chromium-rerun-2026-09-26.log`, `release-stop-focused-2026-09-26.log`, `release-webkit-final-2026-09-26.log`, `release-webkit-lifecycle-portable-2026-09-26.log`, `release-chromium-lifecycle-portable-2026-09-26.log`, `dev-server-idle-probe.log`, `release-host-config-2026-09-26.log`, `release-host-status-2026-09-26.log`, `release-hosted-2026-09-26.log`, and `release-dependency-audit-2026-09-26.json`. Logs are retained outside the Git repository. Initial failures are retained alongside repeat results. The WebKit final runtime log includes the earlier lifecycle harness failures; the separate portable-lifecycle log records the corrected six-test pass.

The final Chromium rerun against the corrected development server passed all 17 scenarios (`release-chromium-final-2026-09-26.log`), and final formatting passed (`release-format-final-2026-09-26.log`). The 17 runtime/interface and six lifecycle scenarios now pass in both Chromium and WebKit within the methods described above.

## Before sign-off

Obtain a successful independent CI run (including full Firefox automation), or explicitly accept its absence, and a verifiable screen-reader check. GitHub is useful for a clean independent build and regression checks; payment is not required to run the site or continue local/staging checks. Production publication and optional search/saved-progress enhancements are separate steps.
