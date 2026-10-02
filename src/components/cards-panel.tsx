import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MAX_CARD_STARS, RARITY_LABEL, TOWER_CARDS, type CardRarity, type TowerCard } from '@/data/cards'
import { useDeleteUserCard, useUpsertUserCard, useUserCards } from '@/hooks/use-cards'
import { cn } from '@/lib/utils'

type LocalCardState = {
  stars: number
  extras: number
}

const emptyState = (): LocalCardState => ({ stars: 0, extras: 0 })

export function CardsPanel() {
  const { data: rows = [], isLoading, error } = useUserCards()
  const upsert = useUpsertUserCard()
  const remove = useDeleteUserCard()
  const [query, setQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState<'all' | CardRarity>('all')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [local, setLocal] = useState<Record<string, LocalCardState>>({})

  useEffect(() => {
    const next: Record<string, LocalCardState> = {}
    for (const card of TOWER_CARDS) {
      const row = rows.find((r) => r.card_id === card.id)
      next[card.id] = row
        ? { stars: row.stars, extras: row.extras }
        : emptyState()
    }
    setLocal(next)
  }, [rows])

  const filtered = useMemo(() => {
    return TOWER_CARDS.filter((card) => {
      if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false
      if (query && !card.name.toLowerCase().includes(query.toLowerCase())) return false
      const state = local[card.id] ?? emptyState()
      if (ownedOnly && state.stars <= 0) return false
      return true
    })
  }, [query, rarityFilter, ownedOnly, local])

  const ownedCount = useMemo(
    () => Object.values(local).filter((s) => s.stars > 0).length,
    [local],
  )

  async function saveCard(cardId: string, next: LocalCardState) {
    setLocal((prev) => ({ ...prev, [cardId]: next }))
    try {
      if (next.stars <= 0 && next.extras <= 0) {
        await remove.mutateAsync(cardId)
      } else {
        await upsert.mutateAsync({
          card_id: cardId,
          stars: Math.max(0, Math.min(MAX_CARD_STARS, next.stars)),
          extras: Math.max(0, next.extras),
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save card')
      // revert from server rows on next invalidate; force refresh state from rows
      const row = rows.find((r) => r.card_id === cardId)
      setLocal((prev) => ({
        ...prev,
        [cardId]: row ? { stars: row.stars, extras: row.extras } : emptyState(),
      }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="card-search">Search</Label>
          <Input
            id="card-search"
            className="w-48"
            placeholder="Coins, Wave Skip…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Rarity</Label>
          <Select value={rarityFilter} onValueChange={(v) => setRarityFilter(v as 'all' | CardRarity)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="common">Common</SelectItem>
              <SelectItem value="rare">Rare</SelectItem>
              <SelectItem value="epic">Epic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={ownedOnly}
            onChange={(e) => setOwnedOnly(e.target.checked)}
          />
          Owned only
        </label>
        <p className="pb-2 text-sm text-muted-foreground">
          {ownedCount}/{TOWER_CARDS.length} owned
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading cards…</p>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {error.message.includes('relation') || error.message.includes('does not exist')
              ? 'Cards table missing. Run supabase/migrations/003_user_cards.sql in your Supabase SQL editor.'
              : error.message}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((card) => (
            <CardEditor
              key={card.id}
              card={card}
              state={local[card.id] ?? emptyState()}
              saving={upsert.isPending || remove.isPending}
              onChange={(next) => void saveCard(card.id, next)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CardEditor({
  card,
  state,
  saving,
  onChange,
}: {
  card: TowerCard
  state: LocalCardState
  saving: boolean
  onChange: (next: LocalCardState) => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const owned = state.stars > 0

  return (
    <Card className={cn('overflow-hidden', !owned && 'opacity-80')}>
      <div className="relative aspect-square bg-muted/40">
        {!imgFailed ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="h-full w-full object-contain p-3"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={cn(
              'flex h-full w-full items-center justify-center p-4 text-center text-sm font-semibold',
              card.rarity === 'common' && 'bg-slate-700/40 text-slate-100',
              card.rarity === 'rare' && 'bg-blue-700/40 text-blue-100',
              card.rarity === 'epic' && 'bg-purple-700/40 text-purple-100',
            )}
          >
            {card.name}
          </div>
        )}
        <Badge
          className={cn(
            'absolute left-2 top-2',
            card.rarity === 'common' && 'border-slate-400/40 bg-slate-500/30',
            card.rarity === 'rare' && 'border-sky-400/40 bg-sky-500/30',
            card.rarity === 'epic' && 'border-violet-400/40 bg-violet-500/30',
          )}
        >
          {RARITY_LABEL[card.rarity]}
        </Badge>
      </div>

      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base">{card.name}</CardTitle>
        <CardDescription>{owned ? `${state.stars}★ · ${state.extras} extras` : 'Not owned'}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Rank (stars)</Label>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: MAX_CARD_STARS }, (_, i) => i + 1).map((star) => {
              const active = state.stars >= star
              return (
                <button
                  key={star}
                  type="button"
                  disabled={saving}
                  aria-label={`Set rank to ${star} stars`}
                  className={cn(
                    'rounded-md p-1 transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground',
                  )}
                  onClick={() =>
                    onChange({
                      stars: state.stars === star ? star - 1 : star,
                      extras: state.stars === star && star - 1 <= 0 ? 0 : state.extras,
                    })
                  }
                >
                  <Star className={cn('size-5', active && 'fill-current')} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Extras</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={saving || state.extras <= 0}
              onClick={() => onChange({ ...state, extras: Math.max(0, state.extras - 1) })}
            >
              <Minus className="size-4" />
            </Button>
            <Input
              type="number"
              min={0}
              className="text-center"
              value={state.extras}
              disabled={saving}
              onChange={(e) =>
                onChange({
                  ...state,
                  extras: Math.max(0, Number(e.target.value) || 0),
                  stars: state.stars <= 0 && Number(e.target.value) > 0 ? 1 : state.stars,
                })
              }
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={saving}
              onClick={() =>
                onChange({
                  stars: state.stars <= 0 ? 1 : state.stars,
                  extras: state.extras + 1,
                })
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
