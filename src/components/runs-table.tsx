import { useMemo, useState } from 'react'
import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDeleteRun } from '@/hooks/use-runs'
import { formatDuration, formatRunDate, formatTowerNumber, runMetrics } from '@/lib/metrics'
import type { PlayMode, Run } from '@/types/run'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
})

export function RunsTable({ runs }: { runs: Run[] }) {
  const deleteRun = useDeleteRun()
  const [tierFilter, setTierFilter] = useState('')
  const [modeFilter, setModeFilter] = useState<'all' | PlayMode>('all')

  const filtered = useMemo(() => {
    return runs.filter((run) => {
      if (tierFilter && String(run.tier) !== tierFilter) return false
      if (modeFilter !== 'all' && run.play_mode !== modeFilter) return false
      return true
    })
  }, [runs, tierFilter, modeFilter])

  const columns = useMemo<ColumnDef<typeof features, Run>[]>(
    () => [
      {
        accessorKey: 'ran_at',
        header: 'Date',
        cell: (info) => formatRunDate(info.getValue<string>()),
      },
      {
        accessorKey: 'tier',
        header: 'Tier',
      },
      {
        accessorKey: 'wave_reached',
        header: 'Wave',
      },
      {
        accessorKey: 'duration_seconds',
        header: 'Duration',
        cell: (info) => formatDuration(info.getValue<number>()),
      },
      {
        accessorKey: 'play_mode',
        header: 'Mode',
        cell: (info) => {
          const mode = info.getValue<PlayMode>()
          return (
            <Badge className={mode === 'afk' ? 'border-chart-3/40 bg-chart-3/15' : 'border-chart-1/40 bg-chart-1/15'}>
              {mode}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'coins',
        header: 'Coins',
        cell: (info) => formatTowerNumber(info.getValue<string>()),
      },
      {
        accessorKey: 'cells',
        header: 'Cells',
        cell: (info) => formatTowerNumber(info.getValue<string>()),
      },
      {
        id: 'cph',
        header: 'Coins/h',
        accessorFn: (row) => runMetrics(row).coinsPerHour.toNumber(),
        cell: ({ row }) => formatTowerNumber(runMetrics(row.original).coinsPerHour),
      },
      {
        id: 'cellsph',
        header: 'Cells/h',
        accessorFn: (row) => runMetrics(row).cellsPerHour.toNumber(),
        cell: ({ row }) => formatTowerNumber(runMetrics(row.original).cellsPerHour),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link to="/runs/$runId" params={{ runId: row.original.id }}>
                <Pencil className="size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!confirm('Delete this run?')) return
                deleteRun.mutate(row.original.id, {
                  onSuccess: () => toast.success('Run deleted'),
                  onError: (err) => toast.error(err.message),
                })
              }}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteRun],
  )

  const table = useTable({
    features,
    data: filtered,
    columns,
    initialState: {
      sorting: [{ id: 'ran_at', desc: true }],
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-32"
          placeholder="Filter tier"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
        />
        <Select value={modeFilter} onValueChange={(v) => setModeFilter(v as 'all' | PlayMode)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Play mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="afk">AFK</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <table.FlexRender header={header} />
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  No runs yet. Log your first run to start tracking.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
