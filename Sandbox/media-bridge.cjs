#!/usr/bin/env node
const http = require("http");
const path = require("path");
const { execFile } = require("child_process");

const sandboxDir = __dirname;
const port = Number(process.env.TG_MEDIA_BRIDGE_PORT || 41817);

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

    sendJson(res, 404, { error: "not found" });
  } catch (e) {
    sendJson(res, 500, { error: e && e.message ? e.message : String(e) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Triangle media bridge listening on http://127.0.0.1:${port}`);
  console.log("Endpoints: GET /health, POST /make-media, POST /extract-frames");
});
