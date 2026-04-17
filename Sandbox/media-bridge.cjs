#!/usr/bin/env node
const http = require("http");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const sandboxDir = __dirname;
const port = Number(process.env.TG_MEDIA_BRIDGE_PORT || 41817);
const llmApiKey = String(process.env.TG_OPENAI_API_KEY || "").trim();
const llmModel = String(process.env.TG_OPENAI_MODEL || "gpt-4.1-mini").trim();
let dispatchedSeq = 0;
const dispatchedLog = [];
const telemetryState = {
  updatedAt: null,
  source: "",
  build: null,
  lines: [],
};
const repoRoot = path.resolve(sandboxDir, "..");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function runPowerShell(scriptName, args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(sandboxDir, scriptName);
    const psArgs = ["-ExecutionPolicy", "Bypass", "-File", scriptPath].concat(args || []);
    execFile(
      "powershell",
      psArgs,
      { cwd: sandboxDir, maxBuffer: 1024 * 1024 * 16 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error((stderr || stdout || err.message || "script failed").trim()));
          return;
        }
        resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
      }
    );
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("invalid JSON body"));
      }
    });
  });
}

function parseUrl(reqUrl) {
  return new URL(reqUrl || "/", "http://127.0.0.1");
}

function resolveSandboxFilePath(inputPath) {
  const raw = String(inputPath || "").trim();
  if (!raw) throw new Error("path is required");
  const fromRepo = path.resolve(repoRoot, raw);
  const fromSandbox = path.resolve(sandboxDir, raw);
  const pick = fromRepo.startsWith(sandboxDir) ? fromRepo : fromSandbox;
  const finalPath = path.resolve(pick);
  if (!finalPath.startsWith(sandboxDir)) throw new Error("Only Sandbox files are allowed");
  return finalPath;
}

function resolveSandboxJsonPath(inputPath) {
  const raw = String(inputPath || "").trim();
  if (!raw) throw new Error("path is required");
  const p1 = path.resolve(repoRoot, raw);
  const p2 = path.resolve(sandboxDir, raw);
  const pick = p1.startsWith(sandboxDir) && p1.toLowerCase().endsWith(".json") ? p1 : p2;
  const finalPath = path.resolve(pick);
  if (!finalPath.startsWith(sandboxDir)) throw new Error("Only Sandbox JSON files are allowed");
  if (!finalPath.toLowerCase().endsWith(".json")) throw new Error("Only .json files are supported");
  return finalPath;
}

