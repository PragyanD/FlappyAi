// ============================================================
// Constants
// ============================================================
const POP_SIZE      = 50;
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
    return this._sig(outSum);
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
    this.alive = true;
    this.ticks = 0;
    this.brain = brain || new NeuralNetwork(3, 6, 1);
  }

  reset() {
    this.x     = 90;
    this.y     = height / 2;
    this.vy    = 0;
    this.alive = true;
    this.ticks = 0;
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
      this.alive = false;
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
    this.alive = false;
    return true;
  }

  draw(isBest) {
    const alpha = isBest ? 255 : 45;
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
  pipes = [];

  curGapH = max(BASE_GAP - (gen - 1) * GAP_SHRINK, MIN_GAP);

  birds = [];
  if (bestBrain) {
    // 1 elite clone
    birds.push(new Bird(bestBrain.copy()));
    // 49 mutated copies
    for (let i = 1; i < POP_SIZE; i++) {
      const mutatedBrain = bestBrain.copy();
      mutatedBrain.mutate(0.2, 0.3);
      birds.push(new Bird(mutatedBrain));
    }
  } else {
    // First generation: all random
    for (let i = 0; i < POP_SIZE; i++) {
      birds.push(new Bird());
    }
  }
}

// ============================================================
// draw
// ============================================================
function draw() {
  // Sky background
  background(113, 197, 207);

  // Clouds
  drawClouds();

  // Ground: brown fill with green strip at top
  fill(210, 180, 120);
  noStroke();
  rect(0, height - GROUND_H, width, GROUND_H);
  fill(98, 165, 45);
  noStroke();
  rect(0, height - GROUND_H, width, 12);

  // Spawn pipe every PIPE_INTERVAL ticks
  if (tick % PIPE_INTERVAL === 0) {
    pipes.push(new Pipe(curGapH));
  }

  // Update and draw pipes; remove offscreen ones
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].draw();
    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
    }
  }

  // Update birds, apply collision
  let aliveCount = 0;
  let bestAlive  = null;

  for (let b of birds) {
    if (!b.alive) continue;
    b.think(pipes);
    b.update();
    for (let p of pipes) {
      if (b.alive) b.hits(p);
    }
    if (b.alive) {
      aliveCount++;
      if (!bestAlive || b.ticks > bestAlive.ticks) {
        bestAlive = b;
      }
    }
  }

  // Draw order: dead first (underneath), then alive non-best, then best on top
  for (let b of birds) {
    if (!b.alive) b.draw(false);
  }
  for (let b of birds) {
    if (b.alive && b !== bestAlive) b.draw(false);
  }
  if (bestAlive) {
    bestAlive.draw(true);
  }

  // HUD
  const score = bestAlive ? bestAlive.ticks : 0;
  drawHUD(aliveCount, score);

  // End of generation: all birds dead
  if (aliveCount === 0) {
    // Find bird with highest ticks to save its brain
    let best = null;
    for (let b of birds) {
      if (!best || b.ticks > best.ticks) {
        best = b;
      }
    }
    if (best) {
      if (best.ticks > bestScore) {
        bestScore = best.ticks;
      }
      bestBrain = best.brain.copy();
    }
    nextGen();
    return;
  }

  tick++;
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
  text('ALIVE ' + alive + '/' + POP_SIZE, 24, 44);
  text('SCORE ' + score,                  24, 64);
  text('BEST  ' + bestScore,              24, 84);
}
