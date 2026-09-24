const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Runtime } = require("./runtime-client.cjs");
let runtime;
before(async () => {
  runtime = new Runtime();
  await runtime.ready;
});
after(async () => {
  await runtime.close();
});

test("expressions, falsey values, and ordinary exceptions preserve execution", async () => {
  for (const [code, output] of [
    ["2 + 2", "4\n"],
    ["0", "0\n"],
    ["False", "False\n"],
    ['""', "''\n"],
  ]) {
    const r = await runtime.run(code);
    assert.equal(r.stdout, output);
    assert.equal(r.stderr, "");
  }
  assert.match((await runtime.run("1 / 0")).stderr, /ZeroDivisionError/);
  assert.equal((await runtime.run("6 * 7")).stdout, "42\n");
});

test("UTF-8 output and successive input prompts round-trip", async () => {
  const r = await runtime.run(
    'print("café α 🧠")\na = input("Name: ")\nb = input("Word: ")\nprint(a, b)',
    { inputs: ["Zoë", "ψυχή 🧠"] }
  );
  assert.equal(r.stdout, "café α 🧠\nName: Word: Zoë ψυχή 🧠\n");
  assert.equal(r.stderr, "");
  assert.equal(r.inputCount, 2);
});

test("partial stderr belongs to its own run", async () => {
  assert.equal(
    (await runtime.run('import sys\nsys.stderr.write("partial α"); None')).stderr,
    "partial α"
  );
  assert.equal(
    (await runtime.run('import sys\nsys.stderr.write("next\\n"); None')).stderr,
    "next\n"
  );
});

test("argv is passed as data, including index zero and hostile-looking text", async () => {
  const values = ["quotes \" and '", "$& $` $' $$", "α 🧠", "line\nsecond"];
  const r = await runtime.run(
    "import sys, json\nprint(sys.argv[0])\nprint(json.dumps(sys.argv[1:], ensure_ascii=False))",
    { args: values }
  );
  const [name, json] = r.stdout.trim().split("\n");
  assert.equal(name, "snippet.py");
  assert.deepEqual(JSON.parse(json), values);
  assert.equal(r.stderr, "");
});

test("shared interrupt stops CPU-bound Python and permits another run", async () => {
  const pending = runtime.run("while True:\n    pass", { timeout: 5000 });
  const timer = setTimeout(() => runtime.stop(), 150);
  const r = await pending;
  clearTimeout(timer);
  assert.match(r.stderr, /KeyboardInterrupt/);
  assert.equal((await runtime.run("7 * 6")).stdout, "42\n");
});

test("shared interrupt stops blocked input and does not poison the next prompt", async () => {
  const r = await runtime.run('input("Waiting: ")', {
    onInput: (client) => client.stop(),
    timeout: 5000,
  });
  assert.match(r.stderr, /KeyboardInterrupt/);
  assert.equal(
    (await runtime.run('print(input(""))', { inputs: ["recovered"] })).stdout,
    "recovered\n"
  );
});

test("syntax errors and package failures leave the runtime usable", async () => {
  assert.match((await runtime.run("if:")).stderr, /SyntaxError/);
  assert.match(
    (await runtime.run("import missing_pysupport_package")).stderr,
    /ModuleNotFoundError/
  );
  assert.equal((await runtime.run('print("still ready")')).stdout, "still ready\n");
});

test("fresh scientific run loads pandas and matplotlib together and captures every figure", async () => {
  const r = await runtime.run(
    "import pandas as pd\nimport matplotlib.pyplot as plt\nprint(pd.Series([1, 2, 3]).mean())\nfor i in range(3):\n    plt.figure()\n    plt.plot([0, i + 1])\nplt.show()"
  );
  assert.equal(r.stderr, "");
  assert.equal(r.stdout, "2.0\n");
  assert.equal(r.images.length, 3);
  for (const image of r.images)
    assert.equal(Buffer.from(image, "base64").subarray(1, 4).toString(), "PNG");
});

