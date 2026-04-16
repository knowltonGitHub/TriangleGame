const fs = require("fs");
const vm = require("vm");
const path = require("path");

const htmlPath = path.resolve(__dirname, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
  throw new Error("Could not find inline script in Sandbox/index.html");
}

const context = {
  console,
  Math,
  Date,
  Set,
  Map,
  URLSearchParams,
  alert: () => {},
  navigator: { clipboard: null },
  location: { search: "" },
  __TG_HEADLESS_SIM__: true,
};
context.globalThis = context;

vm.createContext(context);
new vm.Script(scriptMatch[1], { filename: "Sandbox/index.html:inline-script" }).runInContext(context);

if (!context.__TG_DEBUG__ || typeof context.__TG_DEBUG__.previewIdsForCell !== "function") {
  throw new Error("Headless debug API not available");
}

const args = process.argv.slice(2);
const hasOddTop = args.includes("--odd-top");
const startArgIdx = args.indexOf("--start");
const startId = startArgIdx >= 0 ? Number(args[startArgIdx + 1]) : 13;
const traceIdx = args.indexOf("--trace");
const maskTraceIdx = args.indexOf("--mask-trace");
const rulesIdx = args.indexOf("--rules");

if (rulesIdx >= 0 && args[rulesIdx + 1]) {
  const rulesPath = path.resolve(process.cwd(), args[rulesIdx + 1]);
  const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  context.__TG_AUTOMATION__.setPhysicsRules(rules);
}

if (maskTraceIdx >= 0) {
  const maskPath = path.resolve(process.cwd(), args[maskTraceIdx + 1] || "better tri.json");
  const cellId = Number(args[maskTraceIdx + 2] || "427");
  const mask = JSON.parse(fs.readFileSync(maskPath, "utf8"));
  if (typeof context.__TG_DEBUG__.fallTraceWithSightForMask !== "function") {
    throw new Error("fallTraceWithSightForMask not available (need newer index.html)");
  }
  const rows = context.__TG_DEBUG__.fallTraceWithSightForMask(mask, cellId);
  process.stdout.write(JSON.stringify(rows, null, 2));
} else if (traceIdx >= 0) {
  const container = args[traceIdx + 1] === "V" ? "V" : "T";
  const cellId = Number(args[traceIdx + 2] || "427");
  const rows = context.__TG_DEBUG__.fallTraceWithSightForCell(container, cellId);
  process.stdout.write(JSON.stringify(rows, null, 2));
} else if (hasOddTop) {
  const lines = [];
  for (let id = 1; id <= 35; id += 2) {
    const trace = context.__TG_DEBUG__.previewTraceForCell("V", id);
    const first = trace[0];
    const ids = context.__TG_DEBUG__.previewIdsForCell("V", id);
    const firstTxt = first ? `${first.from}->${first.to} (${first.phase})` : "(none)";
    lines.push(`start ${id}: first ${firstTxt}; tail ${ids.slice(-4).join(",")}`);
  }
  process.stdout.write(lines.join("\n"));
} else {
  const ids = context.__TG_DEBUG__.previewIdsForCell("V", startId);
  process.stdout.write(ids.join("\n"));
}
