const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

function createPreview(getRoot, intercept = () => false) {
  return http.createServer((request, response) => {
    if (intercept(request, response)) return;
    const root = getRoot();
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const filename = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!filename.startsWith(path.resolve(root) + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    // Match the small set of exact/splat _headers rules used by this static site.
    let matches = false;
    for (const line of fs.readFileSync(path.join(root, "_headers"), "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      if (!line.startsWith(" ")) {
        const pattern = line.trim();
        matches = pattern.endsWith("*")
          ? pathname.startsWith(pattern.slice(0, -1))
          : pathname === pattern;
      } else if (matches) {
        const colon = line.indexOf(":");
        response.setHeader(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
      }
    }
    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".xml": "application/xml",
      ".txt": "text/plain",
    };
    response.setHeader("Content-Type", types[path.extname(filename)] || "application/octet-stream");
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.end(fs.readFileSync(filename));
  });
}
if (require.main === module) {
  const root = path.join(__dirname, "..", "dist");
  const server = createPreview(() => root);
  server.listen(Number(process.argv[2] || 8081), "127.0.0.1", () =>
    console.log(`Release preview: http://127.0.0.1:${server.address().port}`)
  );
}
module.exports = { createPreview };
