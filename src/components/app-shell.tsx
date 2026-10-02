import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Home, LayoutDashboard, Lightbulb, ListOrdered, LogOut, Plus, SquareStack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/advisor', label: 'Advisor', icon: Lightbulb },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cards', label: 'Cards', icon: SquareStack },
  { to: '/runs', label: 'Runs', icon: ListOrdered },
  { to: '/runs/new', label: 'Add run', icon: Plus },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_oklch(0.22_0.04_265),_oklch(0.14_0.02_260)_55%)]">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight text-primary">
              Tower Tracker
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const Icon = item.icon
                const active =
                  item.to === '/'
                    ? pathname === '/'
                    : item.to === '/runs/new'
                      ? pathname.startsWith('/runs/new') || pathname.startsWith('/runs/import')
                      : item.to === '/runs'
                        ? pathname === '/runs' || pathname === '/runs/'
                        : pathname === item.to || pathname.startsWith(`${item.to}/`)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
