# Python Peer Support Reference

This is a single-page, static web application designed as a complete Python tutorial for psychology students and/or researchers. It uses HTML for structure, CSS for styling, and vanilla JavaScript to power an in-browser Python interpreter using Pyodide.

The application is designed to be a zero-setup learning environment. There is no build process or server-side backend required.

## Getting Started

To run this project locally, you can initiate local web server:

1.  **Clone the repository:**

    ```bash
    git clone git@github.com:vanyaisme/python-peer-support-ref.git
    cd python-peer-support-ref
    ```

2.  **Serve the files:**
    The easiest way to run a local server is with Python's built-in `http.server`.

    ```bash
    # From the project root
    python3 -m http.server 8765
    ```

3.  **Open in browser:**
    Navigate to `http://localhost:8765` in your browser.

## Project Structure

```
python-html/
├── index.html           # Main HTML file - structure and content for the Python tutorial page
├── style.css           # CSS stylesheet - styling and theming for the application
├── runner.js          # JavaScript file - Pyodide integration and code execution logic
├── favicon.png        # Favicon image - website icon displayed in browser tabs
├── manifest.json      # Web app manifest - PWA configuration for installability
├── sw.js             # Service worker - offline caching and asset management
├── README.md         # Project documentation - overview and setup instructions
├── LICENSE           # License file - project licensing terms
└── .gitignore       # Git ignore rules - specifies files to exclude from version control
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

2.  **Pyodide Integration**:
    - Loads the Pyodide runtime and required packages (e.g., `matplotlib`, `pandas`).
    - Analyzes code before execution to inject necessary imports or context, allowing snippets to be minimal.
    - Captures `stdout`/`stderr` and displays it in a output panel below the code.
    - Detects `input()` and `sys.argv` in a snippet before execution, shows a pre-run form to collect values, then substitutes them as string literals into the code. Works for programs with a fixed number of input calls; `input()` inside loops is not supported.
    - Renders `matplotlib` plots as inline images.

3.  **Service Worker** (`sw.js`):
    - Pre-caches the four static assets (`index.html`, `style.css`, `runner.js`, `manifest.json`) on first visit so the site can be read offline.
    - Uses a cache-first strategy, so Pyodide CDN requests could bypass the cache.

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
