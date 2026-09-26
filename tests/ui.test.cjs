const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const source = fs.readFileSync(path.join(__dirname, "..", "runner.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

async function setup({
  isolated = true,
  constructError = false,
  start = true,
  readingPlace,
  blockStorage = false,
} = {}) {
  const dom = new JSDOM(html, {
    url: "https://test.local/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  await new Promise((resolve) => w.addEventListener("load", resolve, { once: true }));
  const workers = [];
  if (readingPlace !== undefined)
    w.localStorage.setItem("pysupport-reading-place-v1", readingPlace);
  if (blockStorage) {
    for (const method of ["getItem", "setItem", "removeItem"])
      w.Storage.prototype[method] = () => {
        throw new Error("Storage blocked");
      };
  }
  const timers = new Map();
  let nextTimer = 0;
  w.setTimeout = (fn, ms) => {
    const id = ++nextTimer;
    timers.set(id, { fn, ms });
    return id;
  };
  w.clearTimeout = (id) => timers.delete(id);
  w.requestAnimationFrame = (fn) => w.setTimeout(fn, 16);
  w.cancelAnimationFrame = w.clearTimeout;
  w.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  w.crossOriginIsolated = isolated;
  w.SharedArrayBuffer = SharedArrayBuffer;
  w.TextEncoder = TextEncoder;
  const revoked = [];
  let blobId = 0;
  w.URL.createObjectURL = () => "blob:test-" + ++blobId;
  w.URL.revokeObjectURL = (url) => revoked.push(url);
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.Worker = class {
    constructor() {
      if (constructError) throw new Error("Worker unavailable");
      this.listeners = {};
      this.messages = [];
      workers.push(this);
    }
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    emit(data) {
      this.listeners.message({ data });
    }
    fail() {
      this.listeners.error({ message: "Simulated crash" });
    }
  };
  w.eval(source);
  w.dispatchEvent(new w.Event("load"));
  const fire = (ms) => {
    for (const [id, timer] of [...timers])
      if (timer.ms === ms) {
        timers.delete(id);
        timer.fn();
      }
  };
  if (start) w.document.querySelector("#floatingPythonReset")?.click();
  const ready = () => workers.at(-1).emit({ type: "ready", protocolVersion: 2 });
  const button = (id = "ex-016") =>
    w.document
      .querySelector(`[data-example-id="${id}"]`)
      .closest(".code-wrapper")
      .querySelector(".run-btn");
  const status = () => w.document.querySelector(".py-runtime-status");
  return { dom, w, workers, fire, ready, button, status, revoked, close: () => dom.window.close() };
}

test("saved reading place resumes nested panels without starting Python, then clears only its key", async () => {
  const e = await setup({ start: false });
  try {
    const d = e.w.document;
    const section = d.querySelector("#s16");
    const titles = [...section.querySelectorAll(".scenario-title")].filter(
      (el) => !el.closest('[role="dialog"]')
    );
    const target = titles.at(-1);
    const title = target.textContent.replace(/\s+/g, " ").trim().slice(0, 200);
    const record = JSON.stringify({ version: 1, section: "s16", panel: titles.length - 1, title });
    e.w.localStorage.setItem("pysupport-reading-place-v1", record);
    e.w.localStorage.setItem("theme", "light");
    e.w.localStorage.setItem("unrelated", "keep");
    e.w.dispatchEvent(
      new e.w.StorageEvent("storage", { key: "pysupport-reading-place-v1", newValue: record })
    );
    target.closest(".scenario").classList.add("collapsed");
    assert.equal(d.querySelector("#readingResume").hidden, false);
    d.querySelector("#readingResumeLink").click();
    assert.equal(target.closest(".scenario").classList.contains("collapsed"), false);
    assert.equal(target.getAttribute("aria-expanded"), "true");
    assert.equal(d.activeElement, target);
    assert.equal(e.w.location.hash, "#s16");
    assert.equal(e.workers.length, 0);
    d.querySelector("#clearReadingProgress").click();
    assert.equal(d.querySelector("#readingResume").hidden, true);
    assert.equal(e.w.localStorage.getItem("pysupport-reading-place-v1"), null);
    assert.equal(e.w.localStorage.getItem("theme"), "light");
    assert.equal(e.w.localStorage.getItem("unrelated"), "keep");
  } finally {
    e.close();
  }
});

test("invalid/stale bookmarks and blocked storage do not break reading or runtime controls", async () => {
  for (const readingPlace of [
    "{invalid",
    JSON.stringify({ version: 99, section: "s16", panel: 0 }),
    JSON.stringify({ version: 1, section: "s999", panel: 0 }),
  ]) {
    const e = await setup({ start: false, readingPlace });
    try {
      assert.equal(e.w.document.querySelector("#readingResume").hidden, true);
      assert.equal(e.workers.length, 0);
    } finally {
      e.close();
    }
  }
  const stale = await setup({
    start: false,
    readingPlace: JSON.stringify({ version: 1, section: "s16", panel: 0, title: "Removed panel" }),
  });
  try {
    stale.w.document.querySelector("#readingResumeLink").click();
    assert.equal(stale.w.document.activeElement, stale.w.document.querySelector("#s16 h2"));
  } finally {
    stale.close();
  }
  const blocked = await setup({ start: false, blockStorage: true });
  try {
    assert.equal(blocked.w.document.querySelector("#readingResume").hidden, true);
    blocked.w.document.querySelector("#themeToggle").click();
    assert.equal(blocked.w.document.documentElement.dataset.theme, "light");
    blocked.button().click();
    assert.equal(blocked.workers.length, 1);
  } finally {
    blocked.close();
  }
});

test("normal startup enables every Run button and hides loading status", async () => {
  const e = await setup();
  try {
    assert.equal(e.w.document.querySelectorAll(".run-btn:disabled").length, 247);
    assert.match(e.status().textContent, /Loading Python/);
    e.ready();
    assert.equal(e.w.document.querySelectorAll(".run-btn:disabled").length, 0);
    assert.ok(e.status().hidden);
    assert.equal(e.w.document.querySelector(".py-reset-control"), null);
  } finally {
    e.close();
  }
});

test("initialization failure offers retry; stale worker messages cannot change the replacement", async () => {
  const e = await setup();
  try {
    const old = e.workers[0];
    old.emit({ type: "init_error", message: "Download failed" });
    assert.match(e.status().textContent, /Download failed/);
    assert.ok(old.terminated);
    e.status().querySelector("button").click();
    const replacement = e.workers[1];
    assert.notEqual(old.messages[0].stdinSAB, replacement.messages[0].stdinSAB);
    old.emit({ type: "ready", protocolVersion: 2 });
    assert.ok(e.button().disabled);
    e.ready();
    assert.equal(e.button().disabled, false);
    old.fail();
    assert.ok(e.status().hidden);
  } finally {
    e.close();
  }
});

test("startup timeout is enforced after an explicit runtime request", async () => {
  const e = await setup();
  try {
    e.fire(30000);
    assert.match(e.status().textContent, /too long/);
    assert.equal(e.status().querySelector("button").hidden, false);
    assert.ok(e.workers[0].terminated);
  } finally {
    e.close();
  }
});

test("worker construction failures and missing isolation are visible", async () => {
  for (const options of [{ constructError: true }, { isolated: false }]) {
    const e = await setup(options);
    try {
      assert.equal(e.status().hidden, false);
      assert.match(e.status().textContent, /could not start|cross-origin isolated/);
    } finally {
      e.close();
    }
  }
});

test("protocol mismatch provides recovery instead of enabling incompatible execution", async () => {
  const e = await setup();
  try {
    e.workers[0].emit({ type: "ready", protocolVersion: 1 });
    assert.match(e.status().textContent, /different releases/);
    assert.ok(e.button().disabled);
  } finally {
    e.close();
  }
});

test("Stop signals shared memory, ignores stale output, and resets after completion", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const worker = e.workers[0];
    const run = worker.messages.at(-1);
    const init = worker.messages[0];
    worker.emit({ type: "stdout", runId: run.runId - 1, text: "STALE" });
    assert.equal(e.w.document.querySelector(".py-output-body").textContent, "");
    e.button().click();
    assert.equal(Atomics.load(new Uint8Array(init.interruptSAB), 0), 2);
    assert.equal(Atomics.load(new Int32Array(init.cancelSAB), 0), 1);
    worker.emit({ type: "stderr", runId: run.runId, text: "KeyboardInterrupt\n" });
    worker.emit({ type: "done", runId: run.runId, images: [] });
    e.fire(1500);
    assert.equal(e.workers.length, 1);
    assert.match(e.button().textContent, /run/);
    assert.equal(Atomics.load(new Uint8Array(init.interruptSAB), 0), 0);
  } finally {
    e.close();
  }
});

test("unresponsive cancellation restarts once and isolates late messages", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const old = e.workers[0];
    const run = old.messages.at(-1);
    e.button().click();
    e.button().click();
    e.fire(1500);
    assert.ok(old.terminated);
    assert.equal(e.workers.length, 2);
    assert.ok(e.button().disabled);
    old.emit({ type: "done", runId: run.runId, images: [] });
    assert.ok(e.button().disabled);
    e.ready();
    assert.equal(e.button().disabled, false);
    assert.match(
      e.w.document.querySelector(".py-output-body").textContent,
      /temporary files were cleared/
    );
  } finally {
    e.close();
  }
});