function parseIntSafe(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function parseTickDelayMs(promptLower) {
  const s = String(promptLower || "");
  let m = s.match(/(?:with|at)\s+(\d+)\s*(?:second|sec|s)\s+delay(?:\s+between\s+ticks?)?/);
  if (!m) m = s.match(/delay(?:\s+between\s+ticks?)?\s+(\d+)\s*(?:second|sec|s)/);
  if (!m) m = s.match(/(\d+)\s*(?:second|sec|s)\s+between\s+ticks?/);
  if (!m) m = s.match(/\btick\s+delay\s*(\d+)\s*(?:second|sec|s)\b/);
  if (!m || !m[1]) return 0;
  return clamp(parseIntSafe(m[1], 0) * 1000, 0, 10000);
}

function localCommandPlan(promptRaw) {
  const prompt = String(promptRaw || "").trim();
  const s = prompt.toLowerCase().replace(/\badn\b/g, "and");
  const actions = [];
  let reply = "";
  let m;

  if (!prompt) {
    return { reply: "Command is empty.", actions: [] };
  }
  if (/\b(stop|cancel)\s+(demo|test|fill)\b/.test(s)) actions.push({ op: "stopRepeatTopMiddleSettle" });
  if (/\ball\s+off\b/.test(s)) actions.push({ op: "allOff" });
  if (/\bsettle\b/.test(s)) actions.push({ op: "settle" });
  if (/\b(run|start)\s+(top[\s-]*middle|gameplay)\s+(fill|drop)\s+demo\b/.test(s) || /\bfill\s+container\b/.test(s)) {
    actions.push({ op: "repeatTopMiddleSettle", repeats: 16, maxTicksPerDrop: 140, tickDelayMs: 1000, spawnDelayMs: 800, spawnId: 16 });
  }
  if (/\b(load|open)\s+(physics\s+rules?|rules)\b/.test(s)) actions.push({ op: "loadRulesFile", path: "Sandbox/rules/triangle-physics.rules.v1.json" });
  if (/\b(load|open)\s+better\s*tri(?:\.json)?\b/.test(s)) actions.push({ op: "loadContainerFile", path: "Sandbox/better tri.json" });
  if (!actions.length) {
    m = s.match(/\b(?:load|open)\s+(.+?\.json)\b/);
    if (m && m[1]) actions.push({ op: "loadContainerFile", path: m[1].trim() });
  }
  if (/\blight\s+all\s+odd(\s+numbered)?\s+triangles?\b/.test(s) || /\blight\s+odd\s+triangles?\b/.test(s)) actions.push({ op: "lightOddAll" });
  if (/\blight\s+all\s+even(\s+numbered)?\s+triangles?\b/.test(s) || /\blight\s+even\s+triangles?\b/.test(s)) actions.push({ op: "lightEvenAll" });

  m = s.match(/light\s+triangle\s+#?(\d+)/);
  if (m) actions.push({ op: "light", id: clamp(parseIntSafe(m[1], 0), 0, 1000000) });

  m = s.match(/fall(?:\s+for)?\s*(\d+)?\s*ticks?/);
  if (m) {
    const tickDelayMs = parseTickDelayMs(s);
    const action = { op: "fall", ticks: clamp(parseIntSafe(m[1] || 1, 1), 1, 200) };
    if (tickDelayMs > 0) action.tickDelayMs = tickDelayMs;
    actions.push(action);
  } else {
    m = s.match(/\bfall\s+(\d+)\b/);
    if (m) {
      const tickDelayMs = parseTickDelayMs(s);
      const action = { op: "fall", ticks: clamp(parseIntSafe(m[1], 1), 1, 200) };
      if (tickDelayMs > 0) action.tickDelayMs = tickDelayMs;
      actions.push(action);
    } else if (/\bfall\b/.test(s)) {
      const tickDelayMs = parseTickDelayMs(s);
      const action = { op: "fall", ticks: 1 };
      if (tickDelayMs > 0) action.tickDelayMs = tickDelayMs;
      actions.push(action);
    }
  }

  if (!actions.length) {
    reply = 'I can run commands like "open better tri.json", "run top middle fill demo", "stop demo", "light triangle 20 and fall 2 ticks", "light all odd numbered triangles", "settle", or "all off".';
  } else {
    reply = "Using local parser command plan.";
  }
  return { reply, actions };
}

function extractTextFromResponsesApi(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.output)) return "";
  const bits = [];
  data.output.forEach((item) => {
    if (!item || !Array.isArray(item.content)) return;
    item.content.forEach((c) => {
      if (c && typeof c.text === "string" && c.text.trim()) bits.push(c.text.trim());
    });
  });
  return bits.join("\n").trim();
}

function parseJsonObjectFromText(text) {
  const s = String(text || "").trim();
  if (!s) throw new Error("empty model response");
  try {
    return JSON.parse(s);
  } catch (_) {}
  const block = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (block) {
    try {
      return JSON.parse(block[1].trim());
    } catch (_) {}
  }
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i >= 0 && j > i) {
    return JSON.parse(s.slice(i, j + 1));
  }
  throw new Error("could not parse JSON plan from model response");
}

