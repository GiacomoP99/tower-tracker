import { useMemo } from 'react'
import { defineChart, barY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { tooltip } from '@tanstack/charts/tooltip'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { Flame, CalendarDays, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { computeStreakStats } from '@/lib/goals'
import type { Run } from '@/types/run'
import { cn } from '@/lib/utils'

export function StreaksPanel({ runs }: { runs: Run[] }) {
  const stats = useMemo(() => computeStreakStats(runs), [runs])

  const weekChart = useMemo(
    () =>
      defineChart({
        marks: [
          barY(stats.last14Days, {
            id: 'runs-per-day',
            x: 'label',
            y: 'count',
            fill: '#f0c14a',
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.2),
            axis: { label: 'Day' },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: 'Runs' },
          },
        },
        tooltip,
      }),
    [stats.last14Days],
  )

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Streaks & consistency</h2>
        <p className="text-sm text-muted-foreground">How regularly you’re logging farms</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Flame}
          title="Current streak"
          value={`${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`}
          hint={stats.runsToday > 0 ? 'Including today' : 'Counting from yesterday if today is empty'}
        />
        <StatCard
          icon={Flame}
          title="Longest streak"
          value={`${stats.longestStreak} day${stats.longestStreak === 1 ? '' : 's'}`}
          hint="Best consecutive days with ≥1 run"
        />
        <StatCard
          icon={CalendarDays}
          title="This week"
          value={`${stats.runsThisWeek} run${stats.runsThisWeek === 1 ? '' : 's'}`}
          hint={`${stats.activeDaysThisWeek}/7 active days`}
        />
        <StatCard
          icon={Activity}
          title="14-day consistency"
          value={`${stats.consistencyPercent}%`}
          hint={`${stats.last14Days.filter((d) => d.count > 0).length}/14 days with a run`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runs per day</CardTitle>
          <CardDescription>Last 14 days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1">
            {stats.last14Days.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-10 w-full rounded-md border',
                    day.count === 0 && 'bg-muted/40',
                    day.count === 1 && 'border-primary/30 bg-primary/30',
                    day.count === 2 && 'border-primary/40 bg-primary/50',
                    day.count >= 3 && 'border-primary/50 bg-primary/80',
                  )}
                  title={`${day.date}: ${day.count} run${day.count === 1 ? '' : 's'}`}
                />
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  {day.label.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          {runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Log runs to build a streak.</p>
          ) : (
            <Chart definition={weekChart} height={220} ariaLabel="Runs per day last 14 days" />
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: typeof Flame
  title: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {title}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
