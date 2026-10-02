import Decimal from 'decimal.js'
import {
  endOfWeek,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { formatTowerNumber, runMetrics } from '@/lib/metrics'
import type { Run } from '@/types/run'

export type PeriodStats = {
  runCount: number
  avgWave: number
  bestWave: number
  avgCph: Decimal
  bestCph: Decimal
  avgCellsPh: Decimal
  bestCellsPh: Decimal
}

export type StatDelta = {
  wave: number
  cph: Decimal
  cellsPh: Decimal
  runs: number
}

export type TierWeekComparison = {
  tier: number
  thisWeek: PeriodStats
  lastWeek: PeriodStats
  deltaAvg: StatDelta
  deltaBest: StatDelta
  latestRun: Run | null
  latestVsLastWeekAvg: {
    wave: number
    cph: Decimal
    cellsPh: Decimal
  } | null
}

function emptyStats(): PeriodStats {
  return {
    runCount: 0,
    avgWave: 0,
    bestWave: 0,
    avgCph: new Decimal(0),
    bestCph: new Decimal(0),
    avgCellsPh: new Decimal(0),
    bestCellsPh: new Decimal(0),
  }
}

export function computePeriodStats(runs: Run[]): PeriodStats {
  if (runs.length === 0) return emptyStats()

  let waveSum = 0
  let bestWave = 0
  let cphSum = new Decimal(0)
  let cellsPhSum = new Decimal(0)
  let bestCph = new Decimal(0)
  let bestCellsPh = new Decimal(0)

  for (const run of runs) {
    waveSum += run.wave_reached
    bestWave = Math.max(bestWave, run.wave_reached)
    const metrics = runMetrics(run)
    cphSum = cphSum.plus(metrics.coinsPerHour)
    cellsPhSum = cellsPhSum.plus(metrics.cellsPerHour)
    if (metrics.coinsPerHour.gt(bestCph)) bestCph = metrics.coinsPerHour
    if (metrics.cellsPerHour.gt(bestCellsPh)) bestCellsPh = metrics.cellsPerHour
  }

  const n = runs.length
  return {
    runCount: n,
    avgWave: waveSum / n,
    bestWave,
    avgCph: cphSum.div(n),
    bestCph,
    avgCellsPh: cellsPhSum.div(n),
    bestCellsPh,
  }
}

function weekWindow(now: Date, weeksAgo: number): { from: Date; to: Date } {
  const anchor = weeksAgo === 0 ? now : subWeeks(now, weeksAgo)
  return {
    from: startOfWeek(anchor, { weekStartsOn: 1 }),
    to: endOfWeek(anchor, { weekStartsOn: 1 }),
  }
}

function runsInWindow(runs: Run[], tier: number, from: Date, to: Date): Run[] {
  return runs.filter((run) => {
    if (run.tier !== tier) return false
    const when = parseISO(run.ran_at)
    return when >= from && when <= to
  })
}

export function compareTierWeekOverWeek(
  runs: Run[],
  tier: number,
  now = new Date(),
): TierWeekComparison {
  const thisWindow = weekWindow(now, 0)
  const lastWindow = weekWindow(now, 1)

  const thisWeekRuns = runsInWindow(runs, tier, thisWindow.from, thisWindow.to)
  const lastWeekRuns = runsInWindow(runs, tier, lastWindow.from, lastWindow.to)

  const thisWeek = computePeriodStats(thisWeekRuns)
  const lastWeek = computePeriodStats(lastWeekRuns)

  const latestRun =
    [...thisWeekRuns].sort((a, b) => parseISO(b.ran_at).getTime() - parseISO(a.ran_at).getTime())[0] ??
    null

  let latestVsLastWeekAvg: TierWeekComparison['latestVsLastWeekAvg'] = null
  if (latestRun && lastWeek.runCount > 0) {
    const metrics = runMetrics(latestRun)
    latestVsLastWeekAvg = {
      wave: latestRun.wave_reached - lastWeek.avgWave,
      cph: metrics.coinsPerHour.minus(lastWeek.avgCph),
      cellsPh: metrics.cellsPerHour.minus(lastWeek.avgCellsPh),
    }
  }

  return {
    tier,
    thisWeek,
    lastWeek,
    deltaAvg: {
      wave: thisWeek.avgWave - lastWeek.avgWave,
      cph: thisWeek.avgCph.minus(lastWeek.avgCph),
      cellsPh: thisWeek.avgCellsPh.minus(lastWeek.avgCellsPh),
      runs: thisWeek.runCount - lastWeek.runCount,
    },
    deltaBest: {
      wave: thisWeek.bestWave - lastWeek.bestWave,
      cph: thisWeek.bestCph.minus(lastWeek.bestCph),
      cellsPh: thisWeek.bestCellsPh.minus(lastWeek.bestCellsPh),
      runs: thisWeek.runCount - lastWeek.runCount,
    },
    latestRun,
    latestVsLastWeekAvg,
  }
}

export function formatSignedInt(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return digits > 0 ? (0).toFixed(digits) : '0'
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${digits > 0 ? rounded.toFixed(digits) : String(rounded)}`
}

export function formatSignedTower(value: Decimal): string {
  if (value.eq(0)) return '0'
  const sign = value.gt(0) ? '+' : value.lt(0) ? '-' : ''
  return `${sign}${formatTowerNumber(value.abs())}`
}

export function tiersWithRecentActivity(runs: Run[], now = new Date()): number[] {
  const thisWindow = weekWindow(now, 0)
  const lastWindow = weekWindow(now, 1)
  const tiers = new Set<number>()
  for (const run of runs) {
    const when = parseISO(run.ran_at)
    if (
      (when >= thisWindow.from && when <= thisWindow.to) ||
      (when >= lastWindow.from && when <= lastWindow.to)
    ) {
      tiers.add(run.tier)
    }
  }
  return [...tiers].sort((a, b) => b - a)
}
