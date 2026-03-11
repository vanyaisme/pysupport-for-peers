// pyodide-worker.js — Pyodide execution in a Web Worker (classic)
// Communicates with runner.js via postMessage + SharedArrayBuffer for blocking input()
//
// Security: CDN scripts are fetched and verified via crypto.subtle.digest (SHA-384)
// before execution. No CDN code runs without passing an integrity check.

const _createObjectURL = URL.createObjectURL.bind(URL);
const _revokeObjectURL = URL.revokeObjectURL.bind(URL);
const _cryptoDigest = crypto.subtle.digest.bind(crypto.subtle);
const _originalFetch = self.fetch;
const _fetch = fetch.bind(self);
const _importScripts = importScripts.bind(self);

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";

// SHA-384 integrity hashes for CDN-fetched scripts.
// Compute via: curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
const INTEGRITY = Object.freeze({
  "pyodide.mjs":
    "sha384-Iww9yGcV6enS7iZOc/arkzRoBL2UMCEwHsvc9CPwSlSSrbQC2K/OnwFh1GF5SUi5",
  "pyodide.asm.js":
    "sha384-H/2VLTcLlId+2q+XryOhG/nGawPSusslAGPNvqdOA4U5cHJX+UFEzL0fEM1jEf0b",
  "pyodide.asm.wasm":
    "sha384-W3dDz77bydlUojTtAGEnjta8TodphdFrtejY4+BmoIXgXs1o+W8t6byLJ71jkOyN",
});

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function fetchWithIntegrity(filename) {
  if (!Object.hasOwn(INTEGRITY, filename)) {
    throw new Error("No integrity hash for: " + filename);
  }
  const url = PYODIDE_CDN + filename;
  const res = await _fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const hashBuf = await _cryptoDigest("SHA-384", buf);
  const b64 = btoa(
    String.fromCharCode(
      ...Array.from(new Uint8Array(hashBuf), (byte) => byte)
    )
  );
  const computed = "sha384-" + b64;
  if (!timingSafeEqual(computed, INTEGRITY[filename])) {
    throw new Error(
      `Integrity check failed for ${filename}\nExpected: ${INTEGRITY[filename]}\nComputed: ${computed}`
    );
  }
  return buf;
}

