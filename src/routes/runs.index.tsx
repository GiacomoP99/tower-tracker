import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ImageUp, Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { RunsTable } from '@/components/runs-table'
import { Button } from '@/components/ui/button'
import { useRuns } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/runs/')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: RunsPage,
})

function RunsPage() {
  const { data: runs = [], isLoading, error } = useRuns()

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground">Every logged farm or push attempt</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/runs/import">
              <ImageUp className="size-4" />
              Import screenshot
            </Link>
          </Button>
          <Button asChild>
            <Link to="/runs/new">
              <Plus className="size-4" />
              Log run
            </Link>
          </Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading runs…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <RunsTable runs={runs} />
      )}
    </AppShell>
  )
}
