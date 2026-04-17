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
  const mode = typeof scenario.mode === "string" ? scenario.mode : "fixedTicks";
  const litIds = Array.isArray(scenario.litIds) ? scenario.litIds : [];
  const ticks = Math.max(1, Number(scenario.ticks || 5));
  const drops = Math.max(1, Number(scenario.drops || 5));
  const settleMaxTicks = Math.max(1, Number(scenario.settleMaxTicks || 500));
  const captureAfterSpawn = scenario.captureAfterSpawn !== false;
  const stopWhenSpawnBlocked = scenario.stopWhenSpawnBlocked !== false;
  const dropIds = Array.isArray(scenario.dropIds) && scenario.dropIds.length
    ? scenario.dropIds.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : [Number(scenario.dropId != null ? scenario.dropId : 20)];
  const frameSeconds = Math.max(0.05, Number(scenario.frameSeconds || 0.5));
  const browserChannel = typeof scenario.browserChannel === "string" ? scenario.browserChannel : "chrome";

  const runName = scenario.runName || ("run-" + stamp());
  const outDir = path.resolve(repoRoot, scenario.outputDir || path.join("Sandbox", "auto-runs", runName));
  fs.mkdirSync(outDir, { recursive: true });

  const pageUrl = "file:///" + path.join(sandboxDir, "playground.html").replace(/\\/g, "/");
  const browser = await playwright.chromium.launch({ headless: true, channel: browserChannel });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1500 } });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#w svg");
  await page.evaluate(() => {
    const sw = document.querySelector(".sw");
    const w = document.getElementById("w");
    if (sw) {
      sw.style.maxHeight = "none";
      sw.style.overflow = "visible";
    }
    if (w) {
      w.style.overflow = "visible";
      w.style.maxHeight = "none";
    }
  });
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
  let frameCount = 0;
  async function snap() {
    frameCount += 1;
    const pngName = `${prefix}_tick-${pad(frameCount, 4)}.png`;
    await page.locator("#w").screenshot({ path: path.join(outDir, pngName) });
  }

  if (mode === "repeatedDrops") {
    let completedDrops = 0;
    for (let d = 0; d < drops; d++) {
      const dropId = dropIds[d % dropIds.length];
      const beforeCount = await page.evaluate(() => window.__TG_AUTOMATION__.currentOnIds().length);
      await page.evaluate((id) => window.__TG_AUTOMATION__.addOnIds([id]), dropId);
      await page.waitForTimeout(60);
      const afterCount = await page.evaluate(() => window.__TG_AUTOMATION__.currentOnIds().length);
      if (stopWhenSpawnBlocked && afterCount <= beforeCount) {
        break;
      }
      completedDrops += 1;
      if (captureAfterSpawn) await snap();
      let settled = false;
      for (let t = 0; t < settleMaxTicks; t++) {
        const moved = await page.evaluate(() => window.__TG_AUTOMATION__.fallTick());
        await page.waitForTimeout(60);
        await snap();
        if (!moved) {
          settled = true;
          break;
        }
      }
      if (!settled) {
        throw new Error(`Scenario did not settle within ${settleMaxTicks} ticks for drop ${d + 1}`);
      }
    }
    scenario._completedDrops = completedDrops;
  } else {
    for (let i = 1; i <= ticks; i++) {
      await page.evaluate(() => window.__TG_AUTOMATION__.fallTick());
      await page.waitForTimeout(80);
      await snap();
    }
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
    frames: frameCount,
    mp4,
    gif,
    build,
    prefix,
    litIds,
    container,
    mode,
    drops: mode === "repeatedDrops" ? (scenario._completedDrops != null ? scenario._completedDrops : drops) : undefined,
    dropIds: mode === "repeatedDrops" ? dropIds : undefined,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write((err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
