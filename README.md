# Python Peer Support Reference

This is a single-page, static web application designed as a comprehensive, interactive Python tutorial. It uses HTML for structure, CSS for styling, and vanilla JavaScript to power an in-browser Python interpreter using Pyodide.

The application is designed to be a zero-setup learning environment. There is no build process or server-side backend required.

## Getting Started

To run this project locally, you only need a modern web browser and a simple local web server.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/python-peer-support-ref.git
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

The codebase is intentionally simple and flat to make it easy for beginners to understand.

```
python-html/
├── index.html           # Main HTML file - structure and content for the Python tutorial page
├── style.css           # CSS stylesheet - styling and theming for the application
├── runner.js          # JavaScript file - Pyodide integration and code execution logic
├── favicon.png        # Favicon image - website icon displayed in browser tabs
├── manifest.json      # Web app manifest - PWA configuration for installability
├── sw.js             # Service worker - offline caching and asset management
├── qa_test.mjs       # QA test suite - Playwright-based automated testing script
├── AGENTS.md         # Agent instructions - guidelines for AI agents working on the project
├── README.md         # Project documentation - overview and setup instructions
├── LICENSE           # License file - project licensing terms
└── .gitignore       # Git ignore rules - specifies files to exclude from version control
```

---

## Codebase Overview

### `index.html` - Content and Structure

The `index.html` file contains all the tutorial content, structured semantically. The tutorial is divided into 34 sections, organized into a 9-stage learning roadmap covering everything from basic "Hello, World" to advanced data science libraries.

-   **Layout:** A two-column layout with a fixed sidebar for navigation and a main content area.
-   **Content:** Each section contains multiple collapsible "scenarios," code examples, and styled callouts for tips and warnings.

### `runner.js` - Interactivity and Python Execution

This vanilla JavaScript file (~850 lines) brings the page to life. Its major responsibilities include:

1.  **UI Interactions**:
    -   Dynamically generates the sidebar and mobile navigation.
    -   Highlights the active section in the sidebar as the user scrolls.
    -   Handles the light/dark theme toggle.
    -   Manages collapsible content cards.
    -   Adds "copy" buttons to all code blocks.

2.  **Pyodide Integration (In-Browser Python)**:
    -   Loads the Pyodide runtime and required packages (e.g., `matplotlib`, `pandas`) on demand.
    -   Intelligently analyzes code before execution to inject necessary imports or context, allowing tutorial snippets to be minimal and focused.
    -   Captures `stdout`/`stderr` and displays it in a styled output panel below the code.
    -   Supports interactive features like `input()` and `sys.argv` by dynamically creating input forms.
    -   Renders `matplotlib` plots as inline images.

3.  **Service Worker**:
    -   Registers a service worker for offline caching.

### `style.css` - Visual Style and Theming

The project has a complete design system managed through CSS custom properties (variables), allowing for easy theming.

**General Style:**
-   **Theme:** A dark-mode-first design with a warm, paper-like light theme alternative.
-   **Typography:** A clean sans-serif (`Segoe UI`, `system-ui`) for body text and `Fira Code` (with ligatures) for all code.
-   **Layout:** Uses modern CSS features like Flexbox and Grid for a responsive layout.

**Color System:**

| Variable | Dark Theme | Light Theme | Usage |
|---|---|---|---|
| `--bg` | `#0f1117` | `#f5f0e8` | Page background |
| `--surface` | `#1a1d27` | `#ece6da` | Card/container background |
| `--text` | `#e2e8f0` | `#2c2a26` | Main text color |
| `--accent` | `#5b8dee` | `#4a72b8` | Primary accent (links, buttons) |
| `--accent2` | `#a78bfa` | `#7c5cbf` | Secondary accent (highlights) |
| `--green` | `#34d399` | `#1a8a5e` | Success states |
| `--red` | `#f87171` | `#c44040` | Error states |

---

## Contributing

This project is maintained with the help of AI agents. Please refer to `AGENTS.md` for detailed instructions on code style, testing, and other conventions that agents must follow.

Human contributors should also follow these guidelines to maintain consistency.
