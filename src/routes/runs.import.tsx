import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

/** Kept for old links — sends users to Add run → Import tab. */
export const Route = createFileRoute('/runs/import')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login' })
    throw redirect({ to: '/runs/new', search: { tab: 'import' } })
  },
})
