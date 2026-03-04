# Plan: python-guide-production
> Pre-launch audit fixes + file refactoring for `python-guide_final.html`
> Source audit: `.sisyphus/PRODUCTION_PLAN.md`

---

## P0 — Blockers (must fix before any deploy)

- [x] **P0-1**: Fix canonical URL placeholder — replace `https://your-domain.com/python-guide` with actual deployment URL in `<link rel="canonical">` (lines 7–8)
- [x] **P0-2**: Remove the `<!-- TODO: update canonical URL before publishing -->` comment from the `<head>`

---

## P1 — Important (should fix before launch)

### SEO & Meta
- [x] **P1-1**: Add missing Open Graph meta tags — `og:url` and `og:image` (with `og:image:width`/`og:image:height`) to `<head>`
- [x] **P1-2**: Add Twitter/X card meta tags — `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` to `<head>`
- [x] **P1-3**: Add `<meta name="robots">` tag to `<head>` — choose `index, follow` (public) or `noindex, nofollow` (internal) based on intended audience
- [x] **P1-4**: Add `<meta name="author">` tag to `<head>`
- [x] **P1-5**: Add `<meta name="theme-color">` — two variants (dark: `#0f172a`, light: `#ffffff`) with `media` attributes

### Accessibility
- [x] **P1-6**: Replace `<div class="container" role="main">` with `<main class="container">` and update closing tag; wrap sidebar in `<nav class="sidebar" aria-label="Section navigation">`
- [x] **P1-7**: Add `aria-expanded="false"` to each `.scenario` toggle button in HTML; update JS click handler to toggle `aria-expanded` between `"true"` and `"false"`
- [x] **P1-8**: Add `role="switch"` and `aria-checked="false"` to the theme toggle button; update JS to set `aria-checked` on theme change
- [x] **P1-9**: Add `color: #e2e8f0` CSS fallback to the `<h1>` gradient rule (`.header h1`) for screen reader compatibility

### CSS Quality
- [x] **P1-10**: Remove duplicate CSS rule blocks — `.scenario-title` (duped ~line 307 & ~609), `.scenario-body` (duped ~line 365 & ~627), `.section` scroll-margin (defined twice); keep the later overriding version
- [x] **P1-11**: Replace inline `style="background: rgba(...)"` attributes on roadmap section `<tr>` elements with CSS classes (`.roadmap-row-highlight`, `.roadmap-row-muted`)

### HTML Quality
- [x] **P1-12**: Improve `<noscript>` banner message — ensure it explains: (1) JS is required, (2) Python runner will not work, (3) what read-only content is still accessible

### Security / Integrity
- [x] **P1-13**: Verify Pyodide SRI hash — confirmed `sha384-i3R37b3tF+HWudsUf1VSEOY2YxwSNMqY8DQa9Z0O3xh+NkJ9o+yjcGyIi5huj+nB` matches actual Pyodide v0.26.4 CDN file (hash correct, no changes needed)

### Architecture
- [x] **P1-14**: Split monolith into separate files — extract inline `<style>` block (~1,046 lines) to `style.css`, extract inline `<script>` block (~632 lines) to `runner.js`, update `<head>` references, test all functionality (theme toggle, copy buttons, Pyodide runner, sidebar nav, collapsible cards)
- [x] **P1-15**: Resolve `'Fira Code'` font — added Google Fonts `<link>` preconnect + Fira Code wght@400;500 import to both `index.html` and `python-guide_final.html`

---

## P2 — Post-Launch / Nice-to-Have

- [ ] **P2-1**: Minify CSS and JS after file split — use `cssnano` for `style.css` → `style.min.css` and `terser` for `runner.js` → `runner.min.js`; update `index.html` references
- [ ] **P2-2**: Add `<link rel="preload">` resource hints for `style.css` and `runner.js` in `<head>`
- [ ] **P2-3**: Evaluate and optionally enable Pyodide warm-up (commented out at JS line ~9401) — consider gating on `navigator.connection.effectiveType === '4g'`
- [ ] **P2-4**: Add `<meta http-equiv="Content-Security-Policy">` baseline policy (note: requires `unsafe-eval` and `blob:` worker-src for Pyodide — test thoroughly)
- [ ] **P2-5**: Add closing section comments (`<!-- /s1 -->` … `<!-- /s32 -->`) to all 32 content section `</div>` closing tags
- [ ] **P2-6**: Add `td code { ... }` CSS rule and remove redundant `class="inline-code"` from all `<code>` elements inside `<td>` cells
- [ ] **P2-7**: Create `manifest.json` for PWA installability; add `<link rel="manifest">` to `<head>`
- [ ] **P2-8**: Add a Service Worker to cache `index.html`, `style.css`, `runner.js` for offline read-only access (implement after P1-14 file split)
- [ ] **P2-9**: Run Prettier HTML formatter on `index.html` to fix inconsistent section wrapper indentation (lines ~1216, ~1261, ~1318 and others)
- [ ] **P2-10**: Add a JS comment in the sidebar nav generation code documenting why `id="roadmap"` is excluded from sidebar links

---

## Testing Checklist (run after completing P0 + P1)

- [ ] Pyodide runner executes Python in at least 3 different sections
- [ ] Copy buttons work on all code blocks
- [ ] Theme toggle switches dark/light and persists on reload
- [ ] Sidebar navigation scrolls to correct sections
- [ ] All 32 sections + roadmap render correctly
- [ ] Collapsible scenario cards expand/collapse
- [ ] Page loads without console errors
- [ ] `og:url`, `og:image`, canonical URL all point to the live domain
- [ ] SRI hash on Pyodide CDN script verified
- [ ] Lighthouse audit: target 90+ on Performance, Accessibility, Best Practices, SEO
- [ ] Screen reader test (VoiceOver / NVDA) on at least one section
