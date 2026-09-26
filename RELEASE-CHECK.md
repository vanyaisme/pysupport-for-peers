# Release check — 26 September 2026

Status: validation in progress; not yet a complete release sign-off. Enhancements and production publication are deferred.

Application release: `59be8795f96d0c8d137e` (source preview v19). Approved staging snapshot: https://3d022f16.python-peer-support-ref.pages.dev. Release-check branch: `release/validation-2026-09-26`.

## Scope and evidence

| Requested area | Implemented behavior | Release evidence / limits |
| --- | --- | --- |
| Offline and upgrades | Atomic required precache, integrity, app-shell fallback, scoped cache cleanup, waiting updates and hashed assets | Local and hosted lifecycle checks recorded in STAGING-VALIDATION.md and SECURITY-VALIDATION.md. Offline reading is supported; offline Python execution is not promised. |
| Lesson correctness | Both operator equivalences corrected; z-score subtracts the mean before dividing by sample standard deviation | Fresh corpus checks pass, including the displayed z-score mean/deviation assertion. Corpus execution is not a comprehensive editorial review of every explanation. |
| Output and recovery | Bounded text/plots/export snapshots, incremental rendering, Stop and global Reset | Runtime/UI tests pass. A fresh Chromium CPU-stop test used the safe hard-restart fallback and failed its stricter cooperative-interrupt assertion; the isolated repeat passed. Broader repeat pending. No general Python memory quota is claimed. |
| Keyboard and dialogs | Visible keyboard navigation, named dialogs, background inertness and focus trapping/restoration | Browser checks cover these interactions. Actual VoiceOver speech could not be observed through the native control tool; this is pending, not a screen-reader pass. |
| Security and startup | Separate restrictive page/worker policies, verified core Python loader, local Prism, first-Run loading and locked dependencies | Fresh lint, formatting, runtime/UI, corpus, release tests and build pass on Node 22.23.3. See SECURITY-VALIDATION.md for security scope; scientific package archives are not all covered by custom SRI. |
| Git, CI and deployment | Approved checkpoints pushed on a dedicated release-check branch; Linux CI now includes all three browser engines | GitHub blocked the job before any test step because of an account billing lock. Cloudflare automatic build settings were corrected; live production did not change. |

## Independent CI blocker

Run: https://github.com/vanyaisme/pysupport-for-peers/actions/runs/36207999681

Commit: `fa8e857f51648c6617979b1dfd6264cc9a2490c0`.

GitHub's annotation says: “The job was not started because your account is locked due to a billing issue.” No job steps ran. This is neither a test pass nor a code-test failure. Browser jobs were skipped. The code/history push succeeded. Hosting and local testing do not require this lock to be resolved, but independent GitHub checks remain unverified until a successful rerun. Do not mark the workflow green based on local results.

## Hosting correction

The Cloudflare Git integration still had empty build/output settings. It would publish source files rather than the fingerprinted release prepared by `scripts/build-release.cjs`. The project now builds with `npm run build`, publishes `dist`, and runs from the repository root (empty root setting). The project refers to the repository's former name `python-peer-support-ref`; its repository ID matches `vanyaisme/pysupport-for-peers`.

The production deployment remained `26833db9-7df1-4270-add0-ca3e0150def2` before and after this settings correction. Remote `main` remains at the old release. Automatic production deployment on a push to `main` is enabled; merging this branch must therefore be treated as publishing and requires release approval. GitHub Actions is not currently an enforced deployment gate.

The first automatic preview, `beb8daad`, used the old blank settings and is not the approved release preview. A subsequent Git-triggered preview must be checked after this correction, including manifest integrity and live headers.

## Native and real-device scope

- Native Safari completed the hosted name/age example and displayed the correct age result. The native tool exposed only a partial accessibility tree; this is not sufficient evidence for VoiceOver accessibility.
- Native Firefox completed name/age input, stopped a blocked input run, reset Python and opened another input prompt afterwards. Wider dialog checks are still in progress.
- With user approval, VoiceOver was temporarily enabled via System Settings. The caption setting was already enabled, but the tool could not read VoiceOver's announcement window. VoiceOver was restored to its original **off** state; caption preferences were not changed. No actual spoken-output pass is claimed.
- The user previously passed iPhone navigation, panels, input/Stop/Reset, theme switching and CSV/plot downloads. Device model and iOS version were not supplied. See the prior validation reports for the tested snapshots.

## Local evidence

Operator logs are in `../verification/`: `release-check-2026-09-26.log`, `release-chromium-2026-09-26.log`, `release-stop-focused-2026-09-26.log`, and `release-host-config-2026-09-26.log`. Logs are retained outside the Git repository. The initial failed CPU-stop assertion is retained alongside repeat results; it must not be silently discarded.

## Before sign-off

Complete the browser repeats and Git-triggered hosting check. Obtain a successful independent CI run (or explicitly accept its absence) and a verifiable screen-reader check. Production publication and optional search/saved-progress enhancements are separate steps.
