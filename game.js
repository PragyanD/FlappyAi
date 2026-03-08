// ============================================================
// Constants
// ============================================================
let popSize = 50;
const GRAVITY       = 0.5;
const FLAP_VEL      = -9;
const PIPE_SPEED    = 3;
const PIPE_INTERVAL = 90;
const PIPE_W        = 58;
const BASE_GAP      = 150;
const MIN_GAP       = 110;
const GAP_SHRINK    = 2;
const GROUND_H      = 70;
const BIRD_R        = 13;

// ============================================================
// NeuralNetwork
// ============================================================
class NeuralNetwork {
  constructor(i, h, o) {
    this.iSize = i;
    this.hSize = h;
    this.oSize = o;
    this.wIH = this._randMat(h, i);
    this.bH  = this._randMat(h, 1);
    this.wHO = this._randMat(o, h);
    this.bO  = this._randMat(o, 1);
  }

  _randMat(r, c) {
    const m = [];
    for (let row = 0; row < r; row++) {
      m[row] = [];
      for (let col = 0; col < c; col++) {
        m[row][col] = random(-1, 1);
      }
    }
    return m;
  }

  _sig(x) {
    return 1 / (1 + Math.exp(-x));
  }

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

  copy() {
    const nn = new NeuralNetwork(this.iSize, this.hSize, this.oSize);
    nn.wIH = this.wIH.map(row => row.slice());
    nn.bH  = this.bH.map(row => row.slice());
    nn.wHO = this.wHO.map(row => row.slice());
    nn.bO  = this.bO.map(row => row.slice());
    return nn;
  }

  mutate(rate, strength) {
    if (rate === undefined) rate = 0.2;
    if (strength === undefined) strength = 0.3;
    const mutateMatrix = (m) => {
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (random(1) < rate) {
            if (random(1) < 0.05) {
              m[r][c] = random(-1, 1);
            } else {
              m[r][c] += random(-strength, strength);
              m[r][c] = constrain(m[r][c], -2, 2);
            }
          }
        }
      }
    };
    mutateMatrix(this.wIH);
    mutateMatrix(this.bH);
    mutateMatrix(this.wHO);
    mutateMatrix(this.bO);
  }
}

// ============================================================
// Bird
// ============================================================
class Bird {
  constructor(brain) {
    this.x     = 90;
    this.y     = height / 2;
    this.vy    = 0;
    this.alive     = true;
    this.ticks     = 0;
    this.fadeTimer = 0;   // 0 = alive; >0 = fading out (increments each render frame)
    this.brain     = brain || new NeuralNetwork(3, 6, 1);
  }

  reset() {
    this.x         = 90;
    this.y         = height / 2;
    this.vy        = 0;
    this.alive     = true;
    this.ticks     = 0;
    this.fadeTimer = 0;
  }

  die() {
    this.alive     = false;
    this.fadeTimer = 1;   // start fade at frame 1
  }

  think(pipes) {
    // Find the next pipe (first pipe whose right edge is ahead of the bird)
    let nextPipe = null;
    for (let i = 0; i < pipes.length; i++) {
      if (pipes[i].x + PIPE_W > this.x) {
        nextPipe = pipes[i];
        break;
      }
    }
    if (!nextPipe) return;

    const inp0 = this.y / height;
    const inp1 = (nextPipe.x - this.x) / width;
    const inp2 = nextPipe.gapCY / height;

    const output = this.brain.predict([inp0, inp1, inp2]);
    if (output > 0.5) {
      this.vy = FLAP_VEL;
    }
  }

  update() {
    this.vy += GRAVITY;
    this.y  += this.vy;
    this.ticks++;

    // Hit ceiling or ground
    if (this.y - BIRD_R <= 0 || this.y + BIRD_R >= height - GROUND_H) {
      this.die();
    }
  }

  hits(pipe) {
    const bLeft   = this.x - BIRD_R;
    const bRight  = this.x + BIRD_R;
    const bTop    = this.y - BIRD_R;
    const bBottom = this.y + BIRD_R;

    const pLeft  = pipe.x;
    const pRight = pipe.x + PIPE_W;

    // No horizontal overlap
    if (bRight < pLeft || bLeft > pRight) return false;

    const gapTop    = pipe.gapCY - pipe.gapH / 2;
    const gapBottom = pipe.gapCY + pipe.gapH / 2;

    // If bird is fully within the gap vertically, no collision
    if (bTop >= gapTop && bBottom <= gapBottom) return false;

    // Bird is outside gap while overlapping horizontally
    this.die();   // was: this.alive = false
    return true;
  }