test("hard crash during execution permits retry and a subsequent run", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    e.workers[0].fail();
    assert.match(e.status().textContent, /Simulated crash/);
    e.status().querySelector("button").click();
    e.ready();
    e.button("ex-000").click();
    assert.equal(e.workers[1].messages.at(-1).type, "run");
  } finally {
    e.close();
  }
});

test("argv form preserves literal values, original imports and script filename", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button("ex-209").click();
    const fields = [...e.w.document.querySelectorAll(".py-form input")];
    fields[0].value = '$& " α';
    fields[1].value = "Bob";
    fields[2].value = "Carol";
    e.w.document.querySelector(".py-btn-run").click();
    const run = e.workers[0].messages.at(-1);
    assert.deepEqual(Array.from(run.args), ["usethree.py", '$& " α', "Bob", "Carol"]);
    assert.match(run.code, /import sys/);
    assert.match(run.code, /sys.argv\[0\]/);
  } finally {
    e.close();
  }
});

test("output treats HTML-looking strings as text and blocks overlapping runs", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const worker = e.workers[0];
    const run = worker.messages.at(-1);
    e.button("ex-000").click();
    assert.equal(worker.messages.filter((m) => m.type === "run").length, 1);
    worker.emit({ type: "stdout", runId: run.runId, text: '<img src=x onerror="alert(1)">' });
    assert.equal(e.w.document.querySelector(".py-output img"), null);
    e.fire(16);
    assert.match(e.w.document.querySelector(".py-output-body").textContent, /<img/);
  } finally {
    e.close();
  }
});

