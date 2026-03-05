# FlappyAI

A [NEAT](https://en.wikipedia.org/wiki/Neuroevolution_of_augmenting_topologies) (NeuroEvolution of Augmenting Topologies) algorithm that learns to play Flappy Bird optimally.

> The AI starts knowing nothing. After ~20 generations, it plays indefinitely without dying.

## How it works
NEAT evolves a population of neural networks through natural selection:
1. Each bird has a neural network that decides when to flap
2. Birds that survive longer have higher fitness
3. After each generation, the best networks are bred and mutated
4. Over generations, the population gets better and better

**Inputs to the neural network:** bird Y position, distance to next pipe, gap Y position
**Output:** flap or don't flap

## Run it
Open `index.html` in a browser — no install needed.

Or serve locally:
```bash
npx serve .
# Open http://localhost:3000
```

## Tech Stack
JavaScript · HTML Canvas · NEAT algorithm (custom implementation)
