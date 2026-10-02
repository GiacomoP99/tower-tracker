import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ImageUp, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { ImportWizard } from '@/components/import-wizard'
import { RunForm } from '@/components/run-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCreateRun } from '@/hooks/use-runs'
import { supabase } from '@/lib/supabase'

type AddTab = 'manual' | 'import'

type AddRunSearch = {
  tab?: AddTab
}

export const Route = createFileRoute('/runs/new')({
  validateSearch: (search: Record<string, unknown>): AddRunSearch => {
    if (search.tab === 'import') return { tab: 'import' }
    if (search.tab === 'manual') return { tab: 'manual' }
    return {}
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: AddRunPage,
})

function AddRunPage() {
  const { tab: tabParam } = Route.useSearch()
  const tab: AddTab = tabParam ?? 'manual'
  const navigate = useNavigate({ from: '/runs/new' })
  const createRun = useCreateRun()

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Add run</h1>
        <p className="text-sm text-muted-foreground">
          Log a farm manually, or import from a Battle History screenshot
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          void navigate({
            search: { tab: value === 'import' ? 'import' : 'manual' },
            replace: true,
          })
        }}
      >
        <TabsList>
          <TabsTrigger value="manual" className="gap-1.5">
            <PenLine className="size-3.5" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5">
            <ImageUp className="size-3.5" />
            Import screenshot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
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
        </TabsContent>

        <TabsContent value="import">
          <ImportWizard />
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
