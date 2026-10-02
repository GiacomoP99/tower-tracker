import Decimal from 'decimal.js'
import { format, parseISO } from 'date-fns'
import { parseTowerNumber } from '@/lib/metrics'
import type { Run } from '@/types/run'

export type RunFingerprintInput = {
  tier: number
  wave_reached: number
  ran_at: string
  coins: string | number
  cells: string | number
}

export type DuplicateMatch = {
  kind: 'existing' | 'batch'
  reason: string
  matchedRunId?: string
  matchedLocalId?: string
}

function dayKey(isoOrLocal: string): string {
  // Accept ISO or datetime-local (yyyy-MM-ddTHH:mm)
  if (/^\d{4}-\d{2}-\d{2}/.test(isoOrLocal)) return isoOrLocal.slice(0, 10)
  try {
    return format(parseISO(isoOrLocal), 'yyyy-MM-dd')
  } catch {
    return isoOrLocal.slice(0, 10)
  }
}

function roughlyEqualAmount(a: string | number, b: string | number, relativeTol = 0.01): boolean {
  try {
    const left = parseTowerNumber(a)
    const right = parseTowerNumber(b)
    if (left.eq(right)) return true
    const scale = Decimal.max(left.abs(), right.abs())
    if (scale.eq(0)) return true
    return left.minus(right).abs().div(scale).lte(relativeTol)
  } catch {
    return String(a) === String(b)
  }
}

export function runsLookLikeDuplicates(a: RunFingerprintInput, b: RunFingerprintInput): boolean {
  if (a.tier !== b.tier) return false
  if (a.wave_reached !== b.wave_reached) return false
  if (dayKey(a.ran_at) !== dayKey(b.ran_at)) return false
  if (!roughlyEqualAmount(a.coins, b.coins)) return false
  if (!roughlyEqualAmount(a.cells, b.cells, 0.02)) return false
  return true
}

/** Find a matching existing saved run for a candidate. */
export function findExistingDuplicate(
  candidate: RunFingerprintInput,
  existing: Run[],
): DuplicateMatch | null {
  const match = existing.find((run) => runsLookLikeDuplicates(candidate, run))
  if (!match) return null
  return {
    kind: 'existing',
    matchedRunId: match.id,
    reason: `Already saved · Tier ${match.tier} · Wave ${match.wave_reached} · ${dayKey(match.ran_at)}`,
  }
}

/** Find a duplicate inside the current import batch (earlier row wins). */
export function findBatchDuplicate(
  candidate: RunFingerprintInput & { localId: string },
  batch: Array<RunFingerprintInput & { localId: string }>,
): DuplicateMatch | null {
  const match = batch.find(
    (other) => other.localId !== candidate.localId && runsLookLikeDuplicates(candidate, other),
  )
  if (!match) return null
  return {
    kind: 'batch',
    matchedLocalId: match.localId,
    reason: `Duplicate in this import · Tier ${match.tier} · Wave ${match.wave_reached}`,
  }
}

/** Detect duplicates without changing selection. */
export function detectDraftDuplicates(
  drafts: Array<RunFingerprintInput & { localId: string }>,
  existingRuns: Run[],
): Map<string, DuplicateMatch | null> {
  const map = new Map<string, DuplicateMatch | null>()
  drafts.forEach((draft, index) => {
    const existing = findExistingDuplicate(draft, existingRuns)
    if (existing) {
      map.set(draft.localId, existing)
      return
    }
    const batch = findBatchDuplicate(draft, drafts.slice(0, index))
    map.set(draft.localId, batch)
  })
  return map
}

/** Annotate drafts and deselect any that look like duplicates. */
export function annotateImportDraftsWithDuplicates<
  T extends RunFingerprintInput & { localId: string; selected: boolean },
>(drafts: T[], existingRuns: Run[]): Array<T & { duplicate: DuplicateMatch | null }> {
  const detected = detectDraftDuplicates(drafts, existingRuns)
  return drafts.map((draft) => {
    const duplicate = detected.get(draft.localId) ?? null
    return {
      ...draft,
      selected: duplicate ? false : draft.selected,
      duplicate,
    }
  })
}

/** Recompute duplicate flags after edits; preserve the user's Include checkbox. */
export function refreshDraftDuplicates<T extends RunFingerprintInput & { localId: string }>(
  drafts: T[],
  existingRuns: Run[],
): Array<T & { duplicate: DuplicateMatch | null }> {
  const detected = detectDraftDuplicates(drafts, existingRuns)
  return drafts.map((draft) => ({
    ...draft,
    duplicate: detected.get(draft.localId) ?? null,
  }))
}

/** Group already-saved runs that look like duplicates of each other. Keeps the earliest created. */
export function findSavedDuplicateGroups(runs: Run[]): Array<{ keep: Run; dupes: Run[] }> {
  const used = new Set<string>()
  const groups: Array<{ keep: Run; dupes: Run[] }> = []

  const byCreated = [...runs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  for (const run of byCreated) {
    if (used.has(run.id)) continue
    const dupes = byCreated.filter(
      (other) => other.id !== run.id && !used.has(other.id) && runsLookLikeDuplicates(run, other),
    )
    if (dupes.length === 0) continue
    used.add(run.id)
    for (const d of dupes) used.add(d.id)
    groups.push({ keep: run, dupes })
  }

  return groups
}
