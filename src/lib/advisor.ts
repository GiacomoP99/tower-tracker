import { parseISO, subDays } from 'date-fns'
import { MAX_CARD_STARS, TOWER_CARDS } from '@/data/cards'
import { computeStreakStats } from '@/lib/goals'
import { formatTowerNumber } from '@/lib/metrics'
import { compareTierWeekOverWeek, computePeriodStats } from '@/lib/run-comparison'
import type { UserCard } from '@/types/card'
import type { Run } from '@/types/run'

export type AdvisorCategory = 'farm' | 'cards' | 'consistency' | 'progress'

export type AdvisorTip = {
  id: string
  category: AdvisorCategory
  priority: number
  title: string
  body: string
  href?: '/cards' | '/dashboard' | '/runs/new' | '/runs'
  hrefLabel?: string
  hrefSearch?: { tab: 'manual' | 'import' }
}

/** Cards that most often matter for coin/cell farming — prioritized when underleveled. */
const FARM_PRIORITY_CARDS: Array<{ id: string; why: string }> = [
  { id: 'coins', why: 'direct coin multiplier for virtually every farm' },
  { id: 'enemy-balance', why: 'more enemies → more coin and cell income' },
  { id: 'critical-coin', why: 'strong coin income on crit builds' },
  { id: 'cash', why: 'faster workshop upgrades mid-run' },
  { id: 'wave-skip', why: 'more waves per hour = better CPH' },
  { id: 'intro-sprint', why: 'skips early slow waves' },
  { id: 'free-upgrades', why: 'keeps workshop climbing without spending cash' },
  { id: 'recovery-package-chance', why: 'sustains long farms' },
  { id: 'extra-orb', why: 'extra clear and coin opportunities' },
  { id: 'death-ray', why: 'strong late-wave clear for deeper farms' },
  { id: 'plasma-cannon', why: 'helps push tougher waves' },
  { id: 'super-tower', why: 'burst damage for wall waves' },
]

function runsSince(runs: Run[], days: number, now = new Date()): Run[] {
  const from = subDays(now, days)
  return runs.filter((run) => parseISO(run.ran_at) >= from)
}

function tierStatsMap(runs: Run[]) {
  const byTier = new Map<number, Run[]>()
  for (const run of runs) {
    const list = byTier.get(run.tier) ?? []
    list.push(run)
    byTier.set(run.tier, list)
  }
  return [...byTier.entries()]
    .map(([tier, tierRuns]) => ({ tier, stats: computePeriodStats(tierRuns), runs: tierRuns }))
    .filter((row) => row.stats.runCount >= 2)
    .sort((a, b) => b.stats.avgCph.comparedTo(a.stats.avgCph))
}

function cardRow(userCards: UserCard[], cardId: string): UserCard | undefined {
  return userCards.find((c) => c.card_id === cardId)
}

function catalogCard(cardId: string) {
  return TOWER_CARDS.find((c) => c.id === cardId)
}

