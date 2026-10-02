import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { GoalsPanel } from '@/components/goals-panel'
import { StreaksPanel } from '@/components/streaks-panel'
import { useRuns } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: HomePage,
})

function HomePage() {
  const { data: runs = [], isLoading, error } = useRuns()

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">Your goals and farming consistency at a glance</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <div className="space-y-10">
          <GoalsPanel runs={runs} />
          <StreaksPanel runs={runs} />
        </div>
      )}
    </AppShell>
  )
}
