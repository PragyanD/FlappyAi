# FlappyAI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bird-count control, simulation speed slider, dead-bird fade-out, neural network overlay, and targeted design improvements to the existing FlappyAI p5.js game.

**Architecture:** Refactor `game.js` to separate simulation logic (`updateSim`) from rendering (`renderFrame`), enabling the speed multiplier to run N ticks per frame. HTML controls in `index.html` communicate with the p5.js sketch via shared `window`-level variables. All visualization stays inside the p5.js canvas.

**Tech Stack:** Vanilla JavaScript · p5.js v1.6.0 · HTML/CSS (no bundler, no framework)

---

## File Map

| File | What changes |
|------|-------------|
| `index.html` | Add `#controls` panel with bird count input + speed slider |
| `game.js` | Refactor update/render split; add fade-out, NN overlay, design improvements |

---

## Task 1: Refactor — separate `updateSim()` from `renderFrame()`

> Foundation for the speed slider. Everything else builds on this split.

**Files:**
- Modify: `game.js`

**What to do:**

Extract the simulation logic out of `draw()` into two new functions:

```js
// Advances one game tick. No drawing.
function updateSim() {
  tick++;

  if (tick % PIPE_INTERVAL === 0) {
    pipes.push(new Pipe(curGapH));
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    if (pipes[i].offscreen()) {
      pipesPassed++;          // new global (replaces no tracking)
      pipes.splice(i, 1);
    }
  }

  for (let b of birds) {
    if (!b.alive) continue;
    b.think(pipes);
    b.update();
    for (let p of pipes) {
      if (b.alive) b.hits(p);
    }
  }
}

// Renders one frame. No state mutation.
function renderFrame() {
  background(113, 197, 207);
  drawClouds();

  fill(210, 180, 120); noStroke();
  rect(0, height - GROUND_H, width, GROUND_H);
  fill(98, 165, 45); noStroke();
  rect(0, height - GROUND_H, width, 12);

  for (let p of pipes) p.draw();

  // Draw dead birds (fading), then alive non-best, then best
  let bestAlive = null;
  for (let b of birds) {
    if (b.alive) {
      if (!bestAlive || b.ticks > bestAlive.ticks) bestAlive = b;
    }
  }
  for (let b of birds) { if (!b.alive)                   b.draw(false); }
  for (let b of birds) { if (b.alive && b !== bestAlive) b.draw(false); }
  if (bestAlive) bestAlive.draw(true);

  const score = bestAlive ? bestAlive.ticks : 0;
  const alive = birds.filter(b => b.alive).length;
  drawHUD(alive, score);
}
```

Replace `draw()` with:

```js
function draw() {
  const speed = window._flappySpeed || 1;

  for (let s = 0; s < speed; s++) {
    updateSim();
    if (birds.every(b => !b.alive)) {
      evolve();     // renamed from the inline end-of-gen block
      break;
    }
  }

  renderFrame();
}
```

Extract the end-of-generation block into `evolve()`:

```js
function evolve() {
  let best = null;
  for (let b of birds) {
    if (!best || b.ticks > best.ticks) best = b;
  }
  if (best) {
    if (best.ticks > bestScore) bestScore = best.ticks;
    bestBrain = best.brain.copy();
  }
  nextGen();
}
```

Add new global at the top of `game.js`:

```js
let pipesPassed = 0;   // cleared per generation in nextGen()
```

Reset in `nextGen()`:

```js
function nextGen() {
  gen++;
  tick        = 0;
  pipes       = [];
  pipesPassed = 0;
  // ... rest unchanged
}
```

**Verify:** Open `index.html` in a browser. Game should play identically to before — birds evolve, HUD shows GEN/ALIVE/SCORE/BEST.

**Commit:**
```bash
git add game.js
git commit -m "refactor: split updateSim and renderFrame for speed multiplier"
```

---

## Task 2: Dead bird fade-out

**Files:**
- Modify: `game.js` — `Bird` class

**Step 1: Add `fadeTimer` to Bird constructor**

```js
constructor(brain) {
  this.x         = 90;
  this.y         = height / 2;
  this.vy        = 0;
  this.alive     = true;
  this.ticks     = 0;
  this.fadeTimer = 0;    // 0 = alive; >0 = fading out
  this.brain     = brain || new NeuralNetwork(3, 6, 1);
}
```

**Step 2: Add `die()` helper and replace raw `this.alive = false`**

```js
die() {
  this.alive     = false;
  this.fadeTimer = 1;   // trigger fade
}
```

