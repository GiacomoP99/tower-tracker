import Decimal from 'decimal.js'
import type { DuplicateMatch } from '@/lib/duplicates'
import { parseTowerNumber } from '@/lib/metrics'
import type { PlayMode, RunInsert } from '@/types/run'

export type ParsedBattleRun = {
  tier: number
  wave_reached: number
  ran_at_date: string // yyyy-MM-dd
  coins: string
  cells: string
  coins_per_hour: string
  duration_seconds: number
  confidence: 'high' | 'medium' | 'low'
  raw: string
}

export type ImportDraftRun = RunInsert & {
  localId: string
  selected: boolean
  coins_per_hour: string
  confidence: 'high' | 'medium' | 'low'
  raw: string
  duplicate?: DuplicateMatch | null
}

const COMPACT_NUM = String.raw`[\d.,]+(?:[eE][+-]?\d+)?[KMBTqQsSOND]?`

function normalizeOcrText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/Coins\s*\/\s*Hou[rn]/gi, 'Coins/Hour')
    .replace(/Coins\s*Hour/gi, 'Coins/Hour')
    .replace(/Celis/gi, 'Cells')
    .replace(/Ceils/gi, 'Cells')
    .replace(/Tler/gi, 'Tier')
    .replace(/VVave/gi, 'Wave')
    .replace(/Wavo/gi, 'Wave')
    .replace(/\bO(?=\d)/g, '0')
    .replace(/(?<=\d)O\b/g, '0')
}

function parseDateToIsoDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function deriveDurationSeconds(coins: Decimal, coinsPerHour: Decimal): number {
  if (coinsPerHour.lte(0)) return 3600
  const hours = coins.div(coinsPerHour)
  const seconds = hours.mul(3600).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
  return Math.max(60, seconds)
}

function scoreConfidence(parts: {
  tier: boolean
  wave: boolean
  date: boolean
  coins: boolean
  cph: boolean
  cells: boolean
}): 'high' | 'medium' | 'low' {
  const hits = Object.values(parts).filter(Boolean).length
  if (hits >= 6) return 'high'
  if (hits >= 4) return 'medium'
  return 'low'
}

/** Parse OCR text from a Battle History screenshot into run drafts. */
export function parseBattleHistoryText(text: string): ParsedBattleRun[] {
  const normalized = normalizeOcrText(text)
  const chunks = normalized.split(/(?=Tier\s*\d+)/i).map((c) => c.trim()).filter(Boolean)
  const results: ParsedBattleRun[] = []

  for (const chunk of chunks) {
    if (!/tier\s*\d+/i.test(chunk)) continue

    const tierMatch = chunk.match(/Tier\s*(\d+)/i)
    const waveMatch = chunk.match(/Wave\s*(\d+)/i)
    const dateMatch = chunk.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
    const coinsMatch = chunk.match(new RegExp(`Coins\\s*:\\s*(${COMPACT_NUM})`, 'i'))
    const cphMatch = chunk.match(new RegExp(`Coins\\s*/\\s*Hour\\s*:\\s*(${COMPACT_NUM})`, 'i'))
      ?? chunk.match(new RegExp(`Coins\\/Hour\\s*:\\s*(${COMPACT_NUM})`, 'i'))
    const cellsMatch = chunk.match(new RegExp(`Cells\\s*:\\s*(${COMPACT_NUM})`, 'i'))

    if (!tierMatch || !waveMatch || !coinsMatch || !cellsMatch) continue

    try {
      const coins = parseTowerNumber(coinsMatch[1])
      const cells = parseTowerNumber(cellsMatch[1])
      const coinsPerHour = cphMatch ? parseTowerNumber(cphMatch[1]) : coins.div(1)
      const ranAtDate = dateMatch ? parseDateToIsoDate(dateMatch[1]) : null
      if (!ranAtDate) continue

      results.push({
        tier: Number(tierMatch[1]),
        wave_reached: Number(waveMatch[1]),
        ran_at_date: ranAtDate,
        coins: coins.toString(),
        cells: cells.toString(),
        coins_per_hour: coinsPerHour.toString(),
        duration_seconds: deriveDurationSeconds(coins, coinsPerHour),
        confidence: scoreConfidence({
          tier: true,
          wave: true,
          date: Boolean(ranAtDate),
          coins: true,
          cph: Boolean(cphMatch),
          cells: true,
        }),
        raw: chunk.slice(0, 240),
      })
    } catch {
      // skip malformed chunk
    }
  }

  return results
}

export function toImportDrafts(
  parsed: ParsedBattleRun[],
  playMode: PlayMode,
): ImportDraftRun[] {
  return parsed.map((run, index) => {
    // Stagger times so same-day imports don't stack on one chart point:
    // 1st → 01:00, 2nd → 02:00, … wrapping after 23:00 with +5 min offsets.
    const hour = (index % 23) + 1
    const minutes = Math.min(55, Math.floor(index / 23) * 5)
    const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

    return {
      localId: `import-${Date.now()}-${index}`,
      selected: run.confidence !== 'low',
      tier: run.tier,
      wave_reached: run.wave_reached,
      duration_seconds: run.duration_seconds,
      ran_at: `${run.ran_at_date}T${time}:00`,
      play_mode: playMode,
      coins: run.coins,
      cells: run.cells,
      notes: null,
      coins_per_hour: run.coins_per_hour,
      confidence: run.confidence,
      raw: run.raw,
    }
  })
}

export async function preprocessImageForOcr(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare image for OCR')

  ctx.drawImage(bitmap, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data

  // Boost contrast and invert dark UI to black text on white for Tesseract
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const inverted = 255 - gray
    const contrast = inverted > 140 ? 255 : inverted < 90 ? 0 : inverted
    data[i] = contrast
    data[i + 1] = contrast
    data[i + 2] = contrast
  }

  ctx.putImageData(image, 0, 0)
  bitmap.close()
  return canvas
}

export async function extractBattleHistoryFromImage(
  file: File,
  onProgress?: (status: string, progress: number) => void,
): Promise<{ text: string; runs: ParsedBattleRun[] }> {
  const { createWorker } = await import('tesseract.js')
  const canvas = await preprocessImageForOcr(file)
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status && onProgress) {
        onProgress(m.status, m.progress ?? 0)
      }
    },
  })

  try {
    await worker.setParameters({
      tessedit_char_whitelist:
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.:/-+ ',
    })
    const { data } = await worker.recognize(canvas)
    const runs = parseBattleHistoryText(data.text)
    return { text: data.text, runs }
  } finally {
    await worker.terminate()
  }
}
