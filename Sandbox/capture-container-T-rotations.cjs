/**
 * Renders a containerCellMask JSON (triangular mesh) at editor-equivalent rotations
 * (60° CW steps, 0..5, same as editor.html / playground.html) and writes centered PNGs via Playwright.
 *
 * Produces:
 *   - export/container-rotations/<slug>-clean-step-N-cw60deg.png
 *   - export/container-rotations/with-numbers/<slug>-with-numbers-step-N-cw60deg.png
 *     (triangle # labels + r{j} row labels match playground mask iteration; both rotate with the mesh)
 *
 * Usage (from Sandbox/):
 *   node capture-container-T-rotations.cjs
 *   node capture-container-T-rotations.cjs "better tri.json"
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const M = Math.sqrt(3);
const rnd6 = (x) => Math.round(x * 1e6) / 1e6;

function H(a) {
  return (a * M) / 2;
}

function latticeVert(ii, jj, ad, oxd, oyd) {
  const h = H(ad);
  return { x: rnd6(oxd + ii * ad + (jj * ad) / 2), y: rnd6(oyd + jj * h) };
}

function triVertsFromCell(ii, jj, kind, ad, oxd, oyd) {
  const L = latticeVert;
  const v0 = L(ii, jj, ad, oxd, oyd);
  const v10 = L(ii + 1, jj, ad, oxd, oyd);
  const v01 = L(ii, jj + 1, ad, oxd, oyd);
  const v11 = L(ii + 1, jj + 1, ad, oxd, oyd);
  if (kind === 0) return [v0, v10, v01];
  return [v10, v11, v01];
}

function pathDFromVerts(v) {
  return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} Z`;
}

function edgeKeyVerts(p, q) {
  const s1 = `${p.x},${p.y}`;
  const s2 = `${q.x},${q.y}`;
  return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
}

function addTessEdge(edgeMap, p, q) {
  const k = edgeKeyVerts(p, q);
  if (!edgeMap.has(k)) edgeMap.set(k, [p, q]);
}

function tessGridPathFromCells(arr, ad, oxd, oyd) {
  const edgeMap = new Map();
  for (let i = 0; i < arr.length; i++) {
    const tr = arr[i];
    const v = triVertsFromCell(tr.ti, tr.tj, tr.kind, ad, oxd, oyd);
    addTessEdge(edgeMap, v[0], v[1]);
    addTessEdge(edgeMap, v[1], v[2]);
    addTessEdge(edgeMap, v[2], v[0]);
  }
  let d = "";
  edgeMap.forEach((pair) => {
    const p0 = pair[0];
    const p1 = pair[1];
    d += `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} `;
  });
  return d;
}

function kKey(t) {
  return `${t.ti},${t.tj},${t.kind}`;
}

/**
 * Same iteration and labeling as playground.html / js/playground.js build() when cellMaskKeys is set.
 */
