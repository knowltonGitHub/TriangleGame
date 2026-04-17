#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

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

function toInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function mustArray(v, name) {
  if (!Array.isArray(v)) throw new Error(`${name} must be an array`);
  return v;
}

function normalizeIds(v) {
  return mustArray(v, "ids")
    .map((x) => toInt(x, NaN))
    .filter((x) => Number.isFinite(x) && x >= 0);
}

async function installStatusOverlay(page) {
  await page.evaluate(() => {
    let el = document.getElementById("__tg_test_status");
    if (!el) {
      el = document.createElement("div");
      el.id = "__tg_test_status";
      el.style.position = "fixed";
      el.style.left = "10px";
      el.style.top = "10px";
      el.style.zIndex = "99999";
      el.style.background = "rgba(13,17,23,0.92)";
      el.style.border = "1px solid #58a6ff";
      el.style.color = "#c9d1d9";
      el.style.padding = "8px 10px";
      el.style.borderRadius = "8px";
      el.style.font = "12px ui-monospace,Consolas,monospace";
      el.style.maxWidth = "80vw";
      el.style.whiteSpace = "pre-wrap";
      document.body.appendChild(el);
    }
  });
}

async function setStatus(page, msg) {
  await page.evaluate((text) => {
    const el = document.getElementById("__tg_test_status");
    if (el) el.textContent = String(text || "");
  }, msg);
}

function resolveJsonPath(repoRoot, sandboxDir, p) {
  const raw = String(p || "").trim();
  if (!raw) throw new Error("container file path is empty");
  const tries = [path.resolve(repoRoot, raw), path.resolve(sandboxDir, raw)];
  for (let i = 0; i < tries.length; i++) {
    if (fs.existsSync(tries[i])) return tries[i];
  }
  throw new Error("Container JSON not found: " + raw);
}

async function loadContainerFileIntoPage(page, fullPath, ctx) {
  const obj = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const result = await page.evaluate((payload) => window.__TG_AUTOMATION__.loadObject(payload), obj);
  ctx.lastLoadedContainerPath = fullPath;
  ctx.lastLoadedContainerResult = result || null;
}

async function loadRulesFileIntoPage(page, fullPath, ctx) {
  const obj = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const result = await page.evaluate((payload) => window.__TG_AUTOMATION__.setPhysicsRules(payload), obj);
  ctx.lastLoadedRulesPath = fullPath;
  ctx.lastLoadedRulesResult = result || null;
}

