const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const playwright = require("playwright");
const browserName = process.env.TEST_BROWSER || "chromium";
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
let browser, server, origin;
const errors = [];

before(async () => {
  // serve.py supplies the same isolation headers needed in production.
  server = spawn(process.env.PYTHON || "python3", ["-u", "serve.py", "0"], {
    cwd: path.join(__dirname, ".."),
  });
  let output = "";
  origin = await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.stderr.on("data", (data) => {
      output += data;
    });
    server.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/Serving at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) resolve(match[1]);
    });
    server.on("exit", () => reject(new Error(output || "Development server exited")));
  });
  browser = await playwright[browserName].launch({
    executablePath:
      browserName === "chromium" ? process.env.CHROMIUM_EXECUTABLE_PATH || undefined : undefined,
    headless: true,
    args:
      browserName === "chromium"
        ? [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--no-zygote",
            "--use-gl=angle",
            "--use-angle=swiftshader",
          ]
        : undefined,
  });
});
after(async () => {
  await browser?.close();
  server?.kill();
});

async function pageFor({ failFirst = false, corruptFirst = false, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    // The separate release suite covers service workers. Keep injected runtime
    // failures out of the offline cache so Retry always receives the clean worker.
    serviceWorkers: "block",
  });
  // Optional mirror: exact release bytes keep functional tests independent of CDN availability.
  // Without PYODIDE_CACHE_DIR, these requests use the actual pinned CDN.
  if (failFirst || corruptFirst) {
    let injected = false;
    // WebKit does not route worker fetches through context.route. Inject the
    // failed response at the worker's fetch boundary so all engines exercise Retry.
    await context.route("**/pyodide-worker.js*", (route) => {
      if (injected) return route.continue();
      injected = true;
      const source = fs.readFileSync(path.join(__dirname, "..", "pyodide-worker.js"), "utf8");
      const response = failFirst
        ? 'Promise.reject(new TypeError("Simulated runtime download failure"))'
        : 'Promise.resolve(new Response("// deliberately corrupted test response"))';
      return route.fulfill({
        contentType: "application/javascript",
        headers: {
          "content-security-policy":
            "default-src 'none'; script-src blob: 'wasm-unsafe-eval'; connect-src 'self' https://cdn.jsdelivr.net/pyodide/v0.29.3/full/",
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-embedder-policy": "require-corp",
        },
        body: `const originalFetch = self.fetch.bind(self);
self.fetch = (url, options) => String(url).endsWith("/pyodide.mjs")
  ? ${response} : originalFetch(url, options);
${source}`,
      });
    });
  }
  if (process.env.PYODIDE_CACHE_DIR) {
    await context.route("https://cdn.jsdelivr.net/pyodide/v0.29.3/full/**", async (route) => {
      const name = new URL(route.request().url()).pathname.split("/").pop();
      const root = process.env.PYODIDE_CACHE_DIR;
      if (!root) return route.continue();
      const file = path.join(root, name);
      assert.ok(fs.existsSync(file), "Missing runtime fixture: " + name);
      return route.fulfill({
        path: file,
        contentType: name.endsWith(".wasm")
          ? "application/wasm"
          : /\.m?js$/.test(name)
            ? "application/javascript"
            : "application/octet-stream",
        headers: { "access-control-allow-origin": "*" },
      });
    });
  }
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ body: "", contentType: "text/css" })
  );
  await context.addInitScript(() => {
    window.__testWorkers = [];
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        window.__testWorkers.push(this);
      }
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "load" });
  assert.equal(await page.evaluate(() => crossOriginIsolated), true);
  if (failFirst || corruptFirst)
    await page.locator("#floatingPythonReset").evaluate((el) => el.click());
  return { context, page, close: () => context.close() };
}
async function ready(page) {
  if (await page.evaluate(() => window.__testWorkers.length === 0))
    await page.locator("#floatingPythonReset").evaluate((el) => el.click());
  await page.waitForFunction(
    () => document.querySelector(".run-btn") && !document.querySelector(".run-btn").disabled,
    null,
    { timeout: 45000 }
  );
}
function block(page, id = "ex-016") {
  return page.locator(`[data-example-id="${id}"]`).locator("..").locator("..");
}
async function code(page, text) {
  const el = page.locator('[data-example-id="ex-016"]');
  await el.evaluate((node, source) => {
    node.textContent = source;
  }, text);
}
async function run(page, id = "ex-016") {
  await block(page, id).locator(".run-btn").click();
}
async function finished(page, id = "ex-016") {
  await page.waitForFunction(
    (id) => {
      const wrapper = document.querySelector(`[data-example-id="${id}"]`).closest(".code-wrapper");
      return (
        !wrapper.querySelector(".run-btn").classList.contains("loading") &&
        wrapper.nextElementSibling?.classList.contains("py-output")
      );
    },
    id,
    { timeout: 30000 }
  );
}
async function output(page, id = "ex-016") {
  return page
    .locator(`[data-example-id="${id}"]`)
    .evaluate((el) => el.closest(".code-wrapper").nextElementSibling?.textContent);
}

