(function () {
  "use strict";
  const sections = document.querySelectorAll(".section[id]");
  const sidebar = document.getElementById("sidebarNav");
  const links = [];

  sections.forEach((sec) => {
    const num = sec.id.replace("s", "");
    const a = document.createElement("a");
    a.href = "#" + sec.id;
    a.textContent = num.padStart(2, "0");
    a.dataset.section = sec.id;
    sidebar.appendChild(a);
    links.push(a);
  });

  const mobileNavBtn = document.createElement("button");
  mobileNavBtn.className = "mobile-nav-btn";
  mobileNavBtn.setAttribute("aria-label", "Open chapter navigation");
  mobileNavBtn.textContent = "☰";
  document.body.appendChild(mobileNavBtn);

  const mobileNavPanel = document.createElement("nav");
  mobileNavPanel.className = "mobile-nav-panel";
  sections.forEach((sec) => {
    const num = sec.id.replace("s", "");
    const secH2 = sec.querySelector("h2");
    const label = secH2 ? num + ". " + secH2.textContent.trim() : num;
    const a = document.createElement("a");
    a.href = "#" + sec.id;
    a.textContent = label;
    a.addEventListener("click", () => {
      mobileNavPanel.classList.remove("open");
      mobileNavBtn.textContent = "☰";
    });
    mobileNavPanel.appendChild(a);
  });
  document.body.appendChild(mobileNavPanel);

  mobileNavBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = mobileNavPanel.classList.toggle("open");
    mobileNavBtn.textContent = isOpen ? "✕" : "☰";
  });
  document.addEventListener("click", (e) => {
    if (!mobileNavPanel.contains(e.target) && e.target !== mobileNavBtn) {
      mobileNavPanel.classList.remove("open");
      mobileNavBtn.textContent = "☰";
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const link = sidebar.querySelector(`a[data-section="${e.target.id}"]`);
        if (link) link.classList.toggle("active", e.isIntersecting);
      });
    },
    { rootMargin: "-10% 0px -80% 0px" },
  );

  sections.forEach((s) => observer.observe(s));
  window._sectionObserver = observer;

  const heartObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          heart.classList.add("drawn");
        }
      });
    },
    { threshold: 0.4 },
  );
  heartObserver.observe(heart);

  const topBtn = document.getElementById("backToTop");
  window.addEventListener(
    "scroll",
    () => {
      topBtn.classList.toggle("visible", window.scrollY > 500);
    },
    { passive: true },
  );
  topBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );

  const themeBtn = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme");
  const VALID_THEMES = new Set(["light", "dark", ""]);
  if (saved !== null && VALID_THEMES.has(saved)) {
    document.documentElement.dataset.theme = saved;
  }
  themeBtn.setAttribute(
    "aria-pressed",
    document.documentElement.dataset.theme !== "light" ? "true" : "false",
  );

  // Listen for clicks
  themeBtn.addEventListener("click", () => {
    const isLight = document.documentElement.dataset.theme === "light";

    // Toggle the HTML attribute
    document.documentElement.dataset.theme = isLight ? "" : "light";
    themeBtn.setAttribute("aria-pressed", isLight ? "true" : "false");
    // Save to local storage
    localStorage.setItem("theme", isLight ? "" : "light");
  });

  // ── Collapsible scenario cards ──
  document.querySelectorAll(".scenario-title").forEach((title) => {
    title.addEventListener("click", () => {
      const scenario = title.closest(".scenario");
      scenario.classList.toggle("collapsed");
      title.setAttribute(
        "aria-expanded",
        !scenario.classList.contains("collapsed") ? "true" : "false",
      );
    });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        title.click();
      }
    });
  });

  // ── Collapse/Expand all toggle per section ──
  document.querySelectorAll(".section-header").forEach((header) => {
    const btn = document.createElement("button");
    btn.className = "section-toggle";
    btn.textContent = "collapse all";
    btn.addEventListener("click", () => {
      const section = header.closest(".section");
      const scenarios = section.querySelectorAll(".scenario");
      const allCollapsed = [...scenarios].every((s) =>
        s.classList.contains("collapsed"),
      );
      scenarios.forEach((s) => {
        if (allCollapsed) {
          s.classList.remove("collapsed");
          s.querySelector(".scenario-title")?.setAttribute(
            "aria-expanded",
            "true",
          );
        } else {
          s.classList.add("collapsed");
          s.querySelector(".scenario-title")?.setAttribute(
            "aria-expanded",
            "false",
          );
        }
      });
      btn.textContent = allCollapsed ? "collapse all" : "expand all";
    });
    header.appendChild(btn);
  });

  // ── Copy buttons on code blocks ──
  // ── Wrap all <pre> in .code-wrapper (fixes pinned buttons + scroll) ──
  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.classList.contains("code-wrapper")) return;
    if (pre.parentElement.closest("pre")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "code-wrapper";
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
  });

  // ── Auto-wrap all tables in .table-scroll-wrapper ──
  document.querySelectorAll("table").forEach((table) => {
    if (table.closest(".table-scroll-wrapper")) return;
    if (table.closest('[style*="overflow"]')) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll-wrapper";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.closest("pre")) return;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = pre.textContent.trim();
      navigator.clipboard
        .writeText(text)
        .then(() => {
          btn.textContent = "✓";
          btn.classList.add("copied");
          setTimeout(() => {
            if (document.contains(btn)) {
              btn.textContent = "copy";
              btn.classList.remove("copied");
            }
          }, 1500);
        })
        .catch(() => {
          btn.textContent = "✗ failed";
          setTimeout(() => {
            if (document.contains(btn)) btn.textContent = "copy";
          }, 1500);
        });
    });
    pre.parentElement.appendChild(btn);
  });

  // Overlay show/hide via data-overlay-* attributes (replaces inline onclick)
  let lastFocusedElement = null;
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-overlay-show],[data-overlay-hide]");
    if (!btn) return;
    const toHide = btn.dataset.overlayHide;
    const toShow = btn.dataset.overlayShow;

    if (toShow && !toHide) {
      lastFocusedElement = document.activeElement;
    }

    if (toHide) {
      const el = document.getElementById(toHide);
      if (el) el.style.display = "none";
    }
    if (toShow) {
      const el = document.getElementById(toShow);
      if (el) {
        el.style.display = "flex";
        const focusable = el.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable) focusable.focus();
      }
    }

    if (toHide && !toShow && lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  });
})();
// ═══════════════════════════════════════════════════════════════════
// PYTHON RUNNER — Web Worker + SharedArrayBuffer + Atomics
// ═══════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // Guard: SharedArrayBuffer requires cross-origin isolation (COOP + COEP headers).
  // On first page load the Service Worker hasn't activated yet, so those headers
  // are absent. Bail out here — the SW registration below will reload the page
  // once the SW is active and headers are in effect.
  if (!window.crossOriginIsolated) {
    console.info(
      "[runner] Not cross-origin isolated yet — skipping init. SW will reload the page.",
    );
    return;
  }

  // ── SharedArrayBuffer setup ──────────────────────────────────────
  // stdinSAB: Int32Array[2] → [0]=flag, [1]=byteLength
  // dataSAB:  Uint8Array[65536] → raw UTF-8 bytes of user input
  const stdinSAB = new SharedArrayBuffer(8);
  const dataSAB = new SharedArrayBuffer(65536);
  const stdinView = new Int32Array(stdinSAB);

  // ── Worker init ─────────────────────────────────────────────────
  let _worker = null;
  let _running = false;
  let _currentPre = null;
  let _currentBtn = null;
  let _inputPanel = null; // active input DOM element

  function getWorker() {
    if (_worker) return _worker;
    _worker = new Worker("./pyodide-worker.js");
    _worker.addEventListener("message", handleWorkerMessage);
    _worker.addEventListener("error", (e) => {
      toastHide();
      if (_currentBtn) {
        _currentBtn.textContent = "▶ run";
        _currentBtn.classList.remove("loading");
      }
      if (_currentPre)
        showOutput(_currentPre, "err", esc("Worker error: " + e.message));
      _running = false;
      removeInputPanel();
    });
    _worker.postMessage({ type: "init", stdinSAB, dataSAB });
    return _worker;
  }

  // ── Accumulated output buffer (for interleaved stdout/input) ────
  let _stdoutHtml = "";

  // ── Worker message handler ───────────────────────────────────────
  function handleWorkerMessage(event) {
    const { type } = event.data;

    if (type === "ready") {
      toastHide();
      return;
    }

    if (type === "stdout") {
      // Append to live output panel if open, else buffer
      _stdoutHtml += esc(event.data.text);
      updateLiveOutput();
      return;
    }

    if (type === "stderr") {
      _stdoutHtml += `<span class="py-err-inline">${esc(event.data.text)}</span>`;
      updateLiveOutput();
      return;
    }

    if (type === "need_input") {
      showInputPrompt();
      return;
    }

    if (type === "toast") {
      toastShow(event.data.message);
      return;
    }

    if (type === "done") {
      finishRun(event.data.images || []);
      return;
    }

    if (type === "error") {
      toastHide();
      removeInputPanel();
      if (_currentBtn) {
        _currentBtn.textContent = "▶ run";
        _currentBtn.classList.remove("loading");
      }
      if (_currentPre) showOutput(_currentPre, "err", esc(event.data.message));
      _running = false;
      _currentPre = null;
      _currentBtn = null;
      return;
    }
  }

  // ── Live output panel (shown during streaming stdout) ───────────
  let _livePanel = null;

  function ensureLivePanel() {
    if (_livePanel && document.contains(_livePanel)) return;
    if (!_currentPre) return;
    clearBelow(_currentPre);
    _currentPre.parentElement.classList.add("py-open");
    _livePanel = document.createElement("div");
    _livePanel.className = "py-output";
    _livePanel.setAttribute("role", "status");
    _livePanel.setAttribute("aria-live", "polite");
    _livePanel.innerHTML = `
      <div class="py-output-bar">
        <div class="py-output-label">
          <span class="py-dot"></span>
          <span>output</span>
        </div>
        <button class="py-output-close" title="Close">✕</button>
      </div>
      <div class="py-output-body" id="_live_body"></div>
    `;
    _livePanel
      .querySelector(".py-output-close")
      .addEventListener("click", () => {
        _livePanel.remove();
        _livePanel = null;
        if (_currentPre) _currentPre.parentElement.classList.remove("py-open");
      });
    _currentPre.parentElement.insertAdjacentElement("afterend", _livePanel);
  }

  function updateLiveOutput() {
    ensureLivePanel();
    if (!_livePanel) return;
    const body = _livePanel.querySelector("#_live_body");
    if (body) body.innerHTML = _stdoutHtml;
  }

  // ── Input prompt (injected below live output during need_input) ──
  function showInputPrompt() {
    if (!_currentPre) return;
    ensureLivePanel();
    removeInputPanel(); // remove any previous

    const container = document.createElement("div");
    container.className = "py-form";
    container.style.marginTop = "0";
    container.innerHTML = `
      <div class="py-form-body" style="padding: 8px 12px;">
        <input type="text" id="_py_input_field" class="py-input-field"
               placeholder="type your answer and press Enter…"
               aria-label="Python input()" autocomplete="off" />
      </div>
    `;
    const field = container.querySelector("#_py_input_field");
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitInput(field.value);
    });
    // Insert after the live panel
    (_livePanel || _currentPre.parentElement).insertAdjacentElement(
      "afterend",
      container,
    );
    _inputPanel = container;
    field.focus();
  }

  function submitInput(value) {
    removeInputPanel();
    const bytes = new TextEncoder().encode(value + "\n");
    const view = new Uint8Array(dataSAB);
    view.set(bytes.slice(0, Math.min(bytes.length, 65535)));
    Atomics.store(stdinView, 1, Math.min(bytes.length, 65535));
    Atomics.store(stdinView, 0, 2);
    Atomics.notify(stdinView, 0, 1);
    // Echo the input into the live output
    _stdoutHtml += esc(value + "\n");
    updateLiveOutput();
  }

  function removeInputPanel() {
    if (_inputPanel && document.contains(_inputPanel)) _inputPanel.remove();
    _inputPanel = null;
  }

  function interruptRun() {
    if (_worker) _worker.postMessage({ type: "interrupt" });
  }

  // ── Finish run ──────────────────────────────────────────────────
  function finishRun(images) {
    toastHide();
    removeInputPanel();
    _running = false;

    let html = _stdoutHtml;

    // Matplotlib images
    for (const b64 of images) {
      html += `<img src="data:image/png;base64,${b64}" alt="matplotlib plot" />`;
    }

    if (!html.trim()) {
      html =
        '<span style="color:var(--muted);font-style:italic">✓ ran — no output</span>';
    }

    if (_currentPre) {
      // Determine output kind from html content
      const isErr = html.includes("py-err-inline");
      if (_livePanel && document.contains(_livePanel)) {
        const body = _livePanel.querySelector("#_live_body");
        if (body) body.innerHTML = html;
        const dot = _livePanel.querySelector(".py-dot");
        if (dot && isErr) dot.classList.add("err");
        const label = _livePanel.querySelector(
          ".py-output-label span:last-child",
        );
        if (label && isErr) label.textContent = "error";
      } else {
        showOutput(_currentPre, isErr ? "err" : "ok", html);
      }
    }

    if (_currentBtn) {
      _currentBtn.textContent = "▶ run";
      _currentBtn.classList.remove("loading");
      _currentBtn.classList.add("active");
    }

    _livePanel = null;
    _currentPre = null;
    _currentBtn = null;
  }

  // ── Toast helper ─────────────────────────────────────────────────
  const toast = document.createElement("div");
  toast.id = "py-toast";
  toast.innerHTML =
    '<div class="py-spinner"></div><span id="py-toast-msg"></span>';
  document.body.appendChild(toast);

  function toastShow(msg) {
    document.getElementById("py-toast-msg").textContent = msg;
    toast.classList.add("on");
  }
  function toastHide() {
    toast.classList.remove("on");
  }

  // ── Code text extraction ─────────────────────────────────────────
  function getCode(pre) {
    const clone = pre.cloneNode(true);
    clone.querySelectorAll("button").forEach((b) => b.remove());
    return clone.textContent.trim();
  }

  // ── Pre-processing ───────────────────────────────────────────────
  function preprocessCode(code) {
    return code
      .split("\n")
      .map((line) => {
        if (/^[\u2500-\u257f\u2014\u2013\u2010─\-]{2}/.test(line.trim()))
          return "# " + line;
        return line;
      })
      .join("\n");
  }

  function addContext(code) {
    const has = (name) =>
      new RegExp(`\\b${name}\\b`).test(code) &&
      !new RegExp(`\\b${name}\\s*=`).test(code);

    const defs = [];

    if (has("lst")) defs.push("lst = [1, 2, 3]");
    if (has("list_a")) defs.push("list_a = [1, 2, 3]");
    if (has("list_b")) defs.push("list_b = [7, 8, 9]");
    if (has("record")) defs.push("record = ['Alice', 'Maastricht', 62]");
    if (has("eeg") && !/\bimport\b/.test(code))
      defs.push("eeg = [[0.5*i*0.1 for i in range(10)] for _ in range(8)]");

    const needsSine =
      has("channel_a") ||
      has("channel_b") ||
      (has("channel_1") && !/channel_1\s*=/.test(code)) ||
      (has("channel_2") && !/channel_2\s*=/.test(code));
    if (needsSine) defs.push("import math as _m");
    if (has("channel_a"))
      defs.push("channel_a = [_m.sin(i*0.12)*2+i*0.005 for i in range(50)]");
    if (has("channel_b"))
      defs.push("channel_b = [_m.cos(i*0.12)*1.6-i*0.003 for i in range(50)]");
    if (has("channel_1") && !/channel_1\s*=/.test(code))
      defs.push("channel_1 = [_m.sin(i*0.09)*2 for i in range(50)]");
    if (has("channel_2") && !/channel_2\s*=/.test(code))
      defs.push("channel_2 = [_m.cos(i*0.09)*1.5 for i in range(50)]");
    if (has("samples") && !/samples\s*=/.test(code))
      defs.push("samples = list(range(50))");
    if (has("numbers") && !/numbers\s*=/.test(code))
      defs.push("numbers = [4.0, 7.5, 2.1, 9.3, 1.2, 5.6, 8.8, 3.3, 6.7, 0.9]");

    // pandas df context
    const needsPd = /\bpd\./.test(code) && !/import\s+pandas/.test(code);
    const needsDf = has("df");
    const needsS = has("s") && /pd\.Series/.test(code);
    if (needsPd || needsDf || needsS) {
      if (!/import\s+pandas/.test(code)) defs.push("import pandas as pd");
      if (needsDf)
        defs.push(
          "df = pd.DataFrame({'name':['Alice','Bob','Carol','Dave'],'age':[21,25,19,22],'grade':[8.5,7.0,9.2,6.1]})",
        );
    }

    // scipy standalone context
    if (/pearsonr/.test(code) && !has("channel_a") && !/eeg\[/.test(code)) {
      defs.push("import math as _m");
      defs.push("channel_a = [_m.sin(i*0.15) for i in range(30)]");
      defs.push("channel_b = [_m.cos(i*0.15)+0.1 for i in range(30)]");
    }

    // Expand [...] placeholders
    code = code.replace(/\[([0-9\-., ]+),\s*\.\.\.\s*\]/g, (_, vals) => {
      const arr = vals
        .split(",")
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v));
      while (arr.length < 30)
        arr.push(...arr.slice(0, Math.min(arr.length, 30 - arr.length)));
      return "[" + arr.slice(0, 30).join(", ") + "]";
    });

    return defs.length ? defs.join("\n") + "\n" + code : code;
  }

  // ── Code type detection ──────────────────────────────────────────
  function detectType(raw) {
    const lines = raw
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (!lines.length) return "empty";
    const first = lines[0].trim();
    if (/^python[\s3]|^pip[\s3]/.test(first)) return "shell";
    if (/\bimport\s+turtle\b/.test(raw)) return "turtle";
    if (/\bsys\.argv\b/.test(raw)) return "argv";
    if (/\binput\s*\(/.test(raw)) return "input_fn";
    if (/matplotlib|plt\./.test(raw)) return "matplotlib";
    if (/from\s+scipy|import\s+scipy/.test(raw)) return "scipy";
    if (/import\s+pandas|\bpd\./.test(raw)) return "pandas";
    if (/open\s*\(\s*['"][^'"]+\.(txt|csv)['"]/.test(raw)) return "fileio";
    return "simple";
  }

  // ── DOM panel helpers ────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clearBelow(pre) {
    const wrapper = pre.parentElement;
    let next = wrapper.nextElementSibling;
    while (
      next &&
      (next.classList.contains("py-output") ||
        next.classList.contains("py-form"))
    ) {
      const toRemove = next;
      next = next.nextElementSibling;
      toRemove.remove();
    }
    wrapper.classList.remove("py-open");
  }

  function showOutput(pre, kind, contentHTML) {
    clearBelow(pre);
    pre.parentElement.classList.add("py-open");

    const dotCls =
      kind === "err"
        ? "err"
        : kind === "info"
          ? "info"
          : kind === "warn"
            ? "warn"
            : "";
    const label =
      kind === "err" ? "error" : kind === "info" ? "info" : "output";

    const panel = document.createElement("div");
    panel.className = "py-output";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
          <div class="py-output-bar">
            <div class="py-output-label">
              <span class="py-dot ${dotCls}"></span>
              <span>${label}</span>
            </div>
            <button class="py-output-close" title="Close">✕</button>
          </div>
          <div class="py-output-body ${kind === "err" ? "err" : kind === "info" ? "info" : ""}">${contentHTML}</div>
        `;
    panel.querySelector(".py-output-close").addEventListener("click", () => {
      panel.remove();
      pre.parentElement.classList.remove("py-open");
    });
    pre.parentElement.insertAdjacentElement("afterend", panel);
  }

  function showForm(pre, hint, fieldsHTML, onRun) {
    clearBelow(pre);
    pre.parentElement.classList.add("py-open");

    const form = document.createElement("div");
    form.className = "py-form";
    form.innerHTML = `
          <div class="py-form-bar">
            <span>${hint}</span>
            <button class="py-output-close" title="Cancel">✕</button>
          </div>
          <div class="py-form-body">
            ${fieldsHTML}
            <div class="py-form-actions">
              <button class="py-btn-run" aria-label="Run Python code">▶ run</button>
              <button class="py-btn-cancel">cancel</button>
            </div>
          </div>
        `;
    const close = () => {
      form.remove();
      pre.parentElement.classList.remove("py-open");
    };
    form
      .querySelector(".py-form-body .py-btn-run")
      .addEventListener("click", () => onRun(form));
    form
      .querySelector(".py-form-body .py-btn-cancel")
      .addEventListener("click", close);
    form
      .querySelector(".py-form-bar .py-output-close")
      .addEventListener("click", close);
    pre.parentElement.insertAdjacentElement("afterend", form);
    form.querySelector("input")?.focus();
  }

  // ── Core execution ───────────────────────────────────────────────
  function execCode(pre, btn, code) {
    if (_running) return; // one execution at a time
    _running = true;
    _currentPre = pre;
    _currentBtn = btn;
    _stdoutHtml = "";
    _livePanel = null;

    btn.textContent = "…";
    btn.classList.add("loading");
    btn.classList.remove("active");

    code = preprocessCode(code);
    code = addContext(code);

    const worker = getWorker();
    worker.postMessage({ type: "run", code });
  }

  // ── Per-type handlers ────────────────────────────────────────────
  function handleShell(pre) {
    showOutput(
      pre,
      "info",
      "This is a terminal command — run it in your command line, not the Python interpreter.",
    );
  }

  function handleTurtle(pre) {
    showOutput(
      pre,
      "info",
      "Turtle graphics require a local Python window.\n" +
        "This snippet shows the correct loop-based drawing logic — run it in your Python installation!",
    );
  }

  function handleArgv(pre, btn, code) {
    const matches = [...code.matchAll(/sys\.argv\[(\d+)\]/g)];
    const indices = [...new Set(matches.map((m) => +m[1]))]
      .filter((i) => i > 0)
      .sort((a, b) => a - b);
    if (!indices.length) {
      execCode(pre, btn, code);
      return;
    }

    const hints = {};
    if (/speed/.test(code)) {
      hints[1] = "speed1 e.g. 60";
      hints[2] = "speed2 e.g. 80";
      hints[3] = "distance e.g. 100";
      hints[4] = '"towards" or "pursue"';
    }

    const fields = indices
      .map(
        (i) => `
          <label>sys.argv[${i}]${hints[i] ? "  —  " + hints[i] : ""}</label>
          <input type="text" name="a${i}" aria-label="sys.argv[${i}]" placeholder="${hints[i] || "enter value…"}" />
        `,
      )
      .join("");

    showForm(
      pre,
      "sys.argv — provide command-line arguments",
      fields,
      (form) => {
        let patched = code.replace(/^\s*import\s+sys\s*\n?/gm, "");
        indices.forEach((i) => {
          const v = form.querySelector(`[name="a${i}"]`)?.value ?? "";
          patched = patched.replace(
            new RegExp(`sys\\.argv\\[${i}\\]`, "g"),
            JSON.stringify(v),
          );
        });
        form.remove();
        execCode(pre, btn, patched);
      },
    );
  }

  // ── Main click dispatcher ────────────────────────────────────────
  function handleClick(pre, btn) {
    // Click loading button to cancel current execution
    if (_running && btn === _currentBtn) {
      interruptRun();
      return;
    }
    // Toggle: click again to close output
    if (pre.parentElement.nextElementSibling?.classList.contains("py-output")) {
      clearBelow(pre);
      btn.classList.remove("active");
      return;
    }
    // If form is open, just close it
    if (pre.parentElement.nextElementSibling?.classList.contains("py-form")) {
      clearBelow(pre);
      return;
    }

    const raw = getCode(pre);
    const type = detectType(raw);

    if (type === "empty") return;
    if (type === "shell") {
      handleShell(pre);
      return;
    }
    if (type === "turtle") {
      handleTurtle(pre);
      return;
    }
    if (type === "argv") {
      handleArgv(pre, btn, raw);
      return;
    }
    // input_fn and all other types go through execCode — worker handles input() natively
    execCode(pre, btn, raw);
  }

  // ── Inject run buttons ───────────────────────────────────────────
  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.closest("pre")) return;
    const btn = document.createElement("button");
    btn.className = "run-btn";
    btn.textContent = "▶ run";
    btn.setAttribute("aria-label", "Run Python code");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleClick(pre, btn);
    });
    pre.parentElement.appendChild(btn);
  });

  // ── Warm up worker on load ───────────────────────────────────────
  window.addEventListener("load", () => {
    // Pre-init the worker so Pyodide loads in the background
    setTimeout(() => getWorker(), 1500);
  });
})();

// ── Service Worker registration + cross-origin isolation reload guard ──────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        // If not yet cross-origin isolated, wait for SW to activate then reload once
        if (!window.crossOriginIsolated) {
          if (sessionStorage.getItem("__coi_reloaded")) {
            // Already tried once — SW headers may not be supported in this environment
            console.warn(
              "[runner] crossOriginIsolated unavailable after reload; SharedArrayBuffer may not work.",
            );
            return;
          }
          const doReload = () => {
            sessionStorage.setItem("__coi_reloaded", "1");
            location.reload();
          };
          if (reg.active) {
            // SW already active from a previous page load
            doReload();
          } else {
            // Wait for the newly installed SW to activate
            const sw = reg.installing || reg.waiting;
            if (sw) {
              sw.addEventListener("statechange", (e) => {
                if (e.target.state === "activated") doReload();
              });
            }
          }
        }
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  });
}
