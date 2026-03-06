# AGENTS.md

This guide provides instructions for AI agents working on the `python-peer-support-ref` repository. It outlines the project's structure, conventions, and workflows to ensure consistency and quality.

## Project Overview

This is a single-page, static web application designed as a Python tutorial. It uses HTML for structure, CSS for styling, and vanilla JavaScript for interactivity and to power an in-browser Python interpreter using Pyodide. The codebase is simple and has no build process or external dependencies, aside from the CDN-hosted Pyodide.

## Build, Lint, and Test Commands

This project has a very simple setup with no package manager (`npm`, `yarn`, etc.) or build tools. All files are served statically.

### Build

-   **No build command.** The project is composed of static HTML, CSS, and JS files. To "build," simply serve the files from a local web server. For example:
    ```bash
    # (From the project root)
    python3 -m http.server 8765
    ```

### Linting

-   **No linting command.** There are no configured linters (like ESLint or Prettier). Adherence to the code style outlined below is enforced manually through code review.

### Testing

-   **QA/Readiness Test:** The project includes a Playwright-based QA test suite in `qa_test.mjs`. This is not a unit/integration test suite, but a checklist to ensure the production page is rendered correctly.
    -   **To run all QA checks:**
        ```bash
        # Make sure the application is served on http://localhost:8765
        node qa_test.mjs
        ```
    -   **To run a single test:** There is no built-in mechanism to run a single test from the `qa_test.mjs` suite. The script runs all checks sequentially. If you need to debug a specific check, you will need to temporarily comment out the other checks in the file.

## Code Style Guidelines

Follow these guidelines to maintain consistency across the codebase.

### General

-   **File Structure:** All core files (`index.html`, `style.css`, `runner.js`) are in the root directory.
-   **Character Encoding:** Use UTF-8.

### HTML (`index.html`)

-   **Indentation:** 2 spaces.
-   **Semantics:** Use semantic HTML5 tags (`<main>`, `<nav>`, `<section>`, etc.) where appropriate.
-   **Accessibility:**
    -   Provide `alt` attributes for images.
    -   Use `aria-` attributes where necessary to improve accessibility, especially for interactive elements. For example, `aria-label` on icon-only buttons.
-   **IDs and Classes:**
    -   Use `kebab-case` for IDs and class names (e.g., `back-to-top`, `sidebar-nav`).
    -   Use IDs for unique, landmark elements.
    -   Use classes for reusable components and styling hooks.

### CSS (`style.css`)

-   **Formatting:**
    -   Indentation: 2 spaces.
    -   Place the opening brace on the same line as the selector.
    -   Each declaration should be on its own line.
-   **Naming:**
    -   Use `kebab-case` for class names.
    -   A BEM-like methodology is loosely followed.
-   **Variables:** Use CSS Custom Properties (variables) for themeable values like colors and fonts (e.g., `var(--surface)`, `var(--text)`).
-   **Units:** Use `rem` for font sizes and `px` for borders and other fine-grained measurements.

### JavaScript (`runner.js`)

-   **Strict Mode:** All scripts must start with `"use strict";`.
-   **Encapsulation:** Code is organized into Immediately Invoked Function Expressions (IIFEs) to avoid polluting the global namespace.
-   **Variable Declarations:**
    -   Use `const` by default.
    -   Use `let` only when a variable needs to be reassigned.
    -   Do not use `var`.
-   **Naming Conventions:**
    -   `camelCase` for variables and functions (e.g., `mobileNavBtn`, `toastShow`).
    -   `UPPER_SNAKE_CASE` for constants that are hardcoded and widely used (e.g., `VALID_THEMES`).
    -   Prefix internal/private variables with an underscore (e.g., `_pyodide`).
-   **Formatting:**
    -   Indentation: 2 spaces.
    -   Semicolons: Use them at the end of every statement.
    -   Braces: Use braces for all control structures (`if`, `for`, etc.), with the opening brace on the same line.
-   **DOM Manipulation:**
    -   Use vanilla JavaScript APIs (`document.getElementById`, `document.createElement`, etc.). Do not introduce jQuery or other DOM manipulation libraries.
-   **Error Handling:**
    -   Use `try...catch` blocks for asynchronous operations that can fail (e.g., network requests, clipboard access).
    -   Use `.catch()` on promises.
-   **Comments:**
    -   Use `//` for single-line comments.
    -   Use JSDoc-style comments for functions where the purpose or parameters are not obvious.
    -   The codebase uses a decorative line style for section headers (e.g., `// ── Section Name ──`). Please maintain this style.
-   **Types:** This is not a TypeScript project. However, write clear, type-stable code.

## Agentic Behavior

-   **Minimize Changes:** Make the smallest possible change to address a request. Do not refactor or restyle code unless explicitly asked.
-   **Preserve Structure:** Maintain the existing file structure and IIFE-based encapsulation in `runner.js`.
-   **Verify:** After making changes, run the QA test suite (`node qa_test.mjs`) to ensure that no existing functionality has been broken.
