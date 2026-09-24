const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Runtime } = require("./runtime-client.cjs");
const { examples } = require("./example-cases.cjs");

test(
  "every browser example runs independently with declared inputs and expected errors",
  { timeout: 180000 },
  async (t) => {
    const runtime = new Runtime({ resetFixtures: true });
    const corpus = examples();
    assert.equal(corpus.length, 261);
    assert.equal(new Set(corpus.map((e) => e.id)).size, 261);
    try {
      for (const example of corpus) {
        if (example.mode !== "browser") {
          await t.test(example.id + " explicitly " + example.mode, () => {
            assert.ok(example.code.trim());
          });
          continue;
        }
        await t.test(example.id, async () => {
          const r = await runtime.run(example.code, example);
          if (example.expectedError) assert.match(r.stderr, new RegExp(example.expectedError));
          else assert.equal(r.stderr, "", "Unexpected exception or warning");
          if (example.index === 16)
            assert.equal(r.stdout, "Total: 255   Approx. average: 85\nHello, World\n30\n");
          if (example.index === 209) assert.match(r.stdout, /Hi Carol, Bob, and Alice/);
          if (example.index === 225) assert.match(r.stdout, /120/);
          if (example.index === 250) assert.match(r.stdout, /21\.60/);
          if (example.index === 258) assert.match(r.stdout, /Excellent!/);
          if (example.index === 260) {
            assert.equal(r.images.length, 2);
            assert.match(r.stdout, /r = .*p = /);
          }
        });
      }
    } finally {
      await runtime.close();
    }
  }
);

test(
  "browser examples also work in reverse order with a shared filesystem",
  { timeout: 180000 },
  async () => {
    const runtime = new Runtime();
    try {
      for (const example of examples()
        .filter((e) => e.mode === "browser")
        .reverse()) {
        const result = await runtime.run(example.code, example);
        if (example.expectedError)
          assert.match(result.stderr, new RegExp(example.expectedError), example.id);
        else assert.equal(result.stderr, "", example.id + " failed after earlier file mutations");
      }
    } finally {
      await runtime.close();
    }
  }
);

test(
  "all Python examples, including local-only ones, have valid Python syntax",
  { timeout: 30000 },
  async () => {
    const runtime = new Runtime();
    try {
      const corpus = examples()
        .filter((e) => e.mode !== "shell")
        .map((e) => [e.id, e.code]);
      const result = await runtime.run(
        "import ast, json\nfor name, code in json.loads(" +
          JSON.stringify(JSON.stringify(corpus)) +
          "):\n    ast.parse(code, filename=name)\nprint('syntax OK')"
      );
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, "syntax OK\n");
    } finally {
      await runtime.close();
    }
  }
);

test("displayed z-score example produces centred, unit sample deviation scores", async () => {
  const runtime = new Runtime();
  try {
    const example = examples().find((entry) => entry.id === "ex-136");
    const result = await runtime.run(
      example.code + "\nprint('ZSCORE_CHECK', df['rt_z'].mean(), df['rt_z'].std())"
    );
    assert.equal(result.stderr, "");
    const match = result.stdout.match(/ZSCORE_CHECK ([^ ]+) ([^\n]+)/);
    assert.ok(match, result.stdout);
    assert.ok(Math.abs(Number(match[1])) < 1e-12);
    assert.ok(Math.abs(Number(match[2]) - 1) < 1e-12);
  } finally {
    await runtime.close();
  }
});