In `update()`, change:
```js
// OLD:
if (this.y - BIRD_R <= 0 || this.y + BIRD_R >= height - GROUND_H) {
  this.alive = false;
}
// NEW:
if (this.y - BIRD_R <= 0 || this.y + BIRD_R >= height - GROUND_H) {
  this.die();
}
```

In `hits()`, change:
```js
// OLD (two places):
this.alive = false;
// NEW:
this.die();
```

**Step 3: Update `draw()` to use fading alpha**

In `Bird.draw(isBest)`, the current alpha logic is:
```js
const alpha = isBest ? 255 : 45;
```

Change to:
```js
let alpha;
if (!this.alive) {
  // fading out: alpha goes 45 → 0 over 20 frames
  const FADE_FRAMES = 20;
  alpha = 45 * max(0, 1 - this.fadeTimer / FADE_FRAMES);
  this.fadeTimer++;
} else {
  alpha = isBest ? 255 : 45;
}
if (alpha <= 0) return;   // fully faded, skip drawing
```

**Verify:** Open browser. When birds die, they should visibly fade out (fast, ~0.3 sec) at their death position rather than persisting as ghost birds through pipes.

**Commit:**
```bash
git add game.js
git commit -m "fix: dead birds fade out over 20 frames instead of persisting"
```

---

## Task 3: HTML control panel

**Files:**
- Modify: `index.html`

**Replace the entire file with:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlappyAI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: #1a1a1a;
    }

    #controls {
      flex-shrink: 0;
      background: #111;
      color: #ccc;
      padding: 7px 16px;
      display: flex;
      align-items: center;
      gap: 28px;
      font: 12px/1 monospace;
      border-bottom: 1px solid #333;
    }

    #controls label {
      display: flex;
      align-items: center;
      gap: 7px;
      white-space: nowrap;
    }

    #controls input[type="number"] {
      width: 58px;
      padding: 3px 5px;
      background: #2a2a2a;
      color: #fff;
      border: 1px solid #444;
      border-radius: 3px;
      font: 12px monospace;
    }

    #controls input[type="range"] {
      width: 110px;
      accent-color: #4aaa88;
    }

    #controls button {
      padding: 4px 13px;
      background: #2a7a5a;
      color: #fff;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font: 12px monospace;
      transition: background 0.15s;
    }

    #controls button:hover { background: #3a9a6a; }

    #speed-val {
      min-width: 28px;
      display: inline-block;
      color: #fff;
    }

    canvas { display: block; }
  </style>
</head>
<body>
  <div id="controls">
    <label>
      Birds
      <input type="number" id="birdCount" value="50" min="5" max="500" step="5">
    </label>
    <button id="restartBtn">Restart</button>
    <label>
      Speed
      <input type="range" id="speedSlider" min="1" max="20" value="1" step="1">
      <span id="speed-val">1×</span>
    </label>
  </div>

  <script src="p5.js"></script>
  <script src="game.js"></script>

  <script>
    // Speed slider
    const speedSlider = document.getElementById('speedSlider');
    const speedVal    = document.getElementById('speed-val');
    speedSlider.addEventListener('input', () => {
      window._flappySpeed = parseInt(speedSlider.value, 10);
      speedVal.textContent = speedSlider.value + '×';
    });

    // Bird count + restart
    const restartBtn  = document.getElementById('restartBtn');
    const birdCountEl = document.getElementById('birdCount');
    restartBtn.addEventListener('click', () => {
      const n = parseInt(birdCountEl.value, 10);
      if (n >= 5 && n <= 500) {
        window._flappyPopSize = n;
        window._flappyRestart = true;   // polled in game.js
      }
    });

    // Defaults
    window._flappySpeed   = 1;
    window._flappyPopSize = 50;
    window._flappyRestart = false;
  </script>