function buildCellsFromMask(maskKeys, side, ox, oy, gridRows, gridCols) {
  const maskSet = new Set(maskKeys.map(String));
  const cells = [];
  for (let jj = 0; jj < gridRows; jj++) {
    for (let ii = 0; ii < gridCols; ii++) {
      for (let kind = 0; kind < 2; kind++) {
        const k = `${ii},${jj},${kind}`;
        if (!maskSet.has(k)) continue;
        const v = triVertsFromCell(ii, jj, kind, side, ox, oy);
        const cx = (v[0].x + v[1].x + v[2].x) / 3;
        const cy = (v[0].y + v[1].y + v[2].y) / 3;
        cells.push({
          label: cells.length,
          ti: ii,
          tj: jj,
          kind,
          cx,
          cy,
        });
      }
    }
  }
  return cells;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvgForStep(cells, rotStep, a, oxL, oyL, opts) {
  const showNumbers = !!(opts && opts.showNumbers);
  const n = cells.length;
  let rcX = 0;
  let rcY = 0;
  for (let i = 0; i < n; i++) {
    rcX += cells[i].cx;
    rcY += cells[i].cy;
  }
  rcX /= n;
  rcY /= n;
  const Rcell = a / Math.sqrt(3);
  let Rm = 0;
  for (let i = 0; i < n; i++) {
    const tr = cells[i];
    const dx = tr.cx - rcX;
    const dy = tr.cy - rcY;
    const d = Math.sqrt(dx * dx + dy * dy) + Rcell;
    if (d > Rm) Rm = d;
  }
  Rm += Math.max(8, a * 0.22);
  const framePad = Math.max(16, a * 0.75);
  const frameYBias = Math.max(6, a * 0.28);
  const Rf = Rm + framePad;
  const vbX = rcX - Rf;
  const vbY = rcY - Rf + frameYBias;
  const vbW = 2 * Rf;
  const vbH = 2 * Rf;

  let dFill = "";
  for (let i = 0; i < cells.length; i++) {
    const tr = cells[i];
    const v0 = triVertsFromCell(tr.ti, tr.tj, tr.kind, a, oxL, oyL);
    dFill += pathDFromVerts(v0);
  }
  const dGrid = tessGridPathFromCells(cells, a, oxL, oyL);
  const deg = rotStep * 60;

  let numberTexts = "";
  let rowTexts = "";
  if (showNumbers) {
    for (let i = 0; i < cells.length; i++) {
      const tr = cells[i];
      numberTexts += `<text x="${tr.cx}" y="${tr.cy}" class="L numMuted" pointer-events="none">${escapeXml(tr.label)}</text>`;
    }
    const byR = {};
    for (let i = 0; i < cells.length; i++) {
      const tr = cells[i];
      if (!byR[tr.tj]) byR[tr.tj] = [];
      byR[tr.tj].push(tr);
    }
    const rk = Object.keys(byR)
      .map(Number)
      .sort((x, y) => x - y);
    for (let j = 0; j < rk.length; j++) {
      const rn = rk[j];
      const row = byR[rn];
      let minx = row[0].cx;
      let sumy = 0;
      for (let i = 0; i < row.length; i++) {
        if (row[i].cx < minx) minx = row[i].cx;
        sumy += row[i].cy;
      }
      const avgy = sumy / row.length;
      const x = minx - a * 0.55;
      rowTexts += `<text x="${x}" y="${avgy}" class="rowR" pointer-events="none">${escapeXml("r" + rn)}</text>`;
    }
  }

  const svgStyle = showNumbers
    ? `<defs><style type="text/css"><![CDATA[
text.L{pointer-events:none;font-size:11px;fill:#e8eaed;text-anchor:middle;dominant-baseline:central;font-weight:600;font-family:system-ui,sans-serif}
text.L.numMuted{fill:#9aa0a6}
text.rowR{pointer-events:none;font-size:10px;fill:#8ab4f8;text-anchor:end;dominant-baseline:central;opacity:.95;font-weight:600;font-family:system-ui,sans-serif}
]]></style></defs>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">
${svgStyle}
<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#1a1d23"/>
<g transform="rotate(${deg},${rcX},${rcY})">
<path d="${dFill}" fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.11)" stroke-width="0.65" stroke-linejoin="miter" shape-rendering="geometricPrecision"/>
<path d="${dGrid}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" shape-rendering="geometricPrecision"/>
${numberTexts}
${rowTexts}
</g>
</svg>`;
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const jsonPath = path.resolve(__dirname, process.argv[2] || "better tri.json");
  const slug = path
    .basename(jsonPath, path.extname(jsonPath))
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const outDir = path.join(__dirname, "export", "container-rotations");
  const outDirNumbered = path.join(outDir, "with-numbers");
  fs.mkdirSync(outDirNumbered, { recursive: true });

  const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (!payload.mesh || !Array.isArray(payload.keys)) {
    throw new Error("Expected containerCellMask JSON with mesh + keys");
  }
  const m = payload.mesh;
  const side = m.side;
  const originX = typeof m.originX === "number" ? m.originX : 24;
  const originY = typeof m.originY === "number" ? m.originY : 24;
  const gridRows = m.gridRows;
  const gridCols = m.gridCols;

  const cells = buildCellsFromMask(payload.keys, side, originX, originY, gridRows, gridCols);
  if (!cells.length) throw new Error("No valid keys in container JSON");

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: Math.ceil(1200), height: Math.ceil(1200) },
    deviceScaleFactor: 2,
  });

  const htmlWrap = (svg) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:#1a1d23;display:flex;justify-content:center;align-items:center;min-height:100vh;">${svg}</body></html>`;

  for (let rotStep = 0; rotStep < 6; rotStep++) {
    const svgClean = buildSvgForStep(cells, rotStep, side, originX, originY, { showNumbers: false });
    await page.setContent(htmlWrap(svgClean), { waitUntil: "load" });
    const outClean = path.join(outDir, `${slug}-clean-step-${rotStep}-cw60deg.png`);
    await page.screenshot({ path: outClean, type: "png", omitBackground: false });
    process.stdout.write(`Wrote ${path.relative(repoRoot, outClean)}\n`);

    const svgNum = buildSvgForStep(cells, rotStep, side, originX, originY, { showNumbers: true });
    await page.setContent(htmlWrap(svgNum), { waitUntil: "load" });
    const outNum = path.join(outDirNumbered, `${slug}-with-numbers-step-${rotStep}-cw60deg.png`);
    await page.screenshot({ path: outNum, type: "png", omitBackground: false });
    process.stdout.write(`Wrote ${path.relative(repoRoot, outNum)}\n`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