test("theme, collapse controls, and modal open/close still work", async () => {
  const e = await setup();
  try {
    e.w.document.getElementById("themeToggle").click();
    assert.equal(e.w.document.documentElement.dataset.theme, "light");
    const title = e.w.document.querySelector(".scenario-title");
    title.click();
    assert.equal(title.getAttribute("aria-expanded"), "false");
    title.click();
    assert.equal(title.getAttribute("aria-expanded"), "true");
    const open = e.w.document.querySelector("[data-overlay-show]:not([data-overlay-hide])");
    const id = open.dataset.overlayShow;
    open.click();
    assert.equal(e.w.document.getElementById(id).style.display, "flex");
    e.w.document
      .getElementById(id)
      .querySelector("[data-overlay-hide]:not([data-overlay-show])")
      .click();
    assert.equal(e.w.document.getElementById(id).style.display, "none");
  } finally {
    e.close();
  }
});

test("oversized UTF-8 input is rejected intact and a shorter answer can be submitted", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const worker = e.workers[0];
    const run = worker.messages.at(-1);
    const init = worker.messages[0];
    const stdin = new Int32Array(init.stdinSAB);
    Atomics.store(stdin, 0, 1);
    worker.emit({ type: "need_input", runId: run.runId });
    const field = e.w.document.querySelector("#_py_input_field");
    field.value = "α".repeat(40000);
    field.dispatchEvent(new e.w.KeyboardEvent("keydown", { key: "Enter" }));
    assert.equal(Atomics.load(stdin, 0), 1);
    assert.equal(Atomics.load(stdin, 1), 0);
    assert.match(field.validationMessage, /shorter answer/);
    assert.ok(field.isConnected);
    field.value = "Zoë α";
    field.dispatchEvent(new e.w.Event("input"));
    field.dispatchEvent(new e.w.KeyboardEvent("keydown", { key: "Enter" }));
    assert.equal(Atomics.load(stdin, 0), 2);
    assert.equal(
      new TextDecoder().decode(new Uint8Array(init.dataSAB).slice(0, stdin[1])),
      "Zoë α\n"
    );
    assert.equal(field.isConnected, false);
  } finally {
    e.close();
  }
});

