import Decimal from 'decimal.js'
import { endOfDay, endOfMonth, endOfWeek, format, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { formatTowerNumber, parseTowerNumber, runMetrics } from '@/lib/metrics'
import type { Goal, GoalMetric, GoalPeriod } from '@/types/goal'
import type { Run } from '@/types/run'
import { GOAL_METRIC_OPTIONS, GOAL_PERIOD_OPTIONS } from '@/types/goal'

export type GoalProgress = {
  current: Decimal
  target: Decimal
  ratio: number
  percent: number
  currentLabel: string
  targetLabel: string
  completed: boolean
  periodLabel: string
  runCount: number
}

function periodBounds(period: GoalPeriod, now = new Date()): { from: Date; to: Date } | null {
  if (period === 'all') return null
  if (period === 'day') return { from: startOfDay(now), to: endOfDay(now) }
  if (period === 'week') {
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 }),
    }
  }
  return { from: startOfMonth(now), to: endOfMonth(now) }
}

export function filterRunsForGoal(runs: Run[], goal: Goal, now = new Date()): Run[] {
  const bounds = periodBounds(goal.period, now)
  return runs.filter((run) => {
    if (goal.tier != null && run.tier !== goal.tier) return false
    if (!bounds) return true
    const when = parseISO(run.ran_at)
    return when >= bounds.from && when <= bounds.to
  })
}

export function computeGoalCurrent(runs: Run[], metric: GoalMetric): Decimal {
  if (runs.length === 0) return new Decimal(0)

  if (metric === 'run_count') return new Decimal(runs.length)

  if (metric === 'total_coins') {
    return runs.reduce((sum, run) => sum.plus(run.coins), new Decimal(0))
  }
  if (metric === 'total_cells') {
    return runs.reduce((sum, run) => sum.plus(run.cells), new Decimal(0))
  }
  if (metric === 'best_wave') {
    return new Decimal(Math.max(...runs.map((run) => run.wave_reached)))
  }

  const rates = runs.map((run) => runMetrics(run))
  if (metric === 'avg_coins_per_hour') {
    const sum = rates.reduce((acc, m) => acc.plus(m.coinsPerHour), new Decimal(0))
    return sum.div(rates.length)
  }
  if (metric === 'avg_cells_per_hour') {
    const sum = rates.reduce((acc, m) => acc.plus(m.cellsPerHour), new Decimal(0))
    return sum.div(rates.length)
  }
  if (metric === 'best_coins_per_hour') {
    return rates.reduce((best, m) => (m.coinsPerHour.gt(best) ? m.coinsPerHour : best), rates[0].coinsPerHour)
  }
  return rates.reduce((best, m) => (m.cellsPerHour.gt(best) ? m.cellsPerHour : best), rates[0].cellsPerHour)
}

export function computeGoalProgress(goal: Goal, runs: Run[], now = new Date()): GoalProgress {
  const scoped = filterRunsForGoal(runs, goal, now)
  const current = computeGoalCurrent(scoped, goal.metric)
  const target = parseTowerNumber(goal.target)
  const ratio = target.gt(0) ? current.div(target).toNumber() : 0
  const percent = Math.min(100, Math.round(ratio * 1000) / 10)
  const isWaveOrCount = goal.metric === 'best_wave' || goal.metric === 'run_count'

  return {
    current,
    target,
    ratio,
    percent,
    currentLabel: isWaveOrCount ? current.toDecimalPlaces(0).toString() : formatTowerNumber(current),
    targetLabel: isWaveOrCount ? target.toDecimalPlaces(0).toString() : formatTowerNumber(target),
    completed: current.gte(target),
    periodLabel: GOAL_PERIOD_OPTIONS.find((o) => o.value === goal.period)?.label ?? goal.period,
    runCount: scoped.length,
  }
}

export function goalDisplayTitle(goal: Pick<Goal, 'title' | 'metric' | 'period' | 'tier'>): string {
  if (goal.title?.trim()) return goal.title.trim()
  const metric = GOAL_METRIC_OPTIONS.find((o) => o.value === goal.metric)?.label ?? goal.metric
  const period = GOAL_PERIOD_OPTIONS.find((o) => o.value === goal.period)?.label ?? goal.period
  const tier = goal.tier != null ? ` · Tier ${goal.tier}` : ''
  return `${metric} · ${period}${tier}`
}

