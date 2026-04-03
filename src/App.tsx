import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Difficulty,
  countInversions,
  createGoal,
  formatBoardGrid,
  isSolvable,
  isSolved,
  manhattan,
  movedTileValue,
  pathTransitions,
  shuffleForDifficulty,
  tileCorrect,
  trySlideTile,
} from './lib/puzzle'

type WorkerDone = {
  type: 'done'
  path: number[][] | null
  pathKeys: string[] | null
  expansions: number
  error?: string
}

type WorkerProgress = { type: 'progress'; expansions: number }

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m === 0) return `${rs}s`
  return `${m}m ${rs.toString().padStart(2, '0')}s`
}

export function App() {
  const [board, setBoard] = useState<number[]>(() => createGoal())
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [moveCount, setMoveCount] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [solving, setSolving] = useState(false)
  const [searchProgress, setSearchProgress] = useState<number | null>(null)
  const [solverError, setSolverError] = useState<string | null>(null)
  const [aiAnimating, setAiAnimating] = useState(false)
  const shuffleSeqRef = useRef(0)
  const [shuffleMeta, setShuffleMeta] = useState<{
    index: number
    difficulty: Difficulty
    manhattan: number
    inversions: number
    solvable: boolean
    grid: string
  } | null>(null)
  const [aiPlannedMoves, setAiPlannedMoves] = useState<string[]>([])
  const [aiPlaybackMove, setAiPlaybackMove] = useState(0)
  const [aiHighlightTile, setAiHighlightTile] = useState<number | null>(null)
  const [searchExpansions, setSearchExpansions] = useState<number | null>(null)
  const solveLogRef = useRef<HTMLUListElement>(null)

  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedMsRef = useRef(elapsedMs)
  elapsedMsRef.current = elapsedMs
  /** Bumps on shuffle/reset/solve-start to drop stale worker or animation work. */
  const genRef = useRef(0)

  const worker = useMemo(
    () =>
      new Worker(new URL('./workers/solver.worker.ts', import.meta.url), {
        type: 'module',
      }),
    [],
  )

  useEffect(() => {
    return () => {
      worker.terminate()
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [worker])

  useEffect(() => {
    if (!timerRunning) return
    const t0 = Date.now() - elapsedMsRef.current
    const id = setInterval(() => {
      setElapsedMs(Date.now() - t0)
    }, 100)
    return () => clearInterval(id)
  }, [timerRunning])

  const resetTimer = useCallback(() => {
    setElapsedMs(0)
    setTimerRunning(false)
  }, [])

  const handleShuffle = useCallback(() => {
    genRef.current++
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
    setAiAnimating(false)
    setSolving(false)
    setSearchProgress(null)
    setSolverError(null)
    setMoveCount(0)
    setAiPlannedMoves([])
    setAiPlaybackMove(0)
    setAiHighlightTile(null)
    setSearchExpansions(null)
    resetTimer()
    const next = shuffleForDifficulty(difficulty)
    shuffleSeqRef.current += 1
    const n = shuffleSeqRef.current
    setShuffleMeta({
      index: n,
      difficulty,
      manhattan: manhattan(next),
      inversions: countInversions(next),
      solvable: isSolvable(next),
      grid: formatBoardGrid(next),
    })
    setBoard(next)
    setTimerRunning(true)
  }, [difficulty, resetTimer])

  const handleReset = useCallback(() => {
    genRef.current++
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
    setAiAnimating(false)
    setSolving(false)
    setSearchProgress(null)
    setSolverError(null)
    setMoveCount(0)
    shuffleSeqRef.current = 0
    setShuffleMeta(null)
    setAiPlannedMoves([])
    setAiPlaybackMove(0)
    setAiHighlightTile(null)
    setSearchExpansions(null)
    resetTimer()
    setBoard(createGoal())
  }, [resetTimer])

  const onTileClick = useCallback(
    (index: number) => {
      if (solving || aiAnimating) return
      const next = trySlideTile(board, index)
      if (!next) return
      setBoard(next)
      setMoveCount((c) => c + 1)
      if (!timerRunning) setTimerRunning(true)
      if (isSolved(next)) setTimerRunning(false)
    },
    [board, solving, aiAnimating, timerRunning],
  )

  const runAiStep = useCallback((path: number[][], step: number, ticket: number) => {
    if (ticket !== genRef.current) return
    if (step >= path.length) {
      setAiAnimating(false)
      setTimerRunning(false)
      setAiPlaybackMove(path.length - 1)
      setAiHighlightTile(null)
      return
    }
    setBoard(path[step]!)
    setMoveCount((c) => c + 1)
    setAiPlaybackMove(step)
    if (step >= 1) {
      setAiHighlightTile(movedTileValue(path[step - 1]!, path[step]!))
    }
    aiTimerRef.current = setTimeout(() => runAiStep(path, step + 1, ticket), 400)
  }, [])

  useEffect(() => {
    if (!aiAnimating || aiPlaybackMove < 1 || !solveLogRef.current) return
    const el = solveLogRef.current.querySelector(`[data-move="${aiPlaybackMove - 1}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [aiAnimating, aiPlaybackMove])

  const handleAiSolve = useCallback(() => {
    if (solving || aiAnimating) return
    if (isSolved(board)) return
    genRef.current++
    const ticket = genRef.current
    setSolverError(null)
    setSearchProgress(0)
    setSearchExpansions(null)
    setAiPlannedMoves([])
    setAiPlaybackMove(0)
    setAiHighlightTile(null)
    setSolving(true)

    worker.onmessage = (ev: MessageEvent<WorkerDone | WorkerProgress>) => {
      const data = ev.data
      if (ticket !== genRef.current) return
      if (data.type === 'progress') {
        setSearchProgress(data.expansions)
        return
      }
      setSolving(false)
      setSearchProgress(null)
      setSearchExpansions(data.expansions)

      if (data.error || !data.path || data.path.length < 2) {
        setSearchExpansions(null)
        setSolverError(data.error ?? 'Solver returned no path.')
        return
      }

      const path = data.path
      setAiPlannedMoves(pathTransitions(path))
      setTimerRunning((tr) => tr || true)
      setAiAnimating(true)
      runAiStep(path, 1, ticket)
    }

    worker.postMessage({ start: board })
  }, [board, solving, aiAnimating, worker, runAiStep])

  const won = isSolved(board)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start lg:gap-10">
        <main className="flex flex-1 flex-col items-center gap-6">
          <header className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              15 Puzzle
            </h1>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              Slide tiles into order. A* search with Manhattan distance runs in a Web Worker so the
              UI stays responsive.
            </p>
          </header>

          <div
            className="grid w-full max-w-[min(100%,360px)] grid-cols-4 gap-2 rounded-2xl bg-zinc-900/80 p-3 shadow-xl ring-1 ring-zinc-800"
            role="grid"
            aria-label="Puzzle board"
          >
            {board.map((val, i) => {
              if (val === 0) {
                return (
                  <div
                    key="empty"
                    role="presentation"
                    className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/70 bg-emerald-950/40 ring-2 ring-emerald-500/30"
                    aria-label="Empty space"
                  />
                )
              }
              const correct = tileCorrect(board, i)
              return (
                <motion.button
                  key={val}
                  type="button"
                  layout
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  disabled={solving || aiAnimating}
                  onClick={() => onTileClick(i)}
                  className={[
                    'flex aspect-square items-center justify-center rounded-xl text-xl font-semibold shadow-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400',
                    correct
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/80'
                      : 'bg-zinc-700 text-zinc-50 hover:bg-zinc-600',
                    solving || aiAnimating ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
                    aiAnimating && aiHighlightTile === val
                      ? 'relative z-10 ring-4 ring-violet-400 ring-offset-2 ring-offset-zinc-900/90'
                      : '',
                  ].join(' ')}
                  aria-label={`Tile ${val}`}
                >
                  {val}
                </motion.button>
              )
            })}
          </div>

          {won && (
            <p className="text-center text-emerald-400" role="status">
              Solved — nice work.
            </p>
          )}

          {shuffleMeta && (
            <section
              className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left"
              aria-label="Board state after last shuffle"
            >
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                State after shuffle #{shuffleMeta.index}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Mode:{' '}
                <span className="text-zinc-300">
                  {shuffleMeta.difficulty === 'easy'
                    ? 'Easy'
                    : shuffleMeta.difficulty === 'medium'
                      ? 'Medium'
                      : 'Hard'}
                </span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-zinc-500">Manhattan h*</dt>
                  <dd className="font-mono text-zinc-200">{shuffleMeta.manhattan}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Inversions</dt>
                  <dd className="font-mono text-zinc-200">{shuffleMeta.inversions}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Solvable</dt>
                  <dd className={shuffleMeta.solvable ? 'text-emerald-400' : 'text-rose-400'}>
                    {shuffleMeta.solvable ? 'yes' : 'no'}
                  </dd>
                </div>
              </dl>
              <p className="mt-1 text-[10px] text-zinc-600">
                *Admissible heuristic: true optimal move count can be higher than h.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950/80 p-3 font-mono text-sm leading-relaxed text-zinc-300">
                {shuffleMeta.grid}
              </pre>
            </section>
          )}

          {solving && (
            <p className="max-w-md text-center text-sm text-zinc-500">
              A* is searching in the worker — the board stays still until a full solution path is
              found (no trial moves on the grid).
            </p>
          )}
        </main>

        <aside className="w-full shrink-0 space-y-6 lg:sticky lg:top-8 lg:w-80">
          <section className="rounded-2xl bg-zinc-900/90 p-5 ring-1 ring-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Difficulty</h2>
            <label className="mt-3 block text-sm text-zinc-300" htmlFor="difficulty">
              Scramble strength
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="easy">Easy — few random moves</option>
              <option value="medium">Medium — moderate scramble</option>
              <option value="hard">Hard — random solvable state</option>
            </select>
          </section>

          <section className="rounded-2xl bg-zinc-900/90 p-5 ring-1 ring-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Performance</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-zinc-500">Time elapsed</dt>
                <dd className="mt-1 font-mono text-lg text-white">{formatTime(elapsedMs)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Moves</dt>
                <dd className="mt-1 font-mono text-lg text-white">{moveCount}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-zinc-900/90 p-5 ring-1 ring-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Controls</h2>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleShuffle}
                disabled={solving}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-emerald-500 disabled:opacity-50"
              >
                Shuffle
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={solving}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleAiSolve}
                disabled={solving || aiAnimating || won}
                className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-violet-500 disabled:opacity-50"
              >
                {solving ? 'Searching…' : aiAnimating ? 'Animating…' : 'AI Solve (A*)'}
              </button>
            </div>
            {solving && searchProgress !== null && (
              <p className="mt-3 text-xs text-zinc-500">
                Nodes expanded: {searchProgress.toLocaleString()}…
              </p>
            )}
            {solverError && <p className="mt-3 text-sm text-rose-400">{solverError}</p>}
          </section>

          <section className="rounded-2xl bg-zinc-900/90 p-5 ring-1 ring-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">AI solve trace</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Search explores many board states off-screen. Here you see the{' '}
              <strong className="text-zinc-400">optimal move sequence</strong> once A* finishes: each
              line is one slide. Playback highlights the moving tile on the board.
            </p>
            {!solving && !aiAnimating && searchExpansions !== null && aiPlannedMoves.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                Search finished: <span className="font-mono text-zinc-300">{searchExpansions.toLocaleString()}</span>{' '}
                nodes expanded, path length{' '}
                <span className="font-mono text-zinc-300">{aiPlannedMoves.length}</span> moves.
              </p>
            )}
            {aiPlannedMoves.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>Solution steps</span>
                  {aiAnimating && (
                    <span className="font-mono text-violet-300">
                      Move {aiPlaybackMove} / {aiPlannedMoves.length}
                    </span>
                  )}
                </div>
                <ul
                  ref={solveLogRef}
                  className="max-h-52 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 text-xs leading-snug"
                >
                  {aiPlannedMoves.map((line, i) => (
                    <li
                      key={`${line}-${i}`}
                      data-move={i}
                      className={[
                        'rounded px-2 py-1 font-mono',
                        aiAnimating && aiPlaybackMove >= 1 && i === aiPlaybackMove - 1
                          ? 'bg-violet-950/80 text-violet-200'
                          : 'text-zinc-400',
                      ].join(' ')}
                    >
                      <span className="text-zinc-600">{i + 1}.</span> {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!aiPlannedMoves.length && !solving && (
              <p className="mt-3 text-xs text-zinc-600">Run AI Solve to populate this list.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
