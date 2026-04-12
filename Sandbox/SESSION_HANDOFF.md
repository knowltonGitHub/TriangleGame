# Session handoff — Triangle sandbox physics

Last updated: 2026-03-30

## Where we left off

We aligned **Fall 1 tick** in `Sandbox/index.html` with your “lane + rotation” mental model:

1. **Lane step** — Move only to the **same mesh orientation** (`kind`): among downhill cells, **min sideways offset from the gravity line** (`|cross|`), then **shortest step along gravity** (`along`) among **empty** cells in that tier. Skips edge neighbors that would **flip** orientation without a lane move.

2. **Tip (rotation)** — If no lane step: **edge neighbors** only, downhill, empty, **`kind` must change**; ties favor **“heavy to the right”** (max dot with `rightHat = (gy, -gx)` relative to `grav(rotStep)`).

**Playground build:** `PLAYGROUND_BUILD = 23` (also in page title / banner).

## Files touched recently

- `Sandbox/index.html` — fall logic (`neighborFallOnce`), help paragraph under the title.
- Earlier in the thread: `Sandbox/presets/container-default-T.json`, `container-default-V.json`, `generate-presets.cjs`, editor mesh/load — for exporting T/V masks as JSON.

## Open design notes (for when you’re back)

- **Numbered “columns” in the UI** (e.g. #13 → #49 → #83) may **not** match **centroid + gravity** lanes; the current rule is **geometric**. If you need **exact** chains by id, we may need a separate rule (e.g. lattice column id or a data-driven `laneNext` map).
- **Blocked lane** (tier full of pieces): current behavior tries **tip** if no empty lane cell; you may want **stay** vs **tip** clarified after playtesting.
- You wanted to **walk permutations** to validate in-game physics — good next step once you’re back.

## Quick resume checklist

1. Open `Sandbox/index.html` in a browser (hard refresh if needed: Ctrl+F5).
2. Confirm **BUILD 23** in the sticky header.
3. Test a few lights + **Fall 1 tick** / **Settle** and read telemetry.
4. Point the next session at this file + say what felt wrong in play (ids, container T vs mask, etc.).

Safe to delete this file once you no longer need it.
