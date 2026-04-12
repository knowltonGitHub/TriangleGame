Sandbox (not the MAUI game)

index.html
  - Triangle board playground. Open in Chrome (or your default browser).

editor.html
  - Container shape editor: paint which lattice triangles are ON, save/load JSON (containerCellMask). Mesh size/origin come from the file when loading.

presets/
  - container-default-T.json, container-default-V.json — cell masks matching playground T and V (open in editor to tweak).
  - Regenerate: node Sandbox/presets/generate-presets.cjs

open-in-chrome.bat
  - Double-click to open index.html in Chrome (fallback: default browser if Chrome path not found).

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
  - Then in index.html use toolbar buttons:
      Make MP4/GIF
      MP4->PNG
      Run scenario
  - Browser security note: page JS cannot execute local ffmpeg directly; this bridge is the safe opt-in local integration.

run-tick-scenario.cjs + scenarios/demo-run.json
  - Headless automation: set container, light IDs, click Fall N ticks, save PNG per tick, then auto-build MP4/GIF.
  - Requires:
      npm install --prefix Sandbox playwright
      node Sandbox/media-bridge.cjs
  - Direct CLI example:
      node Sandbox/run-tick-scenario.cjs --scenario Sandbox/scenarios/demo-run.json

From Cursor / VS Code:
  - Ctrl+Shift+P (Command Palette) -> "Tasks: Run Task"
  - Choose "Open triangle playground (Chrome)"

Copy JSON / load JSON in the page for patterns. Load also accepts editor `containerCellMask` files (greens start empty). Does not change Design/docs or TriangleGame/.

Sandbox/ and .vscode/ are un-ignored in .cursorignore.
