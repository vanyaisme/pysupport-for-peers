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
  "pyodide.mjs": "sha384-Iww9yGcV6enS7iZOc/arkzRoBL2UMCEwHsvc9CPwSlSSrbQC2K/OnwFh1GF5SUi5",
  "pyodide.asm.js": "sha384-H/2VLTcLlId+2q+XryOhG/nGawPSusslAGPNvqdOA4U5cHJX+UFEzL0fEM1jEf0b",
  "pyodide.asm.wasm": "sha384-W3dDz77bydlUojTtAGEnjta8TodphdFrtejY4+BmoIXgXs1o+W8t6byLJ71jkOyN",
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
  const b64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(hashBuf), (byte) => byte)));
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
  const matchedFilename = Object.keys(INTEGRITY).find((filename) => url.endsWith(filename));

  if (!matchedFilename) {
    return _originalFetch(input, init);
  }

  const resp = await _originalFetch(input, init);
  if (!resp.ok) return resp;

  const buf = await resp.arrayBuffer();
  const hashBuf = await _cryptoDigest("SHA-384", buf);
  const b64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(hashBuf), (byte) => byte)));
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

const PROTOCOL_VERSION = 2;
const utf8Decoder = new TextDecoder();
let stdinView;
let dataView;
let interruptView;
let cancelView;
let pyodide = null;
let busy = false;
let _currentRunId = 0;
let stdoutBuf = "";
let stderrBuf = "";
let stdoutDecoder = new TextDecoder();
let stderrDecoder = new TextDecoder();
const OUTPUT_LIMIT = 100_000;
let outputLength = 0;
let outputMessages = 0;
let outputTruncated = false;
let lastOutputAt = 0;

function sendOutput(type, text) {
  if (!busy || !text || outputTruncated) return;
  const remaining = outputMessages < 1000 ? OUTPUT_LIMIT - outputLength : 0;
  if (remaining > 0) {
    const kept = text.slice(0, remaining);
    self.postMessage({ type, text: kept, runId: _currentRunId });
    outputLength += kept.length;
    outputMessages += 1;
    lastOutputAt = performance.now();
  }
  if (text.length > remaining) {
    outputTruncated = true;
    self.postMessage({ type: "output_truncated", runId: _currentRunId });
  }
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      if (data.protocolVersion !== PROTOCOL_VERSION)
        throw new Error("Python files are from different releases. Please reload.");
      stdinView = new Int32Array(data.stdinSAB);
      dataView = new Uint8Array(data.dataSAB);
      interruptView = new Uint8Array(data.interruptSAB);
      cancelView = new Int32Array(data.cancelSAB);
      await initPyodide();
      self.postMessage({ type: "ready", protocolVersion: PROTOCOL_VERSION });
    } catch (err) {
      self.postMessage({ type: "init_error", message: "Python could not load. " + err.message });
    }
  } else if (data.type === "run") {
    if (busy) return;
    busy = true;
    _currentRunId = data.runId;
    try {
      await runCode(data.code, data.args || ["snippet.py"]);
    } finally {
      busy = false;
    }
  }
};

async function initPyodide() {
  const loadPyodide = await loadVerifiedPyodide();
  self.fetch = verifyingFetch;
  try {
    pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
  } finally {
    self.fetch = _originalFetch;
  }
  pyodide.setInterruptBuffer(interruptView);
  pyodide.setStdout({
    write(bytes) {
      flushStderr();
      if (!outputTruncated) stdoutBuf += stdoutDecoder.decode(bytes, { stream: true });
      if (
        stdoutBuf.includes("\n") ||
        stdoutBuf.length >= 4096 ||
        performance.now() - lastOutputAt >= 50
      )
        flushStdout();
      return bytes.length;
    },
  });
  pyodide.setStderr({
    write(bytes) {
      flushStdout();
      if (!outputTruncated) stderrBuf += stderrDecoder.decode(bytes, { stream: true });
      if (
        stderrBuf.includes("\n") ||
        stderrBuf.length >= 4096 ||
        performance.now() - lastOutputAt >= 50
      )
        flushStderr();
      return bytes.length;
    },
  });

  // Synthetic course fixtures live only in this worker's in-memory filesystem.
  const fixtures = {
    "my_text_file.txt": Array.from({ length: 15 }, (_, i) => i + 1).join("\n") + "\n",
    "rt_data.txt": "412.0\n378.5\n445.2\n390.1\n",
    "some_data.txt": "name,address,house_number\nAlice,Main St,10\nBob,Broad St,25\n",
    "data.csv": "name,age\nAlice,30\nBob,25\n",
    "participants.csv":
      "participant_id,condition,rt_ms\nP01,control,412\nP02,experimental,378\nP03,control,445\n",
    "words.txt": "apple\nbanana\ncherry\ndog\ncat\n",
    "file.txt": "3\n1\n2\n",
    "output.txt": "",
  };
  const eeg =
    Array.from({ length: 50 }, (_, i) =>
      Array.from({ length: 8 }, (_, channel) =>
        (Math.sin(i * 0.12 + channel * 0.25) + channel * 0.1).toFixed(6)
      ).join(" ")
    ).join("\n") + "\n";
  fixtures["open.txt"] = eeg;
  fixtures["closed.txt"] = eeg;
  fixtures["eeg_data.txt"] = eeg;
  for (const [name, content] of Object.entries(fixtures)) pyodide.FS.writeFile(name, content);

  pyodide.globals.set("_js_stdin_read", stdinRead);
  pyodide.runPython(`
import ast, sys, traceback, json

class _WorkerStdin:
    def readline(self, size=-1):
        line = _js_stdin_read()
        return line if size < 0 else line[:size]
    def isatty(self):
        return True

def _run(code, args_json):
    ns = {"__name__": "__main__"}
    previous_argv, previous_stdin = sys.argv, sys.stdin
    sys.argv = json.loads(args_json)
    sys.stdin = _WorkerStdin()
    try:
        tree = ast.parse(code, mode='exec')
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = tree.body.pop()
            exec(compile(tree, '<snippet>', 'exec'), ns)
            value = eval(compile(ast.Expression(body=last.value), '<snippet>', 'eval'), ns)
            return ('', repr(value) if value is not None else None)
        exec(compile(tree, '<snippet>', 'exec'), ns)
        return ('', None)
    except KeyboardInterrupt:
        return ('KeyboardInterrupt\\n', None)
    except SystemExit:
        return ('', None)
    except Exception:
        return (traceback.format_exc(), None)
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
        sys.argv, sys.stdin = previous_argv, previous_stdin

_show_imgs = []
_plot_bytes = 0
_plots_truncated = False

def _cap_show(*args, **kwargs):
    global _plot_bytes, _plots_truncated
    import io, base64
    import matplotlib.pyplot as plt
    for number in plt.get_fignums():
        figure = plt.figure(number)
        try:
            width, height = figure.get_size_inches() * figure.dpi
            if len(_show_imgs) >= 5 or width * height > 4_000_000 or _plot_bytes >= 8_000_000:
                _plots_truncated = True
                continue
            with io.BytesIO() as buf:
                # Fixed canvas dimensions avoid enormous tight bounding boxes from outlying labels.
                with plt.rc_context({'savefig.bbox': None}):
                    figure.savefig(buf, format='png', dpi=figure.dpi)
                encoded = base64.b64encode(buf.getvalue()).decode()
                if len(encoded) > 2_000_000 or _plot_bytes + len(encoded) > 8_000_000:
                    _plots_truncated = True
                    continue
                _show_imgs.append(encoded)
                _plot_bytes += len(encoded)
        finally:
            plt.close(figure)
`);
}

