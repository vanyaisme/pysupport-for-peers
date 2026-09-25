const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const playwright = require("playwright");
const browserName = process.env.TEST_BROWSER || "chromium";
const { buildRelease } = require("../scripts/build-release.cjs");
const { createPreview } = require("../scripts/preview-release.cjs");
const { smoke } = require("../scripts/smoke-deploy.cjs");
const root = path.join(__dirname, "..");
let browser, temp, first, second, release1, release2;

before(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "pysupport-browser-"));
  first = path.join(temp, "first");
  second = path.join(temp, "second");
  release1 = buildRelease(first);
  release2 = buildRelease(second, (name) => {
    const bytes = fs.readFileSync(path.join(root, name));
    if (name === "index.html")
      return bytes.toString().replace("<title>", "<title>Updated release — ");
    if (name === "pyodide-worker.js") return bytes + "\n// Updated release fixture\n";
    return bytes;
  });
  browser = await playwright[browserName].launch({
    executablePath:
      browserName === "chromium" ? process.env.CHROMIUM_EXECUTABLE_PATH || undefined : undefined,
    headless: true,
  });
});
after(async () => {
  await browser?.close();
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
});

async function environment({ fail = "", corrupt = false } = {}) {
  let folder = first;
  const server = createPreview(
    () => folder,
    (request, response) => {
      if (!fail || !request.url.includes(fail)) return false;
      response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      response.setHeader("Content-Type", "image/png");
      response.writeHead(corrupt ? 200 : 503).end(corrupt ? "corrupt bytes" : "Unavailable");
      return true;
    }
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext();
  // Use exact pinned runtime bytes; the deployed worker still verifies their SRI.
  await context.route("https://cdn.jsdelivr.net/pyodide/v0.29.3/full/**", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    const file = path.join(path.dirname(require.resolve("pyodide")), name);
    assert.ok(fs.existsSync(file), "Missing pinned runtime: " + name);
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
  await context.route("https://cdn.jsdelivr.net/npm/prismjs@1.30.0/**", (route) =>
    route.fulfill({
      path: path.join(
        path.dirname(require.resolve("prismjs/package.json")),
        new URL(route.request().url()).pathname.split("/prismjs@1.30.0/")[1]
      ),
      contentType: "application/javascript",
      headers: { "access-control-allow-origin": "*" },
    })
  );
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ body: "", contentType: "text/css" })
  );
  const page = await context.newPage();
  await page.goto(origin);
  return {
    context,
    page,
    origin,
    next() {
      folder = second;
    },
    fail(name, damaged = false) {
      fail = name;
      corrupt = damaged;
    },
    async close() {
      await context.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
async function installed(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}
async function ready(page) {
  await page.locator("#floatingPythonReset").evaluate((el) => el.click());
  await page.waitForFunction(() => document.querySelector(".run-btn")?.disabled === false, null, {
    timeout: 45000,
  });
}
const example = (page, id) =>
  page.locator(".code-wrapper").filter({ has: page.locator(`[data-example-id="${id}"]`) });

test("first visit prepares offline reading, icons and isolation; local release smoke passes", async () => {
  const e = await environment();
  try {
    await installed(e.page);
    await e.page.evaluate(async () => {
      await caches.open("unrelated-app");
    });
    await smoke(e.origin);
    const onlineTitle = await e.page.title();
    assert.ok(onlineTitle.trim(), "the online page must have a title");
    await e.context.setOffline(true);
    await e.page.goto(e.origin + "/?from=offline");
    assert.equal(await e.page.title(), onlineTitle);
    assert.equal(await e.page.evaluate(() => crossOriginIsolated), true);
    assert.equal(await e.page.evaluate(async () => (await fetch("/icon-192.png")).status), 200);
    assert.equal(await e.page.locator(".run-btn").count(), 261);
    assert.ok((await e.page.locator(".token.keyword").count()) > 0, "highlighting works offline");
  } finally {
    await e.close();
  }
});

for (const corrupt of [false, true])
  test(`${corrupt ? "corrupt" : "missing"} critical asset rejects the actual browser installation`, async () => {
    const e = await environment({ fail: "icon-512.png", corrupt });
    try {
      const state = await e.page.evaluate(async () => {
        const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        const worker = reg.installing;
        if (!worker) return reg.active ? "activated" : "redundant";
        return new Promise((resolve) => {
          worker.addEventListener("statechange", () => {
            if (["redundant", "activated"].includes(worker.state)) resolve(worker.state);
          });
        });
      });
      assert.equal(state, "redundant");
      const entries = await e.page.evaluate(async () => {
        const keys = await caches.keys();
        return Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).length));
      });
      assert.ok(entries.every((count) => count === 0));
    } finally {
      await e.close();
    }
  });

