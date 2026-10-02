import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useCreateGoal, useCreateGoals, useDeleteGoal, useGoals, useUpdateGoal } from '@/hooks/use-goals'
import {
  computeGoalProgress,
  generateGoalSuggestions,
  goalDisplayTitle,
  type GoalSuggestion,
} from '@/lib/goals'
import { parseTowerNumber } from '@/lib/metrics'
import {
  GOAL_METRIC_OPTIONS,
  GOAL_PERIOD_OPTIONS,
  type Goal,
  type GoalMetric,
  type GoalPeriod,
} from '@/types/goal'
import type { Run } from '@/types/run'
import { cn } from '@/lib/utils'

export function GoalsPanel({ runs }: { runs: Run[] }) {
  const { data: goals = [], isLoading, error } = useGoals()
  const createGoal = useCreateGoal()
  const createGoals = useCreateGoals()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()
  const [showForm, setShowForm] = useState(false)
  const [showAllGoals, setShowAllGoals] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<GoalSuggestion & { selected: boolean }> | null>(null)

  const activeGoals = useMemo(() => goals.filter((g) => g.active), [goals])
  const completedGoals = useMemo(() => goals.filter((g) => !g.active), [goals])
  const selectedCount = suggestions?.filter((s) => s.selected).length ?? 0

  const sortedActiveGoals = useMemo(() => {
    return [...activeGoals].sort((a, b) => {
      const percentA = computeGoalProgress(a, runs).percent
      const percentB = computeGoalProgress(b, runs).percent
      // Closest to reaching the target first
      if (percentB !== percentA) return percentB - percentA
      return a.created_at.localeCompare(b.created_at)
    })
  }, [activeGoals, runs])

  const visibleActiveGoals = showAllGoals ? sortedActiveGoals : sortedActiveGoals.slice(0, 2)
  const hiddenGoalsCount = Math.max(0, sortedActiveGoals.length - 2)

  function handleGenerate() {
    if (runs.length === 0) {
      toast.error('Log some runs first so we can suggest goals from your progress')
      return
    }
    const generated = generateGoalSuggestions(runs, goals).map((s) => ({ ...s, selected: true }))
    if (generated.length === 0) {
      toast.message('No new suggestions', {
        description: 'You may already have matching active goals, or need more run data.',
      })
      setSuggestions(null)
      return
    }
    setSuggestions(generated)
    setShowForm(false)
    toast.success(`Suggested ${generated.length} goal${generated.length === 1 ? '' : 's'} from your recent progress`)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Goals</h2>
          <p className="text-sm text-muted-foreground">
            Set targets like “hit X coins/h this week”, or generate them from your recent runs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={runs.length === 0}
          >
            <Sparkles className="size-4" />
            Generate from progress
          </Button>
          <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            {showForm ? 'Close' : 'Add goal'}
          </Button>
        </div>
      </div>

      {suggestions && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Suggested goals</CardTitle>
                <CardDescription>
                  Based on recent performance, stretched ~10% (or a bit more for waves / run count). Review and save what
                  you want.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSuggestions(null)}>
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  disabled={selectedCount === 0 || createGoals.isPending}
                  onClick={() => {
                    const selected = suggestions.filter((s) => s.selected)
                    createGoals.mutate(
                      selected.map((s) => ({
                        title: s.title,
                        metric: s.metric,
                        period: s.period,
                        target: s.target,
                        tier: s.tier,
                      })),
                      {
                        onSuccess: () => {
                          toast.success(`Saved ${selected.length} goal${selected.length === 1 ? '' : 's'}`)
                          setSuggestions(null)
                        },
                        onError: (err) => toast.error(err.message),
                      },
                    )
                  }}
                >
                  {createGoals.isPending
                    ? 'Saving…'
                    : `Save ${selectedCount} goal${selectedCount === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion) => (
              <label
                key={suggestion.localId}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                  suggestion.selected ? 'border-primary/40 bg-primary/5' : 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  checked={suggestion.selected}
                  onChange={(e) =>
                    setSuggestions((prev) =>
                      prev?.map((s) =>
                        s.localId === suggestion.localId ? { ...s, selected: e.target.checked } : s,
                      ) ?? null,
                    )
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{suggestion.title}</p>
                    {suggestion.tier != null ? (
                      <Badge className="border-border bg-muted/50">Tier {suggestion.tier}</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.basisLabel}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <GoalForm
          submitting={createGoal.isPending}
          onSubmit={async (values) => {
            await createGoal.mutateAsync(values)
            toast.success('Goal created')
            setShowForm(false)
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading goals…</p>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {error.message.includes('relation') || error.message.includes('does not exist')
              ? 'Goals table missing. Run supabase/migrations/002_goals.sql in your Supabase SQL editor.'
              : error.message}
          </CardContent>
        </Card>
      ) : activeGoals.length === 0 && completedGoals.length === 0 && !suggestions ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center text-sm text-muted-foreground">
            <p>No goals yet. Generate some from your progress, or add one manually.</p>
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={runs.length === 0}>
              <Sparkles className="size-4" />
              Generate from progress
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleActiveGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              runs={runs}
              onToggleActive={() =>
                updateGoal.mutate(
                  { id: goal.id, active: false },
                  {
                    onSuccess: () => toast.success('Goal archived'),
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
              onDelete={() => {
                if (!confirm('Delete this goal?')) return
                deleteGoal.mutate(goal.id, {
                  onSuccess: () => toast.success('Goal deleted'),
                  onError: (err) => toast.error(err.message),
                })
              }}
            />
          ))}
          {hiddenGoalsCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAllGoals((v) => !v)}
            >
              {showAllGoals ? 'Show less' : `Show more (${hiddenGoalsCount})`}
            </Button>
          )}
          {completedGoals.length > 0 && (
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Archived ({completedGoals.length})
              </summary>
              <div className="mt-3 space-y-3">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    runs={runs}
                    archived
                    onToggleActive={() =>
                      updateGoal.mutate(
                        { id: goal.id, active: true },
                        {
                          onSuccess: () => toast.success('Goal restored'),
                          onError: (err) => toast.error(err.message),
                        },
                      )
                    }
                    onDelete={() => {
                      if (!confirm('Delete this goal?')) return
                      deleteGoal.mutate(goal.id, {
                        onSuccess: () => toast.success('Goal deleted'),
                        onError: (err) => toast.error(err.message),
                      })
                    }}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  )
}

function GoalCard({
  goal,
  runs,
  archived,
  onToggleActive,
  onDelete,
}: {
  goal: Goal
  runs: Run[]
  archived?: boolean
  onToggleActive: () => void
  onDelete: () => void
}) {
  const progress = computeGoalProgress(goal, runs)

  return (
    <Card className={cn(archived && 'opacity-70')}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{goalDisplayTitle(goal)}</CardTitle>
            <CardDescription>
              {progress.periodLabel}
              {goal.tier != null ? ` · Tier ${goal.tier}` : ''} · {progress.runCount} run
              {progress.runCount === 1 ? '' : 's'} in period
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {progress.completed ? (
              <Badge className="border-chart-2/40 bg-chart-2/15 text-chart-2">Completed</Badge>
            ) : (
              <Badge className="border-border bg-muted/50">{progress.percent}%</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onToggleActive}>
              {archived ? 'Restore' : 'Archive'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete goal">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="font-medium">
            {progress.currentLabel} <span className="text-muted-foreground">/ {progress.targetLabel}</span>
          </span>
          <span className="text-muted-foreground">{progress.percent}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progress.completed ? 'bg-chart-2' : 'bg-primary',
            )}
            style={{ width: `${Math.min(100, progress.percent)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function GoalForm({
  submitting,
  onSubmit,
}: {
  submitting?: boolean
  onSubmit: (values: {
    title?: string | null
    metric: GoalMetric
    target: string
    period: GoalPeriod
    tier?: number | null
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [metric, setMetric] = useState<GoalMetric>('best_coins_per_hour')
  const [period, setPeriod] = useState<GoalPeriod>('week')
  const [target, setTarget] = useState('')
  const [tier, setTier] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const parsed = parseTowerNumber(target)
      await onSubmit({
        title: title.trim() || null,
        metric,
        period,
        target: parsed.toString(),
        tier: tier ? Number(tier) : null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create goal')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New goal</CardTitle>
        <CardDescription>Example: best coins/h · this week · target 50M</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="goal-title">Title (optional)</Label>
            <Input
              id="goal-title"
              placeholder="Hit 50M coins/h this week"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Metric</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_METRIC_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="goal-target">Target</Label>
            <Input
              id="goal-target"
              required
              placeholder="50M or 150000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="goal-tier">Tier filter (optional)</Label>
            <Input
              id="goal-tier"
              type="number"
              min={1}
              placeholder="Any tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create goal'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
