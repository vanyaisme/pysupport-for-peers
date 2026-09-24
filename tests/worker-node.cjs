// Node adapter for testing the production execution logic with real Pyodide.
// Browser tests separately exercise the unmodified integrity-verified CDN loader.
const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { loadPyodide } = require("pyodide");
let runtime;
let fixtures = new Map();
const scope = {
  URL,
  performance,
  crypto: webcrypto,
  fetch,
  importScripts() {},
  TextDecoder,
  TextEncoder,
  Response,
  Blob,
  btoa,
  console,
  SharedArrayBuffer,
  Atomics,
  postMessage: (message) => parentPort.postMessage(message),
  async testLoad() {
    runtime = await loadPyodide({
      indexURL: path.dirname(require.resolve("pyodide")),
      packageCacheDir: process.env.PYODIDE_CACHE_DIR || path.dirname(require.resolve("pyodide")),
    });
    return runtime;
  },
};
scope.self = scope;
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "pyodide-worker.js"), "utf8"), scope);
vm.runInContext("loadVerifiedPyodide = async () => testLoad;", scope);
parentPort.on("message", async (data) => {
  try {
    if (data.type === "run" && workerData?.resetFixtures) {
      for (const [file, contents] of fixtures) runtime.FS.writeFile(file, contents);
    }
    await scope.onmessage({ data });
    if (data.type === "init" && runtime) {
      fixtures = new Map(
        runtime.FS.readdir(".")
          .filter((name) => runtime.FS.isFile(runtime.FS.stat(name).mode))
          .map((name) => [name, runtime.FS.readFile(name)])
      );
    }
  } catch (error) {
    parentPort.postMessage({ type: "adapter_error", message: error.stack });
  }
});
