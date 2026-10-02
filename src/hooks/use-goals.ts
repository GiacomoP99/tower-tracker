import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import type { Goal, GoalInsert, GoalUpdate } from '@/types/goal'

const goalsKey = ['goals'] as const

export function useGoals() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...goalsKey, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map((row) => ({
        ...(row as Goal),
        target: String((row as Goal).target),
      }))
    },
  })
}

export function useCreateGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: GoalInsert) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('goals')
        .insert({
          ...input,
          user_id: user.id,
          active: input.active ?? true,
          title: input.title?.trim() ? input.title.trim() : null,
          tier: input.tier ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return {
        ...(data as Goal),
        target: String((data as Goal).target),
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsKey })
    },
  })
}

export function useCreateGoals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inputs: GoalInsert[]) => {
      if (!user) throw new Error('Not signed in')
      if (inputs.length === 0) return [] as Goal[]
      const { data, error } = await supabase
        .from('goals')
        .insert(
          inputs.map((input) => ({
            ...input,
            user_id: user.id,
            active: input.active ?? true,
            title: input.title?.trim() ? input.title.trim() : null,
            tier: input.tier ?? null,
          })),
        )
        .select()
      if (error) throw error
      return (data ?? []).map((row) => ({
        ...(row as Goal),
        target: String((row as Goal).target),
      }))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsKey })
    },
  })
}

export function useUpdateGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: GoalUpdate & { id: string }) => {
      const { data, error } = await supabase.from('goals').update(input).eq('id', id).select().single()
      if (error) throw error
      return {
        ...(data as Goal),
        target: String((data as Goal).target),
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsKey })
    },
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsKey })
    },
  })
}