  draw(isBest) {
    let alpha;
    if (!this.alive) {
      const FADE_FRAMES = 20;
      if (this.fadeTimer > FADE_FRAMES) return;  // already fully faded
      alpha = 45 * max(0, 1 - this.fadeTimer / FADE_FRAMES);
      this.fadeTimer++;
      if (alpha <= 0) return;   // fully faded — skip drawing
    } else {
      alpha = isBest ? 255 : 45;
    }
    push();
    translate(this.x, this.y);

    // Wing (drawn behind body)
    fill(210, 170, 0, alpha);
    noStroke();
    ellipse(-8, 6, 16, 10);

    // Body
    fill(255, 220, 0, alpha);
    noStroke();
    ellipse(0, 0, BIRD_R * 2, BIRD_R * 2);

    // Eye white
    fill(255, 255, 255, alpha);
    noStroke();
    ellipse(5, -4, 10, 10);

    // Pupil
    fill(30, 30, 30, alpha);
    noStroke();
    ellipse(6, -4, 5, 5);

    // Eye shine
    fill(255, 255, 255, alpha);
    noStroke();
    ellipse(8, -6, 2.5, 2.5);

    // Beak (orange triangle pointing right)
    fill(255, 140, 0, alpha);
    noStroke();
    triangle(8, -2, 8, 3, 17, 0);

    pop();
  }
}

// ============================================================
// Pipe
// ============================================================
class Pipe {
  constructor(gapH) {
    this.x     = width + 10;
    this.gapH  = gapH;
    this.gapCY = random(gapH / 2 + 80, height - GROUND_H - gapH / 2 - 30);
  }

  update() {
    this.x -= PIPE_SPEED;
  }

  offscreen() {
    return this.x + PIPE_W < 0;
  }

  draw() {
    const pipeGreen   = color(98, 165, 45);
    const capGreen    = color(78, 140, 30);
    const strokeGreen = color(55, 110, 20);
    const CAP_H       = 22;
    const CAP_EXTRA   = 10; // 5px each side

    const gapTop    = this.gapCY - this.gapH / 2;
    const gapBottom = this.gapCY + this.gapH / 2;

    strokeWeight(2);

    // ---- Top pipe body (from y=0 to gapTop - CAP_H) ----
    fill(pipeGreen);
    stroke(strokeGreen);
    rect(this.x, 0, PIPE_W, gapTop - CAP_H);

    // ---- Top pipe cap (sits just above gap) ----
    fill(capGreen);
    stroke(strokeGreen);
    rect(this.x - CAP_EXTRA / 2, gapTop - CAP_H, PIPE_W + CAP_EXTRA, CAP_H);

    // ---- Bottom pipe cap (sits just below gap) ----
    fill(capGreen);
    stroke(strokeGreen);
    rect(this.x - CAP_EXTRA / 2, gapBottom, PIPE_W + CAP_EXTRA, CAP_H);

    // ---- Bottom pipe body (from gapBottom + CAP_H to ground) ----
    fill(pipeGreen);
    stroke(strokeGreen);
    rect(this.x, gapBottom + CAP_H, PIPE_W, height - GROUND_H - gapBottom - CAP_H);

    noStroke();
  }
}

// ============================================================
// Sketch globals
// ============================================================
let birds     = [];
let pipes     = [];
let gen       = 0;
let tick      = 0;
let bestScore = 0;
let bestBrain = null;
let curGapH   = BASE_GAP;
let pipesPassed = 0;

// ============================================================
// setup
// ============================================================
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('monospace');
  nextGen();
}

// ============================================================
// windowResized
// ============================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ============================================================
// nextGen
// ============================================================
function nextGen() {
  gen++;
  tick  = 0;
  pipesPassed = 0;
  pipes = [];

  curGapH = max(BASE_GAP - (gen - 1) * GAP_SHRINK, MIN_GAP);

  birds = [];
  if (bestBrain) {
    // 1 elite clone
    birds.push(new Bird(bestBrain.copy()));
    // 49 mutated copies
    for (let i = 1; i < popSize; i++) {
      const mutatedBrain = bestBrain.copy();
      mutatedBrain.mutate(0.2, 0.3);
      birds.push(new Bird(mutatedBrain));
    }
  } else {
    // First generation: all random
    for (let i = 0; i < popSize; i++) {
      birds.push(new Bird());
    }
  }
}

