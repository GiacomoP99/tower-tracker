export type PlayMode = 'manual' | 'afk'

export type Run = {
  id: string
  user_id: string
  tier: number
  wave_reached: number
  duration_seconds: number
  ran_at: string
  play_mode: PlayMode
  coins: string
  cells: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type RunInsert = {
  tier: number
  wave_reached: number
  duration_seconds: number
  ran_at: string
  play_mode: PlayMode
  coins: string
  cells: string
  notes?: string | null
}

export type RunUpdate = Partial<RunInsert>
