import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import type { UserCard, UserCardUpsert } from '@/types/card'

const cardsKey = ['user-cards'] as const

export function useUserCards() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...cardsKey, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<UserCard[]> => {
      const { data, error } = await supabase.from('user_cards').select('*').order('card_id')
      if (error) throw error
      return (data ?? []) as UserCard[]
    },
  })
}

export function useUpsertUserCard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UserCardUpsert) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('user_cards')
        .upsert(
          {
            user_id: user.id,
            card_id: input.card_id,
            stars: input.stars,
            extras: input.extras,
          },
          { onConflict: 'user_id,card_id' },
        )
        .select()
        .single()
      if (error) throw error
      return data as UserCard
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardsKey })
    },
  })
}

export function useDeleteUserCard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (cardId: string) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('card_id', cardId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardsKey })
    },
  })
}
