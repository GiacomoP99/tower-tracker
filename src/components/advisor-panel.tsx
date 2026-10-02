import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ChartColumnIncreasing,
  Flame,
  Layers,
  Lightbulb,
  Sprout,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUserCards } from '@/hooks/use-cards'
import {
  generateAdvisorTips,
  type AdvisorCategory,
  type AdvisorTip,
} from '@/lib/advisor'
import type { Run } from '@/types/run'
import { cn } from '@/lib/utils'

const CATEGORY_META: Record<
  AdvisorCategory,
  { label: string; icon: typeof Lightbulb; className: string }
> = {
  farm: {
    label: 'Farming',
    icon: Sprout,
    className: 'border-chart-2/40 bg-chart-2/15 text-chart-2',
  },
  cards: {
    label: 'Cards',
    icon: Layers,
    className: 'border-chart-1/40 bg-chart-1/15 text-chart-1',
  },
  consistency: {
    label: 'Consistency',
    icon: Flame,
    className: 'border-chart-3/40 bg-chart-3/15 text-chart-3',
  },
  progress: {
    label: 'Progress',
    icon: TrendingUp,
    className: 'border-primary/40 bg-primary/15 text-primary',
  },
}

export function AdvisorPanel({ runs }: { runs: Run[] }) {
  const { data: userCards = [], isLoading: cardsLoading } = useUserCards()

  const tips = useMemo(
    () => generateAdvisorTips(runs, userCards),
    [runs, userCards],
  )

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Advisor</h2>
        <p className="text-sm text-muted-foreground">
          Suggestions from your recent runs and card ranks — best tiers, gaps, and next moves
        </p>
      </div>

      {cardsLoading && runs.length > 0 ? (
        <p className="text-sm text-muted-foreground">Reading your card inventory…</p>
      ) : tips.length === 0 ? (
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <Lightbulb className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Nothing urgent right now</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep logging farms and updating card stars — new tips will show up as patterns appear.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tips.map((tip) => (
            <TipCard key={tip.id} tip={tip} />
          ))}
        </div>
      )}
    </section>
  )
}

function TipCard({ tip }: { tip: AdvisorTip }) {
  const meta = CATEGORY_META[tip.category]
  const Icon = meta.icon

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn('font-normal', meta.className)}>
            <Icon className="mr-1 size-3.5" />
            {meta.label}
          </Badge>
          {tip.id === 'best-farm-tier' && (
            <Badge className="border-chart-2/30 bg-chart-2/10 font-normal text-chart-2">
              <ChartColumnIncreasing className="mr-1 size-3.5" />
              Top tip
            </Badge>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="font-medium leading-snug">{tip.title}</p>
          <p className="text-sm text-muted-foreground">{tip.body}</p>
        </div>
        {tip.href && (
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link to={tip.href}>
              {tip.hrefLabel ?? 'Open'}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
