# Clean Ubuntu release validation — 26 September 2026

The user requested Parallels as an alternative to the GitHub account billing block and will perform the screen-reader check separately. Ubuntu was sufficient for the clean Linux build and complete Firefox automation. Windows was not started or tested.

## Provenance and environment

- Source: Git archive of `ff29ca2c53520a24d259eeed0a7529fe416c5d8b`, extracted into a new guest directory. No Mac `node_modules` or browser profiles were reused.
- Archive SHA-256: `3599ea70dfcd4d3178821d51bbc07b8e830ecb15865769322a0e66c402e7613f`, verified inside the guest before extraction.
- VM: Ubuntu 26.04 LTS ARM64, two CPUs, 4 GiB RAM, Parallels Tools 27.0.1. Node 22.23.3 Linux ARM64 was checked against Node's published SHA-256 list; npm 10.9.9; system Python 3.14.4; Playwright 1.62.1.
- Browsers: Chromium 151.0.7922.34 (revision 1234), Firefox 153.0 (revision 1538), WebKit 26.5 (revision 2336). Playwright installed browser dependencies and downloaded fresh browser binaries into the task directory.
- `npm ci` installed the lockfile dependencies fresh and reported zero known vulnerabilities. Tests ran as the guest's unprivileged `parallels` user.
- Application build: `59be8795f96d0c8d137e`, identical to the approved staging release. No deployed application files changed during this validation.

The guest is a separate Linux environment on the same physical Mac, not a remote CI runner. ARM64 and system Python 3.14.4 differ from the configured GitHub runner's architecture and Python 3.12. Lesson execution still uses the project's pinned Pyodide 0.29.3. This run does not certify Windows or restore future GitHub automation.

## Results

| Check | Result |
| --- | --- |
| Clean install, ESLint, formatting, deterministic build | Passed |
| Runtime/UI | 32 passed |
| Python corpus, reverse order, syntax and content assertions | 265 passed |
| Release/build checks | 6 passed |
| Chromium interactions / lifecycle | 17 / 6 passed |
| Firefox interactions / lifecycle | 17 / 6 passed after the harness correction below |
| WebKit interactions / lifecycle | 17 / 6 passed |

Total: 372 passing test records across the listed suites. Initial failure logs remain preserved; the summary is not a claim that the first batch passed unchanged.

## Firefox diagnostic and correction

The initial full Firefox interaction suite passed. Three of six lifecycle scenarios failed with `NS_ERROR_OFFLINE` when navigating or reloading after `context.setOffline(true)`.

A separate tiny service worker returned literal HTML without fetching anything or using application code. With Playwright request routing disabled, Firefox served this response under offline emulation. Routing only an unrelated font URL made the same navigation fail. Dropping real origin connections instead also passed with routing enabled. This isolates a conflict between the tested Firefox/Playwright interception and offline-emulation combination; it is not evidence of an application caching defect.

The only code change was in `tests/release-browser.test.cjs`: remove Firefox context routes before switching offline, leaving subsequent network handling to the browser. All six actual application lifecycle scenarios then passed, including offline root/query navigation, offline reloads, rejected precache installs, waiting updates during Python input, activation after all old tabs close, failed-upgrade retry and integrity-checked eviction recovery. Assertions remained intact; no tests were skipped. Chromium and WebKit do not enter this new Firefox-only branch, so their successful original runs still cover their unchanged paths. Formatting was checked after the edit.

Firefox's final lifecycle result is therefore for the archived source plus this four-line test-only correction, saved alongside this report. The other suites passed on the archived source. Application bytes remained unchanged.

WebKit uses an independently verified origin outage rather than browser offline emulation; this tests unavailable-origin reading, not airplane mode or `navigator.onLine`. See [RELEASE-CHECK.md](RELEASE-CHECK.md) for the wider native, hosted and real-device evidence and limits.

## Repeat and retained evidence

In a clean Linux checkout with the pinned Node and Python available:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run check
for engine in firefox chromium webkit; do
  TEST_BROWSER="$engine" npm run test:browser || exit 1
  TEST_BROWSER="$engine" npm run test:release:browser || exit 1
done
```

The guest task directory is `/home/parallels/pysupport-release-ff29ca2.26eg4P`; source, Node, browsers and logs are retained there. Host operator evidence is in `../verification/`: `ubuntu-environment.log`, `ubuntu-bootstrap.log`, `ubuntu-check.log`, `ubuntu-*-browser.log`, `ubuntu-*-release.log`, `ubuntu-firefox-offline-probe.log`, `ubuntu-firefox-release-recheck.log` and `ubuntu-release-id.log`. `ubuntu-results.log` records the original batch, including its Firefox failure; use the separately named recheck log for the corrected pass. Bootstrap, suite and diagnostic scripts are retained beside these logs.

The remaining manual check is screen-reader use on [the verified staging snapshot](https://6b0aad92.python-peer-support-ref.pages.dev/#s3): named lesson controls, dialog announcement and focus containment/return, plus Python input and completion/Stop announcements. No production deployment or merge to `main` was performed.
