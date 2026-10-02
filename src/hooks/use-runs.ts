import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import type { Run, RunInsert, RunUpdate } from '@/types/run'

const runsKey = ['runs'] as const

export function useRuns() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...runsKey, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Run[]> => {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .order('ran_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map((row) => ({
        ...(row as Run),
        coins: String((row as Run).coins),
        cells: String((row as Run).cells),
      }))
    },
  })
}

export function useCreateRun() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RunInsert) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('runs')
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Run
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: runsKey })
    },
  })
}

export function useCreateRuns() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inputs: RunInsert[]) => {
      if (!user) throw new Error('Not signed in')
      if (inputs.length === 0) return [] as Run[]
      const { data, error } = await supabase
        .from('runs')
        .insert(inputs.map((input) => ({ ...input, user_id: user.id })))
        .select()
      if (error) throw error
      return (data ?? []) as Run[]
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: runsKey })
    },
  })
}

export function useUpdateRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: RunUpdate & { id: string }) => {
      const { data, error } = await supabase.from('runs').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Run
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: runsKey })
    },
  })
}

export function useDeleteRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('runs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: runsKey })
    },
  })
}
