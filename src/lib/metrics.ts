import Decimal from 'decimal.js'
import { format, parseISO } from 'date-fns'
import type { Run } from '@/types/run'

Decimal.set({ precision: 40, toExpNeg: -9, toExpPos: 40 })

const SUFFIX_MULTIPLIERS: Record<string, string> = {
  K: '1e3',
  M: '1e6',
  B: '1e9',
  T: '1e12',
  q: '1e15',
  Q: '1e18',
  s: '1e21',
  S: '1e24',
  O: '1e27',
  N: '1e30',
  D: '1e33',
}

/** Parse plain decimals or compact Tower numbers like 111.81M / 1.5e12 */
export function parseTowerNumber(value: string | number): Decimal {
  const trimmed = String(value ?? '')
    .trim()
    .replace(/,/g, '')
    .replace(/\s+/g, '')
  if (!trimmed) throw new Error('Value is required')

  const suffixMatch = trimmed.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)([KMBTqQsSOND])?$/)
  if (!suffixMatch) {
    const parsed = new Decimal(trimmed)
    if (!parsed.isFinite() || parsed.isNegative()) {
      throw new Error('Enter a non-negative number')
    }
    return parsed
  }

  const [, num, suffix] = suffixMatch
  let parsed = new Decimal(num)
  if (suffix) parsed = parsed.mul(SUFFIX_MULTIPLIERS[suffix])
  if (!parsed.isFinite() || parsed.isNegative()) {
    throw new Error('Enter a non-negative number')
  }
  return parsed
}

export function formatTowerNumber(value: string | number | Decimal, digits = 2): string {
  try {
    const d = value instanceof Decimal ? value : new Decimal(value)
    if (!d.isFinite()) return '—'
    const abs = d.abs()
    if (abs.gte(1e15) || (abs.gt(0) && abs.lt(0.001))) {
      return d.toExponential(digits)
    }
    if (abs.gte(1e9)) return `${d.div(1e9).toFixed(digits)}B`
    if (abs.gte(1e6)) return `${d.div(1e6).toFixed(digits)}M`
    if (abs.gte(1e3)) return `${d.div(1e3).toFixed(digits)}K`
    return d.toDecimalPlaces(digits).toString()
  } catch {
    return String(value)
  }
}

export function perHour(amount: string | Decimal, durationSeconds: number): Decimal {
  if (durationSeconds <= 0) return new Decimal(0)
  const value = amount instanceof Decimal ? amount : new Decimal(amount)
  return value.div(durationSeconds).mul(3600)
}

export function runMetrics(run: Pick<Run, 'coins' | 'cells' | 'duration_seconds'>) {
  const coinsPerHour = perHour(run.coins, run.duration_seconds)
  const cellsPerHour = perHour(run.cells, run.duration_seconds)
  return { coinsPerHour, cellsPerHour }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatRunDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy HH:mm')
}

export function durationFromHoursMinutes(hours: number, minutes: number): number {
  return Math.round(hours * 3600 + minutes * 60)
}

export function hoursMinutesFromDuration(seconds: number): { hours: number; minutes: number } {
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
  }
}

export function toChartNumber(value: string | Decimal): number {
  const d = value instanceof Decimal ? value : new Decimal(value)
  const n = d.toNumber()
  return Number.isFinite(n) ? n : 0
}