// ============================================================
// updateSim
// ============================================================
function updateSim() {
  tick++;

  if (tick % PIPE_INTERVAL === 0) {
    pipes.push(new Pipe(curGapH));
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    if (pipes[i].offscreen()) {
      pipesPassed++;
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

// ============================================================
// evolve
// ============================================================
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

// ============================================================
// renderFrame
// ============================================================
function renderFrame() {
  background(113, 197, 207);
  drawClouds();

  fill(210, 180, 120); noStroke();
  rect(0, height - GROUND_H, width, GROUND_H);
  fill(98, 165, 45); noStroke();
  rect(0, height - GROUND_H, width, 12);

  for (let p of pipes) p.draw();

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

  // NN overlay: best alive bird, or fall back to bestBrain
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
}

// ============================================================
// draw
// ============================================================
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

  for (let s = 0; s < speed; s++) {
    updateSim();
    if (birds.every(b => !b.alive)) {
      evolve();
      break;
    }
  }

  renderFrame();
}

// ============================================================
// drawClouds
// ============================================================
function drawClouds() {
  fill(255, 255, 255, 210);
  noStroke();

  // Each cloud: [cx, cy, scale]
  const clouds = [
    [120,  60, 1.0],
    [320,  40, 0.8],
    [580,  75, 1.2],
    [800,  50, 0.9],
    [1050, 65, 1.1],
    [1280, 45, 0.85],
  ];

  for (let i = 0; i < clouds.length; i++) {
    const cx = clouds[i][0];
    const cy = clouds[i][1];
    const s  = clouds[i][2];
    ellipse(cx,       cy,       80 * s, 45 * s);
    ellipse(cx + 30,  cy - 10,  70 * s, 50 * s);
    ellipse(cx + 60,  cy,       80 * s, 40 * s);
    ellipse(cx + 90,  cy + 5,   60 * s, 35 * s);
  }
}

// ============================================================
// drawNNOverlay
// ============================================================
function drawNNOverlay(nn) {
  if (!nn || !nn.lastHidden) return;

  const PW  = 230;
  const PH  = 185;
  const PAD = 12;
  const px  = width  - PW - PAD;
  const py  = height - PH - PAD;
  const NR  = 8;

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

  // Column x positions
  const colX = [px + 42, px + 115, px + 190];

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

  // Connections: input → hidden
  for (let h = 0; h < hCount; h++) {
    for (let i = 0; i < iCount; i++) {
      const w = nn.wIH[h][i];
      const c = w > 0 ? color(50, 210, 120, 130) : color(210, 60, 60, 130);
      stroke(c);
      strokeWeight(constrain(abs(w) * 1.2, 0.3, 2.5));
      line(colX[0], iYs[i], colX[1], hYs[h]);
    }
  }

  // Connections: hidden → output
  for (let h = 0; h < hCount; h++) {
    const w = nn.wHO[0][h];
    const c = w > 0 ? color(50, 210, 120, 130) : color(210, 60, 60, 130);
    stroke(c);
    strokeWeight(constrain(abs(w) * 1.2, 0.3, 2.5));
    line(colX[1], hYs[h], colX[2], oYs[0]);
  }

  noStroke();

  // Input nodes + labels
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
  fill(outAct > 0.5 ? color(80, 240, 100) : color(50, 50, 50));
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

// ============================================================
// drawHUD
// ============================================================
function drawHUD(alive, score) {
  // Semi-transparent dark rounded background
  fill(20, 20, 20, 160);
  noStroke();
  rect(12, 12, 190, 95, 10);

  // White monospace text
  fill(255);
  noStroke();
  textSize(14);
  textAlign(LEFT, TOP);

  text('GEN   ' + gen,                    24, 24);
  text('ALIVE ' + alive + '/' + popSize, 24, 44);
  text('SCORE ' + score,                  24, 64);
  text('BEST  ' + bestScore,              24, 84);
}
