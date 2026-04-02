# Design (single place for game design work)

## Layout

| Folder | Purpose |
|--------|---------|
| `docs/movement-rules/` | Written Q&A and movement notes (e.g. `Gravity.md`). |
| `scripts/` | Python visualization and geometry experiments (`labeled.py`, `abc.py`, ...). Run scripts from this folder. |
| `assets/mockups/` | PNG mockups (`TriangleContainer*.png`, `TriangleField.png`, ...). |
| `archives/` | Zips and older repo snapshots (`repo-snapshots/`, `templates.zip`). |

## Cursor planning artifact

Triangle movement / simulation plan: `.cursor/plans/triangle_movement_spec_b7247755.plan.md` (includes coverage matrix).

## Housekeeping

If an empty folder `python images` remains, another process held a lock during reorganization; delete it manually when idle. All files live in `scripts/`.

## Game app

The MAUI app is at repo root: `TriangleGame/` (not under `Design/`).
