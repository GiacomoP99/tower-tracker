import { useMemo, useState } from 'react'
import type Decimal from 'decimal.js'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  compareTierWeekOverWeek,
  formatSignedInt,
  formatSignedTower,
  tiersWithRecentActivity,
} from '@/lib/run-comparison'
import { formatRunDate, formatTowerNumber, runMetrics } from '@/lib/metrics'
import type { Run } from '@/types/run'
import { cn } from '@/lib/utils'

export function RunComparisonPanel({ runs }: { runs: Run[] }) {
  const availableTiers = useMemo(() => {
    const recent = tiersWithRecentActivity(runs)
    if (recent.length > 0) return recent
    return [...new Set(runs.map((r) => r.tier))].sort((a, b) => b - a)
  }, [runs])

  const [tier, setTier] = useState('')
  const selectedTier = availableTiers.includes(Number(tier))
    ? Number(tier)
    : (availableTiers[0] ?? 0)

  const comparison = useMemo(() => {
    if (!selectedTier) return null
    return compareTierWeekOverWeek(runs, selectedTier)
  }, [runs, selectedTier])

  if (runs.length === 0 || !comparison || availableTiers.length === 0) {
    return null
  }

  const { thisWeek, lastWeek, deltaAvg, latestRun, latestVsLastWeekAvg } = comparison
  const hasBoth = thisWeek.runCount > 0 && lastWeek.runCount > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">This week vs last week</CardTitle>
            <CardDescription>
              Same-tier farm comparison · Mon–Sun weeks · wave, coins/h, cells/h
            </CardDescription>
          </div>
          <Select value={String(selectedTier)} onValueChange={setTier}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              {availableTiers.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  Tier {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasBoth && thisWeek.runCount === 0 && lastWeek.runCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Tier {selectedTier} runs in the last two weeks.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <DeltaStat
                label="Avg wave"
                thisValue={thisWeek.runCount ? thisWeek.avgWave.toFixed(0) : '—'}
                lastValue={lastWeek.runCount ? lastWeek.avgWave.toFixed(0) : '—'}
                delta={hasBoth ? formatSignedInt(deltaAvg.wave, 0) : null}
                tone={deltaTone(deltaAvg.wave, hasBoth)}
              />
              <DeltaStat
                label="Avg coins/h"
                thisValue={thisWeek.runCount ? formatTowerNumber(thisWeek.avgCph) : '—'}
                lastValue={lastWeek.runCount ? formatTowerNumber(lastWeek.avgCph) : '—'}
                delta={hasBoth ? formatSignedTower(deltaAvg.cph) : null}
                tone={deltaToneDecimal(deltaAvg.cph, hasBoth)}
              />
              <DeltaStat
                label="Avg cells/h"
                thisValue={thisWeek.runCount ? formatTowerNumber(thisWeek.avgCellsPh) : '—'}
                lastValue={lastWeek.runCount ? formatTowerNumber(lastWeek.avgCellsPh) : '—'}
                delta={hasBoth ? formatSignedTower(deltaAvg.cellsPh) : null}
                tone={deltaToneDecimal(deltaAvg.cellsPh, hasBoth)}
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge className="font-normal">
                This week · {thisWeek.runCount} run{thisWeek.runCount === 1 ? '' : 's'}
                {thisWeek.runCount > 0 ? ` · best wave ${thisWeek.bestWave}` : ''}
              </Badge>
              <Badge className="font-normal">
                Last week · {lastWeek.runCount} run{lastWeek.runCount === 1 ? '' : 's'}
                {lastWeek.runCount > 0 ? ` · best wave ${lastWeek.bestWave}` : ''}
              </Badge>
            </div>

            {latestRun && latestVsLastWeekAvg && lastWeek.runCount > 0 && (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium">Latest farm vs last week’s average</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRunDate(latestRun.ran_at)} · Wave {latestRun.wave_reached} ·{' '}
                  {formatTowerNumber(runMetrics(latestRun).coinsPerHour)}/h ·{' '}
                  {formatTowerNumber(runMetrics(latestRun).cellsPerHour)} cells/h
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <InlineDelta
                    label="Wave"
                    value={formatSignedInt(latestVsLastWeekAvg.wave, 0)}
                    tone={deltaTone(latestVsLastWeekAvg.wave, true)}
                  />
                  <InlineDelta
                    label="CPH"
                    value={formatSignedTower(latestVsLastWeekAvg.cph)}
                    tone={deltaToneDecimal(latestVsLastWeekAvg.cph, true)}
                  />
                  <InlineDelta
                    label="Cells/h"
                    value={formatSignedTower(latestVsLastWeekAvg.cellsPh)}
                    tone={deltaToneDecimal(latestVsLastWeekAvg.cellsPh, true)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function deltaTone(value: number, active: boolean): 'up' | 'down' | 'flat' {
  if (!active || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

function deltaToneDecimal(value: Decimal, active: boolean): 'up' | 'down' | 'flat' {
  if (!active || value.eq(0)) return 'flat'
  return value.gt(0) ? 'up' : 'down'
}

function DeltaStat({
  label,
  thisValue,
  lastValue,
  delta,
  tone,
}: {
  label: string
  thisValue: string
  lastValue: string
  delta: string | null
  tone: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{thisValue}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">vs {lastValue} last week</p>
      {delta != null && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1 text-sm font-medium',
            tone === 'up' && 'text-chart-2',
            tone === 'down' && 'text-destructive',
            tone === 'flat' && 'text-muted-foreground',
          )}
        >
          <ToneIcon tone={tone} />
          {delta}
        </p>
      )}
    </div>
  )
}

function InlineDelta({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'up' | 'down' | 'flat'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1',
        tone === 'up' && 'border-chart-2/30 bg-chart-2/10 text-chart-2',
        tone === 'down' && 'border-destructive/30 bg-destructive/10 text-destructive',
        tone === 'flat' && 'text-muted-foreground',
      )}
    >
      <ToneIcon tone={tone} />
      {label} {value}
    </span>
  )
}

function ToneIcon({ tone }: { tone: 'up' | 'down' | 'flat' }) {
  if (tone === 'up') return <ArrowUpRight className="size-3.5" />
  if (tone === 'down') return <ArrowDownRight className="size-3.5" />
  return <Minus className="size-3.5" />
}