</body>
</html>
```

**Verify:** Open browser. A dark control bar should appear at the top. Speed slider and bird count input render. No game-breaking errors in console.

**Commit:**
```bash
git add index.html
git commit -m "feat: add HTML control panel with speed slider and bird count input"
```

---

## Task 4: Wire speed slider to simulation

The `draw()` loop already reads `window._flappySpeed` from Task 1 (`const speed = window._flappySpeed || 1;`). No extra code needed.

**Verify:** Drag speed slider to 10×. Birds should evolve visibly faster. Drag back to 1×. Game returns to normal speed.

---

## Task 5: Wire bird count + restart button

**Files:**
- Modify: `game.js`

**Step 1: Replace `const POP_SIZE = 50` with a `let`**

```js
// OLD:
const POP_SIZE = 50;
// NEW:
let popSize = 50;
```

Replace all remaining `POP_SIZE` references in `game.js` with `popSize`:
- `birds.push(new Bird(...))` loop condition: `i < popSize`
- HUD text: `alive + '/' + popSize`

**Step 2: Poll restart flag at top of `draw()`**

Add at the very top of `draw()`, before the speed loop:

```js
function draw() {
  // Handle restart request from HTML controls
  if (window._flappyRestart) {
    window._flappyRestart = false;
    popSize   = window._flappyPopSize || 50;
    gen       = 0;
    bestScore = 0;
    bestBrain = null;
    nextGen();
  }

  const speed = window._flappySpeed || 1;
  // ... rest of draw()
}
```

**Verify:**
1. Change bird count to 100, click Restart — HUD shows ALIVE 100/100 at gen 1.
2. Change to 10, click Restart — only 10 birds.
3. Mid-gen restart works without errors.

**Commit:**
```bash
git add game.js
git commit -m "feat: bird count control and restart wired to HTML panel"
```

---

## Task 6: Neural network visualization overlay

**Files:**
- Modify: `game.js` — `NeuralNetwork` class + new `drawNNOverlay()` function

**Step 1: Store activations during `predict()`**

In `NeuralNetwork.predict()`, add storage of intermediate values:

```js
predict(inputs) {
  // Hidden layer
  const hidden = [];
  for (let h = 0; h < this.hSize; h++) {
    let sum = this.bH[h][0];
    for (let i = 0; i < this.iSize; i++) {
      sum += this.wIH[h][i] * inputs[i];
    }
    hidden[h] = this._sig(sum);
  }
  // Output layer
  let outSum = this.bO[0][0];
  for (let h = 0; h < this.hSize; h++) {
    outSum += this.wHO[0][h] * hidden[h];
  }
  const output = this._sig(outSum);

  // Store for visualization
  this.lastInputs = inputs.slice();
  this.lastHidden = hidden.slice();
  this.lastOutput = output;

  return output;
}
```

**Step 2: Add `drawNNOverlay(nn)` function**

Add this function to `game.js` (near the bottom, before or after `drawHUD`):

```js
function drawNNOverlay(nn) {
  if (!nn || !nn.lastHidden) return;

  const PW  = 230;   // panel width
  const PH  = 185;   // panel height
  const PAD = 12;
  const px  = width  - PW - PAD;
  const py  = height - PH - PAD;
  const NR  = 8;     // node radius

  // Panel background
  fill(15, 15, 15, 185);
  noStroke();
  rect(px, py, PW, PH, 8);

  // Title
  fill(150);
  noStroke();
  textSize(10);
  textAlign(LEFT, TOP);
  text('NEURAL NET  (best bird)', px + 10, py + 8);

  // Column x positions (within panel)
  const colX = [px + 42, px + 115, px + 190];

  // Row y positions per column
  const iCount = nn.iSize;
  const hCount = nn.hSize;
  const oCount = nn.oSize;

  function colYs(count) {
    const ys = [];
    const usable = PH - 36;
    for (let i = 0; i < count; i++) {
      ys.push(py + 28 + (usable / (count + 1)) * (i + 1));
    }
    return ys;
  }

  const iYs = colYs(iCount);
  const hYs = colYs(hCount);
  const oYs = colYs(oCount);

  // Draw connections: input → hidden
  for (let h = 0; h < hCount; h++) {
    for (let i = 0; i < iCount; i++) {
      const w = nn.wIH[h][i];
      const c = w > 0 ? color(50, 210, 120, 130) : color(210, 60, 60, 130);
      stroke(c);
      strokeWeight(constrain(abs(w) * 1.2, 0.3, 2.5));
      line(colX[0], iYs[i], colX[1], hYs[h]);
    }
  }

  // Draw connections: hidden → output
  for (let h = 0; h < hCount; h++) {
    const w = nn.wHO[0][h];
    const c = w > 0 ? color(50, 210, 120, 130) : color(210, 60, 60, 130);
    stroke(c);
    strokeWeight(constrain(abs(w) * 1.2, 0.3, 2.5));
    line(colX[1], hYs[h], colX[2], oYs[0]);
  }

  noStroke();

  // Input labels + nodes
  const inputLabels = ['Y', 'DIST', 'GAP'];
  for (let i = 0; i < iCount; i++) {
    const act = nn.lastInputs ? nn.lastInputs[i] : 0;
    fill(lerpColor(color(50, 50, 50), color(255, 220, 50), act));
    ellipse(colX[0], iYs[i], NR * 2, NR * 2);
    fill(180);
    textSize(8);
    textAlign(RIGHT, CENTER);
    text(inputLabels[i] || '?', colX[0] - NR - 3, iYs[i]);
  }

  // Hidden nodes
  for (let h = 0; h < hCount; h++) {
    const act = nn.lastHidden ? nn.lastHidden[h] : 0;
    fill(lerpColor(color(50, 50, 50), color(80, 180, 255), act));
    ellipse(colX[1], hYs[h], NR * 2, NR * 2);
  }

  // Output node
  const outAct = nn.lastOutput || 0;
  fill(outAct > 0.5
    ? color(80, 240, 100)   // flapping — green
    : color(50, 50, 50));   // not flapping — dark
  ellipse(colX[2], oYs[0], NR * 2, NR * 2);
  fill(180);
  textSize(8);
  textAlign(LEFT, CENTER);
  text('FLAP', colX[2] + NR + 3, oYs[0]);

  // Column headers
  fill(120);
  textSize(8);
  textAlign(CENTER, TOP);
  text('IN',     colX[0], py + 18);
  text('HIDDEN', colX[1], py + 18);
  text('OUT',    colX[2], py + 18);
}
```

**Step 3: Call `drawNNOverlay` from `renderFrame()`**

At the end of `renderFrame()`, before or after `drawHUD`, add:

```js
// Find best alive bird's brain, or fall back to bestBrain
let vizBrain = null;
for (let b of birds) {
  if (b.alive) {
    if (!vizBrain || b.ticks > (vizBrain._ticks || 0)) {
      b.brain._ticks = b.ticks;
      vizBrain = b.brain;
    }
  }
}
if (!vizBrain) vizBrain = bestBrain;
drawNNOverlay(vizBrain);
```

**Verify:** Open browser. Bottom-right corner should show a dark panel with:
- 3 input nodes (Y, DIST, GAP) on the left
- 6 hidden nodes in the middle
- 1 output node (FLAP) on the right
- Connections colored green/red by weight
- Nodes lighting up yellow/blue as the best bird makes decisions
- FLAP node turns green when the bird flaps

**Commit:**
```bash
git add game.js
git commit -m "feat: neural network overlay visualization for best bird"
```

---

## Task 7: Design improvements

### 7a — Add velocity (`vy`) as 4th neural network input

**Files:** `game.js` — `Bird` class

In `Bird` constructor, change default brain to 4 inputs:
```js
this.brain = brain || new NeuralNetwork(4, 6, 1);
```

In `Bird.think()`, add 4th input:
```js
const inp0 = this.y / height;
const inp1 = (nextPipe.x - this.x) / width;
const inp2 = nextPipe.gapCY / height;
const inp3 = this.vy / 20;           // normalized velocity

