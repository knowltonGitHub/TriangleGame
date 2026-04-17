Sandbox (not the MAUI game)

playground.html
  - Triangle board playground. Open in Chrome (or your default browser).

editor.html
  - Container shape editor: paint which lattice triangles are ON, save/load JSON (containerCellMask). Mesh size/origin come from the file when loading.

presets/
  - container-default-T.json, container-default-V.json — cell masks matching playground T and V (open in editor to tweak).
  - Regenerate: node Sandbox/presets/generate-presets.cjs

open-in-chrome.bat
  - Double-click to open playground.html in Chrome (fallback: default browser if Chrome path not found).

make-tick-media.ps1
  - Build MP4 + GIF from screenshot frames in this folder.
  - Example:
      powershell -ExecutionPolicy Bypass -File "Sandbox/make-tick-media.ps1" -InputDir "Sandbox" -Pattern "tg_b56_tick-*.png" -FrameSeconds 0.5 -OutputBase "fall-debug" -OutputDir "Sandbox"

extract-video-frames.ps1
  - Extract PNG frames from a video (reverse direction: MP4 -> PNG).
  - Example:
      powershell -ExecutionPolicy Bypass -File "Sandbox/extract-video-frames.ps1" -InputVideo "Sandbox/fall-debug-b55.mp4" -OutputDir "Sandbox/frames-from-mp4" -OutputPrefix "tick" -Fps 2

media-bridge.cjs
  - Optional local HTTP bridge so the playground page can trigger MP4/GIF build and MP4->PNG extraction.
  - Start it once in a terminal:
      node Sandbox/media-bridge.cjs
  - Playground command box can call bridge endpoint POST /play-command.
    - Local parser works without any API key.
    - Optional LLM mode: set TG_OPENAI_API_KEY (and optional TG_OPENAI_MODEL) before starting bridge.
  - Then in playground.html use toolbar buttons:
      Make MP4/GIF
      MP4->PNG
      Run scenario
      Check bridge / Stop bridge
  - Browser security note: page JS cannot execute local ffmpeg directly; this bridge is the safe opt-in local integration.

bridge-supervisor.cjs (optional)
  - Optional local supervisor for bridge/service controls from the page UI.
  - Start it once in a terminal:
      node Sandbox/bridge-supervisor.cjs
  - The page can then use:
      Check supervisor
      Start bridge / Stop bridge
      Start service / Stop service
  - Optional service target:
      set environment variable `TG_SUPERVISOR_SERVICE_NAME` before starting supervisor.
      Example (PowerShell):
        $env:TG_SUPERVISOR_SERVICE_NAME="YourWindowsServiceName"
        node Sandbox/bridge-supervisor.cjs

run-tick-scenario.cjs + scenarios/demo-run.json
  - Headless automation: set container, light IDs, click Fall N ticks, save PNG per tick, then auto-build MP4/GIF.
  - Requires:
      npm install --prefix Sandbox playwright
      node Sandbox/media-bridge.cjs
  - Direct CLI example:
      node Sandbox/run-tick-scenario.cjs --scenario Sandbox/scenarios/demo-run.json
  - Repeated gameplay-style drops (same spawn ID, settle each drop, auto movie):
      node Sandbox/run-tick-scenario.cjs --scenario Sandbox/scenarios/repeated-id20.json
  - For repeated drops, runner stops early when spawn can no longer be added (`stopWhenSpawnBlocked: true`).

run-physics-tests.cjs + scenarios/physics-tests.json
  - Headless pass/fail harness for scripted physics checks (no video output required).
  - Watch mode (visible browser + status label in-page): set `"visualize": true` in suite JSON or pass `--show`.
  - Delay controls for visibility: `stepDelayMs`, `tickDelayMs`, `testEndDelayMs` (suite JSON or CLI flags).
  - Force fast headless run (override visualize): pass `--headless`.
  - Per-test container JSON load:
      set `containerFile` on a test (or in `defaults`) to load a saved board/container JSON before actions.
  - Per-test physics rules JSON load:
      set `rulesFile` on a test (or in `defaults`) to load declarative movement state rules before actions.
  - Run full suite:
      node Sandbox/run-physics-tests.cjs --file Sandbox/scenarios/physics-tests.json
  - Run one test by name:
      node Sandbox/run-physics-tests.cjs --file Sandbox/scenarios/physics-tests.json --test bottom4-drop20-settles
  - Action examples in test JSON:
      loadContainerFile, loadRulesFile, setContainer, allOff, setOnIds, addOnIds, addId, addTopMiddleId, addBottomIds, fall, settle, repeatTopMiddleSettle
  - Assertion examples:
      stable, settleTicksMax, onCountEquals, onCountAtLeast, includesIds, excludesIds, nextTickHasPhase, nextTickHasAnyPhase, nextTickLacksAnyPhase
  - Automation note:
      Physics uses mesh keys `ti,tj,kind` internally. `__TG_AUTOMATION__.triangleSightFromKey("ti,tj,kind")` is the canonical sight API; `triangleSightById(debugLabel)` resolves a human debug label to a key first. Sight objects list neighbor keys (`litEdgeNeighborKeys`, …) and optional `laneAnyLabel` / `laneFreeLabel` for readable logs only.

find-phase-seeds.cjs
  - Helper to scan IDs and find seeds that trigger target next-tick phases (lane/wall/pivot-like) in V container.
  - Example:
      node Sandbox/find-phase-seeds.cjs

send-play-command.cjs
  - CLI helper to send one text command to the local bridge endpoint `/dispatch-command`.
  - Can also fetch latest bridge-cached telemetry via `GET /telemetry`.
  - Example:
      node Sandbox/send-play-command.cjs "light triangle 20 and fall 2 ticks"
      node Sandbox/send-play-command.cjs "open better tri.json"
      node Sandbox/send-play-command.cjs "load physics rules"
      node Sandbox/send-play-command.cjs "run top middle fill demo"
      node Sandbox/send-play-command.cjs "stop demo"
      node Sandbox/send-play-command.cjs --telemetry --limit 40
  - Requires bridge running:
      node Sandbox/media-bridge.cjs
  - To execute on the page, keep `playground.html` open; it polls `/next-command` and applies dispatched actions.

From Cursor / VS Code:
  - Ctrl+Shift+P (Command Palette) -> "Tasks: Run Task"
  - Choose "Open triangle playground (Chrome)"

Copy JSON / load JSON in the page for patterns. Load also accepts editor `containerCellMask` files (greens start empty). Does not change Design/docs or TriangleGame/.

Sandbox/ and .vscode/ are un-ignored in .cursorignore.