test("browser startup, supplied screenshot example, highlighting, theme and collapse", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    assert.equal(await e.page.locator(".run-btn").count(), 261);
    assert.ok((await e.page.locator(".token.keyword").count()) > 0);
    await run(e.page);
    await finished(e.page);
    const text = await output(e.page);
    assert.match(text, /Total: 255\s+Approx. average: 85/);
    assert.match(text, /Hello, World\n30/);
    await e.page.locator("#themeToggle").click();
    assert.equal(await e.page.locator("html").getAttribute("data-theme"), "light");
    const title = e.page.locator(".scenario-title").first();
    await title.click();
    assert.equal(await title.getAttribute("aria-expanded"), "false");
  } finally {
    await e.close();
  }
});

test("actual worker download failure is visible and Retry succeeds", async () => {
  const e = await pageFor({ failFirst: true });
  try {
    await e.page.locator(".py-runtime-status button").waitFor({ state: "visible", timeout: 40000 });
    assert.match(await e.page.locator(".py-runtime-status").textContent(), /could not load/);
    assert.equal(await e.page.locator(".run-btn:disabled").count(), 261);
    await e.page.locator(".py-runtime-status button").click();
    await ready(e.page);
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /Total: 255/);
  } finally {
    await e.close();
  }
});

test("SRI rejects corrupted runtime bytes and retry loads verified code", async () => {
  const e = await pageFor({ corruptFirst: true });
  try {
    await e.page.locator(".py-runtime-status button").waitFor({ state: "visible", timeout: 40000 });
    assert.match(
      await e.page.locator(".py-runtime-status").textContent(),
      /Integrity check failed/
    );
    await e.page.locator(".py-runtime-status button").click();
    await ready(e.page);
  } finally {
    await e.close();
  }
});

test("CPU-bound Python stops cooperatively and the same worker runs again", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    await code(e.page, 'print("Running now", flush=True)\nwhile True:\n    pass');
    await run(e.page);
    await e.page.getByText("Running now", { exact: true }).waitFor();
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /KeyboardInterrupt/);
    assert.equal(await e.page.evaluate(() => __testWorkers.length), 1);
    await run(e.page);
    await code(e.page, 'print("recovered")');
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /recovered/);
  } finally {
    await e.close();
  }
});

test("input cancellation and Unicode round-trip work through real shared buffers", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    await code(e.page, 'print(input("Name: "))');
    await run(e.page);
    await e.page.locator("#_py_input_field").waitFor();
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /KeyboardInterrupt/);
    assert.equal(await e.page.locator("#_py_input_field").count(), 0);
    assert.equal(await e.page.evaluate(() => __testWorkers.length), 1);
    await run(e.page);
    await run(e.page);
    await e.page.locator("#_py_input_field").fill("Zoë α 🧠");
    await e.page.locator("#_py_input_field").press("Enter");
    await finished(e.page);
    assert.match(await output(e.page), /Zoë α 🧠/);
  } finally {
    await e.close();
  }
});

