# Python Peer Support Reference

This is a single-page, static web application designed as a complete Python tutorial for psychology students and/or researchers. It utilizes HTML for structure, CSS for styling, and JavaScript to power an in-browser Python interpreter using Pyodide.

The application is designed to be a zero-setup learning environment. There is no build process or server-side backend required.

The 1:1 running copy of this repo is accessible through **[peer-support.live](https://peer-support.live)**.

## Getting Started

To run this project locally, you can initiate local web server:

1.  **Clone the repository:**

    ```bash
    git clone git@github.com:vanyaisme/python-peer-support-ref.git
    cd python-peer-support-ref
    ```

2.  **Serve the files:**
    Use the included dev server, which sets the COOP/COEP headers required for `input()` to work:

    ```bash
    python3 serve.py
    # or on a custom port:
    python3 serve.py 3000
    ```

    > **Note:** `python3 -m http.server` also works for read-only browsing, but `input()` will not function without the isolation headers.

3.  **Open in browser:**
    Navigate to `http://127.0.0.1:8080` in your browser.

## Project Structure

```
python-html/
├── index.html           # Tutorial content (29 sections)
├── style.css            # Styling and theming
├── runner.js            # UI logic and worker orchestration
├── pyodide-worker.js    # Pyodide Web Worker (Python execution)
├── sw.js                # Service Worker — caching and COOP/COEP headers
├── serve.py             # Local dev server with COOP/COEP headers
├── _headers             # Production COOP/COEP headers (Cloudflare Pages)
├── manifest.json        # PWA manifest
├── favicon.png          # Favicon
├── AGENTS.md            # AI agent guidelines
├── README.md            # Project documentation
├── LICENSE              # License
└── .gitignore           # Git ignore rules
```

---

## Codebase Overview

### `index.html`

The `index.html` file contains all the tutorial content divided into 29 sections, organized into a 9-stage learning roadmap.

- **Layout:** A one-column layout with a fixed sidebar for navigation and a main content area.
- **Content:** Each section contains multiple collapsible "scenarios," code examples, and styled callouts for tips and warnings.

### `runner.js` - Interactivity and Python Execution

This vanilla JavaScript file. Its major responsibilities include:

1.  **UI**:
    - Dynamically generates the sidebar and mobile navigation.
    - Highlights the active section in the sidebar as the user scrolls.
    - Handles the light/dark theme toggle.
    - Manages collapsible content cards.
    - Adds "copy" buttons to all code blocks.

2.  **Pyodide Integration** (via Web Worker):
    - Spawns `pyodide-worker.js` as a Web Worker using `SharedArrayBuffer` + `Atomics` for real-time `input()`.
    - Streams `stdout`/`stderr` into a live output panel during execution.
    - Handles native `input()` calls: the worker blocks on `Atomics.wait` while the UI shows an input prompt below the output.
    - Supports `KeyboardInterrupt` — clicking the run button while code is executing cancels the run.
    - Renders `matplotlib` plots as inline images.
    - Injects context variables and scaffolding (`pd`, `pearsonr`, etc.) to keep tutorial snippets minimal.

3.  **Service Worker** (`sw.js`):
    - Pre-caches five static assets (`index.html`, `style.css`, `runner.js`, `pyodide-worker.js`, `manifest.json`) on first visit for offline reading.
    - Injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all same-origin responses, enabling `SharedArrayBuffer` support.
    - Uses a cache-first strategy; Pyodide CDN requests bypass the cache.

### `style.css`

The project has a complete design system managed through CSS custom properties (variables), allowing for easy theming.

**General Style:**

- **Theme:** A dark-mode-first design with a warm, paper-like light theme alternative.
- **Typography:** Sans-serif (`Segoe UI`, `system-ui`) for body text and `Fira Code` for code.
- **Layout:** Uses Flexbox and Grid for a layout.

**Color System:**

| Variable    | Dark Theme | Light Theme | Usage                           |
| ----------- | ---------- | ----------- | ------------------------------- |
| `--bg`      | `#0f1117`  | `#f5f0e8`   | Page background                 |
| `--surface` | `#1a1d27`  | `#ece6da`   | Card/container background       |
| `--text`    | `#e2e8f0`  | `#2c2a26`   | Main text color                 |
| `--accent`  | `#5b8dee`  | `#4a72b8`   | Primary accent (links, buttons) |
| `--accent2` | `#a78bfa`  | `#7c5cbf`   | Secondary accent (highlights)   |
| `--green`   | `#34d399`  | `#1a8a5e`   | Success states                  |
| `--red`     | `#f87171`  | `#c44040`   | Error states                    |

---

## Companion Project

The interactive notebooks that accompany this course are available at:
**[github.com/vanyaisme/python-for-psychologists-notebooks](https://github.com/vanyaisme/python-for-psychologists-notebooks)**
