(function () {
  "use strict";
  const sections = document.querySelectorAll(".section[id]");
  const sidebar = document.getElementById("sidebarNav");
  const links = [];
  let savedScrollY = 0;
  let _overlayOpenCount = 0;
  let mobileNavLastFocused = null;

  function getSectionLevel(secId) {
    const n = parseInt(secId.replace("s", ""), 10);
    if (isNaN(n)) return null;
    // Sections 1–13 = beginner, 14–21 = intermediate, 22+ = advanced
    if (n <= 13) return "beginner";
    if (n <= 21) return "intermediate";
    return "advanced";
  }

  sections.forEach((sec) => {
    const num = sec.id.replace("s", "");
    const a = document.createElement("a");
    a.href = "#" + sec.id;
    if (sec.id === "roadmap") {
      const dot = document.createElement("span");
      dot.className = "lens-roadmap-dot";
      dot.setAttribute("aria-hidden", "true");
      a.appendChild(dot);
      const label = document.createElement("span");
      label.className = "sidebar-lens-label";
      label.setAttribute("aria-hidden", "true");
      label.textContent = "Roadmap";
      a.appendChild(label);
    } else {
      const numSpan = document.createElement("span");
      numSpan.textContent = num.padStart(2, "0");
      a.appendChild(numSpan);
      if (sec.id.match(/^s\d+$/)) {
        const label = document.createElement("span");
        label.className = "sidebar-lens-label";
        label.setAttribute("aria-hidden", "true");
        label.textContent = sec.querySelector("h2")?.textContent.trim() || "";
        a.appendChild(label);
      }
    }
    a.setAttribute(
      "aria-label",
      sec.id === "roadmap"
        ? "Roadmap"
        : `${num}. ${sec.querySelector("h2")?.textContent.trim() || "Section"}`
    );
    a.dataset.section = sec.id;
    if (sidebar) sidebar.appendChild(a);
    links.push(a);
  });

  let keyboardNavigation = true;
  function sidebarHasKeyboardFocus() {
    return keyboardNavigation && sidebar?.contains(document.activeElement);
  }
  document.addEventListener(
    "pointerdown",
    () => {
      keyboardNavigation = false;
      sidebar?.classList.remove("is-keyboard-nav");
    },
    true
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Tab") return;
      keyboardNavigation = true;
      if (sidebarHasKeyboardFocus()) sidebar.classList.add("is-keyboard-nav");
    },
    true
  );

  function positionLensLabels() {
    if (!sidebar) return;
    const anchor = links[0];
    if (!anchor) return;
    // Choose by usable gutter, not by the hovered title, so names never jump sides.
    const leftSpace = sidebar.offsetLeft + anchor.offsetLeft - 16;
    const useRight = leftSpace < 180;
    const availableSpace = useRight
      ? window.innerWidth - sidebar.offsetLeft - anchor.offsetLeft - anchor.offsetWidth - 22
      : leftSpace;
    sidebar.classList.toggle("lens-labels-right", useRight);
    sidebar.style.setProperty("--lens-label-width", `${Math.max(0, availableSpace)}px`);
    const visibleLinks = links.filter((link) =>
      link.matches(".is-lens-current, .is-lens-prev, .is-lens-next")
    );
    visibleLinks.forEach((link) => link.style.removeProperty("--lens-label-offset"));
    const current = visibleLinks.find((link) => link.classList.contains("is-lens-current"));
    if (!current) return;
    const center = current.offsetTop + current.offsetHeight / 2;
    const currentHeight = current.querySelector(".sidebar-lens-label").offsetHeight;
    visibleLinks.forEach((link) => {
      if (link === current) return;
      const labelHeight = link.querySelector(".sidebar-lens-label").offsetHeight;
      const distance = link.offsetTop + link.offsetHeight / 2 - center;
      // Wrapped titles need extra space between the current and neighbouring names.
      const offset =
        Math.sign(distance) *
        Math.max(0, (currentHeight + labelHeight) / 2 + 8 - Math.abs(distance));
      link.style.setProperty("--lens-label-offset", `${offset}px`);
    });
  }
  document.fonts?.ready.then(positionLensLabels);

  const roadmapLink = links.find((l) => l.dataset.section === "roadmap");
  let cachedSidebarW = sidebar ? sidebar.offsetWidth : 0;
  window.addEventListener("resize", () => {
    cachedSidebarW = sidebar ? sidebar.offsetWidth : 0;
    positionLensLabels();
  });

  // ── Lens hover ──
  if (sidebar)
    sidebar.addEventListener("mouseleave", () => {
      if (sidebarHasKeyboardFocus()) return;
      links.forEach((l) => {
        l.classList.remove("is-lens-current", "is-lens-prev", "is-lens-next");
      });
      if (roadmapLink) {
        const dot = roadmapLink.querySelector(".lens-roadmap-dot");
        if (dot)
          dot.classList.remove("lens-dot-beginner", "lens-dot-intermediate", "lens-dot-advanced");
      }
    });
  links.forEach((link, i) => {
    link.addEventListener("mouseenter", () => {
      links.forEach((l) => {
        l.classList.remove("is-lens-current", "is-lens-prev", "is-lens-next");
      });
      link.classList.add("is-lens-current");
      if (i > 0) links[i - 1].classList.add("is-lens-prev");
      if (i < links.length - 1) links[i + 1].classList.add("is-lens-next");
      positionLensLabels();

      if (roadmapLink) {
        const dot = roadmapLink.querySelector(".lens-roadmap-dot");
        if (dot) {
          dot.classList.remove("lens-dot-beginner", "lens-dot-intermediate", "lens-dot-advanced");
          const level = getSectionLevel(link.dataset.section);
          if (level) dot.classList.add("lens-dot-" + level);
        }
      }
    });
  });
  // ── Keyboard lens (focusin mirrors mouseenter, focusout mirrors mouseleave) ──
  links.forEach((link, i) => {
    link.addEventListener("focusin", () => {
      sidebar?.classList.add("is-nav-open");
      sidebar?.classList.toggle("is-keyboard-nav", keyboardNavigation);
      links.forEach((l) => {
        l.classList.remove("is-lens-current", "is-lens-prev", "is-lens-next");
      });
      link.classList.add("is-lens-current");
      if (i > 0) links[i - 1].classList.add("is-lens-prev");
      if (i < links.length - 1) links[i + 1].classList.add("is-lens-next");
      positionLensLabels();

      if (roadmapLink) {
        const dot = roadmapLink.querySelector(".lens-roadmap-dot");
        if (dot) {
          dot.classList.remove("lens-dot-beginner", "lens-dot-intermediate", "lens-dot-advanced");
          const level = getSectionLevel(link.dataset.section);
          if (level) dot.classList.add("lens-dot-" + level);
        }
      }
    });
  });
  if (sidebar)
    sidebar.addEventListener("focusout", () => {
      requestAnimationFrame(() => {
        if (sidebar.contains(document.activeElement)) return;
        sidebar.classList.remove("is-nav-open", "is-keyboard-nav");
        links.forEach((l) => {
          l.classList.remove("is-lens-current", "is-lens-prev", "is-lens-next");
        });
        if (roadmapLink) {
          const dot = roadmapLink.querySelector(".lens-roadmap-dot");
          if (dot)
            dot.classList.remove("lens-dot-beginner", "lens-dot-intermediate", "lens-dot-advanced");
        }
      });
    });

  // ── Sidebar reveal ──
  let _rafId = 0;
  document.addEventListener(
    "mousemove",
    (e) => {
      cancelAnimationFrame(_rafId);
      _rafId = requestAnimationFrame(() => {
        const sidebarLeft = Math.max(0, window.innerWidth / 2 - 530);
        const sidebarRight = sidebarLeft + cachedSidebarW + 16;
        const nearEdge = e.clientX >= sidebarLeft && e.clientX <= sidebarRight;
        if (!sidebar || sidebarHasKeyboardFocus()) return;
        if (nearEdge && sidebar.classList.contains("is-nav-open")) return;
        if (!nearEdge && !sidebar.classList.contains("is-nav-open")) return;
        sidebar.classList.toggle("is-nav-open", nearEdge);
      });
    },
    { passive: true }
  );
  document.addEventListener("mouseleave", () => {
    if (!sidebarHasKeyboardFocus()) sidebar?.classList.remove("is-nav-open");
  });

  const mobileNavBtn = document.createElement("button");
  mobileNavBtn.className = "mobile-nav-btn";
  mobileNavBtn.setAttribute("aria-label", "Open chapter navigation");
  mobileNavBtn.setAttribute("aria-expanded", "false");
  mobileNavBtn.textContent = "☰";
  document.body.appendChild(mobileNavBtn);

  const mobileNavPanel = document.createElement("nav");
  mobileNavPanel.className = "mobile-nav-panel";
  mobileNavPanel.setAttribute("role", "navigation");
  mobileNavPanel.setAttribute("aria-label", "Section navigation");
  sections.forEach((sec) => {
    const num = sec.id.replace("s", "");
    const secH2 = sec.querySelector("h2");
    const label = secH2 ? num + ". " + secH2.textContent.trim() : num;
    const a = document.createElement("a");
    a.href = "#" + sec.id;
    a.textContent = label;
    a.addEventListener("click", () => {
      closeMobileNav();
    });
    mobileNavPanel.appendChild(a);
  });
  document.body.appendChild(mobileNavPanel);

  function closeMobileNav() {
    const wasOpen = mobileNavPanel.classList.contains("open");
    mobileNavPanel.classList.remove("open");
    mobileNavBtn.textContent = "☰";
    mobileNavBtn.setAttribute("aria-expanded", "false");
    mobileNavBtn.setAttribute("aria-label", "Open chapter navigation");
    if (wasOpen && mobileNavLastFocused instanceof HTMLElement) {
      mobileNavLastFocused.focus();
      mobileNavLastFocused = null;
    }
  }

  mobileNavBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = mobileNavPanel.classList.toggle("open");
    mobileNavBtn.textContent = isOpen ? "✕" : "☰";
    mobileNavBtn.setAttribute("aria-expanded", String(isOpen));
    mobileNavBtn.setAttribute(
      "aria-label",
      isOpen ? "Close chapter navigation" : "Open chapter navigation"
    );
    if (isOpen) {
      mobileNavLastFocused = document.activeElement;
      const firstLink = mobileNavPanel.querySelector("a");
      if (firstLink) firstLink.focus();
    } else {
      mobileNavLastFocused = null;
    }
  });
  document.addEventListener("click", (e) => {
    if (!mobileNavPanel.contains(e.target) && e.target !== mobileNavBtn) {
      closeMobileNav();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!mobileNavPanel.classList.contains("open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeMobileNav();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [mobileNavBtn].concat(Array.from(mobileNavPanel.querySelectorAll("a")));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const isInsidePanel = active === mobileNavBtn || mobileNavPanel.contains(active);
    if (!isInsidePanel) {
      e.preventDefault();
      first.focus();
      return;
    }
    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  });

  const linkMap = new Map(links.map((l) => [l.dataset.section, l]));

  const observer = new IntersectionObserver(
    (entries) => {
      requestAnimationFrame(() => {
        entries.forEach((e) => {
          const link = linkMap.get(e.target.id);
          if (link) {
            link.classList.toggle("active", e.isIntersecting);
            if (e.isIntersecting) {
              link.setAttribute("aria-current", "location");
            } else {
              link.removeAttribute("aria-current");
            }
          }
        });
      });
    },
    { rootMargin: "-10% 0px -80% 0px" }
  );

  sections.forEach((s) => {
    observer.observe(s);
  });
  window._sectionObserver = observer;

  const heartEl = document.getElementById("heart");
  if (heartEl) {
    const heartObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          heartEl.classList.add("drawn");
          heartObserver.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    heartObserver.observe(heartEl);
  }

  const topBtn = document.getElementById("backToTop");
  let _scrollRafId = 0;
  let _topBtnVisible = false;
  let _floatingBtnVisible = false;
  window.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(_scrollRafId);
      _scrollRafId = requestAnimationFrame(() => {
        const shouldShow = window.scrollY > 500;
        if (topBtn && shouldShow !== _topBtnVisible) {
          _topBtnVisible = shouldShow;
          topBtn.classList.toggle("visible", shouldShow);
        }
        if (floatingThemeBtn && shouldShow !== _floatingBtnVisible) {
          _floatingBtnVisible = shouldShow;
          floatingThemeBtn.classList.toggle("visible", shouldShow);
        }
        const lastSec = sections[sections.length - 1];
        if (lastSec && sidebar) {
          const navH = sidebar.offsetHeight;
          const center = lastSec.getBoundingClientRect().bottom - navH / 2;
          if (center < window.innerHeight / 2) {
            sidebar.style.setProperty("--nav-center-y", center + "px");
          } else {
            sidebar.style.removeProperty("--nav-center-y");
          }
        }
      });
    },
    { passive: true }
  );
  if (topBtn)
    topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const themeBtn = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme");
  const VALID_THEMES = new Set(["light", "dark", ""]);
  if (saved !== null && VALID_THEMES.has(saved)) {
    document.documentElement.dataset.theme = saved;
  }
  if (themeBtn)
    themeBtn.setAttribute(
      "aria-pressed",
      document.documentElement.dataset.theme !== "light" ? "true" : "false"
    );
  const floatingThemeBtn = document.getElementById("floatingThemeToggle");
  if (floatingThemeBtn)
    floatingThemeBtn.setAttribute(
      "aria-pressed",
      document.documentElement.dataset.theme !== "light" ? "true" : "false"
    );

  if (themeBtn)
    themeBtn.addEventListener("click", () => {
      const isLight = document.documentElement.dataset.theme === "light";
      document.documentElement.dataset.theme = isLight ? "" : "light";
      themeBtn.setAttribute("aria-pressed", isLight ? "true" : "false");
      if (floatingThemeBtn)
        floatingThemeBtn.setAttribute("aria-pressed", isLight ? "true" : "false");
      localStorage.setItem("theme", isLight ? "" : "light");
    });

  if (floatingThemeBtn)
    floatingThemeBtn.addEventListener("click", () => {
      const isLight = document.documentElement.dataset.theme === "light";
      document.documentElement.dataset.theme = isLight ? "" : "light";
      floatingThemeBtn.setAttribute("aria-pressed", isLight ? "true" : "false");
      if (themeBtn) themeBtn.setAttribute("aria-pressed", isLight ? "true" : "false");
      localStorage.setItem("theme", isLight ? "" : "light");
    });

  // Collapsible scenario cards
  document.querySelectorAll(".scenario-title").forEach((title) => {
    title.addEventListener("click", () => {
      const scenario = title.closest(".scenario");
      scenario.classList.toggle("collapsed");
      title.setAttribute(
        "aria-expanded",
        !scenario.classList.contains("collapsed") ? "true" : "false"
      );
    });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        title.click();
      }
    });
  });

  // Copy buttons on code blocks
  // Wrap all <pre> in .code-wrapper (fixes pinned buttons + scroll)
  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.classList.contains("code-wrapper")) return;
    if (pre.parentElement.closest("pre")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "code-wrapper";
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
  });

  // Auto-wrap all tables in .table-scroll-wrapper
  document.querySelectorAll("table").forEach((table) => {
    if (table.closest(".table-scroll-wrapper")) return;
    if (table.closest("[style*='overflow']")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll-wrapper";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.closest("pre")) return;
    const srStatus = document.getElementById("_sr_status");
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
          if (srStatus) srStatus.textContent = "Code copied to clipboard";
          setTimeout(() => {
            if (document.contains(btn)) {
              btn.textContent = "copy";
              btn.classList.remove("copied");
              if (srStatus) srStatus.textContent = "";
            }
          }, 1500);
        })
        .catch(() => {
          btn.textContent = "✗ failed";
          if (srStatus) srStatus.textContent = "Copy failed";
          setTimeout(() => {
            if (document.contains(btn)) btn.textContent = "copy";
            if (srStatus) srStatus.textContent = "";
          }, 1500);
        });
    });
    pre.parentElement.appendChild(btn);
  });

  // Overlay show/hide via data-overlay-* attributes
  let lastFocusedElement = null;
  const overlayIds = Array.from(
    new Set(
      Array.from(document.querySelectorAll("[data-overlay-show],[data-overlay-hide]")).flatMap(
        (el) => [el.dataset.overlayShow, el.dataset.overlayHide]
      )
    )
  ).filter(Boolean);

  function getActiveOverlayElement() {
    for (let i = overlayIds.length - 1; i >= 0; i -= 1) {
      const el = document.getElementById(overlayIds[i]);
      if (el && getComputedStyle(el).display !== "none") return el;
    }
    return null;
  }

  function getOverlayFocusableElements(overlay) {
    return Array.from(
      overlay.querySelectorAll("button, [href], input, select, textarea, [tabindex]")
    ).filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.matches(":disabled") &&
        !el.closest("[hidden], [inert], .collapsed .scenario-body") &&
        getComputedStyle(el).visibility !== "hidden" &&
        el.getClientRects().length > 0
    );
  }

  const modalBackground = new Map();
  function syncModalBackground() {
    for (const [el, wasInert] of modalBackground) el.inert = wasInert;
    modalBackground.clear();
    const active = getActiveOverlayElement();
    for (const status of document.querySelectorAll(".py-runtime-status, .py-execution-status")) {
      (active || document.body).appendChild(status);
      status.inert = false;
    }
    if (!active) return;
    let child = active;
    while (child.parentElement) {
      for (const sibling of child.parentElement.children) {
        if (sibling === child) continue;
        modalBackground.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      child = child.parentElement;
      if (child === document.body) break;
    }
  }

  document.addEventListener("keydown", function (e) {
    if (_overlayOpenCount <= 0) return;
    const activeOverlay = getActiveOverlayElement();
    if (!activeOverlay) return;
    if (e.key === "Tab") {
      const focusable = getOverlayFocusableElements(activeOverlay);
      if (!focusable.length) {
        e.preventDefault();
        activeOverlay.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isInsideOverlay = activeOverlay.contains(document.activeElement);
      if (e.shiftKey) {
        if (!isInsideOverlay || document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!isInsideOverlay || document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key !== "Escape") return;
    e.preventDefault();
    const hideBtn = activeOverlay.querySelector(
      `[data-overlay-hide="${activeOverlay.id}"]:not([data-overlay-show])`
    );
    if (hideBtn) hideBtn.click();
  });

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-overlay-show],[data-overlay-hide]");
    if (!btn) return;
    const toHide = btn.dataset.overlayHide;
    const toShow = btn.dataset.overlayShow;

    if (toShow && !toHide) {
      lastFocusedElement = btn;
    }

    if (toShow) {
      const el = document.getElementById(toShow);
      if (el) {
        _overlayOpenCount += 1;
        if (_overlayOpenCount === 1) {
          savedScrollY = window.scrollY;
          document.body.style.top = `-${savedScrollY}px`;
          document.body.style.position = "fixed";
          document.body.style.width = "100%";
        }
        el.style.display = "flex";
      }
    }

    if (toHide) {
      const el = document.getElementById(toHide);
      if (el) {
        el.style.display = "none";
        if (_overlayOpenCount > 0) _overlayOpenCount -= 1;
        if (_overlayOpenCount === 0) {
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.width = "";
          window.scrollTo(0, savedScrollY);
        }
      }
    }

    syncModalBackground();
    if (toShow) {
      const el = document.getElementById(toShow);
      if (el) (getOverlayFocusableElements(el)[0] || el).focus();
    }
    if (toHide && !toShow && lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  });
})();

