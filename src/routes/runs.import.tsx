import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { ImportWizard } from '@/components/import-wizard'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/runs/import')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: ImportPage,
})

function ImportPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Import screenshot</h1>
        <p className="text-sm text-muted-foreground">
          OCR your Battle History screen, review the extracted runs, then save
        </p>
      </div>
      <ImportWizard />
    </AppShell>
  )
}