async function runOneAction(page, action, ctx, runOpts) {
  const type = String(action.type || "").trim();
  if (!type) throw new Error("action.type is required");
  if (type === "loadContainerFile") {
    const fullPath = resolveJsonPath(ctx.repoRoot, ctx.sandboxDir, action.path || action.file || "");
    await loadContainerFileIntoPage(page, fullPath, ctx);
    return;
  }
  if (type === "loadRulesFile") {
    const fullPath = resolveJsonPath(ctx.repoRoot, ctx.sandboxDir, action.path || action.file || "");
    await loadRulesFileIntoPage(page, fullPath, ctx);
    return;
  }
  if (type === "setContainer") {
    const which = action.value === "V" ? "V" : "T";
    await page.evaluate((w) => window.__TG_AUTOMATION__.setContainer(w), which);
    return;
  }
  if (type === "allOff") {
    await page.evaluate(() => window.__TG_AUTOMATION__.setOnIds([]));
    return;
  }
  if (type === "setOnIds") {
    const ids = normalizeIds(action.ids || []);
    await page.evaluate((arr) => window.__TG_AUTOMATION__.setOnIds(arr), ids);
    return;
  }
  if (type === "addOnIds") {
    const ids = normalizeIds(action.ids || []);
    await page.evaluate((arr) => window.__TG_AUTOMATION__.addOnIds(arr), ids);
    return;
  }
  if (type === "addId") {
    const id = toInt(action.id, -1);
    if (id < 0) throw new Error("addId requires id >= 0");
    await page.evaluate((x) => window.__TG_AUTOMATION__.addOnIds([x]), id);
    return;
  }
  if (type === "addTopMiddleId") {
    const preferDown = action.preferDown !== false;
    const id = await page.evaluate((pd) => window.__TG_AUTOMATION__.topMiddleId(pd), preferDown);
    if (id == null) throw new Error("addTopMiddleId could not resolve a spawn id");
    await page.evaluate((x) => window.__TG_AUTOMATION__.addOnIds([x]), id);
    ctx.lastTopMiddleId = id;
    return;
  }
  if (type === "addBottomIds") {
    const count = Math.max(1, toInt(action.count, 4));
    const ids = await page.evaluate((n) => window.__TG_AUTOMATION__.bottomIds(n), count);
    await page.evaluate((arr) => window.__TG_AUTOMATION__.addOnIds(arr), ids || []);
    ctx.lastBottomIds = Array.isArray(ids) ? ids.slice() : [];
    return;
  }
  if (type === "fall") {
    const ticks = Math.max(1, toInt(action.ticks, 1));
    let movedTicks = 0;
    for (let i = 0; i < ticks; i++) {
      const moved = await page.evaluate(() => window.__TG_AUTOMATION__.fallTick());
      if (moved) movedTicks += 1;
      else break;
      if (runOpts && runOpts.tickDelayMs > 0) await page.waitForTimeout(runOpts.tickDelayMs);
    }
    ctx.lastFallTicks = ticks;
    ctx.lastFallMovedTicks = movedTicks;
    return;
  }
  if (type === "settle") {
    const maxTicks = Math.max(1, toInt(action.maxTicks, 500));
    let ticks = 0;
    for (; ticks < maxTicks; ticks++) {
      const moved = await page.evaluate(() => window.__TG_AUTOMATION__.fallTick());
      if (!moved) break;
      if (runOpts && runOpts.showStatus) await setStatus(page, `[${ctx.testName}] settle tick ${ticks + 1}`);
      if (runOpts && runOpts.tickDelayMs > 0) await page.waitForTimeout(runOpts.tickDelayMs);
    }
    ctx.lastSettleTicks = ticks;
    ctx.lastSettleMax = maxTicks;
    ctx.lastSettleStable = ticks < maxTicks;
    return;
  }
  if (type === "repeatTopMiddleSettle") {
    const repeats = Math.max(1, Math.min(120, toInt(action.repeats, 10)));
    const maxTicks = Math.max(1, Math.min(500, toInt(action.maxTicksPerDrop, 140)));
    const fixedSpawn = toInt(action.spawnId, -1);
    const tickDelay = runOpts && runOpts.tickDelayMs > 0 ? runOpts.tickDelayMs : 0;
    const spawnDelay = runOpts && runOpts.stepDelayMs > 0 ? runOpts.stepDelayMs : 0;
    let completed = 0;
    for (let d = 0; d < repeats; d++) {
      const id =
        fixedSpawn >= 0
          ? fixedSpawn
          : await page.evaluate(() => window.__TG_AUTOMATION__.topMiddleId(true));
      if (id == null) break;
      const beforeCount = await page.evaluate(() => window.__TG_AUTOMATION__.currentOnIds().length);
      await page.evaluate((x) => window.__TG_AUTOMATION__.addOnIds([x]), id);
      const afterCount = await page.evaluate(() => window.__TG_AUTOMATION__.currentOnIds().length);
      if (afterCount <= beforeCount) break;
      completed += 1;
      if (spawnDelay > 0) await page.waitForTimeout(spawnDelay);
      for (let t = 0; t < maxTicks; t++) {
        const moved = await page.evaluate(() => window.__TG_AUTOMATION__.fallTick());
        if (tickDelay > 0) await page.waitForTimeout(tickDelay);
        if (!moved) break;
      }
    }
    ctx.lastRepeatDropsCompleted = completed;
    ctx.lastRepeatDropsTarget = repeats;
    return;
  }
  throw new Error(`Unknown action type: ${type}`);
}