async function verifyingFetch(input, init) {
  const url = typeof input === "string" ? input : input?.url || String(input);
  const matchedFilename = Object.keys(INTEGRITY).find((filename) =>
    url.endsWith(filename)
  );

  if (!matchedFilename) {
    return _originalFetch(input, init);
  }

  const resp = await _originalFetch(input, init);
  if (!resp.ok) return resp;

  const buf = await resp.arrayBuffer();
  const hashBuf = await _cryptoDigest("SHA-384", buf);
  const b64 = btoa(
    String.fromCharCode(
      ...Array.from(new Uint8Array(hashBuf), (byte) => byte)
    )
  );
  const computed = "sha384-" + b64;
  if (!timingSafeEqual(computed, INTEGRITY[matchedFilename])) {
    throw new Error(
      `Integrity check failed for ${matchedFilename}\nExpected: ${INTEGRITY[matchedFilename]}\nComputed: ${computed}`
    );
  }

  return new Response(buf, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}

async function loadVerifiedPyodide() {
  // Phase 1: Fetch and verify pyodide.asm.js, then load via importScripts(blobUrl).
  // This defines globalThis._createPyodideModule, which causes loadPyodide()
  // to skip its internal importScripts(CDN) call entirely.
  const asmBytes = await fetchWithIntegrity("pyodide.asm.js");
  const asmBlob = new Blob([asmBytes], { type: "application/javascript" });
  const asmUrl = _createObjectURL(asmBlob);
  try {
    _importScripts(asmUrl);
  } finally {
    _revokeObjectURL(asmUrl);
  }

  // Phase 2: Fetch and verify pyodide.mjs, then load via dynamic import(blobUrl).
  const mjsBytes = await fetchWithIntegrity("pyodide.mjs");
  const mjsBlob = new Blob([mjsBytes], { type: "application/javascript" });
  const mjsUrl = _createObjectURL(mjsBlob);
  try {
    const mod = await import(mjsUrl);
    return mod.loadPyodide;
  } finally {
    _revokeObjectURL(mjsUrl);
  }
}

const utf8Decoder = new TextDecoder();

// ── SharedArrayBuffer layout ──────────────────────────────────────────────────
// stdinSAB (Int32Array, 2 cells):
//   [0] flag:  0 = idle, 1 = worker waiting for input, 2 = main thread wrote data
//   [1] byteLength: how many bytes main thread wrote into dataSAB
// dataSAB (Uint8Array, 65536 bytes): raw UTF-8 bytes of user's input line
// ─────────────────────────────────────────────────────────────────────────────
let stdinView = null; // Int32Array over stdinSAB
let dataView = null; // Uint8Array  over dataSAB
let _currentRunId = 0;

// Stdout accumulation buffer — flushed on newline or when input() drains it
let stdoutBuf = "";
let interrupted = false;

// ── Message dispatch ──────────────────────────────────────────────────────────
self.onmessage = async (event) => {
  const { type } = event.data;
  if (type === "init") {
    const { stdinSAB, dataSAB } = event.data;
    stdinView = new Int32Array(stdinSAB);
    dataView = new Uint8Array(dataSAB);
    await initPyodide();
  } else if (type === "run") {
    _currentRunId = event.data.runId ?? 0;
    await runCode(event.data.code);
  } else if (type === "interrupt") {
    interrupted = true;
    // Also notify any blocked Atomics.wait so it can exit
    if (stdinView) Atomics.notify(stdinView, 0, 1);
  }
};

// ── Pyodide initialisation ────────────────────────────────────────────────────
let pyodide = null;

async function initPyodide() {
  try {
    const loadPyodide = await loadVerifiedPyodide();
    self.fetch = verifyingFetch;
    try {
      pyodide = await loadPyodide({
        indexURL: PYODIDE_CDN,
      });
    } finally {
      self.fetch = _originalFetch;
    }

    pyodide.setStdout({
      raw: (charCode) => {
        const ch = String.fromCharCode(charCode);
        stdoutBuf += ch;
        if (charCode === 10) flushStdout();
      },
    });

    // Stderr: forward immediately line by line
    let stderrBuf = "";
    pyodide.setStderr({
      raw: (charCode) => {
        const ch = String.fromCharCode(charCode);
        stderrBuf += ch;
        if (charCode === 10) {
          self.postMessage({
            type: "stderr",
            text: stderrBuf,
            runId: _currentRunId,
          });
          stderrBuf = "";
        }
      },
    });

    // ── Python bootstrap ──────────────────────────────────────────────────────
    // Write mock files that course snippets reference
    pyodide.FS.writeFile("my_text_file.txt", "Hello from my_text_file!\n");
    pyodide.FS.writeFile("some_data.txt", "alpha\nbeta\ngamma\n");
    pyodide.FS.writeFile("data.csv", "name,age\nAlice,30\nBob,25\n");
    pyodide.FS.writeFile("output.txt", "");
    pyodide.FS.writeFile("open.txt", "opened!\n");

    // Install the _run() helper into Python — namespace isolation + REPL repr + traceback filter
    // stdout capture is handled by pyodide.setStdout, NOT by _cap_out/_cap_err redirects
    pyodide.runPython(`
import ast, sys, traceback

def _run(code):
    ns = {}
    out_repr = None
    try:
        tree = ast.parse(code, mode='exec')
        # Pull last Expr node for REPL-style repr
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = tree.body.pop()
            exec(compile(tree, '<snippet>', 'exec'), ns)
            val = eval(compile(ast.Expression(body=last.value), '<snippet>', 'eval'), ns)
            if val is not None:
                out_repr = repr(val)
        else:
            exec(compile(tree, '<snippet>', 'exec'), ns)
    except SystemExit:
        pass
    except Exception:
        tb = traceback.format_exc()
        # Strip internal pyodide/snippet noise
        lines = tb.splitlines()
        filtered = []
        for line in lines:
            if 'File "<snippet>"' in line and 'in <module>' in line:
                filtered.append(line)
                continue
            if 'File "<snippet>"' in line:
                filtered.append(line)
                continue
            filtered.append(line)
        return ('', '\\n'.join(filtered) + '\\n', None)
    finally:
        try:
            del globals()['_result']
        except Exception:
            pass
        try:
            del globals()['_code_to_run']
        except Exception:
            pass
    return ('', '', out_repr)
`);

    // Matplotlib: monkey-patch plt.show to capture figures as base64 PNG
    // (only runs after matplotlib is loaded; re-applied lazily on first matplotlib run)
    pyodide.runPython(`
_show_imgs = []

def _cap_show():
    import io, base64
    import matplotlib.pyplot as _plt
    buf = io.BytesIO()
    _plt.savefig(buf, format='png', bbox_inches='tight')
    buf.seek(0)
    _show_imgs.append(base64.b64encode(buf.read()).decode())
    _plt.close('all')
`);

    self.postMessage({ type: "ready" });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: `Pyodide init failed: ${err.message}`,
      runId: _currentRunId,
    });
  }
}

// ── stdout flush helper ───────────────────────────────────────────────────────
function flushStdout() {
  if (!stdoutBuf) return;
  self.postMessage({ type: "stdout", text: stdoutBuf, runId: _currentRunId });
  stdoutBuf = "";
}

