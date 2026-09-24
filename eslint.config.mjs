// ESLint flat config (v9+)
// Three distinct environments in this project:
//   runner.js        — browser IIFE, accesses DOM + SharedArrayBuffer
//   pyodide-worker.js — Classic Web Worker, no DOM, has importScripts + Atomics
//   sw.js            — Service Worker, no DOM, has caches + clients
import js from "@eslint/js";
import globals from "globals";

export default [
  // ── Recommended rules (applied to all files) ──────────────────────────────
  js.configs.recommended,

  // ── Shared language settings ──────────────────────────────────────────────
  {
    languageOptions: {
      ecmaVersion: 2022,
      // All three files are plain scripts (IIFE / no import-export).
      sourceType: "script",
    },
    rules: {
      // Enforce modern variable declarations already used in the codebase.
      "no-var": "error",
      "prefer-const": "warn",

      // Strict equality everywhere — catches the == null ambiguity.
      "eqeqeq": ["warn", "always", { null: "ignore" }],

      // Console calls are intentional (Pyodide load progress, isolation guard).
      "no-console": "off",

      // Guard against accidentally leaving debugger statements in.
      "no-debugger": "error",
    },
  },

  // ── runner.js — main thread, full browser environment ─────────────────────
  {
    files: ["scripts/*.cjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["runner.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Available only in cross-origin-isolated contexts (COOP+COEP enforced).
        SharedArrayBuffer: "readonly",
        Atomics: "readonly",
      },
    },
  },

  // ── pyodide-worker.js — Classic Web Worker ────────────────────────────────
  {
    files: ["pyodide-worker.js"],
    languageOptions: {
      globals: {
        ...globals.worker,
        // Exposed by Pyodide after importScripts loads it.
        loadPyodide: "readonly",
      },
    },
  },

  // ── sw.js — Service Worker ────────────────────────────────────────────────
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        // Worker base (self, postMessage, addEventListener, …)
        ...globals.worker,
        // Service-Worker-specific globals not in globals.worker
        caches: "readonly",
        clients: "readonly",
        registration: "readonly",
      },
    },
  },
];