async function checkAssertion(page, assertion, ctx) {
  const type = String(assertion.type || "").trim();
  const onIds = await page.evaluate(() => window.__TG_AUTOMATION__.currentOnIds());
  if (type === "stable") {
    const expected = assertion.expected !== false;
    const wouldMove = await page.evaluate(() => window.__TG_AUTOMATION__.wouldMove());
    const actualStable = !wouldMove;
    return { ok: actualStable === expected, message: `stable expected=${expected} actual=${actualStable}` };
  }
  if (type === "onCountEquals") {
    const n = Math.max(0, toInt(assertion.value, 0));
    return { ok: onIds.length === n, message: `onCount expected=${n} actual=${onIds.length}` };
  }
  if (type === "onCountAtLeast") {
    const n = Math.max(0, toInt(assertion.value, 0));
    return { ok: onIds.length >= n, message: `onCount>=${n} actual=${onIds.length}` };
  }
  if (type === "includesIds") {
    const ids = normalizeIds(assertion.ids || []);
    const set = new Set(onIds);
    const missing = ids.filter((id) => !set.has(id));
    return { ok: missing.length === 0, message: missing.length ? `missing ids: ${missing.join(",")}` : "all required ids present" };
  }
  if (type === "excludesIds") {
    const ids = normalizeIds(assertion.ids || []);
    const set = new Set(onIds);
    const present = ids.filter((id) => set.has(id));
    return { ok: present.length === 0, message: present.length ? `unexpected ids present: ${present.join(",")}` : "excluded ids absent" };
  }
  if (type === "settleTicksMax") {
    const n = Math.max(0, toInt(assertion.value, 0));
    const val = toInt(ctx.lastSettleTicks, Number.POSITIVE_INFINITY);
    return { ok: val <= n, message: `settleTicks<=${n} actual=${val}` };
  }
  if (type === "nextTickHasPhase") {
    const phase = String(assertion.phase || "").trim();
    if (!phase) throw new Error("nextTickHasPhase requires assertion.phase");
    const phases = await page.evaluate(() => window.__TG_AUTOMATION__.peekFallPhases());
    const ok = Array.isArray(phases) && phases.indexOf(phase) >= 0;
    return { ok, message: `nextTickHasPhase ${phase} phases=[${(phases || []).join(",")}]` };
  }
  if (type === "nextTickHasAnyPhase") {
    const wanted = mustArray(assertion.phases || [], "assertion.phases").map((x) => String(x || "").trim()).filter(Boolean);
    if (!wanted.length) throw new Error("nextTickHasAnyPhase requires non-empty assertion.phases");
    const phases = await page.evaluate(() => window.__TG_AUTOMATION__.peekFallPhases());
    const ok = Array.isArray(phases) && phases.some((p) => wanted.indexOf(p) >= 0);
    return { ok, message: `nextTickHasAnyPhase [${wanted.join(",")}] phases=[${(phases || []).join(",")}]` };
  }
  if (type === "nextTickLacksAnyPhase") {
    const banned = mustArray(assertion.phases || [], "assertion.phases").map((x) => String(x || "").trim()).filter(Boolean);
    if (!banned.length) throw new Error("nextTickLacksAnyPhase requires non-empty assertion.phases");
    const phases = await page.evaluate(() => window.__TG_AUTOMATION__.peekFallPhases());
    const hit = (phases || []).filter((p) => banned.indexOf(p) >= 0);
    const ok = hit.length === 0;
    return { ok, message: `nextTickLacksAnyPhase [${banned.join(",")}] hit=[${hit.join(",")}] all=[${(phases || []).join(",")}]` };
  }
  throw new Error(`Unknown assertion type: ${type}`);
}

