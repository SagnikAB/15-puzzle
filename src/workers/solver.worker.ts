import {
  cloneState,
  createGoal,
  key,
  manhattan,
  neighborStates,
  parseKey,
} from '../lib/puzzle'

const GOAL_KEY = key(createGoal())

type OpenNode = { f: number; g: number; stateKey: string }

class MinHeap {
  private heap: OpenNode[] = []

  get size(): number {
    return this.heap.length
  }

  push(node: OpenNode): void {
    this.heap.push(node)
    this.siftUp(this.heap.length - 1)
  }

  pop(): OpenNode | undefined {
    const h = this.heap
    if (h.length === 0) return undefined
    const min = h[0]!
    const last = h.pop()!
    if (h.length > 0) {
      h[0] = last
      this.siftDown(0)
    }
    return min
  }

  private siftUp(i: number): void {
    const h = this.heap
    while (i > 0) {
      const p = (i - 1) >> 1
      if (h[i]!.f >= h[p]!.f) break
      ;[h[i], h[p]] = [h[p]!, h[i]!]
      i = p
    }
  }

  private siftDown(i: number): void {
    const h = this.heap
    const n = h.length
    while (true) {
      const l = i * 2 + 1
      const r = l + 1
      let smallest = i
      if (l < n && h[l]!.f < h[smallest]!.f) smallest = l
      if (r < n && h[r]!.f < h[smallest]!.f) smallest = r
      if (smallest === i) break
      ;[h[i], h[smallest]] = [h[smallest]!, h[i]!]
      i = smallest
    }
  }
}

/** Only guards runaway bugs; solvable 15-puzzles should finish below this. */
const MAX_EXPANSIONS = 2_000_000_000
const PROGRESS_EVERY = 150_000

function reconstructPath(cameFrom: Map<string, string>, lastKey: string, startKey: string): string[] {
  const chain: string[] = [lastKey]
  let cur = lastKey
  while (cur !== startKey) {
    const p = cameFrom.get(cur)
    if (p === undefined) break
    chain.push(p)
    cur = p
  }
  chain.reverse()
  return chain
}

function aStar(start: number[]): { pathKeys: string[] | null; expansions: number; error?: string } {
  const startKey = key(start)
  if (startKey === GOAL_KEY) {
    return { pathKeys: [startKey], expansions: 0 }
  }

  const open = new MinHeap()
  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, string>()
  /** States already expanded with optimal g (standard A* closed set). */
  const closed = new Set<string>()

  const h0 = manhattan(start)
  gScore.set(startKey, 0)
  open.push({ f: h0, g: 0, stateKey: startKey })

  let expansions = 0

  while (open.size > 0) {
    const cur = open.pop()!
    const { stateKey: ck, g: cg } = cur
    const best = gScore.get(ck)
    if (best === undefined || cg > best) continue

    if (ck === GOAL_KEY) {
      const pathKeys = reconstructPath(cameFrom, GOAL_KEY, startKey)
      return { pathKeys, expansions }
    }

    if (closed.has(ck)) continue
    closed.add(ck)

    expansions++
    if (expansions % PROGRESS_EVERY === 0) {
      self.postMessage({
        type: 'progress',
        expansions,
      } satisfies WorkerProgressMessage)
    }
    if (expansions > MAX_EXPANSIONS) {
      return {
        pathKeys: null,
        expansions,
        error: `Search stopped after ${MAX_EXPANSIONS.toLocaleString()} expansions (memory or time limit). Very few random boards need this.`,
      }
    }

    const state = parseKey(ck)
    for (const next of neighborStates(state)) {
      const nk = key(next)
      const tg = cg + 1
      const prev = gScore.get(nk)
      if (prev !== undefined && tg >= prev) continue

      cameFrom.set(nk, ck)
      gScore.set(nk, tg)
      const f = tg + manhattan(next)
      open.push({ f, g: tg, stateKey: nk })
    }
  }

  return { pathKeys: null, expansions, error: 'No solution found.' }
}

type WorkerProgressMessage = { type: 'progress'; expansions: number }

self.onmessage = (ev: MessageEvent<{ start: number[] }>) => {
  const { start } = ev.data
  const copy = cloneState(start)
  const { pathKeys, expansions, error } = aStar(copy)
  if (error || !pathKeys) {
    self.postMessage({
      type: 'done',
      pathKeys: null,
      path: null,
      expansions,
      error: error ?? 'Failed',
    })
    return
  }
  const path = pathKeys.map(parseKey)
  self.postMessage({
    type: 'done',
    pathKeys,
    path,
    expansions,
    error: undefined,
  })
}