function normalizeActionPlan(obj) {
  const out = { reply: "", actions: [] };
  if (obj && typeof obj.reply === "string") out.reply = obj.reply.trim();
  if (!obj || !Array.isArray(obj.actions)) return out;
  obj.actions.forEach((a) => {
    if (!a || typeof a !== "object") return;
    if (a.op === "stopRepeatTopMiddleSettle") out.actions.push({ op: "stopRepeatTopMiddleSettle" });
    else if (a.op === "allOff") out.actions.push({ op: "allOff" });
    else if (a.op === "settle") out.actions.push({ op: "settle" });
    else if (a.op === "repeatTopMiddleSettle") {
      out.actions.push({
        op: "repeatTopMiddleSettle",
        repeats: clamp(parseIntSafe(a.repeats, 12), 1, 120),
        maxTicksPerDrop: clamp(parseIntSafe(a.maxTicksPerDrop, 140), 1, 500),
        tickDelayMs: clamp(parseIntSafe(a.tickDelayMs, 1000), 0, 4000),
        spawnDelayMs: clamp(parseIntSafe(a.spawnDelayMs, 800), 0, 4000),
        spawnId: clamp(parseIntSafe(a.spawnId, 16), 0, 1000000),
      });
    }
    else if (a.op === "loadContainerFile") {
      const p = String(a.path || "").trim();
      if (p) out.actions.push({ op: "loadContainerFile", path: p });
    }
    else if (a.op === "loadRulesFile") {
      const p = String(a.path || "").trim();
      if (p) out.actions.push({ op: "loadRulesFile", path: p });
    }
    else if (a.op === "lightOddAll") out.actions.push({ op: "lightOddAll" });
    else if (a.op === "lightEvenAll") out.actions.push({ op: "lightEvenAll" });
    else if (a.op === "light") {
      const id = clamp(parseIntSafe(a.id, -1), 0, 1000000);
      if (id >= 0) out.actions.push({ op: "light", id });
    } else if (a.op === "fall") {
      const ticks = clamp(parseIntSafe(a.ticks, 1), 1, 200);
      const tickDelayMs = clamp(parseIntSafe(a.tickDelayMs, 0), 0, 10000);
      const action = { op: "fall", ticks };
      if (tickDelayMs > 0) action.tickDelayMs = tickDelayMs;
      out.actions.push(action);
    }
  });
  return out;
}