async function runOneTest(playwright, sandboxDir, test, defaults, browserChannel, runOpts) {
  const pageUrl = "file:///" + path.join(sandboxDir, "playground.html").replace(/\\/g, "/") + "?nodispatch=1";
  const browser = await playwright.chromium.launch({ headless: !!runOpts.headless, channel: browserChannel });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
  const ctx = { repoRoot: path.resolve(sandboxDir, ".."), sandboxDir, testName: test.name || "(unnamed)" };
  const out = {
    name: test.name || "(unnamed)",
    pass: true,
    assertions: [],
    steps: [],
  };
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#w svg");
    await page.waitForTimeout(60);
    if (runOpts.showStatus) {
      await installStatusOverlay(page);
      await setStatus(page, `[${ctx.testName}] preparing`);
    }
    if (!test.skipInitialReset) {
      await page.evaluate(() => {
        if (!window.__TG_AUTOMATION__) throw new Error("__TG_AUTOMATION__ unavailable");
        window.__TG_AUTOMATION__.setContainer("T");
        window.__TG_AUTOMATION__.setOnIds([]);
      });
    }
    if (defaults && defaults.container) {
      await page.evaluate((w) => window.__TG_AUTOMATION__.setContainer(w === "V" ? "V" : "T"), defaults.container);
    }
    if (defaults && defaults.containerFile) {
      const file = resolveJsonPath(ctx.repoRoot, sandboxDir, defaults.containerFile);
      await loadContainerFileIntoPage(page, file, ctx);
      out.steps.push({ idx: out.steps.length + 1, type: "loadContainerFile(defaults)" });
    }
    if (defaults && defaults.rulesFile) {
      const file = resolveJsonPath(ctx.repoRoot, sandboxDir, defaults.rulesFile);
      await loadRulesFileIntoPage(page, file, ctx);
      out.steps.push({ idx: out.steps.length + 1, type: "loadRulesFile(defaults)" });
    }
    if (test && test.containerFile) {
      const file = resolveJsonPath(ctx.repoRoot, sandboxDir, test.containerFile);
      await loadContainerFileIntoPage(page, file, ctx);
      out.steps.push({ idx: out.steps.length + 1, type: "loadContainerFile(test)" });
    }
    if (test && test.rulesFile) {
      const file = resolveJsonPath(ctx.repoRoot, sandboxDir, test.rulesFile);
      await loadRulesFileIntoPage(page, file, ctx);
      out.steps.push({ idx: out.steps.length + 1, type: "loadRulesFile(test)" });
    }
    const actions = mustArray(test.actions || [], "test.actions");
    for (let i = 0; i < actions.length; i++) {
      if (runOpts.showStatus) await setStatus(page, `[${ctx.testName}] action ${i + 1}/${actions.length}: ${actions[i].type || "?"}`);
      await runOneAction(page, actions[i], ctx, runOpts);
      out.steps.push({ idx: out.steps.length + 1, type: actions[i].type || "?" });
      if (runOpts.stepDelayMs > 0) await page.waitForTimeout(runOpts.stepDelayMs);
    }
    const assertions = mustArray(test.assertions || [], "test.assertions");
    for (let i = 0; i < assertions.length; i++) {
      if (runOpts.showStatus) await setStatus(page, `[${ctx.testName}] assert ${i + 1}/${assertions.length}: ${assertions[i].type || "?"}`);
      const res = await checkAssertion(page, assertions[i], ctx);
      out.assertions.push({ idx: i + 1, type: assertions[i].type || "?", ok: !!res.ok, message: res.message || "" });
      if (!res.ok) out.pass = false;
    }
    out.finalOnCount = await page.evaluate(() => window.__TG_AUTOMATION__.currentOnIds().length);
    out.finalWouldMove = await page.evaluate(() => window.__TG_AUTOMATION__.wouldMove());
    out.context = {
      lastSettleTicks: ctx.lastSettleTicks,
      lastSettleStable: ctx.lastSettleStable,
      lastBottomIds: ctx.lastBottomIds,
      lastTopMiddleId: ctx.lastTopMiddleId,
      lastFallMovedTicks: ctx.lastFallMovedTicks,
      lastRepeatDropsCompleted: ctx.lastRepeatDropsCompleted,
      lastRepeatDropsTarget: ctx.lastRepeatDropsTarget,
      lastLoadedContainerPath: ctx.lastLoadedContainerPath,
      lastLoadedContainerResult: ctx.lastLoadedContainerResult,
      lastLoadedRulesPath: ctx.lastLoadedRulesPath,
      lastLoadedRulesResult: ctx.lastLoadedRulesResult,
    };
    if (runOpts.showStatus) {
      await setStatus(page, `[${ctx.testName}] ${out.pass ? "PASS" : "FAIL"}`);
      if (runOpts.testEndDelayMs > 0) await page.waitForTimeout(runOpts.testEndDelayMs);
    }
  } finally {
    await browser.close();
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sandboxDir = __dirname;
  const repoRoot = path.resolve(sandboxDir, "..");
  const fileArg = args.file || "Sandbox/scenarios/physics-tests.json";
  let filePath = path.resolve(repoRoot, fileArg);
  if (!fs.existsSync(filePath)) filePath = path.resolve(sandboxDir, fileArg);
  if (!fs.existsSync(filePath)) throw new Error("Test file not found: " + filePath);
  let playwright;
  try {
    playwright = require("playwright");
  } catch (_) {
    throw new Error("Missing dependency: playwright. Install with `npm install --prefix Sandbox playwright`.");
  }
  const suite = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const tests = mustArray(suite.tests || [], "tests");
  const selected = args.test ? tests.filter((t) => String(t.name || "") === String(args.test)) : tests;
  if (!selected.length) throw new Error(args.test ? `No test named: ${args.test}` : "No tests found.");
  const defaults = suite.defaults && typeof suite.defaults === "object" ? suite.defaults : {};
  const browserChannel = typeof suite.browserChannel === "string" ? suite.browserChannel : "chrome";
  const runOpts = {
    showStatus: args.show === true || suite.visualize === true,
    headless: args.headless === true ? true : !(args.show === true || suite.visualize === true),
    stepDelayMs: Math.max(0, toInt(args.stepDelayMs != null ? args.stepDelayMs : suite.stepDelayMs, 0)),
    tickDelayMs: Math.max(0, toInt(args.tickDelayMs != null ? args.tickDelayMs : suite.tickDelayMs, 0)),
    testEndDelayMs: Math.max(0, toInt(args.testEndDelayMs != null ? args.testEndDelayMs : suite.testEndDelayMs, 0)),
  };
  const results = [];
  for (let i = 0; i < selected.length; i++) {
    const r = await runOneTest(playwright, sandboxDir, selected[i], defaults, browserChannel, runOpts);
    results.push(r);
  }
  const failed = results.filter((r) => !r.pass).length;
  const out = {
    ok: failed === 0,
    suite: suite.suite || path.basename(filePath),
    filePath,
    ran: results.length,
    failed,
    passed: results.length - failed,
    results,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  process.stderr.write((err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