test("non-cooperative code triggers a hard restart, then normal execution recovers", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    await code(
      e.page,
      'import signal\nsignal.signal(signal.SIGINT, signal.SIG_IGN)\nprint("Running now", flush=True)\nwhile True:\n    pass'
    );
    await run(e.page);
    await e.page.getByText("Running now", { exact: true }).waitFor();
    await run(e.page);
    await e.page.waitForFunction(() => __testWorkers.length === 2);
    await ready(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /temporary files were cleared/);
    await run(e.page);
    await code(e.page, "6 * 7");
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /42/);
  } finally {
    await e.close();
  }
});

test("browser argv form preserves script name and literal punctuation", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    // Reveal the answer container to isolate argv execution from navigation.
    await e.page.locator('[data-example-id="ex-209"]').evaluate((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.classList.contains("collapsed")) p.classList.remove("collapsed");
        if (p.getAttribute("role") === "dialog") p.style.display = "flex";
      }
    });
    await run(e.page, "ex-209");
    await e.page.locator('.py-form input[name="a1"]').fill('$& " α');
    await e.page.locator('.py-form input[name="a2"]').fill("Bob");
    await e.page.locator('.py-form input[name="a3"]').fill("Carol");
    await e.page.locator(".py-btn-run").click();
    await finished(e.page, "ex-209");
    const text = await output(e.page, "ex-209");
    assert.match(text, /Hi Carol, Bob, and \$& " α/);
    assert.match(text, /This is usethree.py/);
  } finally {
    await e.close();
  }
});

test("cold-start mixed packages render multiple PNG figures", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    await code(
      e.page,
      "import pandas as pd\nimport matplotlib.pyplot as plt\nfrom scipy.stats import pearsonr\nprint(pd.Series([1, 2, 3]).mean())\nprint(round(pearsonr([1, 2, 3], [2, 4, 6]).statistic))\nfor i in range(2):\n    plt.figure()\n    plt.plot([0, i + 1])\nplt.show()"
    );
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /2\.0\n1/);
    assert.equal(await e.page.locator(".py-output img").count(), 2);
    for (const image of await e.page.locator(".py-output img").all())
      assert.equal(await image.evaluate((el) => el.complete && el.naturalWidth > 0), true);
  } finally {
    await e.close();
  }
});

test("mobile navigation and runtime recovery controls fit the viewport", async () => {
  const e = await pageFor({ failFirst: true, mobile: true });
  try {
    await e.page.locator(".py-runtime-status button").waitFor({ state: "visible", timeout: 40000 });
    const box = await e.page.locator(".py-runtime-status").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await e.page.locator(".py-runtime-status button").click();
    await ready(e.page);
    await e.page.locator(".mobile-nav-btn").click();
    assert.equal(await e.page.locator(".mobile-nav-btn").getAttribute("aria-expanded"), "true");
    await e.page.keyboard.press("Escape");
    assert.equal(await e.page.locator(".mobile-nav-btn").getAttribute("aria-expanded"), "false");
    if (process.env.TEST_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
      await e.page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, "mobile.png") });
    }
  } finally {
    await e.close();
  }
});

