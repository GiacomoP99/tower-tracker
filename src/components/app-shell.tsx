import { useEffect, useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Home, LayoutDashboard, Lightbulb, ListOrdered, LogOut, Menu, Plus, SquareStack, X } from 'lucide-react'
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

function isNavActive(pathname: string, to: (typeof nav)[number]['to']) {
  if (to === '/') return pathname === '/'
  if (to === '/runs/new') return pathname.startsWith('/runs/new') || pathname.startsWith('/runs/import')
  if (to === '/runs') return pathname === '/runs' || pathname === '/runs/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_oklch(0.22_0.04_265),_oklch(0.14_0.02_260)_55%)]">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 sm:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
            <Link to="/" className="truncate text-lg font-semibold tracking-tight text-primary">
              Tower Tracker
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const Icon = item.icon
                const active = isNavActive(pathname, item.to)
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
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <div
            id="mobile-nav"
            className="border-t border-border/80 bg-background/95 sm:hidden"
          >
            <nav className="mx-auto grid max-w-6xl gap-1 px-3 py-3">
              {nav.map((item) => {
                const Icon = item.icon
                const active = isNavActive(pathname, item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
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
              {user?.email ? (
                <p className="mt-2 truncate px-3 pb-1 text-xs text-muted-foreground">{user.email}</p>
              ) : null}
            </nav>
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
