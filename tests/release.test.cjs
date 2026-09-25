const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { buildRelease, integrity } = require("../scripts/build-release.cjs");
const root = path.join(__dirname, "..");

function serviceWorker({ fail = false } = {}) {
  const handlers = {};
  const stores = new Map([
    ["unrelated-app", new Map()],
    ["python-guide-v15", new Map()],
  ]);
  const key = (request) =>
    new URL(typeof request === "string" ? request : request.url, "https://test.local").href;
  const requests = [];
  const caches = {
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const values = stores.get(name);
      return {
        async addAll(entries) {
          requests.push(...entries);
          if (fail) throw new Error("Failed required asset");
          for (const entry of entries) values.set(key(entry), new Response(key(entry)));
        },
        async match(request) {
          return values.get(key(request))?.clone();
        },
        async put(request, response) {
          values.set(key(request), response);
        },
      };
    },
  };
  const scope = {
    URL,
    Request,
    Response,
    Headers,
    Set,
    caches,
    fetch: async () => {
      throw new Error("offline");
    },
    self: {
      location: new URL("https://test.local/sw.js"),
      addEventListener: (type, fn) => {
        handlers[type] = fn;
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "sw.js"), "utf8"), scope);
  return {
    stores,
    requests,
    async lifecycle(type) {
      let pending;
      handlers[type]({
        waitUntil(promise) {
          pending = promise;
        },
      });
      return pending;
    },
    fetch(url, mode = "navigate", method = "GET") {
      let response;
      handlers.fetch({
        request: { url: "https://test.local" + url, mode, method },
        respondWith(value) {
          response = value;
        },
      });
      return response;
    },
  };
}

test("offline root/query navigation uses the installed app shell after a single visit", async () => {
  const sw = serviceWorker();
  await sw.lifecycle("install");
  await sw.lifecycle("activate");
  for (const route of ["/", "/?source=pwa", "/index.html"])
    assert.equal(await (await sw.fetch(route)).text(), "https://test.local/index.html");
  assert.ok(sw.requests.every((request) => request.cache === "reload"));
  assert.equal(sw.fetch("/unknown"), undefined);
  assert.equal(sw.fetch("/", "navigate", "POST"), undefined);
});

test("failed critical precache rejects installation and preserves the previous cache", async () => {
  const sw = serviceWorker({ fail: true });
  await assert.rejects(sw.lifecycle("install"), /Failed required asset/);
  assert.ok(sw.stores.has("python-guide-v15"));
  assert.equal(sw.stores.get("python-guide-v19").size, 0);
});

test("activation only deletes this application's old caches", async () => {
  const sw = serviceWorker();
  await sw.lifecycle("install");
  await sw.lifecycle("activate");
  assert.deepEqual([...sw.stores.keys()].sort(), ["python-guide-v19", "unrelated-app"]);
  assert.equal((await sw.fetch("/style.css?v=19", "cors")).status, 200);
  assert.equal(sw.fetch("/style.css?v=15", "cors"), undefined);
});

test("release build fingerprints runtime dependencies and verifies every precached byte", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pysupport-build-"));
  try {
    const release = buildRelease(temp);
    assert.deepEqual(buildRelease(temp), release, "unchanged sources produce an identical release");
    for (const asset of release.assets) {
      const file = path.join(temp, new URL(asset.url, "https://test.local").pathname);
      assert.equal(integrity(fs.readFileSync(file)), asset.integrity);
    }
    const html = fs.readFileSync(path.join(temp, "index.html"), "utf8");
    assert.doesNotMatch(html, /(?:runner\.js|style\.css)\?v=/);
    const runnerAsset = release.assets.find((asset) => asset.url.includes("/runner."));
    const workerAsset = release.assets.find((asset) => asset.url.includes("/pyodide-worker."));
    assert.ok(html.includes(runnerAsset.url));
    assert.ok(fs.readFileSync(path.join(temp, runnerAsset.url), "utf8").includes(workerAsset.url));
    const sw = fs.readFileSync(path.join(temp, "sw.js"), "utf8");
    assert.ok(sw.includes(release.id));
    assert.ok(sw.includes(workerAsset.integrity));
    for (const name of ["node_modules", "tests", ".git", "package.json"])
      assert.equal(fs.existsSync(path.join(temp, name)), false);
    const changed = buildRelease(temp, (name) => {
      const bytes = fs.readFileSync(path.join(root, name));
      return name === "pyodide-worker.js" ? bytes + "\n// next release\n" : bytes;
    });
    assert.notEqual(changed.id, release.id);
    assert.notEqual(
      changed.assets.find((asset) => asset.url.includes("/runner.")).url,
      runnerAsset.url
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("operator table's equivalent expressions agree with its displayed result", () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  try {
    const title = [...dom.window.document.querySelectorAll(".scenario-title")].find((el) =>
      el.textContent.includes("Augmented")
    );
    const rows = [...title.closest(".scenario").querySelectorAll("tr")].slice(1);
    assert.equal(rows.length, 7);
    for (const row of rows) {
      const [operator, equivalent, , result] = [...row.querySelectorAll("td")].map((el) =>
        el.textContent.trim()
      );
      const match = operator.match(/^x (\S+)= (\d+)$/);
      assert.ok(match, operator);
      assert.equal(equivalent, `x = x ${match[1]} ${match[2]}`);
      const n = Number(match[2]);
      const operations = {
        "+": () => 10 + n,
        "-": () => 10 - n,
        "*": () => 10 * n,
        "/": () => 10 / n,
        "//": () => Math.floor(10 / n),
        "%": () => 10 % n,
        "**": () => 10 ** n,
      };
      assert.equal(operations[match[1]](), Number(result));
    }
  } finally {
    dom.window.close();
  }
});

test("document restrictions, local Prism provenance and offline inclusion stay consistent", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const document = new JSDOM(html).window.document;
  const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
  assert.match(policy, /script-src 'self';/);
  assert.doesNotMatch(policy, /'unsafe-eval'|script-src[^;]*'unsafe-inline'/);
  assert.ok(fs.readFileSync(path.join(root, "_headers"), "utf8").includes(policy));
  assert.equal(document.querySelectorAll('script[src^="https:"]').length, 0);
  assert.equal(document.querySelectorAll("[onload]").length, 0);
  const expected =
    "/*! PrismJS 1.30.0 — MIT license; see prism-LICENSE.txt. */\n" +
    ["core", "python", "bash"]
      .map((part) =>
        fs.readFileSync(
          path.join(root, "node_modules/prismjs/components/prism-" + part + ".js"),
          "utf8"
        )
      )
      .join("\n");
  assert.equal(fs.readFileSync(path.join(root, "vendor/prism.js"), "utf8"), expected);
  assert.equal(
    fs.readFileSync(path.join(root, "vendor/prism-LICENSE.txt"), "utf8"),
    fs.readFileSync(path.join(root, "node_modules/prismjs/LICENSE"), "utf8")
  );
});