test("output flood stays bounded, Stop works, and Reset clears files and blocked input", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    await code(
      e.page,
      'open("reset-check.txt", "w").write("temporary")\nfor i in range(100000):\n    print("a" * 20)\ninput("Continue: ")'
    );
    await run(e.page);
    await e.page.locator("#_py_input_field").waitFor({ state: "visible" });
    assert.match(await output(e.page), /Output truncated/);
    const body = block(e.page).locator("+ .py-output .py-output-body");
    assert.ok((await body.textContent()).length < 100200);
    assert.equal(await e.page.locator(".py-output[aria-live]").count(), 0);
    const resetBox = await e.page.locator("#floatingPythonReset").boundingBox();
    const themeBox = await e.page.locator("#floatingThemeToggle").boundingBox();
    assert.equal(resetBox.x, themeBox.x);
    assert.equal(resetBox.width, themeBox.width);
    assert.ok(resetBox.y + resetBox.height < themeBox.y);
    assert.equal(await e.page.locator(".py-output #floatingPythonReset").count(), 0);
    if (process.env.TEST_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
      await e.page.screenshot({
        path: path.join(process.env.TEST_SCREENSHOT_DIR, "floating-reset-desktop.png"),
      });
    }
    await e.page.locator("#floatingPythonReset").click();
    await ready(e.page);
    assert.equal(await e.page.locator("#_py_input_field").count(), 0);
    assert.equal(await e.page.evaluate(() => window.__testWorkers.length), 2);
    await code(e.page, 'import os\nprint(os.path.exists("reset-check.txt"))');
    await run(e.page); // close previous output
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /False/);
    await code(e.page, 'while True:\n    print("flood")');
    await run(e.page);
    await run(e.page);
    await e.page.waitForFunction(() =>
      document.querySelector(".py-output-body")?.textContent.includes("Output truncated")
    );
    await run(e.page); // Stop must remain clickable under output pressure.
    await finished(e.page);
    assert.match(await output(e.page), /KeyboardInterrupt|Execution stopped/);
  } finally {
    await e.close();
  }
});

test("keyboard sidebar and dialog transitions reveal focus and isolate the active modal", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    const link = e.page.locator("#sidebarNav a").first();
    await e.page.keyboard.press("Tab");
    await link.focus();
    assert.equal(await link.getAttribute("aria-label"), "Roadmap");
    await e.page.mouse.move(1400, 100);
    await e.page.waitForFunction(
      () => getComputedStyle(document.querySelector("#sidebarNav")).opacity === "1"
    );
    await link.click();
    await e.page.mouse.move(1400, 100);
    await e.page.waitForFunction(
      () => getComputedStyle(document.querySelector("#sidebarNav")).opacity === "0"
    );
    await e.page.keyboard.press("Tab");
    await link.focus();
    await e.page.waitForFunction(
      () => getComputedStyle(document.querySelector("#sidebarNav")).opacity === "1"
    );
    const opener = e.page
      .locator('[data-overlay-show="answers-landing"]:not([data-overlay-hide])')
      .first();
    await opener.focus();
    await e.page.keyboard.press("Enter");
    const landing = e.page.locator("#answers-landing");
    assert.ok(await landing.getAttribute("aria-label"));
    assert.equal(await landing.locator(".py-execution-status").count(), 1);
    assert.equal(await landing.locator(".py-runtime-status").count(), 1);
    assert.equal(
      await e.page.locator("#themeToggle").evaluate((el) => Boolean(el.closest("[inert]"))),
      true
    );
    await landing.locator('[data-overlay-show="answers-exercises-overlay"]').click();
    const modal = e.page.locator("#answers-exercises-overlay");
    assert.equal(await modal.evaluate((el) => Boolean(el.closest("[inert]"))), false);
    const controls = await modal.evaluate((el) =>
      [...el.querySelectorAll("button, [href], input, select, textarea, [tabindex]")].filter(
        (n) =>
          n.tabIndex >= 0 &&
          !n.disabled &&
          n.getClientRects().length &&
          getComputedStyle(n).visibility !== "hidden"
      )
    );
    assert.ok(controls.length > 0);
    const firstClose = modal.locator('[data-overlay-hide="answers-exercises-overlay"]').first();
    await firstClose.focus();
    await e.page.keyboard.press("Shift+Tab");
    assert.equal(
      await modal.evaluate(
        (el) =>
          el.contains(document.activeElement) && document.activeElement.getClientRects().length > 0
      ),
      true
    );
    for (let i = 0; i < 15; i++) {
      await e.page.keyboard.press("Tab");
      assert.equal(
        await modal.evaluate(
          (el) =>
            el.contains(document.activeElement) &&
            !document.activeElement.closest(".collapsed .scenario-body") &&
            document.activeElement.getClientRects().length > 0
        ),
        true
      );
    }
    await e.page.keyboard.press("Escape");
    assert.equal(await e.page.locator("[inert]").count(), 0);
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    assert.equal(await e.page.locator("body > .py-execution-status").count(), 1);
    assert.equal(await e.page.locator("body > .py-runtime-status").count(), 1);
  } finally {
    await e.close();
  }
});

