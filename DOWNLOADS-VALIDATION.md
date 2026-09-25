# Learner downloads stage — 25 September 2026

## Delivered behavior

- Each captured plot has an individually named PNG download.
- Files created or changed by an example appear as individual downloads under its output. Exact bytes are preserved, including CSV line endings, Unicode and binary files; changed practice fixtures and nested output folders are supported.
- Exports are snapshots of that run and remain usable after Python Reset. Closing/replacing the output releases the file Blob URLs. Reset still clears the worker's temporary files.
- The 13 local-only Python examples show **Run locally**, explain the environment requirement, and offer a `.py` download of the displayed source. The terminal example shows **Terminal** with copy/paste guidance. These actions do not start Python and stay available while Python is unavailable or loading.
- Source-preview references/cache advance together to v19. The lesson HTML copy, strict security policies, Python version and worker protocol remain unchanged.

## Export limits

Only regular files in the initial lesson workspace are inspected. Dotfiles, `__pycache__`, symlinks and paths outside the workspace are excluded. Up to 20 files, 4 MiB each and 8 MiB in total can be offered per run. Inspection has separate bounds: 500 entries, six nested directory levels, and 16 MiB of file hashing per scan. A notice reports omitted exports. Paths become safe flat download names; the visible link retains the relative workspace path.

Snapshots compare file size, modification time and content hashes within the inspection budget. Exports written before an ordinary Python exception may still be available. A hard worker termination cannot recover in-flight files. These controls bound export work; they do not impose a general memory/filesystem quota on Python.

## Checks

- Node 22.23.3: `npm run check` passed lint/format, 32 runtime/UI checks, all 265 example checks, six release tests and build.
- Chromium: all 17 runtime/interface scenarios and six offline/update scenarios passed on the final built release.
- WebKit: all 17 runtime/interface scenarios passed, including PNG/source/CSV/binary downloads and Reset retention.
- Downloads were read from real browser download files and compared byte-for-byte. Worker tests cover nested and empty files, modified fixtures, error paths, exclusion of external paths/symlinks, size/count/total limits and subsequent-run recovery. UI tests cover literal handling of HTML-looking filenames, URL revocation, and local actions without isolation.
- Release: `59be8795f96d0c8d137e`.
- Desktop (1440px) and 320px phone-width screenshots were inspected in dark/light themes. The first review found local instructions unnecessarily scrolled internally; the final panel expands naturally with its download link above the instructions. The affected download/layout checks passed again in Chromium and WebKit, and release verification was repeated after this refinement.
- Live staging validation is pending.

Evidence lives in `../verification/downloads-check.log`, `downloads-browser-focused.log`, `downloads-chromium-release.log`, `downloads-webkit.log`, `downloads-layout-chromium.log`, `downloads-layout-webkit.log`, and `downloads-release-final.log`. Screenshots are `downloads-csv-*.png`, `downloads-local-*.png` and `downloads-local-light-320.png`. The existing Firefox automation limitation is unchanged. Native iPhone download behavior requires its own check; prior iPhone runtime confirmations did not cover this feature. Production publishing is separate.

## References

- [Browser download links](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download)
- [Blob URL lifetime](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob)