test("output rendering is batched and incremental, with bounded retention and quiet regions", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const worker = e.workers[0];
    const { runId } = worker.messages.at(-1);
    for (let i = 0; i < 100; i++) worker.emit({ type: "stdout", runId, text: "hello\n" });
    assert.equal(e.w.document.querySelector(".py-output-body").textContent, "");
    e.fire(16);
    const body = e.w.document.querySelector(".py-output-body");
    const first = body.firstChild;
    worker.emit({ type: "stdout", runId, text: "x".repeat(200000) });
    e.fire(16);
    assert.equal(body.firstChild, first);
    assert.ok(body.textContent.length < 100200);
    assert.match(body.textContent, /Output truncated/);
    assert.equal(body.closest(".py-output").getAttribute("role"), "region");
    worker.emit({ type: "done", runId, images: [], plotsTruncated: true });
    assert.match(body.textContent, /Plots truncated/);
    assert.ok(body.childNodes.length <= 1003);
  } finally {
    e.close();
  }
});

test("Reset replaces a blocked worker and shared buffers; late output cannot affect the next run", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const old = e.workers[0];
    const { runId } = old.messages.at(-1);
    old.emit({ type: "need_input", runId });
    e.w.document.querySelector("#floatingPythonReset").click();
    assert.ok(old.terminated);
    assert.equal(e.w.document.querySelector("#_py_input_field"), null);
    assert.notEqual(old.messages[0].stdinSAB, e.workers[1].messages[0].stdinSAB);
    old.emit({ type: "stdout", runId, text: "STALE" });
    e.fire(16);
    assert.doesNotMatch(e.w.document.querySelector(".py-output").textContent, /STALE/);
    e.ready();
    e.button("ex-000").click();
    assert.equal(e.workers[1].messages.at(-1).type, "run");
  } finally {
    e.close();
  }
});

test("reading stays idle; first Run queues exactly one execution and reset cancels it", async () => {
  const e = await setup({ start: false });
  try {
    e.fire(1500);
    assert.equal(e.workers.length, 0);
    assert.equal(e.button().disabled, false);
    assert.ok(e.status().hidden);
    e.button().click();
    assert.equal(e.workers.length, 1);
    assert.equal(e.workers[0].messages.length, 1);
    e.ready();
    assert.equal(e.workers[0].messages.at(-1).type, "run");
    e.workers[0].emit({ type: "done", runId: e.workers[0].messages.at(-1).runId, images: [] });
  } finally {
    e.close();
  }
  const reset = await setup({ start: false });
  try {
    reset.button().click();
    reset.w.document.querySelector("#floatingPythonReset").click();
    reset.ready();
    assert.equal(reset.workers[1].messages.length, 1);
  } finally {
    reset.close();
  }
});

test("local and terminal instructions work without starting Python, including missing isolation", async () => {
  for (const isolated of [true, false]) {
    const e = await setup({ isolated, start: false });
    try {
      assert.equal(e.w.document.querySelectorAll(".local-run-btn").length, 14);
      assert.equal(e.button("ex-122").textContent, "Run locally");
      assert.equal(e.button("ex-007").textContent, "Terminal");
      e.button("ex-122").click();
      const link = e.w.document.querySelector("a.py-download");
      assert.equal(link.download, "ex-122.py");
      const url = link.href;
      assert.match(e.w.document.querySelector(".py-output").textContent, /desktop graphics/);
      e.button("ex-122").click();
      assert.ok(e.revoked.includes(url));
      e.button("ex-007").click();
      assert.match(e.w.document.querySelector(".py-output").textContent, /terminal/);
      assert.equal(e.w.document.querySelectorAll("a.py-download").length, 0);
      assert.equal(e.workers.length, 0);
    } finally {
      e.close();
    }
  }
});

test("file links survive reset, treat names as text, and release blobs on close", async () => {
  const e = await setup();
  try {
    e.ready();
    e.button().click();
    const worker = e.workers[0];
    worker.emit({
      type: "done",
      runId: worker.messages.at(-1).runId,
      images: [],
      files: [{ name: 'results/<img onerror="bad">.csv', bytes: new e.w.Uint8Array([1, 2, 3]) }],
    });
    const link = e.w.document.querySelector(".py-download");
    assert.equal(e.w.document.querySelector(".py-output img"), null);
    assert.equal(link.download, "results__img onerror=_bad__.csv");
    const url = link.href;
    assert.equal(e.revoked.length, 0);
    e.w.document.querySelector("#floatingPythonReset").click();
    e.ready();
    assert.equal(link.href, url);
    assert.equal(e.revoked.length, 0);
    e.w.document.querySelector(".py-output-close").click();
    assert.deepEqual(e.revoked, [url]);
    assert.equal(e.button().parentElement.classList.contains("py-open"), false);
  } finally {
    e.close();
  }
});
