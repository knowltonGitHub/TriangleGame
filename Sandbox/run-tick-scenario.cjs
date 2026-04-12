#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function pad(n, w) {
  let s = String(Math.max(0, Math.floor(n)));
  while (s.length < w) s = "0" + s;
  return s;
}

function stamp() {
  const d = new Date();
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1, 2) +
    pad(d.getDate(), 2) +
    "-" +
    pad(d.getHours(), 2) +
    pad(d.getMinutes(), 2) +
    pad(d.getSeconds(), 2)
  );
}

function runPowerShell(scriptPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const psArgs = ["-ExecutionPolicy", "Bypass", "-File", scriptPath].concat(args || []);
    execFile("powershell", psArgs, { cwd, maxBuffer: 1024 * 1024 * 16 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || stdout || err.message || "PowerShell failed").trim()));
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sandboxDir = __dirname;
  const repoRoot = path.resolve(sandboxDir, "..");
  const scenarioArg = args.scenario || "Sandbox/scenarios/demo-run.json";
  let scenarioPath = path.resolve(repoRoot, scenarioArg);
  if (!fs.existsSync(scenarioPath)) {
    scenarioPath = path.resolve(sandboxDir, scenarioArg);
  }
  if (!fs.existsSync(scenarioPath)) throw new Error("Scenario not found: " + scenarioPath);

  let playwright;
  try {
    playwright = require("playwright");
  } catch (e) {
    throw new Error("Missing dependency: playwright. Install with `npm install playwright` from repo root.");
  }

  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  const container = scenario.container === "V" ? "V" : "T";
  const litIds = Array.isArray(scenario.litIds) ? scenario.litIds : [];
  const ticks = Math.max(1, Number(scenario.ticks || 5));
  const frameSeconds = Math.max(0.05, Number(scenario.frameSeconds || 0.5));
  const browserChannel = typeof scenario.browserChannel === "string" ? scenario.browserChannel : "chrome";

  const runName = scenario.runName || ("run-" + stamp());
  const outDir = path.resolve(repoRoot, scenario.outputDir || path.join("Sandbox", "auto-runs", runName));
  fs.mkdirSync(outDir, { recursive: true });

  const pageUrl = "file:///" + path.join(sandboxDir, "index.html").replace(/\\/g, "/");
  const browser = await playwright.chromium.launch({ headless: true, channel: browserChannel });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1500 } });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#w svg");
  await page.evaluate(
    (payload) => {
      if (!window.__TG_AUTOMATION__) throw new Error("__TG_AUTOMATION__ unavailable");
      window.__TG_AUTOMATION__.setContainer(payload.container);
      window.__TG_AUTOMATION__.setOnIds(payload.litIds);
    },
    { container, litIds }
  );
  await page.waitForTimeout(80);
  const build = await page.evaluate(() => window.__TG_AUTOMATION__.getBuild());

  const prefix = (scenario.prefix || ("auto_b" + build)).replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 32) || ("auto_b" + build);
  for (let i = 1; i <= ticks; i++) {
    await page.evaluate(() => window.__TG_AUTOMATION__.fallTick());
    await page.waitForTimeout(80);
    const pngName = `${prefix}_tick-${pad(i, 4)}.png`;
    await page.locator("#w").screenshot({ path: path.join(outDir, pngName) });
  }
  await browser.close();

  const makeMediaScript = path.join(sandboxDir, "make-tick-media.ps1");
  const stdout = await runPowerShell(
    makeMediaScript,
    ["-InputDir", outDir, "-Pattern", `${prefix}_tick-*.png`, "-FrameSeconds", String(frameSeconds), "-OutputBase", `${prefix}_movie`, "-OutputDir", outDir],
    sandboxDir
  );

  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const mp4 = (lines.find((l) => l.startsWith("Created MP4:")) || "").replace(/^Created MP4:\s*/, "");
  const gif = (lines.find((l) => l.startsWith("Created GIF:")) || "").replace(/^Created GIF:\s*/, "");

  const result = {
    ok: true,
    scenarioPath,
    outputDir: outDir,
    frames: ticks,
    mp4,
    gif,
    build,
    prefix,
    litIds,
    container,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write((err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
