#!/usr/bin/env node
const http = require("http");
const path = require("path");
const { spawn, execFile } = require("child_process");

const sandboxDir = __dirname;
const repoRoot = path.resolve(sandboxDir, "..");
const supervisorPort = Number(process.env.TG_SUPERVISOR_PORT || 41818);
const bridgePort = Number(process.env.TG_MEDIA_BRIDGE_PORT || 41817);
const serviceName = String(process.env.TG_SUPERVISOR_SERVICE_NAME || "").trim();

let managedBridgeChild = null;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("invalid JSON body"));
      }
    });
  });
}

function httpGetJson(host, port, route, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { method: "GET", host, port, path: route, timeout: timeoutMs || 1200 },
      (res) => {
        let raw = "";
        res.on("data", (d) => (raw += d));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
          try {
            resolve(JSON.parse(raw || "{}"));
          } catch (_) {
            reject(new Error("invalid JSON response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function httpPostJson(host, port, route, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body || {}), "utf8");
    const req = http.request(
      {
        method: "POST",
        host,
        port,
        path: route,
        timeout: timeoutMs || 1500,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (d) => (raw += d));
        res.on("end", () => {
          let data = {};
          try {
            data = JSON.parse(raw || "{}");
          } catch (_) {}
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error((data && data.error) || `HTTP ${res.statusCode}`));
          resolve(data);
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(payload);
    req.end();
  });
}

async function isBridgeUp() {
  try {
    const data = await httpGetJson("127.0.0.1", bridgePort, "/health", 900);
    return !!(data && data.ok);
  } catch (_) {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms | 0)));
}

async function waitBridgeUp(maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await isBridgeUp()) return true;
    await sleep(180);
  }
  return false;
}

function startManagedBridge() {
  if (managedBridgeChild && !managedBridgeChild.killed) {
    return { started: false, reason: "already_managed_running", pid: managedBridgeChild.pid || null };
  }
  const child = spawn("node", [path.join(sandboxDir, "media-bridge.cjs")], {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true,
  });
  managedBridgeChild = child;
  child.on("exit", () => {
    if (managedBridgeChild === child) managedBridgeChild = null;
  });
  return { started: true, pid: child.pid || null };
}

async function stopBridge() {
  let stopped = false;
  let mode = "none";
  if (await isBridgeUp()) {
    try {
      await httpPostJson("127.0.0.1", bridgePort, "/shutdown", { reason: "supervisor" }, 1200);
      mode = "shutdown_endpoint";
      stopped = true;
    } catch (_) {}
  }
  await sleep(250);
  if (await isBridgeUp()) {
    if (managedBridgeChild && managedBridgeChild.pid) {
      try {
        process.kill(managedBridgeChild.pid, "SIGTERM");
      } catch (_) {}
      await sleep(220);
      mode = "managed_kill";
      stopped = !(await isBridgeUp());
    } else {
      mode = "external_running";
      stopped = false;
    }
  }
  if (!stopped && !(await isBridgeUp())) stopped = true;
  return { stopped, mode };
}

function psExec(script) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { cwd: repoRoot, windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || stdout || err.message || "powershell failed").trim()));
        resolve(String(stdout || "").trim());
      }
    );
  });
}

async function getServiceStatus() {
  if (!serviceName) return { configured: false, name: "" };
  try {
    const out = await psExec(`$s=Get-Service -Name "${serviceName}" -ErrorAction Stop; Write-Output $s.Status`);
    return { configured: true, name: serviceName, exists: true, status: out || "Unknown" };
  } catch (e) {
    return { configured: true, name: serviceName, exists: false, status: "NotFound", error: e.message };
  }
}

async function setServiceState(action) {
  if (!serviceName) throw new Error("TG_SUPERVISOR_SERVICE_NAME is not configured");
  if (action === "start") {
    await psExec(`Start-Service -Name "${serviceName}" -ErrorAction Stop`);
  } else if (action === "stop") {
    await psExec(`Stop-Service -Name "${serviceName}" -ErrorAction Stop`);
  } else {
    throw new Error("invalid service action");
  }
  return getServiceStatus();
}

async function supervisorHealthPayload() {
  return {
    ok: true,
    supervisorPort,
    bridgePort,
    bridge: {
      up: await isBridgeUp(),
      managed: !!managedBridgeChild,
      managedPid: managedBridgeChild && managedBridgeChild.pid ? managedBridgeChild.pid : null,
    },
    service: await getServiceStatus(),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, await supervisorHealthPayload());
    }

    if (req.method === "POST" && req.url === "/bridge/start") {
      if (await isBridgeUp()) return sendJson(res, 200, { ok: true, started: false, reason: "already_running" });
      const r = startManagedBridge();
      const up = await waitBridgeUp(5000);
      return sendJson(res, up ? 200 : 500, { ok: up, ...r, bridgeUp: up });
    }

    if (req.method === "POST" && req.url === "/bridge/stop") {
      const r = await stopBridge();
      return sendJson(res, r.stopped ? 200 : 500, { ok: r.stopped, ...r });
    }

    if (req.method === "POST" && req.url === "/service/start") {
      await parseBody(req);
      const s = await setServiceState("start");
      return sendJson(res, 200, { ok: true, service: s });
    }

    if (req.method === "POST" && req.url === "/service/stop") {
      await parseBody(req);
      const s = await setServiceState("stop");
      return sendJson(res, 200, { ok: true, service: s });
    }

    return sendJson(res, 404, { error: "not found" });
  } catch (e) {
    return sendJson(res, 500, { error: e && e.message ? e.message : String(e) });
  }
});

server.listen(supervisorPort, "127.0.0.1", () => {
  console.log(`Triangle bridge supervisor listening on http://127.0.0.1:${supervisorPort}`);
  console.log("Endpoints: GET /health, POST /bridge/start, POST /bridge/stop, POST /service/start, POST /service/stop");
  console.log(`Target bridge port: ${bridgePort}`);
  console.log(`Target service: ${serviceName || "(not configured; set TG_SUPERVISOR_SERVICE_NAME)"}`);
});

