import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { RunForm } from '@/components/run-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRuns, useUpdateRun } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/runs/$runId')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: EditRunPage,
})

function EditRunPage() {
  const { runId } = Route.useParams()
  const { data: runs = [], isLoading } = useRuns()
  const updateRun = useUpdateRun()
  const navigate = useNavigate()
  const run = runs.find((r) => r.id === runId)

  return (
    <AppShell>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit run</CardTitle>
          <CardDescription>Update details for this run</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !run ? (
            <p className="text-sm text-destructive">Run not found.</p>
          ) : (
            <RunForm
              initial={run}
              submitting={updateRun.isPending}
              onSubmit={async (values) => {
                await updateRun.mutateAsync({ id: run.id, ...values })
                toast.success('Run updated')
                await navigate({ to: '/runs' })
              }}
            />
          )}
        </CardContent>
      </Card>
    </AppShell>
  )
}