test("input, scipy, and matplotlib coexist on a fresh runtime", async () => {
  const fresh = new Runtime();
  try {
    const r = await fresh.run(
      'from scipy.stats import pearsonr\nimport matplotlib.pyplot as plt\nn = int(input(""))\nr, p = pearsonr([1, 2, 3], [2, 4, 6])\nprint(round(r), n)\nplt.plot([1, n]); plt.show()',
      { inputs: ["4"] }
    );
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, "1 4\n");
    assert.equal(r.images.length, 1);
  } finally {
    await fresh.close();
  }
});

test("plot state is cleared after errors and subsequent non-plot code", async () => {
  assert.match(
    (await runtime.run('import matplotlib.pyplot as plt\nplt.figure()\nraise ValueError("test")'))
      .stderr,
    /ValueError/
  );
  assert.equal(
    (await runtime.run("import matplotlib.pyplot as plt\nprint(len(plt.get_fignums()))")).stdout,
    "0\n"
  );
  assert.equal((await runtime.run("1")).images.length, 0);
});

test("file writes persist; example variables do not leak into other runs", async () => {
  await runtime.run(
    'with open("test_saved.txt", "w") as f:\n    f.write("saved α")\nx_private = 42'
  );
  assert.equal(
    (await runtime.run('with open("test_saved.txt") as f:\n    print(f.read())')).stdout,
    "saved α\n"
  );
  assert.match((await runtime.run("x_private")).stderr, /NameError/);
});

test("large and alternating output is bounded, preserves ordering, and permits recovery", async () => {
  const ordered = await runtime.run(
    'import sys\nprint("first", end="", flush=True)\nsys.stderr.write("second"); sys.stderr.flush(); print("third", flush=True)'
  );
  assert.deepEqual(
    ordered.messages
      .filter((m) => ["stdout", "stderr"].includes(m.type))
      .map((m) => [m.type, m.text]),
    [
      ["stdout", "first"],
      ["stderr", "second"],
      ["stdout", "third\n"],
    ]
  );
  for (const code of [
    'for i in range(100000):\n    print("a" * 20)',
    'import sys\nfor i in range(2000):\n    sys.stdout.write("a"); sys.stdout.flush(); sys.stderr.write("b"); sys.stderr.flush()',
  ]) {
    const r = await runtime.run(code);
    assert.ok(r.stdout.length + r.stderr.length <= 100000);
    assert.ok(r.messages.length <= 1002);
    assert.equal(r.messages.filter((m) => m.type === "output_truncated").length, 1);
  }
  assert.equal(
    (await runtime.run('print(input("Name: "))', { inputs: ["Zoë 🧠"] })).stdout,
    "Name: Zoë 🧠\n"
  );
});

test("plot count and oversized canvases are bounded and figures are closed", async () => {
  const r = await runtime.run(
    "import matplotlib.pyplot as plt\nfor i in range(9):\n    plt.figure(figsize=(2, 2))\n    plt.plot([0, i])\n    plt.show()\nprint(plt.get_fignums())"
  );
  assert.equal(r.images.length, 5);
  assert.equal(r.messages.at(-1).plotsTruncated, true);
  assert.equal(r.stdout, "[]\n");
  const large = await runtime.run(
    "import matplotlib.pyplot as plt\nplt.figure(figsize=(100, 100), dpi=100)\nplt.show()\nprint(plt.get_fignums())"
  );
  assert.equal(large.images.length, 0);
  assert.equal(large.messages.at(-1).plotsTruncated, true);
  const next = await runtime.run(
    "import matplotlib.pyplot as plt\nplt.figure(figsize=(2, 2))\nplt.plot([1, 2])\nplt.show()"
  );
  assert.equal(next.images.length, 1);
  assert.equal(next.messages.at(-1).plotsTruncated, false);
});
