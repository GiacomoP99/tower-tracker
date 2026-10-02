import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdvisorPanel } from '@/components/advisor-panel'
import { AppShell } from '@/components/app-shell'
import { useRuns } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/advisor')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: AdvisorPage,
})

function AdvisorPage() {
  const { data: runs = [], isLoading, error } = useRuns()

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Advisor</h1>
        <p className="text-sm text-muted-foreground">
          Suggestions from your recent runs and card ranks — best tiers, gaps, and next moves
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <AdvisorPanel runs={runs} />
      )}
    </AppShell>
  )
}