const DEBUG = location.hostname === "localhost";

// PYTHON RUNNER — Web Worker + SharedArrayBuffer + Atomics
(function () {
  "use strict";

  const PROTOCOL_VERSION = 2;
  const STARTUP_TIMEOUT_MS = 30_000;
  const CANCEL_TIMEOUT_MS = 1500;
  const runtimeStatus = document.createElement("div");
  runtimeStatus.className = "py-runtime-status";
  runtimeStatus.hidden = true;
  const runtimeMessage = document.createElement("span");
  runtimeMessage.setAttribute("role", "status");
  runtimeMessage.setAttribute("aria-live", "polite");
  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.textContent = "Retry Python";
  retryButton.hidden = true;
  runtimeStatus.append(runtimeMessage, retryButton);
  document.body.appendChild(runtimeStatus);

  function showRuntimeStatus(message, retry = false) {
    const activeDialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(
      (el) => getComputedStyle(el).display !== "none"
    );
    (activeDialog || document.body).appendChild(runtimeStatus);
    runtimeStatus.inert = false;
    runtimeStatus.hidden = !message;
    runtimeMessage.textContent = message;
    retryButton.hidden = !retry;
  }

  if (!window.crossOriginIsolated) {
    showRuntimeStatus(
      "Python needs a secure, cross-origin isolated page. Reload to try again; you can still read and copy the examples.",
      true
    );
    retryButton.textContent = "Reload page";
    retryButton.addEventListener("click", () => location.reload());
  }

  let stdinView = null;
  let dataView = null;
  let interruptView = null;
  let cancelView = null;

  let _worker = null;
  let _pendingRun = null;
  let _runtimeState = "idle";
  let _startupTimer = null;
  let _cancelTimer = null;
  let _running = false;
  let _runId = 0;
  let _currentPre = null;
  let _currentBtn = null;
  let _inputPanel = null; // active input DOM element

  function setRunButtonsEnabled(enabled) {
    document.querySelectorAll(".run-btn:not(.local-run-btn)").forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  function getWorker() {
    if (!window.crossOriginIsolated) return null;
    if (_worker) return _worker;
    _runtimeState = "loading";
    setRunButtonsEnabled(false);
    showRuntimeStatus("Loading Python…");
    try {
      // Each generation owns its buffers: late writes cannot affect a replacement worker.
      stdinView = new Int32Array(new SharedArrayBuffer(8));
      dataView = new Uint8Array(new SharedArrayBuffer(65536));
      interruptView = new Uint8Array(new SharedArrayBuffer(1));
      cancelView = new Int32Array(new SharedArrayBuffer(4));
      const worker = new Worker("./pyodide-worker.js?v=19");
      _worker = worker;
      worker.addEventListener("message", (event) => {
        if (_worker === worker) handleWorkerMessage(event);
      });
      worker.addEventListener("error", (event) => {
        if (_worker === worker) failWorker("Python stopped unexpectedly. " + event.message);
      });
      worker.addEventListener("messageerror", () => {
        if (_worker === worker) failWorker("Python could not read a response. Please retry.");
      });
      _startupTimer = setTimeout(() => {
        if (_worker === worker && _runtimeState === "loading") {
          failWorker("Python took too long to load. Check your connection and retry.");
        }
      }, STARTUP_TIMEOUT_MS);
      worker.postMessage({
        type: "init",
        protocolVersion: PROTOCOL_VERSION,
        stdinSAB: stdinView.buffer,
        dataSAB: dataView.buffer,
        interruptSAB: interruptView.buffer,
        cancelSAB: cancelView.buffer,
      });
    } catch (err) {
      failWorker("Python could not start. " + err.message);
    }
    return _worker;
  }

  function failWorker(message) {
    _pendingRun = null;
    clearTimeout(_startupTimer);
    clearTimeout(_cancelTimer);
    const worker = _worker;
    _worker = null;
    worker?.terminate();
    _runtimeState = "failed";
    if (_running) {
      _stdoutParts.push({ kind: "stderr", text: message.slice(0, 4000) + "\n" });
      finishRun([]);
    }
    setRunButtonsEnabled(false);
    showRuntimeStatus(message, true);
  }

  if (window.crossOriginIsolated) retryButton.addEventListener("click", () => getWorker());

  const OUTPUT_LIMIT = 100_000;
  const PART_LIMIT = 1000;
  let _stdoutParts = [];
  let outputLength = 0;
  let outputTruncated = false;
  let outputFrame = null;
  const renderedParts = new WeakMap();
  const executionStatus = document.createElement("div");
  executionStatus.className = "sr-only py-execution-status";
  executionStatus.setAttribute("role", "status");
  executionStatus.setAttribute("aria-live", "polite");
  document.body.appendChild(executionStatus);
  const resetButton = document.createElement("button");
  resetButton.id = "floatingPythonReset";
  resetButton.className = "floating-python-reset";
  resetButton.type = "button";
  resetButton.disabled = !window.crossOriginIsolated;
  resetButton.title = "Reset Python — stops code and clears temporary files";
  resetButton.setAttribute("aria-label", "Reset Python");
  resetButton.setAttribute("aria-describedby", "python-reset-help");
  const resetIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  resetIcon.setAttribute("viewBox", "0 0 24 24");
  resetIcon.setAttribute("fill", "none");
  resetIcon.setAttribute("stroke", "currentColor");
  resetIcon.setAttribute("stroke-width", "1.5");
  resetIcon.setAttribute("aria-hidden", "true");
  resetIcon.innerHTML =
    '<title>Reset Python</title><path stroke-linecap="round" stroke-linejoin="round" d="M3 12a9 9 0 0 1 15.36-6.36L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.36 6.36L3 16M8 16H3v5" />';
  resetButton.appendChild(resetIcon);
  const resetHelp = document.createElement("span");
  resetHelp.id = "python-reset-help";
  resetHelp.className = "sr-only";
  resetHelp.textContent = "Stops running code and clears temporary files.";
  document.body.append(resetButton, resetHelp);
  function updateResetVisibility() {
    const visible = window.crossOriginIsolated && window.scrollY > 500;
    resetButton.classList.toggle("visible", visible);
    resetButton.tabIndex = visible ? 0 : -1;
  }
  window.addEventListener("scroll", updateResetVisibility, { passive: true });
  updateResetVisibility();

  resetButton.addEventListener("click", () => {
    resetButton.disabled = true;
    failWorker("Python was reset; temporary files were cleared.");
    document.querySelectorAll(".py-form").forEach((form) => form.remove());
    getWorker();
    executionStatus.textContent = "Resetting Python. Temporary files were cleared.";
  });

  function addOutput(kind, value) {
    const text = String(value || "");
    if (!text || outputTruncated) return;
    const remaining = _stdoutParts.length < PART_LIMIT ? OUTPUT_LIMIT - outputLength : 0;
    if (remaining > 0) {
      const kept = text.slice(0, remaining);
      _stdoutParts.push({ kind, text: kept });
      outputLength += kept.length;
    }
    if (text.length > remaining) markOutputTruncated();
    updateLiveOutput();
  }
  function markOutputTruncated() {
    if (outputTruncated) return;
    outputTruncated = true;
    _stdoutParts.push({
      kind: "notice",
      text: "\nOutput truncated. Reduce printed output or stop the code.\n",
    });
    executionStatus.textContent = "Output truncated. Code can still be stopped.";
    updateLiveOutput();
  }

  // Worker message handler
  const MSG = {
    ready: (data) => {
      if (data.protocolVersion !== PROTOCOL_VERSION) {
        failWorker("Python files are from different releases. Reload the page and retry.");
        return;
      }
      clearTimeout(_startupTimer);
      _runtimeState = "ready";
      toastHide();
      showRuntimeStatus("");
      setRunButtonsEnabled(true);
      resetButton.disabled = false;
      const pending = _pendingRun;
      _pendingRun = null;
      if (pending) execCode(...pending);
    },
    init_error: (data) => failWorker(data.message),
    stdout: ({ text }) => {
      addOutput("stdout", text);
    },
    stderr: ({ text }) => {
      addOutput("stderr", text);
    },
    output_truncated: () => markOutputTruncated(),
    need_input: () => showInputPrompt(),
    toast: ({ message }) => toastShow(message),
    done: ({ images, plotsTruncated, errorMessage, files, filesTruncated }) => {
      if (errorMessage)
        _stdoutParts.push({ kind: "stderr", text: String(errorMessage).slice(0, 4000) });
      finishRun(images || [], plotsTruncated, files || [], filesTruncated);
    },
    error: (data) => {
      _stdoutParts.push({ kind: "stderr", text: String(data.message).slice(0, 4000) + "\n" });
      finishRun([], false, data.files || [], data.filesTruncated);
    },
  };

  function handleWorkerMessage({ data }) {
    if (!data || typeof data !== "object") return;
    if (_runtimeState === "loading" && data.type === "error") {
      failWorker(data.message || "Python could not start.");
      return;
    }
    if (data.type !== "ready" && data.type !== "init_error") {
      if (!_running || data.runId !== _runId) return;
    }
    if (!Object.hasOwn(MSG, data.type)) {
      console.warn("Unknown worker message:", data.type);
      return;
    }
    MSG[data.type]?.(data);
  }

  // Live output panel (shown during streaming stdout)
  let _livePanel = null;

  function ensureLivePanel() {
    if (_livePanel && document.contains(_livePanel)) return;
    if (!_currentPre) return;
    clearBelow(_currentPre);
    _currentPre.parentElement?.classList.add("py-open");
    _livePanel = document.createElement("div");
    _livePanel.className = "py-output";
    _livePanel.setAttribute("role", "region");
    _livePanel.setAttribute("aria-label", "Python output");

    const bar = document.createElement("div");
    bar.className = "py-output-bar";

    const labelWrap = document.createElement("div");
    labelWrap.className = "py-output-label";

    const dot = document.createElement("span");
    dot.className = "py-dot";

    const label = document.createElement("span");
    label.textContent = "output";

    labelWrap.append(dot, label);

    const closeBtn = document.createElement("button");
    closeBtn.className = "py-output-close";
    closeBtn.title = "Close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close output panel");
    closeBtn.textContent = "✕";

    bar.append(labelWrap, closeBtn);

    const body = document.createElement("div");
    body.className = "py-output-body";
    body.id = "_live_body";

    _livePanel.append(bar, body);
    const panel = _livePanel;
    const pre = _currentPre;
    panel.querySelector(".py-output-close").addEventListener("click", () => {
      removeOutputPanel(panel);
      if (_livePanel === panel) _livePanel = null;
      pre.parentElement?.classList.remove("py-open");
    });
    _currentPre.parentElement?.insertAdjacentElement("afterend", _livePanel);
  }

  function renderOutputParts(body, parts) {
    const start = renderedParts.get(body) || 0;
    parts.slice(start).forEach((part) => {
      if (part.kind === "stderr") {
        const span = document.createElement("span");
        span.className = "py-err-inline";
        span.textContent = part.text;
        body.appendChild(span);
        return;
      }
      body.appendChild(document.createTextNode(part.text));
    });
    renderedParts.set(body, parts.length);
  }

  const downloadURLs = new Set();

  function downloadName(name) {
    return (
      Array.from(String(name), (char) =>
        char.codePointAt(0) < 32 || char.codePointAt(0) === 127 ? "_" : char
      )
        .join("")
        .replace(/[<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/g, "_")
        .replace(/^\.+/, "")
        .slice(-180) || "download"
    );
  }

  function downloadLink(url, name, label) {
    const link = document.createElement("a");
    link.className = "py-download";
    link.href = url;
    link.download = downloadName(name);
    link.textContent = label;
    return link;
  }

  function fileLink(bytes, name, label) {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    downloadURLs.add(url);
    const link = downloadLink(url, name, label);
    link.dataset.downloadUrl = url;
    return link;
  }

  function removeOutputPanel(panel) {
    panel.querySelectorAll("[data-download-url]").forEach((link) => {
      URL.revokeObjectURL(link.dataset.downloadUrl);
      downloadURLs.delete(link.dataset.downloadUrl);
    });
    panel.remove();
  }
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    downloadURLs.forEach((url) => URL.revokeObjectURL(url));
    downloadURLs.clear();
  });

  function appendOutputImages(body, images) {
    let bytes = 0;
    images.slice(0, 5).forEach((b64, index) => {
      if (typeof b64 !== "string" || b64.length > 2_000_000 || bytes + b64.length > 8_000_000)
        return;
      bytes += b64.length;
      const figure = document.createElement("figure");
      figure.className = "py-plot";
      const img = document.createElement("img");
      img.src = `data:image/png;base64,${b64}`;
      img.alt = `Plot ${index + 1} from this example`;
      const caption = document.createElement("figcaption");
      const exampleId = _currentPre?.querySelector("code")?.dataset.exampleId || "python";
      caption.appendChild(
        downloadLink(
          img.src,
          `${exampleId}-plot-${index + 1}.png`,
          `Download plot ${index + 1} (PNG)`
        )
      );
      figure.append(img, caption);
      body.appendChild(figure);
    });
  }

  function appendOutputFiles(body, files, truncated) {
    const group = document.createElement("div");
    group.className = "py-downloads";
    const label = document.createElement("p");
    label.textContent = "Files from this run";
    group.appendChild(label);
    let total = 0;
    for (const file of files.slice(0, 20)) {
      if (
        typeof file.name !== "string" ||
        !(file.bytes instanceof Uint8Array) ||
        file.bytes.length > 4 * 1024 * 1024 ||
        total + file.bytes.length > 8 * 1024 * 1024
      )
        continue;
      total += file.bytes.length;
      const size =
        file.bytes.length < 1024
          ? `${file.bytes.length} B`
          : `${(file.bytes.length / 1024).toFixed(1)} KiB`;
      group.appendChild(fileLink(file.bytes, file.name, `Download ${file.name} (${size})`));
    }
    if (group.childElementCount > 1) body.appendChild(group);
    if (truncated) {
      const notice = document.createElement("p");
      notice.className = "py-download-note";
      notice.textContent =
        "Some files were omitted. Downloads support up to 20 files, 4 MiB each and 8 MiB per run, in the lesson workspace.";
      body.appendChild(notice);
    }
  }

  function flushLiveOutput() {
    if (outputFrame !== null) cancelAnimationFrame(outputFrame);
    outputFrame = null;
    ensureLivePanel();
    const body = _livePanel?.querySelector("#_live_body");
    if (body) renderOutputParts(body, _stdoutParts);
  }

  function updateLiveOutput() {
    if (outputFrame === null) outputFrame = requestAnimationFrame(flushLiveOutput);
  }

  // Input prompt (injected below live output during need_input)
  function showInputPrompt() {
    if (!_currentPre) return;
    flushLiveOutput();
    executionStatus.textContent = "Python is waiting for input.";
    removeInputPanel();

    const container = document.createElement("div");
    container.className = "py-form";
    container.style.marginTop = "0";
    const body = document.createElement("div");
    body.className = "py-form-body";
    body.style.padding = "8px 12px";

    const field = document.createElement("input");
    field.type = "text";
    field.id = "_py_input_field";
    field.className = "py-input-field";
    field.placeholder = "type your answer and press Enter…";
    field.setAttribute("aria-label", "Python input()");
    field.autocomplete = "off";
    field.addEventListener("input", () => field.setCustomValidity(""));

    body.appendChild(field);
    container.appendChild(body);
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitInput(field.value);
      }
    });
    (_livePanel || _currentPre.parentElement).insertAdjacentElement("afterend", container);
    _inputPanel = container;
    if (!field.closest("[inert]")) field.focus();
  }

  function submitInput(value) {
    if (!_running || Atomics.load(cancelView, 0) || Atomics.load(stdinView, 0) !== 1) return;
    const bytes = new TextEncoder().encode(value + "\n");
    if (bytes.length > dataView.length) {
      const field = _inputPanel?.querySelector("input");
      field?.setCustomValidity("Please enter a shorter answer (at most 65,535 UTF-8 bytes).");
      field?.reportValidity();
      return;
    }
    removeInputPanel();
    dataView.set(bytes);
    Atomics.store(stdinView, 1, bytes.length);
    Atomics.store(stdinView, 0, 2);
    Atomics.notify(stdinView, 0, 1);
    addOutput("stdout", value + "\n");
    _currentBtn?.focus();
    executionStatus.textContent = "Python is running.";
  }

  function removeInputPanel() {
    if (_inputPanel && document.contains(_inputPanel)) _inputPanel.remove();
    _inputPanel = null;
  }

  function interruptRun() {
    if (!_worker || !_running || Atomics.load(cancelView, 0)) return;
    const worker = _worker;
    const runId = _runId;
    Atomics.store(cancelView, 0, 1);
    Atomics.store(interruptView, 0, 2);
    Atomics.notify(stdinView, 0);
    removeInputPanel();
    if (_currentBtn) _currentBtn.textContent = "Stopping…";
    _cancelTimer = setTimeout(() => {
      if (_worker !== worker || !_running || _runId !== runId) return;
      failWorker(
        "Execution stopped. Python was reset because the code did not respond; temporary files were cleared."
      );
      getWorker();
    }, CANCEL_TIMEOUT_MS);
  }

  // Finish run
  function finishRun(images, plotsTruncated = false, files = [], filesTruncated = false) {
    const inputHadFocus = _inputPanel?.contains(document.activeElement);
    if (plotsTruncated)
      _stdoutParts.push({
        kind: "notice",
        text: "\nPlots truncated. Showing at most 5 plots within the image size limit.\n",
      });
    if (outputFrame !== null) cancelAnimationFrame(outputFrame);
    outputFrame = null;
    clearTimeout(_cancelTimer);
    toastHide();
    removeInputPanel();
    _running = false;
    if (cancelView) Atomics.store(cancelView, 0, 0);
    if (interruptView) Atomics.store(interruptView, 0, 0);

    const hasErr = _stdoutParts.some((part) => part.kind === "stderr");
    const hasTextOutput = _stdoutParts.some((part) => part.text.trim());
    const hasImages = images.length > 0;

    if (_currentPre) {
      if (_livePanel && document.contains(_livePanel)) {
        const body = _livePanel.querySelector("#_live_body");
        if (body) {
          renderOutputParts(body, _stdoutParts);
          appendOutputImages(body, images);
          appendOutputFiles(body, files, filesTruncated);
          if (!hasTextOutput && !hasImages && !files.length && !filesTruncated) {
            const empty = document.createElement("span");
            empty.style.color = "var(--muted)";
            empty.style.fontStyle = "italic";
            empty.textContent = "✓ ran — no output";
            body.appendChild(empty);
          }
        }
        const dot = _livePanel.querySelector(".py-dot");
        if (dot && hasErr) dot.classList.add("err");
        const label = _livePanel.querySelector(".py-output-label span:last-child");
        if (label && hasErr) label.textContent = "error";
      } else {
        const outputFragment = document.createDocumentFragment();
        renderOutputParts(outputFragment, _stdoutParts);
        appendOutputImages(outputFragment, images);
        appendOutputFiles(outputFragment, files, filesTruncated);
        if (!hasTextOutput && !hasImages && !files.length && !filesTruncated) {
          const empty = document.createElement("span");
          empty.style.color = "var(--muted)";
          empty.style.fontStyle = "italic";
          empty.textContent = "✓ ran — no output";
          outputFragment.appendChild(empty);
        }
        showOutput(_currentPre, hasErr ? "err" : "ok", outputFragment);
      }
    }

    if (_currentBtn) {
      _currentBtn.textContent = "▶ run";
      _currentBtn.setAttribute("aria-label", "Run Python code");
      _currentBtn.classList.remove("loading");
      _currentBtn.classList.add("active");
    }

    executionStatus.textContent = hasErr
      ? "Python finished with an error. Check the output."
      : "Python finished. Output is available below the example.";
    if (inputHadFocus) _currentBtn?.focus();
    _stdoutParts = [];
    _livePanel = null;
    _currentPre = null;
    _currentBtn = null;
  }

  // Toast helper
  const toast = document.createElement("div");
  toast.id = "py-toast";
  const toastSpinner = document.createElement("div");
  toastSpinner.className = "py-spinner";
  const toastMsg = document.createElement("span");
  toastMsg.id = "py-toast-msg";
  toast.append(toastSpinner, toastMsg);
  document.body.appendChild(toast);

  function toastShow(msg) {
    document.getElementById("py-toast-msg").textContent = msg;
    toast.classList.add("on");
  }
  function toastHide() {
    toast.classList.remove("on");
  }

  // Code text extraction
  function getCode(pre) {
    const clone = pre.cloneNode(true);
    clone.querySelectorAll("button").forEach((b) => {
      b.remove();
    });
    return clone.textContent.trim();
  }

  // Pre-processing
  function preprocessCode(code) {
    return code
      .split("\n")
      .map((line) => {
        if (/^[\u2500-\u257f\u2014\u2013\u2010─-]{2}/.test(line.trim())) return "# " + line;
        return line;
      })
      .join("\n");
  }

  // ── Code type detection ──────────────────────────────────────────
  function detectType(raw) {
    const lines = raw.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (!lines.length) return "empty";
    const first = lines[0].trim();
    if (/^python[\s3]|^pip[\s3]/.test(first)) return "shell";
    if (/\bimport\s+turtle\b/.test(raw)) return "turtle";
    if (/\bsys\.argv\b/.test(raw)) return "argv";
    if (/\binput\s*\(/.test(raw)) return "input_fn";
    if (/matplotlib|plt\./.test(raw)) return "matplotlib";
    if (/from\s+scipy|import\s+scipy/.test(raw)) return "scipy";
    if (/import\s+pandas|\bpd\./.test(raw)) return "pandas";
    if (/open\s*\(\s*[""][^""]+\.(txt|csv)[""]/.test(raw)) return "fileio";
    return "simple";
  }

  // ── DOM panel helpers ────────────────────────────────────────────
  function clearBelow(pre) {
    const wrapper = pre.parentElement;
    let next = wrapper.nextElementSibling;
    while (next && (next.classList.contains("py-output") || next.classList.contains("py-form"))) {
      const toRemove = next;
      next = next.nextElementSibling;
      removeOutputPanel(toRemove);
    }
    wrapper.classList.remove("py-open");
  }

  function showOutput(pre, kind, content) {
    clearBelow(pre);
    pre.parentElement?.classList.add("py-open");

    const dotCls =
      kind === "err" ? "err" : kind === "info" ? "info" : kind === "warn" ? "warn" : "";
    const label = kind === "err" ? "error" : kind === "info" ? "info" : "output";

    const panel = document.createElement("div");
    panel.className = "py-output";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Python output");

    const bar = document.createElement("div");
    bar.className = "py-output-bar";

    const labelWrap = document.createElement("div");
    labelWrap.className = "py-output-label";

    const dot = document.createElement("span");
    dot.className = `py-dot ${dotCls}`.trim();

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    labelWrap.append(dot, labelEl);

    const closeBtn = document.createElement("button");
    closeBtn.className = "py-output-close";
    closeBtn.title = "Close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close output panel");
    closeBtn.textContent = "✕";

    bar.append(labelWrap, closeBtn);

    const body = document.createElement("div");
    body.className =
      `py-output-body ${kind === "err" ? "err" : kind === "info" ? "info" : ""}`.trim();
    if (content instanceof Node) {
      body.appendChild(content);
    } else {
      body.textContent = String(content || "");
    }

    panel.append(bar, body);
    panel.querySelector(".py-output-close")?.addEventListener("click", () => {
      removeOutputPanel(panel);
      pre.parentElement?.classList.remove("py-open");
    });
    pre.parentElement?.insertAdjacentElement("afterend", panel);
  }

  function showForm(pre, hint, fields, onRun) {
    clearBelow(pre);
    pre.parentElement?.classList.add("py-open");

    const form = document.createElement("div");
    form.className = "py-form";

    const bar = document.createElement("div");
    bar.className = "py-form-bar";

    const hintEl = document.createElement("span");
    hintEl.textContent = String(hint || "");

    const closeBtn = document.createElement("button");
    closeBtn.className = "py-output-close";
    closeBtn.title = "Cancel";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close input form");
    closeBtn.textContent = "✕";

    bar.append(hintEl, closeBtn);

    const body = document.createElement("div");
    body.className = "py-form-body";

    fields.forEach((fieldData) => {
      const labelEl = document.createElement("label");
      labelEl.textContent = fieldData.label;
      const inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.name = fieldData.name;
      inputEl.setAttribute("aria-label", fieldData.ariaLabel);
      inputEl.placeholder = fieldData.placeholder;
      body.append(labelEl, inputEl);
    });

    const actions = document.createElement("div");
    actions.className = "py-form-actions";

    const runBtn = document.createElement("button");
    runBtn.className = "py-btn-run";
    runBtn.type = "button";
    runBtn.setAttribute("aria-label", "Run Python code");
    runBtn.textContent = "▶ run";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "py-btn-cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = "cancel";

    actions.append(runBtn, cancelBtn);
    body.appendChild(actions);
    form.append(bar, body);

    const close = () => {
      form.remove();
      pre.parentElement.classList.remove("py-open");
    };
    runBtn.addEventListener("click", () => onRun(form));
    cancelBtn.addEventListener("click", close);
    closeBtn.addEventListener("click", close);
    pre.parentElement.insertAdjacentElement("afterend", form);
    form.querySelector("input")?.focus();
  }

  // ── Core execution ───────────────────────────────────────────────
  async function execCode(pre, btn, code, args = []) {
    if (_running) return;
    if (_runtimeState !== "ready") {
      _pendingRun = [pre, btn, code, args];
      getWorker();
      return;
    }
    _running = true;
    _currentPre = pre;
    _currentBtn = btn;
    _stdoutParts = [];
    outputLength = 0;
    outputTruncated = false;
    (pre.closest('[role="dialog"]') || document.body).appendChild(executionStatus);
    executionStatus.inert = false;
    executionStatus.textContent = "Python is running.";
    _livePanel = null;
    _runId += 1;
    const thisRunId = _runId;
    ensureLivePanel();

    btn.textContent = "■ stop";
    btn.setAttribute("aria-label", "Stop Python code");
    btn.classList.add("loading");
    btn.classList.remove("active");

    code = preprocessCode(code);
    Atomics.store(cancelView, 0, 0);
    Atomics.store(interruptView, 0, 0);
    Atomics.store(stdinView, 0, 0);
    const scriptName = pre.querySelector("code")?.dataset.scriptName || "snippet.py";
    try {
      _worker.postMessage({ type: "run", code, args: [scriptName, ...args], runId: thisRunId });
    } catch (err) {
      failWorker("Python could not receive the code. " + err.message);
    }
  }

  // ── Per-type handlers ────────────────────────────────────────────
  function showLocalInstructions(pre, shell = false) {
    if (pre.parentElement.nextElementSibling?.classList.contains("py-output")) {
      clearBelow(pre);
      return;
    }
    const example = pre.querySelector("code");
    const fragment = document.createElement("div");
    fragment.className = "py-local-help";
    const explanation = document.createElement("p");
    explanation.textContent =
      example.dataset.runReason ||
      (shell
        ? "Run this command in a terminal, not in the Python interpreter."
        : "This example needs a local Python environment.");
    fragment.appendChild(explanation);
    const steps = document.createElement("p");
    steps.textContent = shell
      ? "Use Copy above, then paste into your terminal. Keep any referenced script in that folder."
      : "Open the downloaded .py file in your Python editor. Install any required packages before running it.";
    if (!shell) {
      const filename = `${example.dataset.exampleId || "example"}.py`;
      fragment.appendChild(
        fileLink(example.textContent.trim() + "\n", filename, `Download ${filename}`)
      );
    }
    fragment.appendChild(steps);
    showOutput(pre, "info", fragment);
  }

  function handleArgv(pre, btn, code) {
    const matches = [...code.matchAll(/sys\.argv\[(\d+)\]/g)];
    const indices = [...new Set(matches.map((m) => +m[1]))]
      .filter((i) => i > 0)
      .sort((a, b) => a - b);
    if (!indices.length) {
      execCode(pre, btn, code).catch((err) => {
        console.error("execCode failed:", err);
      });
      return;
    }

    const hints = {};
    if (/speed/.test(code)) {
      hints[1] = "speed1 e.g. 60";
      hints[2] = "speed2 e.g. 80";
      hints[3] = "distance e.g. 100";
      hints[4] = "'towards' or 'pursue'";
    }

    const fields = indices.map((i) => ({
      label: `sys.argv[${i}]${hints[i] ? "  —  " + hints[i] : ""}`,
      name: `a${i}`,
      ariaLabel: `sys.argv[${i}]`,
      placeholder: hints[i] || "enter value…",
    }));

    showForm(pre, "sys.argv — provide command-line arguments", fields, (form) => {
      const args = Array(Math.max(...indices)).fill("");
      indices.forEach((i) => {
        args[i - 1] = form.querySelector(`[name="a${i}"]`)?.value ?? "";
      });
      form.remove();
      execCode(pre, btn, code, args).catch((err) => {
        console.error("execCode failed:", err);
      });
    });
  }

  // ── Main click dispatcher ────────────────────────────────────────
  function handleClick(pre, btn) {
    if (_running && btn === _currentBtn) {
      interruptRun();
      return;
    }
    if (_running) return;
    // Toggle: click again to close output
    if (pre.parentElement.nextElementSibling?.classList.contains("py-output")) {
      clearBelow(pre);
      btn.classList.remove("active");
      return;
    }
    if (pre.parentElement.nextElementSibling?.classList.contains("py-form")) {
      clearBelow(pre);
      return;
    }

    const raw = getCode(pre);
    const example = pre.querySelector("code");
    if (example?.dataset.runMode === "local") {
      showLocalInstructions(pre);
      return;
    }
    const type = detectType(raw);

    if (type === "empty") return;
    if (type === "shell") {
      showLocalInstructions(pre, true);
      return;
    }
    if (type === "turtle") {
      showLocalInstructions(pre);
      return;
    }
    if (type === "argv" && example?.dataset.argvMode !== "empty") {
      handleArgv(pre, btn, raw);
      return;
    }
    // input_fn and all other types go through execCode — worker handles input() natively
    execCode(pre, btn, raw).catch((err) => {
      console.error("execCode failed:", err);
    });
  }

  // ── Inject run buttons ───────────────────────────────────────────
  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.closest("pre")) return;
    if (!pre.querySelector("code.language-python")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    const example = pre.querySelector("code");
    const local = ["local", "shell"].includes(example.dataset.runMode);
    const shell = example.dataset.runMode === "shell";
    btn.className = local ? "run-btn local-run-btn" : "run-btn";
    btn.textContent = local ? (shell ? "Terminal" : "Run locally") : "▶ run";
    btn.disabled = !local && !window.crossOriginIsolated;
    btn.setAttribute(
      "aria-label",
      local
        ? shell
          ? "Terminal instructions"
          : "Run locally: instructions and download"
        : "Run Python code"
    );
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (local) showLocalInstructions(pre, shell);
      else handleClick(pre, btn);
    });
    pre.parentElement.appendChild(btn);
  });
})();

// ── Service Worker registration + cross-origin isolation reload guard ──────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        const showUpdate = () => {
          if (!reg.waiting || !navigator.serviceWorker.controller) return;
          if (document.querySelector(".site-update-status")) return;
          const notice = document.createElement("aside");
          notice.className = "site-update-status";
          notice.setAttribute("role", "status");
          notice.textContent =
            "A site update is ready. Finish your work, then close all tabs for this site and reopen it.";
          document.body.appendChild(notice);
        };
        const watchInstalling = () => {
          reg.installing?.addEventListener("statechange", showUpdate);
        };
        showUpdate();
        watchInstalling();
        reg.addEventListener("updatefound", watchInstalling);
        // If not yet cross-origin isolated, wait for SW to activate then reload once
        if (!window.crossOriginIsolated) {
          if (sessionStorage.getItem("__coi_reloaded")) {
            // Already tried once — SW headers may not be supported in this environment
            if (DEBUG)
              console.warn(
                "[runner] crossOriginIsolated unavailable after reload; SharedArrayBuffer may not work."
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
        if (DEBUG) console.warn("SW registration failed:", err);
      });
  });
}