test("update waits during Python input; old tabs stay coherent, then new release activates", async () => {
  const e = await environment();
  try {
    await installed(e.page);
    await e.page.reload();
    await ready(e.page);
    await e.page.evaluate(async () => {
      await caches.open("unrelated-app");
    });
    await example(e.page, "ex-006")
      .getByRole("button", { name: "Run Python code", exact: true })
      .click();
    await e.page.getByRole("textbox", { name: "Python input()" }).waitFor();
    e.next();
    const newWorker = e.context.waitForEvent("serviceworker");
    await e.page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    const updated = await newWorker;
    await e.page.locator(".site-update-status").waitFor();
    assert.equal(await e.page.getByRole("textbox", { name: "Python input()" }).count(), 1);
    await e.page.getByRole("textbox", { name: "Python input()" }).fill("Zoë 🧠");
    await e.page.getByRole("textbox", { name: "Python input()" }).press("Enter");
    await e.page.getByRole("textbox", { name: "Python input()" }).fill("21");
    await e.page.getByRole("textbox", { name: "Python input()" }).press("Enter");
    await e.page.getByText("In 10 years you will be 31", { exact: false }).waitFor();
    const other = await e.context.newPage();
    await other.goto(e.origin);
    assert.ok(!(await other.title()).startsWith("Updated release"));
    await e.context.setOffline(true);
    await other.reload();
    assert.ok(!(await other.title()).startsWith("Updated release"));
    const firstRunner = release1.assets.find((asset) => asset.url.includes("/runner.")).url;
    assert.ok(await other.locator(`script[src="${firstRunner}"]`).count());
    const activation = updated.evaluate(
      () =>
        new Promise((resolve) =>
          self.addEventListener("activate", () => resolve(true), { once: true })
        )
    );
    await e.page.close();
    await other.close();
    await activation;
    await e.context.setOffline(false);
    const monitor = await e.context.newPage();
    await monitor.goto(e.origin);
    assert.ok((await monitor.title()).startsWith("Updated release"));
    await ready(monitor);
    await example(monitor, "ex-016")
      .getByRole("button", { name: "Run Python code", exact: true })
      .click();
    await monitor.getByText("Total: 255", { exact: false }).last().waitFor();
    const cachesLeft = await monitor.evaluate(() => caches.keys());
    assert.ok(cachesLeft.includes("unrelated-app"));
    assert.ok(cachesLeft.includes("python-guide-" + release2.id));
    assert.ok(!cachesLeft.includes("python-guide-" + release1.id));
  } finally {
    await e.close();
  }
});

test("failed upgrade retains the working release and a later retry installs successfully", async () => {
  const e = await environment();
  try {
    await installed(e.page);
    await e.page.reload();
    e.next();
    e.fail("icon-512.png");
    const rejected = await e.page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const result = new Promise((resolve) =>
        reg.addEventListener(
          "updatefound",
          () => {
            const worker = reg.installing;
            worker.addEventListener("statechange", () => {
              if (["redundant", "installed"].includes(worker.state)) resolve(worker.state);
            });
          },
          { once: true }
        )
      );
      await reg.update();
      return result;
    });
    assert.equal(rejected, "redundant");
    await e.context.setOffline(true);
    await e.page.reload();
    assert.ok(!(await e.page.title()).startsWith("Updated release"));
    assert.ok((await e.page.evaluate(() => caches.keys())).includes("python-guide-" + release1.id));
    await e.context.setOffline(false);
    e.fail("");
    await e.page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await e.page.locator(".site-update-status").waitFor();
  } finally {
    await e.close();
  }
});

test("evicted assets recover only when network bytes match the installed release", async () => {
  const e = await environment();
  try {
    await installed(e.page);
    await e.page.reload();
    const icon = "/icon-192.png";
    await e.page.evaluate(
      async ({ id, icon }) => {
        await (await caches.open("python-guide-" + id)).delete(icon);
      },
      { id: release1.id, icon }
    );
    assert.equal(await e.page.evaluate(async (icon) => (await fetch(icon)).status, icon), 200);
    await e.page.evaluate(
      async ({ id, icon }) => {
        await (await caches.open("python-guide-" + id)).delete(icon);
      },
      { id: release1.id, icon }
    );
    e.fail("icon-192.png", true);
    assert.equal(await e.page.evaluate(async (icon) => (await fetch(icon)).status, icon), 503);
    assert.equal(
      await e.page.evaluate(
        async ({ id, icon }) => !!(await (await caches.open("python-guide-" + id)).match(icon)),
        { id: release1.id, icon }
      ),
      false
    );
  } finally {
    await e.close();
  }
});
