# Triangle Game — main design doc (living)

**Maintain:** Update this file whenever design answers land in chat (win/lose, moves, phases, goals).  
Do not wait for a separate "please update doc" prompt if the user is iterating on rules.

---

## 1. One-line pitch

Equilateral triangle **cells** fill a **rotating** container; motion is **discrete** (slides / rotations under rules), not continuous physics.

---

## 2. Win / lose (LOCKED)

- **WIN:** Every cell in **FillMask** is **occupied**.
- **LOSE:** Any cell in **FillMask** is **empty**.  
  Whether that is **designer fault**, **player fault**, or both **does not change** the condition.

**FillMask (for code):** the finite **set of triangular cells inside the closed container outline** (same interior as mockups).  
**WIN test:** `occupied` contains all `FillMask`.

---

## 3. Legal moves (LOCKED — discrete shell)

A **slide** or **rotate** is **legal** only if:

- destination cell(s) are **empty**,
- **inside** the container,
- the transition is an **allowed primitive**,
- pieces **never overlap**,
- pieces **never pass through** occupied cells **unless** a **named special rule** says otherwise.

**Reachability:** Configurations that only exist by **editing** the board (e.g. delete one triangle) may be **off** the set of states reachable from **legal play**; treat those as **sandbox stress tests** until a solver proves otherwise.

### 3.1 Slide rule (LOCKED — intent)

**State model:** Each piece **occupies exactly one** triangular cell (a **panel** is ON or OFF).

**Feel:** Triangles **fall** until something stops them; if the container is **tilted**, they **slide** along support like a stiff tile; they **stop** on **container surface** or **another triangle**; **rotation** is a **separate** primitive when the slide story says so (exact rotate predicate still in section 6 as next bite).

**One slide tick ≠ single edge-adjacent hop to opposite-orientation neighbor.**  
Moving only to the **immediate** adjacent cell of **opposite** orientation reads as a **magic flip**; **gravity keeps a triangle "flat" on its contact** in the illustrated sense.

**Slide step (authoritative):** One **slide** advances the piece to the **next legal cell along the downhill slide lane that preserves the piece posture** (same up/down orientation class relative to the support in the mockup sequence). On the grid, that is the **"two-triangle" / skip-intermediate** motion shown in **TICK_EMPTY_TEMPLATE_ONE_TRIANGLE** (tick 1→2→3): stay **up-pointing** on the base while moving toward the **downhill** corner.  
Implementation detail for code: express this as an explicit **slide primitive** (parity / glide chain), **not** as "pick any graph neighbor edge."

**Termination:** Repeat slide ticks while downhill slide remains legal; otherwise evaluate **rotate** or **settle** per micro-behavior order.

---

### 3.2 Look-around zone and single-piece fall cadence (LOCKED - intent)

**Status:** Product rules below are design intent. Sandbox `playground.html` may not enforce all of this in code yet; this section states the target contract.

#### Look-around ("ZONE of awareness")

- Each triangle on the lattice has a **look-around zone**: a structured field of awareness used when reasoning about **how it could move** or **what it sees**.
- That zone is **ego-centric**: it **moves with the triangle** (re-centered on the active cell each tick). Sector layout stays aligned to **gravity / downhill** and the two oblique down directions (three 120-degree sectors; see layered diagrams under `Design/assets/`).
- **Every triangle**, **lit or unlit**, is treated as having this zone for design purposes, even if a given build only *evaluates* movement for lit pieces.
- **Decisions** (rule cascade, candidates, tie-breaks) should ultimately be expressible in terms of what this zone reports (near field, farther rings, sector summaries, isolation vs crowding), not ad hoc global scans unrelated to the piece.

#### Container orientation during a fall ("right side up")

- The container has a **canonical draw orientation**: **right side up**, as first authored in the design/layout.
- **Falling / settling** for a piece assumes this orientation: "down" is defined relative to that fixed cup frame for the drop described here.

#### One piece falling; no rotation until settled

- **Exactly one** triangle is **in the act of falling / settling** inside the container at a time.
- The **container does not rotate while** that triangle's fall sequence is in progress.
- The piece must **fully settle** (stable state for that drop) **before** either:
  - **another** triangle is dropped / released into the container, **or**
  - the **container is rotated**.

#### User-driven cadence

- The **user initiates** each fall into the container (e.g. one tick at a time or settle-to-completion).
- The **user is responsible** for respecting the cadence: **wait until settle** before starting the next drop **or** applying rotation. (Future product behavior may add hard enforcement; this section states the **intended rule**.)

**Alignment:** This intent matches phase gates such as **GRC-001** (no container rotation while motion is not quiescent) and **PHS-004** (one drop pipeline at a time); see **section 4**.

---

## 4. Phases (macro)

**Source of truth:** `Design/docs/movement-rules/TRANSITIONS.csv`  
(Idle / Spawning / Falling / AllSettled / Rotating / PostRotateCascade + BLOCK rows + RuleIds `GRC-001`, `PHS-002`..`004`.)

**Rule IDs (short):**

- **GRC-001** — No container rotation while spawning / falling (motion not quiescent).
- **PHS-002** — No new rotation during post-rotate cascade.
- **PHS-003** — No drop / extra rotate while rotation step applying.
- **PHS-004** — One drop pipeline at a time from spawn through cascade.

---

## 5. Per-piece behaviors (micro — vocabulary)

Priority idea for each **tick:** **FALL (slide)** → **ROTATE** → optional **LAY** → **SETTLE**.  
Slide semantics: see **§3.1**. Rotate predicate: **Open** (next).

---

## 6. Tracking — asked / answered / quality

Legend: **Strong** = ready to implement; **Partial** = needs one more sentence or data; **Open** = not decided.

| Topic | Status | Quality | Note |
|-------|--------|---------|------|
| Win / lose / FillMask meaning | Answered | Strong | Strict full interior; fault-independent |
| Discrete legal move shell | Answered | Strong | No pass-through; specials explicit |
| Phase gates CSV | Answered | Strong | `TRANSITIONS.csv` |
| **Slide rule** (parity / no magic flip) | Answered | Partial | Strong intent; needs formal cell-ID glide on lattice |
| **Rotate rule** (exact predicate) | Open | Open | After slide lattice encoding |
| **Contention** (two pieces, one cell) | Open | Open | Tie policy |
| **FillMask** as explicit cell-ID list (per level) | Open | Partial | Needs lattice + inverted-T enumeration |
| Rotation limits: full 360 vs capped arc | Open | Partial | May be two modes |
| Solver / reachability for published levels | Open | Partial | QA gate for "winnable mask" |

---

## 7. Related files

- `Design/docs/movement-rules/Gravity.md` — early Q&A
- `Design/docs/movement-rules/TRANSITIONS.csv` — phase transition table
- `Design/docs/look-around-and-fall-contract.md` — stub pointer; canonical text is **section 3.2** in this file
- `Design/README.md` — folder map
- Mockup: **TICK_EMPTY_TEMPLATE_ONE_TRIANGLE** (slide ticks / settled then rotate)

---

## 8. Changelog (design session)

- **2026-04-15:** Added **section 3.2** look-around zone (every triangle, lit or unlit), canonical cup orientation for falls, single active fall with **no rotation until settled**, and user cadence; stubbed sibling doc to point here.
- **2026-03-30:** Seeded main doc; locked win/lose + discrete legality; pointed at TRANSITIONS.csv; listed open bites.
- **2026-03-30 (later):** Locked **slide rule** intent (panels ON; slide preserves posture; not single opposite-orientation hop); tracking updated; rotate rule still open.