// ── stdin read (blocks via Atomics.wait) ──────────────────────────────────────
function stdinRead() {
  // Flush any pending stdout — this is the input() prompt
  flushStdout();

  Atomics.store(stdinView, 0, 1);
  self.postMessage({ type: "need_input", runId: _currentRunId });

  // Wait in 100 ms slices so interrupt can cancel us
  const deadline = Date.now() + 60_000;
  while (true) {
    if (interrupted) {
      // Clean up flag and throw so Python sees KeyboardInterrupt
      Atomics.store(stdinView, 0, 0);
      throw new Error("__interrupted__");
    }
    Atomics.wait(stdinView, 0, 1, 100);
    if (Atomics.load(stdinView, 0) === 2) break;
    if (Date.now() > deadline) {
      Atomics.store(stdinView, 0, 0);
      throw new Error("input() timed out after 60 s");
    }
  }

  if (interrupted) {
    Atomics.store(stdinView, 0, 0);
    throw new Error("__interrupted__");
  }

  const byteLen = Math.max(0, Math.min(Atomics.load(stdinView, 1), dataView.byteLength));
  const bytes = dataView.slice(0, byteLen);
  Atomics.store(stdinView, 0, 0);

  return utf8Decoder.decode(bytes);
}

// ── Package loader helper ─────────────────────────────────────────────────────
async function ensurePackage(name) {
  try {
    await pyodide.loadPackage(name);
  } catch (err) {
    const message = `Failed to load required package "${name}": ${err.message}`;
    self.postMessage({ type: "error", message, runId: _currentRunId });
    const packageLoadError = new Error(message);
    packageLoadError.packageLoadReported = true;
    throw packageLoadError;
  }
}

// ── Detection helpers (mirror runner.js detectType) ──────────────────────────
function detectType(code) {
  if (!code.trim()) return "empty";
  if (/^\s*!/m.test(code)) return "shell";
  if (/\bturtle\b/.test(code)) return "turtle";
  if (/\bsys\.argv\b/.test(code)) return "argv";
  if (/\binput\s*\(/.test(code)) return "input_fn";
  if (/\bmatplotlib\b|\bplt\./.test(code)) return "matplotlib";
  if (/\bscipy\b/.test(code)) return "scipy";
  if (/\bpandas\b|\bpd\./.test(code)) return "pandas";
  if (/open\s*\(|\.read\(|\.write\(/.test(code)) return "fileio";
  return "simple";
}

// ── Main run function ─────────────────────────────────────────────────────────
async function runCode(code) {
  interrupted = false;

  if (!pyodide) {
    self.postMessage({
      type: "error",
      message: "Pyodide not initialised yet.",
      runId: _currentRunId,
    });
    return;
  }

  stdoutBuf = "";

  try {
    const kind = detectType(code);

    if (kind === "empty") {
      self.postMessage({ type: "done", images: [], runId: _currentRunId });
      return;
    }
    if (kind === "shell") {
      self.postMessage({
        type: "toast",
        message: "Shell commands (!) are not supported in the browser.",
        runId: _currentRunId,
      });
      self.postMessage({ type: "done", images: [], runId: _currentRunId });
      return;
    }
    if (kind === "turtle") {
      self.postMessage({
        type: "toast",
        message: "Turtle graphics are not supported in the browser.",
        runId: _currentRunId,
      });
      self.postMessage({ type: "done", images: [], runId: _currentRunId });
      return;
    }

    if (kind === "matplotlib") await ensurePackage("matplotlib");
    if (kind === "scipy") {
      await ensurePackage("scipy");
      await ensurePackage("matplotlib");
    }
    if (kind === "pandas") await ensurePackage("pandas");

    // Install stdin override (uses JS stdinRead callback)
    pyodide.globals.set("_js_stdin_read", stdinRead);
    pyodide.runPython(`
import sys as _sys

class _WorkerStdin:
    def readline(self):
        line = _js_stdin_read()
        if not line.endswith('\\n'):
            line += '\\n'
        return line
    def read(self, n=-1):
        return self.readline()

_sys.stdin = _WorkerStdin()
`);

    if (kind === "matplotlib" || kind === "scipy") {
      pyodide.runPython(`
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as _plt
_plt.show = _cap_show
_show_imgs.clear()
`);
    }

    pyodide.globals.set("_code_to_run", code);
    pyodide.runPython(`_result = _run(_code_to_run)`);
    const result = pyodide.globals.get("_result");

    flushStdout();

    const stderr = result.get(1) || "";
    const reprVal = result.get(2);
    result.destroy();

    if (stderr)
      self.postMessage({ type: "stderr", text: stderr, runId: _currentRunId });
    if (reprVal)
      self.postMessage({
        type: "stdout",
        text: String(reprVal) + "\n",
        runId: _currentRunId,
      });

    let images = [];
    if (kind === "matplotlib" || kind === "scipy") {
      const imgs = pyodide.globals.get("_show_imgs");
      images = imgs.toJs();
      imgs.destroy();
    }

    self.postMessage({ type: "done", images, runId: _currentRunId });
  } catch (err) {
    flushStdout();
    if (err.message === "__interrupted__") {
      self.postMessage({
        type: "stderr",
        text: "KeyboardInterrupt\n",
        runId: _currentRunId,
      });
      self.postMessage({ type: "done", images: [], runId: _currentRunId });
    } else if (err.packageLoadReported) {
      return;
    } else {
      self.postMessage({
        type: "error",
        message: err.message,
        runId: _currentRunId,
      });
    }
  }
}
