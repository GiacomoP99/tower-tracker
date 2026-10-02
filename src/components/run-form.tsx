import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  durationFromHoursMinutes,
  hoursMinutesFromDuration,
  parseTowerNumber,
} from '@/lib/metrics'
import type { PlayMode, Run, RunInsert } from '@/types/run'

type RunFormProps = {
  initial?: Run
  submitting?: boolean
  onSubmit: (values: RunInsert) => Promise<void>
}

function toLocalInputValue(iso?: string) {
  const date = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function RunForm({ initial, submitting, onSubmit }: RunFormProps) {
  const initialDuration = useMemo(
    () => hoursMinutesFromDuration(initial?.duration_seconds ?? 3600),
    [initial?.duration_seconds],
  )

  const [tier, setTier] = useState(String(initial?.tier ?? 1))
  const [wave, setWave] = useState(String(initial?.wave_reached ?? 1))
  const [hours, setHours] = useState(String(initialDuration.hours))
  const [minutes, setMinutes] = useState(String(initialDuration.minutes))
  const [ranAt, setRanAt] = useState(toLocalInputValue(initial?.ran_at))
  const [playMode, setPlayMode] = useState<PlayMode>(initial?.play_mode ?? 'manual')
  const [coins, setCoins] = useState(String(initial?.coins ?? ''))
  const [cells, setCells] = useState(String(initial?.cells ?? ''))
  const [notes, setNotes] = useState(initial?.notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const durationSeconds = durationFromHoursMinutes(Number(hours) || 0, Number(minutes) || 0)
      if (durationSeconds <= 0) throw new Error('Duration must be greater than 0')
      const coinsParsed = parseTowerNumber(coins)
      const cellsParsed = parseTowerNumber(cells)
      const ranAtDate = new Date(ranAt)
      if (Number.isNaN(ranAtDate.getTime())) throw new Error('Invalid date/time')

      await onSubmit({
        tier: Number(tier),
        wave_reached: Number(wave),
        duration_seconds: durationSeconds,
        ran_at: ranAtDate.toISOString(),
        play_mode: playMode,
        coins: coinsParsed.toString(),
        cells: cellsParsed.toString(),
        notes: notes.trim() ? notes.trim() : null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save run')
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tier">Tier</Label>
          <Input id="tier" type="number" min={1} required value={tier} onChange={(e) => setTier(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wave">Wave reached</Label>
          <Input id="wave" type="number" min={1} required value={wave} onChange={(e) => setWave(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Duration</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Hours"
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              max={59}
              placeholder="Minutes"
              required
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ranAt">Date / time of run</Label>
          <Input id="ranAt" type="datetime-local" required value={ranAt} onChange={(e) => setRanAt(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Play mode</Label>
        <Select value={playMode} onValueChange={(v) => setPlayMode(v as PlayMode)}>
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="afk">AFK</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="coins">Coins</Label>
          <Input
            id="coins"
            required
            placeholder="e.g. 1.5e12 or 1500000"
            value={coins}
            onChange={(e) => setCoins(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cells">Cells</Label>
          <Input
            id="cells"
            required
            placeholder="e.g. 25000"
            value={cells}
            onChange={(e) => setCells(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything noteworthy about this run" />
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? 'Saving…' : initial ? 'Update run' : 'Save run'}
      </Button>
    </form>
  )
}