const output = this.brain.predict([inp0, inp1, inp2, inp3]);
```

Update the NN overlay input labels in `drawNNOverlay`:
```js
const inputLabels = ['Y', 'DIST', 'GAP', 'VEL'];
```

> **Why:** The bird currently has no sense of its own momentum. Adding `vy` lets the network learn to anticipate falling and flap earlier — improving convergence speed.

**Verify:** Reload. Generation 1 still works. Birds may converge faster from gen 5 onward.

**Commit:**
```bash
git add game.js
git commit -m "feat: add velocity as 4th neural network input for better gravity awareness"
```

---

### 7b — Top-3 elites instead of top-1

**Files:** `game.js`

Change `bestBrain` (single) to `eliteBrains` (array of up to 3):

```js
// Replace:
let bestBrain = null;

// With:
let eliteBrains = [];   // array of {brain, ticks} sorted descending
```

Update `evolve()`:

```js
function evolve() {
  // Sort all birds by ticks descending
  const ranked = birds.slice().sort((a, b) => b.ticks - a.ticks);

  // Keep top 3
  for (let i = 0; i < min(3, ranked.length); i++) {
    if (ranked[i].ticks > 0) {
      if (!eliteBrains[i] || ranked[i].ticks > eliteBrains[i].ticks) {
        eliteBrains[i] = { brain: ranked[i].brain.copy(), ticks: ranked[i].ticks };
      }
    }
  }
  eliteBrains.sort((a, b) => b.ticks - a.ticks);

  if (ranked[0].ticks > bestScore) bestScore = ranked[0].ticks;
  nextGen();
}
```

Update `nextGen()` to seed from elites:

```js
function nextGen() {
  gen++;
  tick        = 0;
  pipes       = [];
  pipesPassed = 0;
  curGapH     = max(BASE_GAP - (gen - 1) * GAP_SHRINK, MIN_GAP);

  birds = [];

  if (eliteBrains.length > 0) {
    // Clone each elite once (up to 3 elites)
    for (let i = 0; i < min(eliteBrains.length, popSize); i++) {
      birds.push(new Bird(eliteBrains[i].brain.copy()));
    }
    // Fill the rest with mutations of the best elite
    for (let i = eliteBrains.length; i < popSize; i++) {
      const src = eliteBrains[i % eliteBrains.length].brain.copy();
      src.mutate(0.2, 0.3);
      birds.push(new Bird(src));
    }
  } else {
    for (let i = 0; i < popSize; i++) {
      birds.push(new Bird());
    }
  }
}
```

Update the `vizBrain` fallback in `renderFrame()`:
```js
if (!vizBrain && eliteBrains.length > 0) vizBrain = eliteBrains[0].brain;
```

Also update the restart block in `draw()`:
```js
eliteBrains = [];
```

**Verify:** Multi-generation run. BEST score should hold or improve each gen; losing a great brain to bad luck should happen less often.

**Commit:**
```bash
git add game.js
git commit -m "feat: preserve top-3 elite brains across generations"
```

---

### 7c — Show pipe count in HUD

**Files:** `game.js` — `drawHUD()`

Update `drawHUD` signature and body:

```js
function drawHUD(alive, score) {
  fill(20, 20, 20, 160);
  noStroke();
  rect(12, 12, 195, 115, 10);

  fill(255);
  noStroke();
  textSize(14);
  textAlign(LEFT, TOP);

  text('GEN   ' + gen,                       24, 24);
  text('ALIVE ' + alive + '/' + popSize,     24, 44);
  text('SCORE ' + score,                     24, 64);
  text('BEST  ' + bestScore,                 24, 84);
  text('PIPES ' + pipesPassed,               24, 104);
}
```

**Verify:** HUD shows PIPES counter that increments as pipes scroll off screen.

**Commit:**
```bash
git add game.js
git commit -m "feat: show pipe count in HUD"
```

---

### 7d — Scrolling clouds

**Files:** `game.js`

Add a cloud offset global:
```js
let cloudOffset = 0;
```

Reset in `nextGen()`: no reset needed (clouds scroll continuously).

Update in `updateSim()` (add one line):
```js
cloudOffset = (cloudOffset + PIPE_SPEED * 0.25) % width;
```

Update `drawClouds()` to use offset:

```js
function drawClouds() {
  fill(255, 255, 255, 210);
  noStroke();

  const clouds = [
    [120,  60, 1.0],
    [320,  40, 0.8],
    [580,  75, 1.2],
    [800,  50, 0.9],
    [1050, 65, 1.1],
    [1280, 45, 0.85],
  ];

  for (let i = 0; i < clouds.length; i++) {
    // Each cloud scrolls left; wraps around the right side
    let cx = (clouds[i][0] - cloudOffset % width + width) % width;
    // If cloud has wrapped near left edge, also draw it from the right
    const cy = clouds[i][1];
    const s  = clouds[i][2];

    for (let wrap = 0; wrap < 2; wrap++) {
      const ox = cx + wrap * width;
      if (ox > width + 150) continue;   // off right side, skip
      ellipse(ox,       cy,       80 * s, 45 * s);
      ellipse(ox + 30,  cy - 10,  70 * s, 50 * s);
      ellipse(ox + 60,  cy,       80 * s, 40 * s);
      ellipse(ox + 90,  cy + 5,   60 * s, 35 * s);
    }
  }
}
```

**Verify:** Clouds now scroll slowly left. At 10× speed they scroll faster, matching the sense of motion.

**Commit:**
```bash
git add game.js
git commit -m "feat: scroll clouds with pipe speed for visual depth"
```

---

## Remaining design suggestions (not implemented — future work)

These were identified in the design review but are non-trivial to implement safely without breaking the existing evolution loop:

| Suggestion | Effort | Notes |
|-----------|--------|-------|
| **Crossover** — blend weights from two parent brains | Medium | Requires selecting top-N parents, not just top-3 |
| **localStorage save/load** — persist best brain across refreshes | Medium | Serialize `eliteBrains[0]` to JSON |
| **CDN p5.js** — remove 4MB local file | Low | Replace `<script src="p5.js">` with CDN link; adds internet dependency |
| **Configurable network size** — hidden layer size control | Medium | Add HTML input; requires resetting evolution on change |
| **Tournament selection** — pick parents via random tournament | High | More robust than top-N but significant refactor |

---

## Final commit

```bash
git add docs/plans/2026-03-08-flappy-ai-improvements.md
git commit -m "docs: add implementation plan for FlappyAI improvements"
```
