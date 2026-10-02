import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { CardsPanel } from '@/components/cards-panel'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/cards')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
  },
  component: CardsPage,
})

function CardsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cards</h1>
        <p className="text-sm text-muted-foreground">
          Track which cards you own, their star rank, and how many extras you have for each
        </p>
      </div>
      <CardsPanel />
    </AppShell>
  )
}
