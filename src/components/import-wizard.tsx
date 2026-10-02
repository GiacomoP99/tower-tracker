import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ImageUp, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useCreateRuns, useRuns } from '@/hooks/use-runs'
import {
  extractBattleHistoryFromImage,
  toImportDrafts,
  type ImportDraftRun,
} from '@/lib/battle-history-ocr'
import {
  annotateImportDraftsWithDuplicates,
  refreshDraftDuplicates,
} from '@/lib/duplicates'
import {
  durationFromHoursMinutes,
  formatDuration,
  formatTowerNumber,
  hoursMinutesFromDuration,
  parseTowerNumber,
} from '@/lib/metrics'
import type { PlayMode } from '@/types/run'
import { cn } from '@/lib/utils'

type Step = 'upload' | 'review'

export function ImportWizard() {
  const navigate = useNavigate()
  const createRuns = useCreateRuns()
  const { data: existingRuns = [] } = useRuns()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [progress, setProgress] = useState(0)
  const [playMode, setPlayMode] = useState<PlayMode>('afk')
  const [drafts, setDrafts] = useState<ImportDraftRun[]>([])
  const [rawText, setRawText] = useState('')

  const selectedCount = useMemo(() => drafts.filter((d) => d.selected).length, [drafts])
  const duplicateCount = useMemo(() => drafts.filter((d) => d.duplicate).length, [drafts])

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image screenshot')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setScanning(true)
    setProgress(0)
    setProgressLabel('Starting OCR…')

    try {
      const { text, runs } = await extractBattleHistoryFromImage(file, (status, p) => {
        setProgressLabel(status)
        setProgress(Math.round(p * 100))
      })
      setRawText(text)
      if (runs.length === 0) {
        toast.error('No runs detected. Try a clearer Battle History screenshot.')
        setDrafts([])
        setStep('upload')
        return
      }
      const annotated = annotateImportDraftsWithDuplicates(toImportDrafts(runs, playMode), existingRuns)
      setDrafts(annotated)
      setStep('review')
      const skipped = annotated.filter((d) => d.duplicate).length
      toast.success(
        skipped > 0
          ? `Found ${runs.length} run${runs.length === 1 ? '' : 's'} · ${skipped} likely duplicate${skipped === 1 ? '' : 's'} deselected`
          : `Found ${runs.length} run${runs.length === 1 ? '' : 's'}`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OCR failed')
    } finally {
      setScanning(false)
    }
  }

  function updateDraft(localId: string, patch: Partial<ImportDraftRun>) {
    setDrafts((prev) => {
      const next = prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d))
      return refreshDraftDuplicates(next, existingRuns)
    })
  }

  function applyPlayModeToAll(mode: PlayMode) {
    setPlayMode(mode)
    setDrafts((prev) => prev.map((d) => ({ ...d, play_mode: mode })))
  }

  async function handleSave() {
    const selected = drafts.filter((d) => d.selected)
    if (selected.length === 0) {
      toast.error('Select at least one run to save')
      return
    }

    const selectedDupes = selected.filter((d) => d.duplicate)
    if (selectedDupes.length > 0) {
      const ok = confirm(
        `${selectedDupes.length} selected run${selectedDupes.length === 1 ? ' looks' : 's look'} like duplicate${selectedDupes.length === 1 ? '' : 's'}. Save anyway?`,
      )
      if (!ok) return
    }

    try {
      const payload = selected.map((d) => {
        const ranAt = new Date(d.ran_at)
        if (Number.isNaN(ranAt.getTime())) throw new Error('Invalid date on one of the runs')
        if (d.duration_seconds <= 0) throw new Error('Duration must be greater than 0')
        return {
          tier: d.tier,
          wave_reached: d.wave_reached,
          duration_seconds: d.duration_seconds,
          ran_at: ranAt.toISOString(),
          play_mode: d.play_mode,
          coins: parseTowerNumber(String(d.coins)).toString(),
          cells: parseTowerNumber(String(d.cells)).toString(),
          notes: d.notes,
        }
      })

      await createRuns.mutateAsync(payload)
      toast.success(`Saved ${payload.length} run${payload.length === 1 ? '' : 's'}`)
      await navigate({ to: '/runs' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save runs')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import from Battle History</CardTitle>
          <CardDescription>
            Upload a screenshot of the in-game Battle History list. We extract tier, wave, date, coins,
            cells, and estimate duration from Coins/Hour. Likely duplicates are flagged and deselected
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'upload' && (
            <>
              <div className="grid gap-2 max-w-xs">
                <Label>Default play mode for imported runs</Label>
                <Select value={playMode} onValueChange={(v) => setPlayMode(v as PlayMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="afk">AFK</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />

              <button
                type="button"
                disabled={scanning}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-14 text-center transition-colors',
                  scanning ? 'opacity-70' : 'hover:bg-muted/50',
                )}
              >
                {scanning ? (
                  <>
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <div>
                      <p className="font-medium">Reading screenshot…</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {progressLabel} {progress > 0 ? `${progress}%` : ''}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ImageUp className="size-8 text-primary" />
                    <div>
                      <p className="font-medium">Drop or choose a Battle History screenshot</p>
                      <p className="mt-1 text-sm text-muted-foreground">PNG or JPG from your phone</p>
                    </div>
                  </>
                )}
              </button>

              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="max-h-64 w-full rounded-lg border object-contain bg-black/80"
                />
              )}
            </>
          )}

          {step === 'review' && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="grid gap-2">
                  <Label>Apply play mode to all</Label>
                  <Select value={playMode} onValueChange={(v) => applyPlayModeToAll(v as PlayMode)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="afk">AFK</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep('upload')
                      setDrafts([])
                    }}
                  >
                    Choose another image
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={createRuns.isPending || selectedCount === 0}>
                    {createRuns.isPending ? 'Saving…' : `Save ${selectedCount} run${selectedCount === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </div>

              {duplicateCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-chart-3/40 bg-chart-3/10 px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-3" />
                  <p>
                    {duplicateCount} run{duplicateCount === 1 ? '' : 's'} look like duplicate
                    {duplicateCount === 1 ? '' : 's'} (same day + tier + wave + coins/cells) and{' '}
                    {duplicateCount === 1 ? 'was' : 'were'} deselected. Re-check Include if you still want
                    to save {duplicateCount === 1 ? 'it' : 'them'}.
                  </p>
                </div>
              )}

              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="max-h-48 w-full rounded-lg border object-contain bg-black/80"
                />
              )}

              <div className="space-y-4">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.localId}
                    draft={draft}
                    onChange={(patch) => updateDraft(draft.localId, patch)}
                    onRemove={() =>
                      setDrafts((prev) => refreshDraftDuplicates(
                        prev.filter((d) => d.localId !== draft.localId),
                        existingRuns,
                      ))
                    }
                  />
                ))}
              </div>

              <details className="rounded-lg border bg-muted/20 p-3 text-sm">
                <summary className="cursor-pointer font-medium">Raw OCR text</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {rawText || '—'}
                </pre>
              </details>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DraftCard({
  draft,
  onChange,
  onRemove,
}: {
  draft: ImportDraftRun
  onChange: (patch: Partial<ImportDraftRun>) => void
  onRemove: () => void
}) {
  const duration = hoursMinutesFromDuration(draft.duration_seconds)
  const localDateTime = draft.ran_at.slice(0, 16)
  const isDupe = Boolean(draft.duplicate)

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm',
        !draft.selected && 'opacity-55',
        isDupe && 'border-chart-3/50',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.selected}
              onChange={(e) => onChange({ selected: e.target.checked })}
              className="size-4 accent-primary"
            />
            Include
          </label>
          <Badge
            className={
              draft.confidence === 'high'
                ? 'border-chart-2/40 bg-chart-2/15'
                : draft.confidence === 'medium'
                  ? 'border-chart-3/40 bg-chart-3/15'
                  : 'border-destructive/40 bg-destructive/10'
            }
          >
            {draft.confidence} confidence
          </Badge>
          {isDupe && (
            <Badge className="border-chart-3/50 bg-chart-3/15 text-chart-3">
              Duplicate
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            ~{formatDuration(draft.duration_seconds)} · {formatTowerNumber(draft.coins_per_hour)}/h
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove draft">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      {isDupe && draft.duplicate && (
        <p className="mb-3 text-xs text-chart-3">{draft.duplicate.reason}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tier">
          <Input
            type="number"
            min={1}
            value={draft.tier}
            onChange={(e) => onChange({ tier: Number(e.target.value) })}
          />
        </Field>
        <Field label="Wave">
          <Input
            type="number"
            min={1}
            value={draft.wave_reached}
            onChange={(e) => onChange({ wave_reached: Number(e.target.value) })}
          />
        </Field>
        <Field label="Date / time">
          <Input
            type="datetime-local"
            value={localDateTime}
            onChange={(e) => onChange({ ran_at: e.target.value })}
          />
        </Field>
        <Field label="Play mode">
          <Select
            value={draft.play_mode}
            onValueChange={(v) => onChange({ play_mode: v as PlayMode })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="afk">AFK</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Coins">
          <Input value={draft.coins} onChange={(e) => onChange({ coins: e.target.value })} />
        </Field>
        <Field label="Cells">
          <Input value={draft.cells} onChange={(e) => onChange({ cells: e.target.value })} />
        </Field>
        <Field label="Hours">
          <Input
            type="number"
            min={0}
            value={duration.hours}
            onChange={(e) =>
              onChange({
                duration_seconds: durationFromHoursMinutes(Number(e.target.value) || 0, duration.minutes),
              })
            }
          />
        </Field>
        <Field label="Minutes">
          <Input
            type="number"
            min={0}
            max={59}
            value={duration.minutes}
            onChange={(e) =>
              onChange({
                duration_seconds: durationFromHoursMinutes(duration.hours, Number(e.target.value) || 0),
              })
            }
          />
        </Field>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