async function llmCommandPlan(prompt, context) {
  if (!llmApiKey) return null;
  if (typeof fetch !== "function") throw new Error("Node runtime does not support fetch()");
  const sys = [
    "You convert user commands into JSON action plans for a triangle game UI.",
    "Return ONLY JSON with shape: {\"reply\":\"...\",\"actions\":[...]}",
    "Allowed actions:",
    "- {\"op\":\"stopRepeatTopMiddleSettle\"}",
    "- {\"op\":\"light\",\"id\":number}",
    "- {\"op\":\"fall\",\"ticks\":number,\"tickDelayMs\":number(optional)}",
    "- {\"op\":\"settle\"}",
    "- {\"op\":\"allOff\"}",
    "- {\"op\":\"repeatTopMiddleSettle\",\"repeats\":16,\"maxTicksPerDrop\":140,\"tickDelayMs\":1000,\"spawnDelayMs\":800,\"spawnId\":16}",
    "- {\"op\":\"loadContainerFile\",\"path\":\"Sandbox/better tri.json\"}",
    "- {\"op\":\"loadRulesFile\",\"path\":\"Sandbox/rules/triangle-physics.rules.v1.json\"}",
    "- {\"op\":\"lightOddAll\"}",
    "- {\"op\":\"lightEvenAll\"}",
    "Keep actions short and safe. If unclear, return empty actions with a helpful reply.",
  ].join("\n");
  const user = JSON.stringify({
    prompt: String(prompt || ""),
    context: context && typeof context === "object" ? context : {},
  });
  const body = {
    model: llmModel,
    input: [
      { role: "system", content: [{ type: "input_text", text: sys }] },
      { role: "user", content: [{ type: "input_text", text: user }] },
    ],
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmApiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${raw.slice(0, 240)}`);
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error("LLM API returned invalid JSON");
  }
  const txt = extractTextFromResponsesApi(data);
  const plan = parseJsonObjectFromText(txt);
  return normalizeActionPlan(plan);
}

function createPlannedCommand(prompt, context, preferLlm) {
  const run = async () => {
    let mode = "local";
    let plan = null;
    if (preferLlm !== false) {
      try {
        const llmPlan = await llmCommandPlan(prompt, context);
        if (llmPlan) {
          mode = "llm";
          plan = llmPlan;
        }
      } catch (_) {
        mode = "local_fallback";
      }
    }
    if (!plan) plan = localCommandPlan(prompt);
    return {
      mode,
      hasLlm: !!llmApiKey,
      reply: plan.reply || "",
      actions: Array.isArray(plan.actions) ? plan.actions : [],
    };
  };
  return run();
}

function enqueueDispatchedCommand(payload) {
  dispatchedSeq += 1;
  const item = {
    id: dispatchedSeq,
    at: new Date().toISOString(),
    payload,
  };
  dispatchedLog.push(item);
  if (dispatchedLog.length > 100) dispatchedLog.splice(0, dispatchedLog.length - 100);
  return item;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, port, sandboxDir });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/page-version")) {
      const u = parseUrl(req.url);
      const rel = String(u.searchParams.get("path") || "playground.html").trim();
      const filePath = resolveSandboxFilePath(rel);
      const st = fs.statSync(filePath);
      sendJson(res, 200, {
        ok: true,
        path: filePath,
        mtimeMs: Number(st.mtimeMs || 0),
        size: Number(st.size || 0),
      });
      return;
    }

    if (req.method === "POST" && req.url === "/telemetry") {
      const body = await parseBody(req);
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      const cleanLines = rawLines
        .map((x) => String(x == null ? "" : x).replace(/\s+$/g, ""))
        .filter((x) => x.length > 0)
        .slice(0, 400);
      telemetryState.lines = cleanLines;
      telemetryState.source = String(body.source || "").slice(0, 80);
      telemetryState.build = Number.isFinite(Number(body.build)) ? Math.trunc(Number(body.build)) : null;
      telemetryState.updatedAt = new Date().toISOString();
      sendJson(res, 200, {
        ok: true,
        accepted: telemetryState.lines.length,
        updatedAt: telemetryState.updatedAt,
      });
      return;
    }

    if (req.method === "POST" && req.url === "/make-media") {
      const body = await parseBody(req);
      const pattern = body.pattern || "tg_b*_tick-*.png";
      const frameSeconds = Number(body.frameSeconds || 0.5);
      const outputBase = body.outputBase || "fall-debug";
      const outputDir = body.outputDir || ".";
      const r = await runPowerShell("make-tick-media.ps1", [
        "-Pattern",
        String(pattern),
        "-FrameSeconds",
        String(frameSeconds),
        "-OutputBase",
        String(outputBase),
        "-OutputDir",
        String(outputDir),
      ]);
      const out = r.stdout.split(/\r?\n/).filter(Boolean);
      const mp4 = (out.find((l) => l.startsWith("Created MP4:")) || "").replace(/^Created MP4:\s*/, "");
      const gif = (out.find((l) => l.startsWith("Created GIF:")) || "").replace(/^Created GIF:\s*/, "");
      sendJson(res, 200, { ok: true, mp4, gif, log: out.slice(-8) });
      return;
    }

    if (req.method === "POST" && req.url === "/extract-frames") {
      const body = await parseBody(req);
      const inputVideo = body.inputVideo || "fall-debug-b55.mp4";
      const outputDir = body.outputDir || "frames-from-video";
      const outputPrefix = body.outputPrefix || "tick";
      const fps = Number(body.fps || 2);
      const r = await runPowerShell("extract-video-frames.ps1", [
        "-InputVideo",
        String(inputVideo),
        "-OutputDir",
        String(outputDir),
        "-OutputPrefix",
        String(outputPrefix),
        "-Fps",
        String(fps),
      ]);
      const out = r.stdout.split(/\r?\n/).filter(Boolean);
      const dir = (out.find((l) => l.startsWith("Extracted frames to:")) || "").replace(/^Extracted frames to:\s*/, "");
      const pattern = (out.find((l) => l.startsWith("Pattern:")) || "").replace(/^Pattern:\s*/, "");
      sendJson(res, 200, { ok: true, outputDir: dir, pattern, log: out.slice(-8) });
      return;
    }

    if (req.method === "POST" && req.url === "/run-scenario") {
      const body = await parseBody(req);
      const scenarioPath = body.scenarioPath || "scenarios/demo-run.json";
      const scriptPath = path.join(sandboxDir, "run-tick-scenario.cjs");
      execFile(
        "node",
        [scriptPath, "--scenario", scenarioPath],
        { cwd: path.resolve(sandboxDir, ".."), maxBuffer: 1024 * 1024 * 16 },
        (err, stdout, stderr) => {
          if (err) {
            sendJson(res, 500, { error: (stderr || stdout || err.message || "run-scenario failed").trim() });
            return;
          }
          try {
            const data = JSON.parse(String(stdout || "{}"));
            sendJson(res, 200, data);
          } catch (e) {
            sendJson(res, 500, { error: "Invalid run-scenario response", raw: String(stdout || "") });
          }
        }
      );
      return;
    }

    if (req.method === "POST" && req.url === "/play-command") {
      const body = await parseBody(req);
      const prompt = String(body.prompt || "").trim();
      const context = body.context && typeof body.context === "object" ? body.context : {};
      if (!prompt) {
        sendJson(res, 400, { error: "prompt is required" });
        return;
      }
      const planned = await createPlannedCommand(prompt, context, true);
      sendJson(res, 200, { ok: true, ...planned });
      return;
    }

    if (req.method === "POST" && req.url === "/dispatch-command") {
      const body = await parseBody(req);
      const prompt = String(body.prompt || "").trim();
      const context = body.context && typeof body.context === "object" ? body.context : {};
      if (!prompt) {
        sendJson(res, 400, { error: "prompt is required" });
        return;
      }
      const planned = await createPlannedCommand(prompt, context, true);
      const queued = enqueueDispatchedCommand({
        prompt,
        mode: planned.mode,
        hasLlm: planned.hasLlm,
        reply: planned.reply,
        actions: planned.actions,
      });
      sendJson(res, 200, { ok: true, queuedId: queued.id, ...planned });
      return;
    }

    if (req.method === "POST" && req.url === "/shutdown") {
      sendJson(res, 200, { ok: true, shuttingDown: true });
      setTimeout(() => {
        try {
          server.close(() => process.exit(0));
          setTimeout(() => process.exit(0), 800);
        } catch (_) {
          process.exit(0);
        }
      }, 80);
      return;
    }

    if (req.method === "POST" && req.url === "/load-container-file") {
      const body = await parseBody(req);
      const filePath = resolveSandboxJsonPath(body.path || "");
      const raw = fs.readFileSync(filePath, "utf8");
      let object = {};
      try {
        object = JSON.parse(raw);
      } catch (_) {
        sendJson(res, 400, { error: "Invalid JSON file: " + filePath });
        return;
      }
      sendJson(res, 200, { ok: true, path: filePath, object });
      return;
    }

    if (req.method === "POST" && req.url === "/load-rules-file") {
      const body = await parseBody(req);
      const filePath = resolveSandboxJsonPath(body.path || "");
      const raw = fs.readFileSync(filePath, "utf8");
      let object = {};
      try {
        object = JSON.parse(raw);
      } catch (_) {
        sendJson(res, 400, { error: "Invalid JSON file: " + filePath });
        return;
      }
      sendJson(res, 200, { ok: true, path: filePath, object });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/next-command")) {
      const u = parseUrl(req.url);
      const after = parseIntSafe(u.searchParams.get("after") || "0", 0);
      const next = dispatchedLog.find((x) => x.id > after) || null;
      sendJson(res, 200, {
        ok: true,
        lastId: dispatchedSeq,
        command: next
          ? {
              id: next.id,
              at: next.at,
              prompt: next.payload.prompt,
              mode: next.payload.mode,
              hasLlm: next.payload.hasLlm,
              reply: next.payload.reply,
              actions: next.payload.actions,
            }
          : null,
      });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/telemetry")) {
      const u = parseUrl(req.url);
      const limit = clamp(parseIntSafe(u.searchParams.get("limit") || "80", 80), 1, 400);
      sendJson(res, 200, {
        ok: true,
        updatedAt: telemetryState.updatedAt,
        source: telemetryState.source,
        build: telemetryState.build,
        count: telemetryState.lines.length,
        lines: telemetryState.lines.slice(0, limit),
      });
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (e) {
    sendJson(res, 500, { error: e && e.message ? e.message : String(e) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Triangle media bridge listening on http://127.0.0.1:${port}`);
  console.log("Endpoints: GET /health, GET /page-version, GET /next-command, GET /telemetry, POST /telemetry, POST /make-media, POST /extract-frames, POST /run-scenario, POST /play-command, POST /dispatch-command, POST /shutdown, POST /load-container-file, POST /load-rules-file");
  console.log(`LLM command mode: ${llmApiKey ? `enabled (${llmModel})` : "disabled (set TG_OPENAI_API_KEY)"}`);
});
