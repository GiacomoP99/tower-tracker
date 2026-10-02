export type UserCard = {
  id: string
  user_id: string
  card_id: string
  stars: number
  extras: number
  created_at: string
  updated_at: string
}

export type UserCardUpsert = {
  card_id: string
  stars: number
  extras: number
}
