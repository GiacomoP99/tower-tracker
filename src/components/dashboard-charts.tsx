import { useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import Decimal from 'decimal.js'
import { endOfDay, format, parseISO, startOfDay, startOfWeek, subDays } from 'date-fns'
import { defineChart, lineY, barY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react/tooltip'
import { tooltip } from '@tanstack/charts/tooltip'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { scaleBand } from '@tanstack/charts/scales/band'
import { Crown, Gauge, Waves } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  formatDuration,
  formatRunDate,
  formatTowerNumber,
  runMetrics,
  toChartNumber,
} from '@/lib/metrics'
import type { Run } from '@/types/run'
import { cn } from '@/lib/utils'

type DashboardChartsProps = {
  runs: Run[]
}

type Point = {
  label: string
  tier: number
  wave: number
  coins: number
  cells: number
  coinsPerHour: number
  cellsPerHour: number
  isBestWave: boolean
  isBestCph: boolean
  isBestCellsPh: boolean
}

type AggregatePoint = { label: string; coins: number; cells: number; tiersLabel: string }

type TierStat = {
  label: string
  tier: number
  runs: number
  avgWave: number
  avgCph: number
  avgCellsPh: number
  totalCoins: number
  totalCells: number
}

type BestMarker = {
  key: 'wave' | 'cph' | 'cellsPh'
  title: string
  valueLabel: string
  run: Run
  icon: typeof Waves
}

function defaultRange() {
  const to = new Date()
  const from = subDays(to, 29)
  const toInput = (d: Date) => format(d, 'yyyy-MM-dd')
  return { from: toInput(from), to: toInput(to) }
}

export function DashboardCharts({ runs }: DashboardChartsProps) {
  const defaults = defaultRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [tierFilter, setTierFilter] = useState<'all' | string>('all')
  const [aggregateMode, setAggregateMode] = useState<'daily' | 'weekly'>('daily')
  const [byTierMetric, setByTierMetric] = useState<'avgCph' | 'avgCellsPh' | 'avgWave' | 'runs'>('avgCph')
  const [showCells, setShowCells] = useState(true)

  const tiers = useMemo(() => {
    const unique = new Set(runs.map((run) => run.tier))
    return [...unique].sort((a, b) => a - b)
  }, [runs])

  const filtered = useMemo(() => {
    const fromDate = startOfDay(parseISO(from))
    const toDate = endOfDay(parseISO(to))
    return runs
      .filter((run) => {
        const when = parseISO(run.ran_at)
        if (when < fromDate || when > toDate) return false
        if (tierFilter !== 'all' && String(run.tier) !== tierFilter) return false
        return true
      })
      .slice()
      .sort((a, b) => parseISO(a.ran_at).getTime() - parseISO(b.ran_at).getTime())
  }, [runs, from, to, tierFilter])

  const summary = useMemo(() => {
    let totalCoins = new Decimal(0)
    let totalCells = new Decimal(0)
    let cphSum = new Decimal(0)
    let cellsPhSum = new Decimal(0)

    for (const run of filtered) {
      totalCoins = totalCoins.plus(run.coins)
      totalCells = totalCells.plus(run.cells)
      const metrics = runMetrics(run)
      cphSum = cphSum.plus(metrics.coinsPerHour)
      cellsPhSum = cellsPhSum.plus(metrics.cellsPerHour)
    }

    const count = filtered.length
    return {
      count,
      totalCoins,
      totalCells,
      avgCph: count ? cphSum.div(count) : new Decimal(0),
      avgCellsPh: count ? cellsPhSum.div(count) : new Decimal(0),
    }
  }, [filtered])

  const bestMarkers = useMemo((): BestMarker[] => {
    if (filtered.length === 0) return []

    let bestWave = filtered[0]
    let bestCph = filtered[0]
    let bestCellsPh = filtered[0]
    let bestCphValue = runMetrics(filtered[0]).coinsPerHour
    let bestCellsPhValue = runMetrics(filtered[0]).cellsPerHour

    for (const run of filtered) {
      if (run.wave_reached > bestWave.wave_reached) bestWave = run
      const metrics = runMetrics(run)
      if (metrics.coinsPerHour.gt(bestCphValue)) {
        bestCph = run
        bestCphValue = metrics.coinsPerHour
      }
      if (metrics.cellsPerHour.gt(bestCellsPhValue)) {
        bestCellsPh = run
        bestCellsPhValue = metrics.cellsPerHour
      }
    }

    return [
      {
        key: 'wave',
        title: 'Highest wave',
        valueLabel: String(bestWave.wave_reached),
        run: bestWave,
        icon: Waves,
      },
      {
        key: 'cph',
        title: 'Best coins/h',
        valueLabel: formatTowerNumber(bestCphValue),
        run: bestCph,
        icon: Crown,
      },
      {
        key: 'cellsPh',
        title: 'Best cells/h',
        valueLabel: formatTowerNumber(bestCellsPhValue),
        run: bestCellsPh,
        icon: Gauge,
      },
    ]
  }, [filtered])

  const bestIds = useMemo(() => {
    const waveId = bestMarkers.find((m) => m.key === 'wave')?.run.id
    const cphId = bestMarkers.find((m) => m.key === 'cph')?.run.id
    const cellsPhId = bestMarkers.find((m) => m.key === 'cellsPh')?.run.id
    return { waveId, cphId, cellsPhId }
  }, [bestMarkers])

  const series: Point[] = useMemo(
    () =>
      filtered.map((run) => {
        const metrics = runMetrics(run)
        return {
          label: format(parseISO(run.ran_at), 'MMM d HH:mm'),
          tier: run.tier,
          wave: run.wave_reached,
          coins: toChartNumber(run.coins),
          cells: toChartNumber(run.cells),
          coinsPerHour: toChartNumber(metrics.coinsPerHour),
          cellsPerHour: toChartNumber(metrics.cellsPerHour),
          isBestWave: run.id === bestIds.waveId,
          isBestCph: run.id === bestIds.cphId,
          isBestCellsPh: run.id === bestIds.cellsPhId,
        }
      }),
    [filtered, bestIds],
  )

  const aggregates: AggregatePoint[] = useMemo(() => {
    const map = new Map<string, { coins: Decimal; cells: Decimal; tiers: Set<number> }>()
    for (const run of filtered) {
      const date = parseISO(run.ran_at)
      const key =
        aggregateMode === 'daily'
          ? format(date, 'yyyy-MM-dd')
          : format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const current = map.get(key) ?? { coins: new Decimal(0), cells: new Decimal(0), tiers: new Set<number>() }
      current.tiers.add(run.tier)
      map.set(key, {
        coins: current.coins.plus(run.coins),
        cells: current.cells.plus(run.cells),
        tiers: current.tiers,
      })
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const tierList = [...value.tiers].sort((a, b) => a - b)
        return {
          label:
            aggregateMode === 'daily'
              ? format(parseISO(key), 'MMM d')
              : `W ${format(parseISO(key), 'MMM d')}`,
          coins: toChartNumber(value.coins),
          cells: toChartNumber(value.cells),
          tiersLabel: tierList.length === 1 ? `Tier ${tierList[0]}` : `Tiers ${tierList.join(', ')}`,
        }
      })
  }, [filtered, aggregateMode])

  const tierStats: TierStat[] = useMemo(() => {
    const map = new Map<
      number,
      { runs: number; waveSum: number; cphSum: Decimal; cellsPhSum: Decimal; coins: Decimal; cells: Decimal }
    >()

    for (const run of filtered) {
      const metrics = runMetrics(run)
      const current = map.get(run.tier) ?? {
        runs: 0,
        waveSum: 0,
        cphSum: new Decimal(0),
        cellsPhSum: new Decimal(0),
        coins: new Decimal(0),
        cells: new Decimal(0),
      }
      map.set(run.tier, {
        runs: current.runs + 1,
        waveSum: current.waveSum + run.wave_reached,
        cphSum: current.cphSum.plus(metrics.coinsPerHour),
        cellsPhSum: current.cellsPhSum.plus(metrics.cellsPerHour),
        coins: current.coins.plus(run.coins),
        cells: current.cells.plus(run.cells),
      })
    }

    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tier, value]) => ({
        label: `T${tier}`,
        tier,
        runs: value.runs,
        avgWave: value.waveSum / value.runs,
        avgCph: toChartNumber(value.cphSum.div(value.runs)),
        avgCellsPh: toChartNumber(value.cellsPhSum.div(value.runs)),
        totalCoins: toChartNumber(value.coins),
        totalCells: toChartNumber(value.cells),
      }))
  }, [filtered])

  const incomeChart = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(series, {
            id: 'coins',
            x: 'label',
            y: 'coins',
            points: true,
            stroke: '#f0c14a',
            z: () => 'Coins',
          }),
          ...(showCells
            ? [
                lineY(series, {
                  id: 'cells',
                  x: 'label',
                  y: 'cells',
                  yScale: 'cells',
                  points: true,
                  stroke: '#4ade80',
                  z: () => 'Cells',
                }),
              ]
            : []),
        ],
        scales: {
          x: {
            scale: () => scalePoint<string>().padding(0.2),
            axis: { label: 'Run' },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: 'Coins',
              ticks: { format: (value: number) => formatTowerNumber(value) },
            },
          },
          ...(showCells
            ? {
                cells: {
                  channel: 'y' as const,
                  scale: scaleLinear,
                  nice: true,
                  side: 'right' as const,
                  axis: {
                    label: 'Cells',
                    ticks: { format: (value: number) => formatTowerNumber(value) },
                  },
                },
              }
            : {}),
        },
        tooltip,
      }),
    [series, showCells],
  )

  const rateChart = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(series, {
            id: 'cph',
            x: 'label',
            y: 'coinsPerHour',
            points: true,
            stroke: '#eab308',
            z: () => 'Coins/h',
          }),
          ...(showCells
            ? [
                lineY(series, {
                  id: 'cellsph',
                  x: 'label',
                  y: 'cellsPerHour',
                  yScale: 'cellsPerHour',
                  points: true,
                  stroke: '#34d399',
                  z: () => 'Cells/h',
                }),
              ]
            : []),
        ],
        scales: {
          x: {
            scale: () => scalePoint<string>().padding(0.2),
            axis: { label: 'Run' },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: 'Coins/h',
              ticks: { format: (value: number) => formatTowerNumber(value) },
            },
          },
          ...(showCells
            ? {
                cellsPerHour: {
                  channel: 'y' as const,
                  scale: scaleLinear,
                  nice: true,
                  side: 'right' as const,
                  axis: {
                    label: 'Cells/h',
                    ticks: { format: (value: number) => formatTowerNumber(value) },
                  },
                },
              }
            : {}),
        },
        tooltip,
      }),
    [series, showCells],
  )

  const periodLabel = aggregateMode === 'daily' ? 'Day' : 'Week'

  const aggregateCoinsChart = useMemo(
    () =>
      defineChart({
        marks: [
          barY(aggregates, {
            id: 'agg-coins',
            x: 'label',
            y: 'coins',
            fill: '#f0c14a',
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.2),
            axis: { label: periodLabel },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: 'Coins',
              ticks: { format: (value: number) => formatTowerNumber(value) },
            },
          },
        },
        tooltip,
      }),
    [aggregates, periodLabel],
  )

  const aggregateCellsChart = useMemo(
    () =>
      defineChart({
        marks: [
          barY(aggregates, {
            id: 'agg-cells',
            x: 'label',
            y: 'cells',
            fill: '#4ade80',
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.2),
            axis: { label: periodLabel },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: 'Cells',
              ticks: { format: (value: number) => formatTowerNumber(value) },
            },
          },
        },
        tooltip,
      }),
    [aggregates, periodLabel],
  )

  const byTierChart = useMemo(() => {
    const metricLabel =
      byTierMetric === 'avgCph'
        ? 'Avg coins/h'
        : byTierMetric === 'avgCellsPh'
          ? 'Avg cells/h'
          : byTierMetric === 'avgWave'
            ? 'Avg wave'
            : 'Runs'
    const fill =
      byTierMetric === 'avgCellsPh'
        ? '#4ade80'
        : byTierMetric === 'avgWave'
          ? '#60a5fa'
          : byTierMetric === 'runs'
            ? '#a78bfa'
            : '#f0c14a'

    return defineChart({
      marks: [
        barY(tierStats, {
          id: 'by-tier',
          x: 'label',
          y: byTierMetric,
          fill,
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand().padding(0.25),
          axis: { label: 'Tier' },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: metricLabel,
            ticks: {
              format: (value: number) =>
                byTierMetric === 'runs' || byTierMetric === 'avgWave'
                  ? String(Math.round(value))
                  : formatTowerNumber(value),
            },
          },
        },
      },
      tooltip,
    })
  }, [tierStats, byTierMetric])

  const byTierIncomeChart = useMemo(
    () =>
      defineChart({
        marks: [
          barY(tierStats, {
            id: 'tier-coins',
            x: 'label',
            y: 'totalCoins',
            fill: '#f0c14a',
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.25),
            axis: { label: 'Tier' },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: 'Total coins',
              ticks: { format: (value: number) => formatTowerNumber(value) },
            },
          },
        },
        tooltip,
      }),
    [tierStats],
  )

  const byTierCellsChart = useMemo(
    () =>
      defineChart({
        marks: [
          barY(tierStats, {
            id: 'tier-cells',
            x: 'label',
            y: 'totalCells',
            fill: '#4ade80',
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.25),
            axis: { label: 'Tier' },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: 'Total cells',
              ticks: { format: (value: number) => formatTowerNumber(value) },
            },
          },
        },
        tooltip,
      }),
    [tierStats],
  )

  function applyPreset(days: number | 'all') {
    const end = new Date()
    setTo(format(end, 'yyyy-MM-dd'))
    if (days === 'all') {
      if (runs.length === 0) {
        setFrom(format(subDays(end, 29), 'yyyy-MM-dd'))
        return
      }
      const earliest = runs.reduce((min, run) => {
        const t = parseISO(run.ran_at).getTime()
        return t < min ? t : min
      }, parseISO(runs[0].ran_at).getTime())
      setFrom(format(new Date(earliest), 'yyyy-MM-dd'))
      return
    }
    setFrom(format(subDays(end, days - 1), 'yyyy-MM-dd'))
  }

  const empty = filtered.length === 0
  const activePreset = getActivePreset(from, to, runs)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label>Range</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: '7', label: '7d', days: 7 as const },
                { id: '30', label: '30d', days: 30 as const },
                { id: '90', label: '90d', days: 90 as const },
                { id: 'all', label: 'All', days: 'all' as const },
              ] as const
            ).map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={activePreset === preset.id ? 'default' : 'outline'}
                onClick={() => applyPreset(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Tier</Label>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {tiers.map((tier) => (
                <SelectItem key={tier} value={String(tier)}>
                  Tier {tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard title="Runs" value={String(summary.count)} />
        <SummaryCard title="Total coins" value={formatTowerNumber(summary.totalCoins)} />
        <SummaryCard title="Total cells" value={formatTowerNumber(summary.totalCells)} />
        <SummaryCard title="Avg coins/h" value={formatTowerNumber(summary.avgCph)} />
        <SummaryCard title="Avg cells/h" value={formatTowerNumber(summary.avgCellsPh)} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Best runs</h2>
          <p className="text-sm text-muted-foreground">
            Top performers in the selected range{tierFilter !== 'all' ? ` · Tier ${tierFilter}` : ''}
          </p>
        </div>
        {empty ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No runs in this date range.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {bestMarkers.map((marker) => (
              <BestRunCard key={marker.key} marker={marker} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{showCells ? 'Coins & cells over time' : 'Coins over time'}</CardTitle>
            <CardDescription>Income from each run in the selected range</CardDescription>
          </div>
          <CellsToggle checked={showCells} onChange={setShowCells} />
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyChart />
          ) : (
            <Chart
              definition={incomeChart}
              height={320}
              ariaLabel={showCells ? 'Coins and cells over time' : 'Coins over time'}
              renderTooltipBody={renderRunTooltip}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{showCells ? 'Coins/h and cells/h trend' : 'Coins/h trend'}</CardTitle>
            <CardDescription>Efficiency per run — hover to see best-run badges</CardDescription>
          </div>
          <CellsToggle checked={showCells} onChange={setShowCells} />
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyChart />
          ) : (
            <Chart
              definition={rateChart}
              height={320}
              ariaLabel={showCells ? 'Coins and cells per hour trend' : 'Coins per hour trend'}
              renderTooltipBody={renderRunTooltip}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>By tier</CardTitle>
            <CardDescription>Compare average efficiency and totals across tiers</CardDescription>
          </div>
          <Tabs value={byTierMetric} onValueChange={(v) => setByTierMetric(v as typeof byTierMetric)}>
            <TabsList>
              <TabsTrigger value="avgCph">Avg CPH</TabsTrigger>
              <TabsTrigger value="avgCellsPh">Avg cells/h</TabsTrigger>
              <TabsTrigger value="avgWave">Avg wave</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-6">
          {empty ? (
            <EmptyChart />
          ) : (
            <>
              <Chart definition={byTierChart} height={280} ariaLabel="By tier comparison" renderTooltipBody={renderTierTooltip} />
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Total coins by tier</p>
                  <Chart
                    definition={byTierIncomeChart}
                    height={240}
                    ariaLabel="Total coins by tier"
                    renderTooltipBody={renderTierTooltip}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Total cells by tier</p>
                  <Chart
                    definition={byTierCellsChart}
                    height={240}
                    ariaLabel="Total cells by tier"
                    renderTooltipBody={renderTierTooltip}
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Tier</th>
                      <th className="px-3 py-2 font-medium">Runs</th>
                      <th className="px-3 py-2 font-medium">Avg wave</th>
                      <th className="px-3 py-2 font-medium">Avg coins/h</th>
                      <th className="px-3 py-2 font-medium">Avg cells/h</th>
                      <th className="px-3 py-2 font-medium">Total coins</th>
                      <th className="px-3 py-2 font-medium">Total cells</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierStats.map((row) => (
                      <tr key={row.tier} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">Tier {row.tier}</td>
                        <td className="px-3 py-2">{row.runs}</td>
                        <td className="px-3 py-2">{Math.round(row.avgWave)}</td>
                        <td className="px-3 py-2">{formatTowerNumber(row.avgCph)}</td>
                        <td className="px-3 py-2">{formatTowerNumber(row.avgCellsPh)}</td>
                        <td className="px-3 py-2">{formatTowerNumber(row.totalCoins)}</td>
                        <td className="px-3 py-2">{formatTowerNumber(row.totalCells)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Daily / weekly totals</CardTitle>
            <CardDescription>Separate coin and cell totals for the selected period</CardDescription>
          </div>
          <Tabs value={aggregateMode} onValueChange={(v) => setAggregateMode(v as 'daily' | 'weekly')}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyChart />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Coins</p>
                <Chart
                  definition={aggregateCoinsChart}
                  height={280}
                  ariaLabel={`${aggregateMode} coins totals`}
                  renderTooltipBody={renderAggregateTooltip}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Cells</p>
                <Chart
                  definition={aggregateCellsChart}
                  height={280}
                  ariaLabel={`${aggregateMode} cells totals`}
                  renderTooltipBody={renderAggregateTooltip}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getActivePreset(from: string, to: string, runs: Run[]): string | null {
  const end = format(new Date(), 'yyyy-MM-dd')
  if (to !== end) return null
  if (from === format(subDays(new Date(), 6), 'yyyy-MM-dd')) return '7'
  if (from === format(subDays(new Date(), 29), 'yyyy-MM-dd')) return '30'
  if (from === format(subDays(new Date(), 89), 'yyyy-MM-dd')) return '90'
  if (runs.length > 0) {
    const earliest = runs.reduce((min, run) => {
      const t = parseISO(run.ran_at).getTime()
      return t < min ? t : min
    }, parseISO(runs[0].ran_at).getTime())
    if (from === format(new Date(earliest), 'yyyy-MM-dd')) return 'all'
  }
  return null
}

function BestRunCard({ marker }: { marker: BestMarker }) {
  const Icon = marker.icon
  const metrics = runMetrics(marker.run)

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {marker.title}
          </CardDescription>
          <Badge className="border-primary/30 bg-primary/15 text-primary">Best</Badge>
        </div>
        <CardTitle className="text-2xl">{marker.valueLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Tier {marker.run.tier} · Wave {marker.run.wave_reached} · {marker.run.play_mode}
        </p>
        <p>{formatRunDate(marker.run.ran_at)} · {formatDuration(marker.run.duration_seconds)}</p>
        <p>
          {formatTowerNumber(marker.run.coins)} coins · {formatTowerNumber(marker.run.cells)} cells ·{' '}
          {formatTowerNumber(metrics.coinsPerHour)}/h
        </p>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link to="/runs/$runId" params={{ runId: marker.run.id }}>
            View run
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function CellsToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      Show cells
    </label>
  )
}

function renderRunTooltip({
  points,
  defaultBody,
}: {
  points: readonly { datum: Point }[]
  defaultBody: ReactNode
}) {
  const point = points[0]?.datum
  if (!point) return defaultBody

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">
        Tier {point.tier} · Wave {point.wave}
      </p>
      <div className="flex flex-wrap gap-1">
        {point.isBestWave ? <TooltipBadge>Best wave</TooltipBadge> : null}
        {point.isBestCph ? <TooltipBadge>Best CPH</TooltipBadge> : null}
        {point.isBestCellsPh ? <TooltipBadge>Best cells/h</TooltipBadge> : null}
      </div>
      {defaultBody}
    </div>
  )
}

function renderAggregateTooltip({
  points,
  defaultBody,
}: {
  points: readonly { datum: AggregatePoint }[]
  defaultBody: ReactNode
}) {
  const tiersLabel = points[0]?.datum.tiersLabel
  return (
    <div className="space-y-1">
      {tiersLabel ? <p className="text-xs font-medium">{tiersLabel}</p> : null}
      {defaultBody}
    </div>
  )
}

function renderTierTooltip({
  points,
  defaultBody,
}: {
  points: readonly { datum: TierStat }[]
  defaultBody: ReactNode
}) {
  const row = points[0]?.datum
  if (!row) return defaultBody
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">Tier {row.tier}</p>
      <p className="text-xs text-muted-foreground">
        {row.runs} runs · avg wave {Math.round(row.avgWave)}
      </p>
      {defaultBody}
    </div>
  )
}

function TooltipBadge({ children }: { children: ReactNode }) {
  return (
    <span className={cn('rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary')}>
      {children}
    </span>
  )
}

function EmptyChart() {
  return <p className="py-16 text-center text-sm text-muted-foreground">No runs in this date range.</p>
}
