/** 4×4 fifteen puzzle: indices 0–15, 0 = empty. Goal: 1…15 then 0. */

export const GRID_SIZE = 4
export const CELL_COUNT = GRID_SIZE * GRID_SIZE

/** Goal order (1D): row-major, empty last. */
export function createGoal(): number[] {
  return [...Array(CELL_COUNT - 1).keys()].map((i) => i + 1).concat(0)
}

export function key(state: readonly number[]): string {
  return state.join(',')
}

export function parseKey(k: string): number[] {
  return k.split(',').map(Number)
}

export function cloneState(state: readonly number[]): number[] {
  return state.slice()
}

export function getEmptyIndex(state: readonly number[]): number {
  return state.indexOf(0)
}

export function isSolved(state: readonly number[]): boolean {
  const g = createGoal()
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state[i] !== g[i]) return false
  }
  return true
}

/** Inversion count for tiles 1–15 (0 excluded), row-major order. */
export function countInversions(state: readonly number[]): number {
  let inv = 0
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state[i] === 0) continue
    for (let j = i + 1; j < CELL_COUNT; j++) {
      if (state[j] === 0) continue
      if (state[i]! > state[j]!) inv++
    }
  }
  return inv
}

/**
 * 4×4 solvability: blank row from bottom (1-indexed) + inversion parity.
 * Solvable iff (inversions + rowFromBottom) is odd.
 */
export function isSolvable(state: readonly number[]): boolean {
  const inv = countInversions(state)
  const emptyIdx = getEmptyIndex(state)
  const rowFromTop = Math.floor(emptyIdx / GRID_SIZE)
  const rowFromBottom = GRID_SIZE - rowFromTop
  return (inv + rowFromBottom) % 2 === 1
}

export function manhattan(state: readonly number[]): number {
  let h = 0
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = state[i]!
    if (v === 0) continue
    const tr = Math.floor((v - 1) / GRID_SIZE)
    const tc = (v - 1) % GRID_SIZE
    const cr = Math.floor(i / GRID_SIZE)
    const cc = i % GRID_SIZE
    h += Math.abs(tr - cr) + Math.abs(tc - cc)
  }
  return h
}

function swap(state: number[], i: number, j: number): void {
  const t = state[i]!
  state[i] = state[j]!
  state[j] = t
}

/** All states reachable in one slide from `state`. */
export function neighborStates(state: readonly number[]): number[][] {
  const ei = getEmptyIndex(state)
  const r = Math.floor(ei / GRID_SIZE)
  const c = ei % GRID_SIZE
  const out: number[][] = []
  const tryPush = (ni: number) => {
    const n = cloneState(state)
    swap(n, ei, ni)
    out.push(n)
  }
  if (r > 0) tryPush(ei - GRID_SIZE)
  if (r < GRID_SIZE - 1) tryPush(ei + GRID_SIZE)
  if (c > 0) tryPush(ei - 1)
  if (c < GRID_SIZE - 1) tryPush(ei + 1)
  return out
}

function randomNeighbor(state: readonly number[]): number[] {
  const opts = neighborStates(state)
  return opts[Math.floor(Math.random() * opts.length)]!
}

/** Scramble by N random valid moves from goal (always solvable). */
export function shuffleByMoves(moves: number): number[] {
  let s = createGoal()
  for (let i = 0; i < moves; i++) {
    s = randomNeighbor(s)
  }
  return s
}

function randomPermutation(): number[] {
  const arr = Array.from({ length: CELL_COUNT }, (_, i) => i)
  for (let i = CELL_COUNT - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
  return arr
}

/** Uniform-ish random solvable configuration (may retry). */
export function randomSolvableState(): number[] {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const s = randomPermutation()
    if (isSolvable(s)) return s
  }
  return shuffleByMoves(120)
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export function shuffleForDifficulty(d: Difficulty): number[] {
  switch (d) {
    case 'easy':
      return shuffleByMoves(12 + Math.floor(Math.random() * 10))
    case 'medium':
      return shuffleByMoves(45 + Math.floor(Math.random() * 36))
    case 'hard':
      return randomSolvableState()
    default:
      return shuffleByMoves(30)
  }
}

/** If tile at `tileIndex` is adjacent to empty, swap; else return null. */
export function trySlideTile(state: readonly number[], tileIndex: number): number[] | null {
  if (state[tileIndex] === 0) return null
  const ei = getEmptyIndex(state)
  const tr = Math.floor(tileIndex / GRID_SIZE)
  const tc = tileIndex % GRID_SIZE
  const er = Math.floor(ei / GRID_SIZE)
  const ec = ei % GRID_SIZE
  const d = Math.abs(tr - er) + Math.abs(tc - ec)
  if (d !== 1) return null
  const n = cloneState(state)
  swap(n, tileIndex, ei)
  return n
}

export function tileCorrect(state: readonly number[], index: number): boolean {
  const v = state[index]!
  if (v === 0) return false
  return index === v - 1
}

/** Tile value that slides into the empty cell when going from `prev` → `next`. */
export function movedTileValue(prev: readonly number[], next: readonly number[]): number {
  const ej = getEmptyIndex(next)
  return prev[ej]!
}

/** Human-readable slide (one step). */
export function describeTransition(prev: readonly number[], next: readonly number[]): string {
  const tile = movedTileValue(prev, next)
  const ei = getEmptyIndex(prev)
  const ej = getEmptyIndex(next)
  const dr = Math.floor(ei / GRID_SIZE) - Math.floor(ej / GRID_SIZE)
  const dc = (ei % GRID_SIZE) - (ej % GRID_SIZE)
  let dir = '…'
  if (dr === -1 && dc === 0) dir = 'up'
  else if (dr === 1 && dc === 0) dir = 'down'
  else if (dr === 0 && dc === -1) dir = 'left'
  else if (dr === 0 && dc === 1) dir = 'right'
  return `Tile ${tile} slides ${dir}`
}

/** Monospace grid for display (— = empty). */
export function formatBoardGrid(state: readonly number[]): string {
  const lines: string[] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    const cells: string[] = []
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = state[r * GRID_SIZE + c]!
      cells.push(v === 0 ? ' —' : String(v).padStart(2, ' '))
    }
    lines.push(cells.join(' '))
  }
  return lines.join('\n')
}

/** One description per transition along `path` (length `path.length - 1`). */
export function pathTransitions(path: readonly number[][]): string[] {
  const out: string[] = []
  for (let i = 1; i < path.length; i++) {
    out.push(describeTransition(path[i - 1]!, path[i]!))
  }
  return out
}