export type GoalSuggestion = {
  localId: string
  title: string
  metric: GoalMetric
  period: GoalPeriod
  target: string
  tier: number | null
  basisLabel: string
  currentLabel: string
  targetLabel: string
}

function runsInLastDays(runs: Run[], days: number, now = new Date()): Run[] {
  const from = startOfDay(new Date(now))
  from.setDate(from.getDate() - (days - 1))
  const to = endOfDay(now)
  return runs.filter((run) => {
    const when = parseISO(run.ran_at)
    return when >= from && when <= to
  })
}

function mostCommonTier(runs: Run[], limit = 2): number[] {
  const counts = new Map<number, number>()
  for (const run of runs) {
    counts.set(run.tier, (counts.get(run.tier) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, limit)
    .map(([tier]) => tier)
}

/** Stretch a baseline into a slightly ambitious, nicely rounded target. */
export function stretchTarget(value: Decimal, kind: 'rate' | 'count' | 'wave'): Decimal {
  if (value.lte(0)) return kind === 'wave' || kind === 'count' ? new Decimal(1) : new Decimal(1)

  if (kind === 'wave') {
    const plus = value.plus(25)
    const pct = value.mul(1.05).toDecimalPlaces(0, Decimal.ROUND_CEIL)
    return Decimal.max(plus, pct)
  }

  if (kind === 'count') {
    return Decimal.max(value.plus(1), value.mul(1.25)).toDecimalPlaces(0, Decimal.ROUND_CEIL)
  }

  const stretched = value.mul(1.1)
  if (stretched.lt(1000)) return stretched.toDecimalPlaces(0, Decimal.ROUND_CEIL)

  // Round large Tower numbers to ~3 significant digits
  const exp = stretched.e
  const factor = new Decimal(10).pow(exp - 2)
  return stretched.div(factor).toDecimalPlaces(0, Decimal.ROUND_CEIL).mul(factor)
}

function alreadyHasGoal(
  existing: Goal[],
  metric: GoalMetric,
  period: GoalPeriod,
  tier: number | null,
): boolean {
  return existing.some(
    (goal) =>
      goal.active &&
      goal.metric === metric &&
      goal.period === period &&
      (goal.tier ?? null) === tier,
  )
}

/**
 * Build goal suggestions from recent run performance.
 * Uses the last 7 days when possible, otherwise last 14 / all runs.
 */
export function generateGoalSuggestions(
  runs: Run[],
  existingGoals: Goal[] = [],
  now = new Date(),
): GoalSuggestion[] {
  let windowRuns = runsInLastDays(runs, 7, now)
  let windowLabel = 'last 7 days'
  if (windowRuns.length < 3) {
    windowRuns = runsInLastDays(runs, 14, now)
    windowLabel = 'last 14 days'
  }
  if (windowRuns.length < 2) {
    windowRuns = [...runs]
    windowLabel = 'all logged runs'
  }
  if (windowRuns.length === 0) return []

  const suggestions: GoalSuggestion[] = []
  const topTiers = mostCommonTier(windowRuns, 1)
  const scopes: Array<{ tier: number | null; runs: Run[]; label: string }> = [
    { tier: null, runs: windowRuns, label: windowLabel },
    ...topTiers.map((tier) => ({
      tier,
      runs: windowRuns.filter((run) => run.tier === tier),
      label: `${windowLabel} · Tier ${tier}`,
    })),
  ]

  let counter = 0
  const push = (
    metric: GoalMetric,
    period: GoalPeriod,
    baseline: Decimal,
    kind: 'rate' | 'count' | 'wave',
    tier: number | null,
    scopeLabel: string,
  ) => {
    if (baseline.lte(0)) return
    if (alreadyHasGoal(existingGoals, metric, period, tier)) return
    if (suggestions.some((s) => s.metric === metric && s.period === period && s.tier === tier)) return

    const targetRaw = stretchTarget(baseline, kind)
    const target =
      targetRaw.lte(baseline) && kind === 'rate' ? baseline.mul(1.05) : targetRaw
    const metricLabel = GOAL_METRIC_OPTIONS.find((o) => o.value === metric)?.label ?? metric
    const periodLabel = GOAL_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period
    const isDiscrete = kind !== 'rate'
    const currentLabel = isDiscrete ? baseline.toDecimalPlaces(0).toString() : formatTowerNumber(baseline)
    const targetLabel = isDiscrete ? target.toDecimalPlaces(0).toString() : formatTowerNumber(target)

    suggestions.push({
      localId: `suggest-${Date.now()}-${counter++}`,
      title: `${metricLabel}: reach ${targetLabel} (${periodLabel.toLowerCase()})`,
      metric,
      period,
      target: target.toString(),
      tier,
      basisLabel: `Based on ${scopeLabel}: ${currentLabel} → ${targetLabel}`,
      currentLabel,
      targetLabel,
    })
  }

  for (const scope of scopes) {
    if (scope.runs.length === 0) continue
    const bestCph = computeGoalCurrent(scope.runs, 'best_coins_per_hour')
    const avgCph = computeGoalCurrent(scope.runs, 'avg_coins_per_hour')
    const bestCells = computeGoalCurrent(scope.runs, 'best_cells_per_hour')
    const avgCells = computeGoalCurrent(scope.runs, 'avg_cells_per_hour')
    const bestWave = computeGoalCurrent(scope.runs, 'best_wave')
    const runCount = computeGoalCurrent(scope.runs, 'run_count')
    const totalCoins = computeGoalCurrent(scope.runs, 'total_coins')

    // Prefer weekly stretch goals from recent performance
    push('best_coins_per_hour', 'week', bestCph, 'rate', scope.tier, scope.label)
    push('avg_coins_per_hour', 'week', avgCph, 'rate', scope.tier, scope.label)
    push('best_cells_per_hour', 'week', bestCells, 'rate', scope.tier, scope.label)
    push('avg_cells_per_hour', 'week', avgCells, 'rate', scope.tier, scope.label)
    push('best_wave', 'week', bestWave, 'wave', scope.tier, scope.label)

    // Overall (no tier) also gets run-count / coins volume goals
    if (scope.tier == null) {
      push('run_count', 'week', runCount, 'count', null, scope.label)
      push('total_coins', 'week', totalCoins, 'rate', null, scope.label)
    }
  }

  return suggestions.slice(0, 8)
}

export type DayActivity = {
  date: string
  label: string
  count: number
}

export type StreakStats = {
  currentStreak: number
  longestStreak: number
  runsToday: number
  runsThisWeek: number
  activeDaysThisWeek: number
  last14Days: DayActivity[]
  consistencyPercent: number
}

function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function computeStreakStats(runs: Run[], now = new Date()): StreakStats {
  const counts = new Map<string, number>()
  for (const run of runs) {
    const key = toDayKey(parseISO(run.ran_at))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const todayKey = toDayKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = toDayKey(yesterday)

  let currentStreak = 0
  if (counts.has(todayKey) || counts.has(yesterdayKey)) {
    const cursor = new Date(counts.has(todayKey) ? now : yesterday)
    while (counts.has(toDayKey(cursor))) {
      currentStreak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  const allDays = [...counts.keys()].sort()
  let longestStreak = 0
  let streak = 0
  let prev: string | null = null
  for (const day of allDays) {
    if (!prev) {
      streak = 1
    } else {
      const prevDate = parseISO(prev)
      const nextExpected = new Date(prevDate)
      nextExpected.setDate(nextExpected.getDate() + 1)
      streak = toDayKey(nextExpected) === day ? streak + 1 : 1
    }
    longestStreak = Math.max(longestStreak, streak)
    prev = day
  }

  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  let runsThisWeek = 0
  let activeDaysThisWeek = 0
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const key = toDayKey(d)
    const count = counts.get(key) ?? 0
    runsThisWeek += count
    if (count > 0) activeDaysThisWeek += 1
  }

  const last14Days: DayActivity[] = []
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = toDayKey(d)
    last14Days.push({
      date: key,
      label: format(d, 'EEE d'),
      count: counts.get(key) ?? 0,
    })
  }

  const activeInWindow = last14Days.filter((d) => d.count > 0).length
  const consistencyPercent = Math.round((activeInWindow / 14) * 100)

  return {
    currentStreak,
    longestStreak,
    runsToday: counts.get(todayKey) ?? 0,
    runsThisWeek,
    activeDaysThisWeek,
    last14Days,
    consistencyPercent,
  }
}
