const { Worker } = require("node:worker_threads");
const path = require("node:path");
class Runtime {
  constructor({ resetFixtures = false } = {}) {
    this.stdin = new Int32Array(new SharedArrayBuffer(8));
    this.bytes = new Uint8Array(new SharedArrayBuffer(65536));
    this.interrupt = new Uint8Array(new SharedArrayBuffer(1));
    this.cancel = new Int32Array(new SharedArrayBuffer(4));
    this.worker = new Worker(path.join(__dirname, "worker-node.cjs"), {
      workerData: { resetFixtures },
    });
    this.runId = 0;
    this.ready = new Promise((resolve, reject) => {
      this.worker.on("error", reject);
      this.worker.on("message", (data) => {
        if (data.type === "ready") resolve();
        if (["init_error", "adapter_error"].includes(data.type)) reject(new Error(data.message));
      });
    });
    this.worker.postMessage({
      type: "init",
      protocolVersion: 2,
      stdinSAB: this.stdin.buffer,
      dataSAB: this.bytes.buffer,
      interruptSAB: this.interrupt.buffer,
      cancelSAB: this.cancel.buffer,
    });
  }
  stop() {
    Atomics.store(this.cancel, 0, 1);
    Atomics.store(this.interrupt, 0, 2);
    Atomics.notify(this.stdin, 0);
  }
  input(value) {
    const bytes = new TextEncoder().encode(value + "\n");
    this.bytes.set(bytes);
    Atomics.store(this.stdin, 1, bytes.length);
    Atomics.store(this.stdin, 0, 2);
    Atomics.notify(this.stdin, 0);
  }
  async run(code, { args = [], inputs = [], onInput, timeout = 20000 } = {}) {
    await this.ready;
    Atomics.store(this.cancel, 0, 0);
    Atomics.store(this.interrupt, 0, 0);
    Atomics.store(this.stdin, 0, 0);
    const runId = ++this.runId;
    const messages = [];
    let inputIndex = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stop();
        cleanup();
        reject(new Error("Execution timed out"));
      }, timeout);
      const cleanup = () => {
        clearTimeout(timer);
        this.worker.off("message", handler);
      };
      const handler = (message) => {
        if (message.type === "adapter_error") {
          cleanup();
          reject(new Error(message.message));
          return;
        }
        if (message.runId !== runId) return;
        messages.push(message);
        if (message.type === "need_input") {
          if (onInput) onInput(this, inputIndex++);
          else if (inputIndex < inputs.length) this.input(inputs[inputIndex++]);
          else {
            this.stop();
          }
        }
        if (message.type === "done" || message.type === "error") {
          cleanup();
          resolve({
            messages,
            stdout: messages
              .filter((m) => m.type === "stdout")
              .map((m) => m.text)
              .join(""),
            stderr: messages
              .filter((m) => m.type === "stderr" || m.type === "error")
              .map((m) => m.text || m.message)
              .join(""),
            images: message.images || [],
            files: message.files || [],
            filesTruncated: message.filesTruncated || false,
            inputCount: inputIndex,
          });
        }
      };
      this.worker.on("message", handler);
      this.worker.postMessage({ type: "run", code, args: ["snippet.py", ...args], runId });
    });
  }
  close() {
    return this.worker.terminate();
  }
}
module.exports = { Runtime };
