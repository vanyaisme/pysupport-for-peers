# Staging validation — 24–25 September 2026

## Checkpoints and staging

- Approved baseline: `dc71876` — reliability, accessibility and navigation release.
- Follow-up: `8cba982` — mobile theme control and browser test harness improvements.
- Final application release: `5f59c4f7874774366c2d`.
- Staging alias: https://approved-preview.python-peer-support-ref.pages.dev
- Verified final snapshot: https://f64b5f95.python-peer-support-ref.pages.dev
- iPhone-reviewed snapshot with the same final application bytes: https://d94fd013.python-peer-support-ref.pages.dev
- Cloudflare Pages project: `python-peer-support-ref`; preview branch: `approved-preview`.

Commits are local. No Git push or production deployment was performed. Production remains separate on `main`. The security/loading development stage has not started.

## Completed checks

- `npm run check`: lint, formatting, 27 runtime/UI tests, 265 example checks, five release tests and build passed on the follow-up checkpoint.
- Chromium: all 14 execution/interface scenarios passed.
- WebKit: the final isolated run passed all 14 execution/interface scenarios, including cooperative Stop.
- Chromium release browser suite: all six offline/update scenarios passed, including failed installation, failed upgrade, asset recovery and safe updates during input.
- Hosted headers and integrity: the homepage, all nine required assets, isolation headers, immutable asset caching, service-worker revalidation and release agreement passed against actual Cloudflare responses.
- Hosted Chromium and WebKit: live CDN loading, cross-origin isolation, Unicode name/age input, Stop during blocked input, Reset, and subsequent successful execution passed.
- Hosted update lifecycle: deployed a temporary worker-comment-only release to staging while Python waited for input. The update waited, the active input sequence completed, offline navigation retained the installed release, and the new release activated only after the old tab closed. Python then ran successfully. Restored and verified release `5f59c4f7874774366c2d` afterward.
- Native Firefox 156.0.1: manually ran the hosted input example through the actual browser UI, entered `Zoë 🧠` and age `21`, and verified the greeting and result `In 10 years you will be 31`. This was a focused native-browser smoke check, not the full automated suite.
- Real iPhone Safari: the user reported navigation, panel collapse/expand, input, Stop, Reset and rotation working. They found the floating sun button missing; after the fix they confirmed it appears and switches themes. iPhone model and iOS version were not supplied.
- Mobile theme regression: WebKit verified theme switching and non-overlapping Reset/theme/Back-to-top controls at 320px and 640px.

## Verification findings and limits

The mobile theme button was deliberately hidden by a desktop-only CSS rule. The follow-up removes that restriction and keeps Reset above the theme control on mobile, matching desktop. No tutorial text was changed during this checkpoint work.

The original offline browser test expected an outdated title. It now checks that offline navigation retains the actual online title. Runtime fault-injection tests preserve the worker's isolation headers and disable service workers in that suite so test responses cannot contaminate the offline cache; the separate release suite continues to test real service workers.

Cloudflare's preview alias can briefly serve the preceding deployment after the upload command succeeds. The hosted update probe now waits for both the expected manifest and service-worker release before requesting an update. The complete hosted lifecycle passed with that propagation check.

One WebKit run made under concurrent browser-test load used the existing 1.5-second forced-reset fallback for a CPU-bound loop instead of returning a cooperative KeyboardInterrupt. The isolated Stop recheck and subsequent complete isolated 14-scenario WebKit run both passed. The fallback stops execution but clears temporary files, as the interface states; do not assume cooperative cancellation is guaranteed under all loads.

The bundled Playwright Firefox browser failed to launch on this Mac with `Couldn't load XPCOM`; no automated Firefox pass is claimed. Native desktop Firefox received the focused check above. Native desktop Safari rendering was inspected, while interactive Safari coverage came from the user's real iPhone plus automated WebKit; WebKit is not a substitute for a full desktop Safari certification.

The local checks used Node 26.9.0. CI pins Node 22.22.0; remote CI and clean-install verification on that pinned toolchain have not been run in this checkpoint. Broader screen-reader and real-device coverage remain separate from these checks.

## Evidence

Logs and screenshots are in `../verification/`:

- `checkpoint-check.log`
- `checkpoint-browser.log`
- `checkpoint-release-browser.log`
- `checkpoint-webkit.log`, `checkpoint-webkit-stop-recheck.log`, `checkpoint-webkit-final.log`
- `checkpoint-hosted-browser.log` (hosted runtime checks passed; first update attempt timed out before alias propagation)
- `checkpoint-hosted-updates.log` (complete hosted lifecycle and final restoration passed)
- `mobile-theme-check.log`, `mobile-theme/`
- `staging-chromium.png`, `staging-webkit.png`

`staging-browser.cjs` is an operator-only staging verification script in the evidence directory. It creates and restores a temporary preview deployment; it must not be run against production.