export function generateAdvisorTips(
  runs: Run[],
  userCards: UserCard[],
  now = new Date(),
): AdvisorTip[] {
  const tips: AdvisorTip[] = []
  const recent = runsSince(runs, 14, now)
  const recent7 = runsSince(runs, 7, now)

  // --- Best farming tier lately ---
  const tierRows = tierStatsMap(recent.length >= 3 ? recent : runs)
  if (tierRows.length > 0) {
    const best = tierRows[0]
    const runnerUp = tierRows[1]
    tips.push({
      id: 'best-farm-tier',
      category: 'farm',
      priority: 100,
      title: `Best farming tier lately: Tier ${best.tier}`,
      body: runnerUp
        ? `Avg ${formatTowerNumber(best.stats.avgCph)} coins/h across ${best.stats.runCount} recent runs (avg wave ${Math.round(best.stats.avgWave)}). Next best is Tier ${runnerUp.tier} at ${formatTowerNumber(runnerUp.stats.avgCph)}/h.`
        : `Avg ${formatTowerNumber(best.stats.avgCph)} coins/h · avg wave ${Math.round(best.stats.avgWave)} · best cells/h ${formatTowerNumber(best.stats.bestCellsPh)} over ${best.stats.runCount} runs.`,
      href: '/dashboard',
      hrefLabel: 'Open dashboard',
    })

    // Underperforming relative to best
    const weak = tierRows.find(
      (row) =>
        row.tier !== best.tier &&
        row.stats.runCount >= 2 &&
        best.stats.avgCph.gt(0) &&
        row.stats.avgCph.div(best.stats.avgCph).lt(0.7),
    )
    if (weak) {
      tips.push({
        id: `weak-tier-${weak.tier}`,
        category: 'farm',
        priority: 70,
        title: `Tier ${weak.tier} is lagging your best farm`,
        body: `Only ${formatTowerNumber(weak.stats.avgCph)} coins/h vs ${formatTowerNumber(best.stats.avgCph)} on Tier ${best.tier}. Consider shifting volume to the stronger tier until labs/cards catch up.`,
        href: '/dashboard',
        hrefLabel: 'Compare tiers',
      })
    }
  }

  // --- Week-over-week slip / gain on most-run tier ---
  if (recent7.length > 0) {
    const counts = new Map<number, number>()
    for (const run of recent7) counts.set(run.tier, (counts.get(run.tier) ?? 0) + 1)
    const mainTier = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (mainTier != null) {
      const cmp = compareTierWeekOverWeek(runs, mainTier, now)
      if (cmp.thisWeek.runCount > 0 && cmp.lastWeek.runCount > 0) {
        const cphDelta = cmp.deltaAvg.cph
        const lastAvg = cmp.lastWeek.avgCph.gt(0) ? cmp.lastWeek.avgCph : null
        if (lastAvg && cphDelta.lt(0) && cphDelta.abs().div(lastAvg).gt(0.08)) {
          tips.push({
            id: `tier-slip-${mainTier}`,
            category: 'progress',
            priority: 85,
            title: `Tier ${mainTier} coins/h slipped vs last week`,
            body: `Avg CPH ${formatTowerNumber(cmp.thisWeek.avgCph)} this week vs ${formatTowerNumber(cmp.lastWeek.avgCph)} last week (${formatTowerNumber(cphDelta)}). Check card slots, modules, or whether you’re pushing too hard a wave target.`,
            href: '/dashboard',
            hrefLabel: 'See week comparison',
          })
        } else if (lastAvg && cphDelta.gt(0) && cphDelta.div(lastAvg).gt(0.08)) {
          tips.push({
            id: `tier-gain-${mainTier}`,
            category: 'progress',
            priority: 75,
            title: `Tier ${mainTier} is up vs last week`,
            body: `Avg CPH climbed to ${formatTowerNumber(cmp.thisWeek.avgCph)} from ${formatTowerNumber(cmp.lastWeek.avgCph)}. Keep banking this tier while the trend holds.`,
            href: '/dashboard',
            hrefLabel: 'See week comparison',
          })
        }
      }
    }
  }

  // --- Cells vs coins focus ---
  if (recent.length >= 3) {
    const stats = computePeriodStats(recent)
    if (stats.avgCph.gt(0) && stats.avgCellsPh.gt(0)) {
      // Heuristic: if best cells/h tier differs from best coins/h tier
      const byCells = [...tierRows].sort((a, b) => b.stats.avgCellsPh.comparedTo(a.stats.avgCellsPh))
      if (
        byCells.length > 1 &&
        tierRows[0] &&
        byCells[0].tier !== tierRows[0].tier &&
        byCells[0].stats.avgCellsPh.gt(0)
      ) {
        tips.push({
          id: 'cells-vs-coins-tier',
          category: 'farm',
          priority: 65,
          title: `Cells farm better on Tier ${byCells[0].tier}`,
          body: `Your best coin tier is ${tierRows[0].tier} (${formatTowerNumber(tierRows[0].stats.avgCph)}/h), but Tier ${byCells[0].tier} leads cells/h at ${formatTowerNumber(byCells[0].stats.avgCellsPh)}. Split sessions if you need both currencies.`,
          href: '/dashboard',
          hrefLabel: 'Review charts',
        })
      }
    }
  }

  // --- AFK vs manual ---
  const afk = recent.filter((r) => r.play_mode === 'afk')
  const manual = recent.filter((r) => r.play_mode === 'manual')
  if (afk.length >= 2 && manual.length >= 2) {
    const afkStats = computePeriodStats(afk)
    const manStats = computePeriodStats(manual)
    if (afkStats.avgCph.gt(0) && manStats.avgCph.gt(0)) {
      const better = manStats.avgCph.gt(afkStats.avgCph) ? 'manual' : 'afk'
      const ratio =
        better === 'manual'
          ? manStats.avgCph.div(afkStats.avgCph)
          : afkStats.avgCph.div(manStats.avgCph)
      if (ratio.gte(1.12)) {
        tips.push({
          id: 'mode-preference',
          category: 'farm',
          priority: 55,
          title: `${better === 'manual' ? 'Manual' : 'AFK'} runs outperform lately`,
          body: `Recent ${better} farms average ${formatTowerNumber(better === 'manual' ? manStats.avgCph : afkStats.avgCph)} coins/h vs ${formatTowerNumber(better === 'manual' ? afkStats.avgCph : manStats.avgCph)} the other way. Prefer that mode when optimizing income.`,
          href: '/runs/new',
          hrefLabel: 'Log a run',
        })
      }
    }
  }

  // --- Underleveled / missing farm cards ---
  const ownedCount = userCards.filter((c) => c.stars > 0).length
  const hasAnyCardData = userCards.length > 0

  if (!hasAnyCardData) {
    tips.push({
      id: 'cards-empty',
      category: 'cards',
      priority: 90,
      title: 'Track your card ranks',
      body: 'No card inventory yet. Logging stars helps surface underleveled farm cards (Coins, Enemy Balance, Wave Skip, and more).',
      href: '/cards',
      hrefLabel: 'Open cards',
    })
  } else {
    const underleveled: AdvisorTip[] = []
    for (const { id, why } of FARM_PRIORITY_CARDS) {
      const meta = catalogCard(id)
      if (!meta) continue
      const row = cardRow(userCards, id)
      const stars = row?.stars ?? 0
      if (stars >= MAX_CARD_STARS) continue
      if (stars === 0) {
        underleveled.push({
          id: `card-missing-${id}`,
          category: 'cards',
          priority: 80 - underleveled.length,
          title: `Missing farm card: ${meta.name}`,
          body: `Not in your inventory yet — ${why}. Prioritize unlocking it when you can.`,
          href: '/cards',
          hrefLabel: 'Update cards',
        })
      } else if (stars <= 3) {
        underleveled.push({
          id: `card-low-${id}`,
          category: 'cards',
          priority: 78 - underleveled.length,
          title: `${meta.name} is only ${stars}★`,
          body: `Still early for a key farm card (${why}). Extras and lab focus here usually pay off in CPH.`,
          href: '/cards',
          hrefLabel: 'Update cards',
        })
      } else if (stars <= 5) {
        underleveled.push({
          id: `card-mid-${id}`,
          category: 'cards',
          priority: 60 - underleveled.length,
          title: `Keep starring ${meta.name} (${stars}★)`,
          body: `Solid progress, but not maxed yet — ${why}.`,
          href: '/cards',
          hrefLabel: 'Open cards',
        })
      }
    }
    tips.push(...underleveled.slice(0, 4))

    // Extras ready to merge
    const readyToStar = userCards
      .filter((c) => c.stars > 0 && c.stars < MAX_CARD_STARS && c.extras > 0)
      .map((c) => {
        const meta = catalogCard(c.card_id)
        return meta ? { row: c, meta } : null
      })
      .filter((x): x is { row: UserCard; meta: (typeof TOWER_CARDS)[number] } => x != null)
      .sort((a, b) => {
        const aPri = FARM_PRIORITY_CARDS.findIndex((p) => p.id === a.row.card_id)
        const bPri = FARM_PRIORITY_CARDS.findIndex((p) => p.id === b.row.card_id)
        const ap = aPri === -1 ? 99 : aPri
        const bp = bPri === -1 ? 99 : bPri
        if (ap !== bp) return ap - bp
        return b.row.extras - a.row.extras
      })

    if (readyToStar.length > 0) {
      const top = readyToStar.slice(0, 3)
      const names = top
        .map((t) => `${t.meta.name} (${t.row.extras} extra${t.row.extras === 1 ? '' : 's'})`)
        .join(', ')
      tips.push({
        id: 'card-extras',
        category: 'cards',
        priority: 72,
        title: 'Card extras ready to invest',
        body: `You have duplicates sitting on: ${names}. Starring farm cards usually beats hoarding extras.`,
        href: '/cards',
        hrefLabel: 'Review cards',
      })
    }

    // Coverage
    if (ownedCount > 0 && ownedCount < 12) {
      tips.push({
        id: 'card-coverage',
        category: 'cards',
        priority: 50,
        title: `Only ${ownedCount} cards tracked at 1★+`,
        body: 'A thin card book limits slot options. Keep logging unlocks so advice stays accurate.',
        href: '/cards',
        hrefLabel: 'Open cards',
      })
    }
  }

  // --- Consistency ---
  const streaks = computeStreakStats(runs, now)
  if (runs.length > 0 && streaks.currentStreak === 0 && streaks.consistencyPercent < 50) {
    tips.push({
      id: 'consistency-low',
      category: 'consistency',
      priority: 68,
      title: 'Farming consistency is soft',
      body: `Only ${streaks.consistencyPercent}% of the last 14 days had a logged run. Even one shorter AFK farm a day compounds labs and cards.`,
      href: '/runs/new',
      hrefLabel: 'Log a run',
    })
  } else if (streaks.currentStreak >= 5) {
    tips.push({
      id: 'consistency-hot',
      category: 'consistency',
      priority: 40,
      title: `${streaks.currentStreak}-day streak — keep it going`,
      body: `${streaks.runsThisWeek} runs this week. Consistency is doing the heavy lifting; protect the streak with at least one farm today.`,
      href: '/runs/new',
      hrefLabel: 'Log today’s farm',
    })
  }

  // --- Empty / bootstrap ---
  if (runs.length === 0) {
    tips.push({
      id: 'no-runs',
      category: 'farm',
      priority: 110,
      title: 'Log a few farms to unlock advice',
      body: 'Advisor needs run history (tier, wave, coins, cells) to recommend your best farming tier and progress trends. Import a Battle History screenshot to get started fast.',
      href: '/runs/new',
      hrefLabel: 'Import screenshot',
      hrefSearch: { tab: 'import' },
    })
  } else if (runs.length < 5) {
    tips.push({
      id: 'few-runs',
      category: 'farm',
      priority: 45,
      title: 'More runs will sharpen advice',
      body: `Only ${runs.length} runs logged so far. A week of data makes tier and CPH suggestions much more reliable.`,
      href: '/runs/new',
      hrefLabel: 'Import more',
      hrefSearch: { tab: 'import' },
    })
  }

  return tips.sort((a, b) => b.priority - a.priority).slice(0, 8)
}