function flushStdout() {
  sendOutput("stdout", stdoutBuf);
  stdoutBuf = "";
}

function flushStderr() {
  sendOutput("stderr", stderrBuf);
  stderrBuf = "";
}

function checkCancelled() {
  if (!Atomics.load(cancelView, 0)) return;
  // A persistent flag survives CPython consuming/resetting its interrupt byte.
  Atomics.store(interruptView, 0, 2);
  pyodide.checkInterrupt();
}

function stdinRead() {
  flushStdout();
  flushStderr();
  checkCancelled();
  Atomics.store(stdinView, 0, 1);
  self.postMessage({ type: "need_input", runId: _currentRunId });
  try {
    while (Atomics.load(stdinView, 0) !== 2) {
      checkCancelled();
      Atomics.wait(stdinView, 0, 1, 100);
    }
    checkCancelled();
    const length = Atomics.load(stdinView, 1);
    if (length < 0 || length > dataView.length) throw new Error("Invalid input length");
    return utf8Decoder.decode(dataView.slice(0, length));
  } finally {
    Atomics.store(stdinView, 0, 0);
  }
}

async function runCode(code, args) {
  outputLength = 0;
  outputMessages = 0;
  outputTruncated = false;
  lastOutputAt = performance.now();
  stdoutBuf = "";
  stderrBuf = "";
  stdoutDecoder = new TextDecoder();
  stderrDecoder = new TextDecoder();
  let result;
  let imagesProxy;
  let usesPlots = false;
  let terminalMessage;
  try {
    if (!pyodide) throw new Error("Python is not ready. Please retry.");
    checkCancelled();
    await pyodide.loadPackagesFromImports(code, { messageCallback: () => {} });
    checkCancelled();
    usesPlots = Object.hasOwn(pyodide.loadedPackages, "matplotlib");
    if (usesPlots) {
      pyodide.runPython(`
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as _plt
_plt.close('all')
_plt.show = _cap_show
_show_imgs.clear()
_plot_bytes = 0
_plots_truncated = False
`);
    }
    pyodide.globals.set("_code_to_run", code);
    pyodide.globals.set("_args_json", JSON.stringify(args));
    result = pyodide.runPython("_run(_code_to_run, _args_json)");
    flushStdout();
    flushStderr();
    const error = result.get(0);
    const repr = result.get(1);
    if (error) sendOutput("stderr", error);
    if (repr !== undefined && repr !== null) sendOutput("stdout", repr + "\n");
    let images = [];
    if (usesPlots) {
      imagesProxy = pyodide.globals.get("_show_imgs");
      images = imagesProxy.toJs();
    }
    terminalMessage = {
      type: "done",
      images,
      runId: _currentRunId,
      plotsTruncated: usesPlots && Boolean(pyodide.globals.get("_plots_truncated")),
      errorMessage: outputTruncated && error ? error.slice(0, 4000) : "",
    };
  } catch (err) {
    if (cancelView && Atomics.load(cancelView, 0)) {
      terminalMessage = { type: "error", message: "KeyboardInterrupt", runId: _currentRunId };
    } else {
      terminalMessage = {
        type: "error",
        message: err.message || String(err),
        runId: _currentRunId,
      };
    }
  } finally {
    // Clear pending signals before cleanup; the next run has its own cancellation state.
    if (interruptView) Atomics.store(interruptView, 0, 0);
    result?.destroy();
    imagesProxy?.destroy();
    if (pyodide) {
      pyodide.globals.delete("_code_to_run");
      pyodide.globals.delete("_args_json");
      if (usesPlots) pyodide.runPython("_plt.close('all'); _show_imgs.clear()");
    }
    stdoutBuf += stdoutDecoder.decode();
    stderrBuf += stderrDecoder.decode();
    flushStdout();
    flushStderr();
  }
  self.postMessage(terminalMessage);
}
