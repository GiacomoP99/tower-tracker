import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { DashboardCharts } from '@/components/dashboard-charts'
import { useRuns } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { data: runs = [], isLoading, error } = useRuns()

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Trends, best-run markers, and tier comparisons for your logged farms
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading runs…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <DashboardCharts runs={runs} />
      )}
    </AppShell>
  )
}
