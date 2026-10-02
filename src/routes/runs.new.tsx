import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { RunForm } from '@/components/run-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateRun } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/runs/new')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: NewRunPage,
})

function NewRunPage() {
  const createRun = useCreateRun()
  const navigate = useNavigate()

  return (
    <AppShell>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Log a run</CardTitle>
          <CardDescription>Record tier, wave, duration, mode, coins, and cells</CardDescription>
        </CardHeader>
        <CardContent>
          <RunForm
            submitting={createRun.isPending}
            onSubmit={async (values) => {
              await createRun.mutateAsync(values)
              toast.success('Run saved')
              await navigate({ to: '/runs' })
            }}
          />
        </CardContent>
      </Card>
    </AppShell>
  )
}
