# Saved reading place validation

## Compact control refinement

Current preview: https://664629f5.python-peer-support-ref.pages.dev — release `2040845ac76f92591d58`, source preview v21.

The large saved-place card was replaced by **Resume · chapter name ×** beside Contents. The panel name and local-device note remain in the link tooltip; the visible label is just the chapter. The separate × button retains its accessible Clear name and a 44px target. On narrow screens the control moves onto one compact row beneath the header; long labels truncate visually while their full text remains available to assistive technology. Colors use the existing light/dark theme variables. Bookmark storage and resume behavior are unchanged.

Verified lint, formatting, six release/build checks, and the two existing bookmark/reflow tests in both Chromium and WebKit. Reviewed light/dark screenshots with a long chapter title at 320, 768 and 1440px; existing layout checks also include 390px. Earlier functional validation below remains evidence for the unchanged persistence/runtime behavior. Logs and screenshots: `../verification/compact-resume-*`.

## Initial implementation

Preview: https://9e7d1d03.python-peer-support-ref.pages.dev

Release: `88192cd50b45ed745bc7` (source preview v20). Approved pre-enhancement baseline: `6fb8bdb`, application release `59be8795f96d0c8d137e`. Production has not been published. Lesson search is deferred; the existing table of contents remains the navigation structure.

## Behavior

- After scrolling through a lesson, the current chapter and panel are saved locally. Writes are debounced and pending saves flush on page hide/exit. Contents and exercise dialogs do not replace the reading place.
- Contents offers **Continue reading**. It opens collapsed ancestors, scrolls to the saved panel and moves keyboard focus there. Arrival does not auto-resume; chapter links retain their own destination.
- **Clear** deletes only this bookmark, announces the result and returns focus to Contents. Another lesson scroll can create a new bookmark. Open tabs receive bookmark changes and deletion through storage events.
- Storage contains just a version, chapter ID, panel index and panel title. No Python work or completion percentage is saved. Reset Python leaves the bookmark intact. Each browser and site origin has a separate bookmark.
- Invalid data is ignored. Changed/missing panels fall back to their chapter. Disabled storage does not break reading, theme controls or Python startup. Theme persistence was also guarded because an unhandled storage exception previously could stop UI initialization.
- Later chapter containers are nested within chapter 9 in the legacy HTML. Detection uses the latest chapter start passed and indexes only panels owned by that chapter. No lesson text or page structure was rewritten to implement this feature.

## Verification

| Check | Result |
| --- | --- |
| ESLint, formatting, Git whitespace and build | Passed |
| Runtime/UI, including invalid/stale bookmarks and unavailable storage | 34 passed |
| Python corpus | 265 passed |
| Release/build checks | 6 passed |
| Chromium interactions, including saved place and 320/390/768px reflow | 19 passed |
| WebKit interactions, including saved place and cross-tab Clear | 19 passed |
| Ubuntu Firefox focused saved-place tests | 2 passed |
| Offline/update lifecycle, including offline bookmark resume | 6 passed in each of Chromium, WebKit and Firefox |
| Hosted homepage, ten required assets, integrity, CSP, isolation and caching headers | Passed |
| Hosted Chromium/WebKit save/resume, light/dark layout, first-Run input and Reset bookmark retention | Passed; no uncaught page errors |

Mac checks used Node 22.23.3 and Playwright 1.62.1. Firefox used the existing Ubuntu 26.04 ARM64 toolchain in a separate source directory, with the previously installed locked dependencies and browser; it was not a second clean install. The earlier complete Firefox suite remains baseline evidence; this stage ran its two new interaction tests and all six lifecycle scenarios. WebKit's offline method is the verified origin outage described in RELEASE-CHECK.md.

The first browser attempt caught chapter 9 being selected for later nested chapters; the corrected detection passed the repeat and full suites. The first Node runtime run had two interrupt timeouts in unchanged runtime tests; the complete repeat passed with no runtime changes. The cause of those timeouts is unproven. Initial logs are retained, not overwritten or counted as passes.

Operator evidence is in `../verification/reading-place-*.log`, `reading-place-source.tar`, `ubuntu-reading-place.sh`, and `reading-place/` screenshots. The initial search draft is set aside outside the repository and is not part of the built site. GitHub's account billing lock still prevents unattended CI; these are local/VM/hosted test results.

For visual review, open the preview, read part of a lesson, then reopen the same preview URL. Select **Continue reading** in Contents and try **Clear**. The earlier manual screen-reader pass belongs to the baseline release; the new bookmark controls have automated keyboard/focus checks and await any further manual feedback.
