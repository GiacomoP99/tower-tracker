export type GoalMetric =
  | 'avg_coins_per_hour'
  | 'avg_cells_per_hour'
  | 'best_coins_per_hour'
  | 'best_cells_per_hour'
  | 'best_wave'
  | 'total_coins'
  | 'total_cells'
  | 'run_count'

export type GoalPeriod = 'day' | 'week' | 'month' | 'all'

export type Goal = {
  id: string
  user_id: string
  title: string | null
  metric: GoalMetric
  target: string
  period: GoalPeriod
  tier: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export type GoalInsert = {
  title?: string | null
  metric: GoalMetric
  target: string
  period: GoalPeriod
  tier?: number | null
  active?: boolean
}

export type GoalUpdate = Partial<GoalInsert>

export const GOAL_METRIC_OPTIONS: { value: GoalMetric; label: string }[] = [
  { value: 'avg_coins_per_hour', label: 'Avg coins/h' },
  { value: 'avg_cells_per_hour', label: 'Avg cells/h' },
  { value: 'best_coins_per_hour', label: 'Best coins/h' },
  { value: 'best_cells_per_hour', label: 'Best cells/h' },
  { value: 'best_wave', label: 'Best wave' },
  { value: 'total_coins', label: 'Total coins' },
  { value: 'total_cells', label: 'Total cells' },
  { value: 'run_count', label: 'Run count' },
]

export const GOAL_PERIOD_OPTIONS: { value: GoalPeriod; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]