test("reset control and dialogs reflow on narrow and enlarged layouts", async () => {
  const e = await pageFor({ mobile: true });
  try {
    await ready(e.page);
    assert.equal(await e.page.locator(".py-reset-control").count(), 0);
    await run(e.page);
    await finished(e.page);
    for (const width of [320, 640]) {
      await e.page.setViewportSize({ width, height: 900 });
      await e.page.locator("#floatingPythonReset").waitFor({ state: "visible" });
      const theme = e.page.locator("#floatingThemeToggle");
      await theme.waitFor({ state: "visible" });
      const resetBox = await e.page.locator("#floatingPythonReset").boundingBox();
      const themeBox = await theme.boundingBox();
      const topBox = await e.page.locator(".back-to-top").boundingBox();
      assert.ok(resetBox.y + resetBox.height < themeBox.y);
      assert.ok(themeBox.y + themeBox.height < topBox.y);
      const wasLight = (await e.page.locator("html").getAttribute("data-theme")) === "light";
      await theme.click();
      assert.equal(
        (await e.page.locator("html").getAttribute("data-theme")) === "light",
        !wasLight
      );
      await theme.click();
      assert.equal(
        await e.page
          .locator("#floatingPythonReset")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        true
      );
      if (process.env.TEST_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
        await e.page.screenshot({
          path: path.join(process.env.TEST_SCREENSHOT_DIR, `reset-${width}.png`),
        });
      }
      await e.page.getByRole("button", { name: "Open answers", exact: true }).focus();
      await e.page.keyboard.press("Enter");
      const modal = e.page.getByRole("dialog", { name: "Answers", exact: true });
      assert.equal(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
      if (process.env.TEST_SCREENSHOT_DIR)
        await e.page.screenshot({
          path: path.join(process.env.TEST_SCREENSHOT_DIR, `dialog-${width}.png`),
        });
      await e.page.keyboard.press("Escape");
      assert.equal(await e.page.locator("[inert]").count(), 0);
    }
  } finally {
    await e.close();
  }
});

test("no uncaught page JavaScript errors during browser scenarios", () => {
  assert.deepEqual(errors, []);
});

test("hovering chapter numbers reveals animated topic names across desktop widths", async () => {
  const e = await pageFor();
  try {
    await ready(e.page);
    await e.page.emulateMedia({ reducedMotion: "no-preference" });
    for (const width of [1024, 1440, 1600, 1920, 2400]) {
      await e.page.setViewportSize({ width, height: 1000 });
      await e.page.mouse.move(width - 10, 20);
      await e.page.mouse.move(Math.max(0, width / 2 - 530) + 20, 500);
      await e.page.waitForFunction(
        () => getComputedStyle(document.querySelector("#sidebarNav")).opacity === "1"
      );
      const before = await e.page.evaluate(() => ({ y: scrollY, hash: location.hash }));
      for (const id of ["s16", "s11", "s18", "s19", "s10", "s16"]) {
        const link = e.page.locator(`#sidebarNav a[href="#${id}"]`);
        await link.hover();
        const label = link.locator(".sidebar-lens-label");
        await e.page.waitForFunction(
          (id) =>
            getComputedStyle(
              document.querySelector(`#sidebarNav a[href="#${id}"] .sidebar-lens-label`)
            ).opacity === "1",
          id,
          { timeout: 3000 }
        );
        const state = await label.evaluate((el) => ({
          text: el.textContent,
          left: el.getBoundingClientRect().left,
          right: el.getBoundingClientRect().right,
          duration: getComputedStyle(el).transitionDuration,
        }));
        assert.ok(state.text.trim().length > 0);
        assert.ok(
          state.left >= 0 && state.right <= width,
          "topic name must be inside the viewport"
        );
        const anchorBox = await link.boundingBox();
        if (width >= 1440)
          assert.ok(
            state.right < anchorBox.x,
            "every topic must stay on the left when the gutter is usable"
          );
        if (width === 1024)
          assert.ok(
            state.left > anchorBox.x + anchorBox.width,
            "every topic must stay on the right when the left gutter is too small"
          );
        const currentBox = await label.boundingBox();
        const prevBox = await e.page.locator(".is-lens-prev .sidebar-lens-label").boundingBox();
        const nextBox = await e.page.locator(".is-lens-next .sidebar-lens-label").boundingBox();
        assert.ok(prevBox.y + prevBox.height <= currentBox.y - 7);
        assert.ok(currentBox.y + currentBox.height <= nextBox.y - 7);
        assert.equal(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
        await link.focus();
        assert.equal(
          await e.page
            .locator("#sidebarNav")
            .evaluate((el) => el.classList.contains("lens-labels-right")),
          width === 1024,
          "keyboard navigation must use the same stable side"
        );
        assert.notEqual(state.duration, "0s");
        assert.equal(await e.page.locator(".is-lens-prev .sidebar-lens-label").count(), 1);
        assert.equal(await e.page.locator(".is-lens-next .sidebar-lens-label").count(), 1);
        assert.deepEqual(
          await e.page.evaluate(() => ({ y: scrollY, hash: location.hash })),
          before
        );
      }
      if (process.env.TEST_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
        await e.page.screenshot({
          path: path.join(process.env.TEST_SCREENSHOT_DIR, `hover-labels-${width}.png`),
        });
      }
    }
  } finally {
    await e.close();
  }
});

test("reading downloads no Python; one Run click starts and executes under strict CSP", async () => {
  const e = await pageFor();
  try {
    await e.page.waitForTimeout(1800);
    assert.equal(await e.page.evaluate(() => window.__testWorkers.length), 0);
    assert.equal(
      await e.page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((r) => /pyodide|cdn.jsdelivr.net/.test(r.name))
      ),
      false
    );
    assert.ok((await e.page.locator(".token.keyword").count()) > 0);
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /Total: 255/);
    assert.equal(await e.page.evaluate(() => window.__testWorkers.length), 1);
    const workerURL = await e.page.evaluate(
      () =>
        performance.getEntriesByType("resource").find((r) => r.name.includes("pyodide-worker"))
          ?.name
    );
    const response = await e.context.request.get(workerURL || origin + "/pyodide-worker.js?v=18");
    const policy = response.headers()["content-security-policy"];
    assert.match(policy, /'wasm-unsafe-eval'/);
    assert.ok(!policy.includes("'unsafe-eval'"));
    await run(e.page); // Close the previous output.
    await code(
      e.page,
      'import js\ntry:\n    js.eval("1+1")\nexcept Exception:\n    print("JavaScript eval blocked")\nelse:\n    print("EVAL WAS ALLOWED")'
    );
    await run(e.page);
    await finished(e.page);
    assert.match(await output(e.page), /JavaScript eval blocked/);
    const blocked = await e.page.evaluate(async () => {
      const violations = [];
      document.addEventListener("securitypolicyviolation", (event) =>
        violations.push(event.effectiveDirective)
      );
      const script = document.createElement("script");
      script.textContent = "window.__inlineExecuted = true";
      document.body.appendChild(script);
      const remote = document.createElement("script");
      remote.src = "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/prism-core.min.js";
      document.body.appendChild(remote);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { executed: !!window.__inlineExecuted, violations };
    });
    assert.equal(blocked.executed, false);
    assert.ok(
      blocked.violations.filter((directive) => directive === "script-src-elem").length >= 2
    );
  } finally {
    await e.close();
  }
});
