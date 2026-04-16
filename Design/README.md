# Design (single place for game design work)

## Authoritative design spec

**Living doc:** `docs/GAME_DESIGN.md` (win/lose, legal moves, phase CSV links, asked/answered tracking).  
Update it whenever design decisions land—no separate prompt needed.

**Look-around zone and single-piece fall contract:** **`docs/GAME_DESIGN.md` section 3.2** (canonical). `docs/look-around-and-fall-contract.md` is a **stub** for older links.

## Layout

| Folder | Purpose |
|--------|---------|
| `docs/` | **GAME_DESIGN.md** (main spec; includes **section 3.2** fall/look-around intent), **look-around-and-fall-contract.md** (stub pointer), `movement-rules/` (`Gravity.md`, `TRANSITIONS.csv`, …). |
| `scripts/` | Python visualization and geometry experiments (`labeled.py`, `abc.py`, …). Run scripts from this folder. |
| `assets/mockups/` | PNG mockups (`TriangleContainer*.png`, `TriangleField.png`, …). |
| `archives/` | Zips and older repo snapshots (`repo-snapshots/`, `templates.zip`). |

## Cursor planning artifact

Triangle movement / simulation plan: `.cursor/plans/triangle_movement_spec_b7247755.plan.md` (includes coverage matrix).

## Housekeeping

If an empty folder `python images` remains, another process held a lock during reorganization; delete it manually when idle. All files live in `scripts/`.

## Game app

The MAUI app is at repo root: `TriangleGame/` (not under `Design/`).
