const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = path.join(__dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const integrity = (bytes) => "sha256-" + createHash("sha256").update(bytes).digest("base64");

function buildRelease(
  output = path.join(root, "dist"),
  read = (name) => fs.readFileSync(path.join(root, name))
) {
  const files = new Map();
  const fingerprint = (name, bytes) => {
    const extension = path.extname(name);
    const url = `/releases/${path.basename(name, extension)}.${hash(bytes).slice(0, 20)}${extension}`;
    files.set(url.slice(1), bytes);
    return url;
  };
  const worker = fingerprint("pyodide-worker.js", read("pyodide-worker.js"));
  const runnerSource = read("runner.js").toString();
  if (!runnerSource.includes("./pyodide-worker.js?v=19"))
    throw new Error("Worker release URL drifted");
  const runner = fingerprint("runner.js", runnerSource.replace("./pyodide-worker.js?v=19", worker));
  const style = fingerprint("style.css", read("style.css"));
  const prism = fingerprint("prism.js", read("vendor/prism.js"));
  let html = read("index.html").toString();
  for (const [from, to] of [
    ["runner.js?v=19", runner],
    ["style.css?v=19", style],
    ["vendor/prism.js?v=19", prism],
  ]) {
    if (!html.includes(from)) throw new Error("Missing release reference: " + from);
    html = html.replaceAll(from, to);
  }
  files.set("index.html", html);
  for (const name of [
    "manifest.json",
    "favicon.png",
    "icon-192.png",
    "icon-512.png",
    "assets/og-image.png",
  ])
    files.set(name, read(name));
  const assets = [...files].map(([name, bytes]) => ({
    url: "/" + name + (name === "favicon.png" ? "?v=5" : ""),
    integrity: integrity(bytes),
  }));
  const template = read("sw.js").toString();
  const headers = read("_headers");
  const release = { id: hash(JSON.stringify(assets) + template + headers).slice(0, 20), assets };
  const config = /const RELEASE = \{[\s\S]*?\n\};/;
  if (!config.test(template)) throw new Error("Service-worker release configuration missing");
  files.set(
    "sw.js",
    template.replace(config, "const RELEASE = " + JSON.stringify(release, null, 2) + ";")
  );
  files.set("release-manifest.json", JSON.stringify(release, null, 2) + "\n");
  files.set("_headers", headers);
  files.set("vendor/prism-LICENSE.txt", read("vendor/prism-LICENSE.txt"));
  for (const name of ["404.html", "robots.txt", "sitemap.xml", "llms.txt"])
    files.set(name, read(name));
  if (path.resolve(output) === path.resolve(root))
    throw new Error("Output cannot be the source folder");
  fs.mkdirSync(output, { recursive: true });
  for (const [name, bytes] of files) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  return release;
}

if (require.main === module) {
  const release = buildRelease();
  console.log(`Built release ${release.id} in dist/ (${release.assets.length} required assets)`);
}
module.exports = { buildRelease, hash, integrity };
