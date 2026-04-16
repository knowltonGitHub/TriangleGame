#!/usr/bin/env node
const http = require("http");
const https = require("https");
const { URL } = require("url");

function usage() {
  console.log("Usage:");
  console.log('  node Sandbox/send-play-command.cjs "light triangle 20 and fall 2 ticks"');
  console.log('  node Sandbox/send-play-command.cjs "load physics rules"');
  console.log("  node Sandbox/send-play-command.cjs --prompt \"settle\" --url http://127.0.0.1:41817/dispatch-command");
  console.log("  node Sandbox/send-play-command.cjs --telemetry --limit 40");
}

function parseArgs(argv) {
  const out = { prompt: "", url: "http://127.0.0.1:41817/dispatch-command", telemetry: false, limit: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (a === "--prompt" && i + 1 < argv.length) {
      out.prompt = String(argv[++i] || "");
      continue;
    }
    if (a === "--url" && i + 1 < argv.length) {
      out.url = String(argv[++i] || out.url);
      continue;
    }
    if (a === "--telemetry") {
      out.telemetry = true;
      continue;
    }
    if (a === "--limit" && i + 1 < argv.length) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n)) out.limit = Math.max(1, Math.min(400, Math.trunc(n)));
      continue;
    }
    if (!a.startsWith("--") && !out.prompt) {
      out.prompt = a;
      continue;
    }
  }
  return out;
}

function getJson(urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method: "GET",
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(raw || "{}");
          } catch (_) {
            return reject(new Error(`Invalid JSON response (${res.statusCode}): ${raw.slice(0, 300)}`));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(data.error || `HTTP ${res.statusCode}`));
          }
          resolve(data);
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(body.length),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(raw || "{}");
          } catch (_) {
            return reject(new Error(`Invalid JSON response (${res.statusCode}): ${raw.slice(0, 300)}`));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(data.error || `HTTP ${res.statusCode}`));
          }
          resolve(data);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.telemetry && !args.prompt.trim())) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  if (args.telemetry) {
    const base = new URL(args.url);
    const telemetryUrl = `${base.protocol}//${base.host}/telemetry?limit=${args.limit}`;
    const res = await getJson(telemetryUrl);
    console.log(`telemetry source: ${res.source || "unknown"}  build: ${res.build || "?"}  updatedAt: ${res.updatedAt || "never"}  count: ${res.count || 0}`);
    const lines = Array.isArray(res.lines) ? res.lines : [];
    if (!lines.length) {
      console.log("(no telemetry lines cached yet)");
      return;
    }
    console.log("latest lines:");
    lines.forEach((line) => console.log(line));
    return;
  }
  const context = { source: "cursor-cli", at: new Date().toISOString() };
  const res = await postJson(args.url, { prompt: args.prompt, context });
  if (typeof res.queuedId === "number") console.log(`queuedId: ${res.queuedId}`);
  console.log(`mode: ${res.mode || "unknown"}  hasLlm: ${res.hasLlm ? "yes" : "no"}`);
  if (res.reply) console.log(`reply: ${res.reply}`);
  if (Array.isArray(res.actions)) {
    console.log("actions:");
    console.log(JSON.stringify(res.actions, null, 2));
  }
}

main().catch((err) => {
  console.error(`send-play-command failed: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
