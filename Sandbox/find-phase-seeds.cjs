#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function resolveJsonPath(repoRoot, sandboxDir, p) {
  const raw = String(p || "").trim();
  if (!raw) return null;
  const tries = [path.resolve(repoRoot, raw), path.resolve(sandboxDir, raw)];
  for (let i = 0; i < tries.length; i++) {
    if (fs.existsSync(tries[i])) return tries[i];
  }
  throw new Error("Container JSON not found: " + raw);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let playwright;
  try {
    playwright = require("playwright");
  } catch (_) {
    throw new Error("Missing dependency: playwright. Install with `npm install --prefix Sandbox playwright`.");
  }
  const sandboxDir = __dirname;
  const repoRoot = path.resolve(sandboxDir, "..");
  const pageUrl = "file:///" + path.join(sandboxDir, "index.html").replace(/\\/g, "/");
  const browser = await playwright.chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#w svg");
  await page.waitForTimeout(50);

  const containerFilePath = resolveJsonPath(repoRoot, sandboxDir, args.containerFile || args.file || "");
  if (containerFilePath) {
    const obj = JSON.parse(fs.readFileSync(containerFilePath, "utf8"));
    await page.evaluate((payload) => window.__TG_AUTOMATION__.loadObject(payload), obj);
  } else {
    await page.evaluate(() => {
      window.__TG_AUTOMATION__.setContainer("V");
      window.__TG_AUTOMATION__.setOnIds([]);
    });
  }

  async function phasesFor(ids) {
    return page.evaluate((arr) => {
      window.__TG_AUTOMATION__.setOnIds(arr);
      return window.__TG_AUTOMATION__.peekFallPhases();
    }, ids);
  }

  const cellCount = await page.evaluate(() => window.__TG_AUTOMATION__.cellCount());
  const results = { lane: null, wallLike: null, pivotLike: null };
  const maxId = Math.max(0, cellCount - 1);
  for (let id = 0; id <= maxId; id++) {
    const p = await phasesFor([id]);
    if (!results.lane && p.includes("lane")) results.lane = { ids: [id], phases: p };
    if (!results.wallLike && (p.includes("wall") || p.includes("wallSlideComposite"))) results.wallLike = { ids: [id], phases: p };
    if (!results.pivotLike && (p.includes("pivotRotate") || p.includes("pivot") || p.includes("boundaryTip"))) results.pivotLike = { ids: [id], phases: p };
    if (results.lane && results.wallLike && results.pivotLike) break;
  }

  if (!results.wallLike || !results.pivotLike) {
    const hi = Math.min(maxId, 320);
    for (let a = 0; a <= hi; a++) {
      for (let b = a + 1; b <= hi; b++) {
        const p = await phasesFor([a, b]);
        if (!results.wallLike && (p.includes("wall") || p.includes("wallSlideComposite"))) results.wallLike = { ids: [a, b], phases: p };
        if (!results.pivotLike && (p.includes("pivotRotate") || p.includes("pivot") || p.includes("boundaryTip"))) results.pivotLike = { ids: [a, b], phases: p };
        if (results.wallLike && results.pivotLike) break;
      }
      if (results.wallLike && results.pivotLike) break;
    }
  }

  await browser.close();
  process.stdout.write(JSON.stringify({ containerFilePath, cellCount, ...results }, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write((err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
