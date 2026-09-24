const assert = require("node:assert/strict");
const { integrity } = require("./build-release.cjs");

async function smoke(origin) {
  const get = async (url) => {
    const response = await fetch(new URL(url, origin), {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
    return response;
  };
  const manifest = await (await get("/release-manifest.json")).json();
  const homepage = await get("/");
  const html = Buffer.from(await homepage.arrayBuffer());
  assert.equal(
    integrity(html),
    manifest.assets.find((asset) => asset.url === "/index.html").integrity,
    "Homepage does not match release manifest (check HTML rewriting and edge caching)"
  );
  assert.match(homepage.headers.get("cache-control") || "", /no-cache|max-age=0/);
  for (const asset of manifest.assets) {
    const response = await get(asset.url);
    assert.equal(
      integrity(Buffer.from(await response.arrayBuffer())),
      asset.integrity,
      asset.url + " integrity"
    );
    assert.equal(
      response.headers.get("cross-origin-opener-policy"),
      "same-origin",
      asset.url + " COOP"
    );
    assert.equal(
      response.headers.get("cross-origin-embedder-policy"),
      "require-corp",
      asset.url + " COEP"
    );
    if (asset.url.startsWith("/releases/"))
      assert.match(response.headers.get("cache-control") || "", /immutable/);
  }
  const sw = await get("/sw.js");
  assert.match(sw.headers.get("cache-control") || "", /no-cache|max-age=0/);
  assert.ok(
    (await sw.text()).includes(manifest.id),
    "Service worker release differs from manifest"
  );
  console.log(
    `Deployment ${manifest.id}: homepage, ${manifest.assets.length} assets, integrity and headers passed`
  );
}
if (require.main === module) {
  if (!process.argv[2]) {
    console.error("Usage: npm run smoke:deploy -- https://your-preview.pages.dev");
    process.exitCode = 1;
  } else
    smoke(process.argv[2]).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
module.exports = { smoke };
