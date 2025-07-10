import { createClient } from '@supabase/supabase-js'

// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          nickname: string
          avatar_url: string | null
          role: 'audience' | 'host' | 'player'
          room_id: string | null
          joined_at: string
          order_number: number | null
          selected_reward: string | null
          is_online: boolean
          current_emoji: string | null
          emoji_expires_at: string | null
          password: string | null
        }
        Insert: {
          id?: string
          nickname: string
          avatar_url?: string | null
          role?: 'audience' | 'host' | 'player'
          room_id?: string | null
          joined_at?: string
          order_number?: number | null
          selected_reward?: string | null
          is_online?: boolean
          current_emoji?: string | null
          emoji_expires_at?: string | null
          password?: string | null
        }
        Update: {
          id?: string
          nickname?: string
          avatar_url?: string | null
          role?: 'audience' | 'host' | 'player'
          room_id?: string | null
          joined_at?: string
          order_number?: number | null
          selected_reward?: string | null
          is_online?: boolean
          current_emoji?: string | null
          emoji_expires_at?: string | null
          password?: string | null
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          stage: 'waiting' | 'lottery' | 'reward_selection' | 'final_lottery' | 'finished'
          created_at: string
          settings: Record<string, unknown>
          is_lottery_locked: boolean
          current_selector: string | null
          selection_timeout: string | null
        }
        Insert: {
          id?: string
          name: string
          stage?: 'waiting' | 'lottery' | 'reward_selection' | 'final_lottery' | 'finished'
          created_at?: string
          settings?: Record<string, unknown>
          is_lottery_locked?: boolean
          current_selector?: string | null
          selection_timeout?: string | null
        }
        Update: {
          id?: string
          name?: string
          stage?: 'waiting' | 'lottery' | 'reward_selection' | 'final_lottery' | 'finished'
          created_at?: string
          settings?: Record<string, unknown>
          is_lottery_locked?: boolean
          current_selector?: string | null
          selection_timeout?: string | null
        }
      }
      lottery_participants: {
        Row: {
          id: string
          room_id: string
          user_id: string
          created_at: string
          is_drawn: boolean
          drawn_at: string | null
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          created_at?: string
          is_drawn?: boolean
          drawn_at?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          created_at?: string
          is_drawn?: boolean
          drawn_at?: string | null
        }
      }
      rewards: {
        Row: {
          id: string
          room_id: string
          name: string
          description: string
          image_url: string | null
          order_index: number
          selected_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          name: string
          description: string
          image_url?: string | null
          order_index: number
          selected_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          name?: string
          description?: string
          image_url?: string | null
          order_index?: number
          selected_by?: string | null
          created_at?: string
        }
      }
      emojis: {
        Row: {
          id: string
          user_id: string
          room_id: string
          emoji: string
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          user_id: string
          room_id: string
          emoji: string
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          user_id?: string
          room_id?: string
          emoji?: string
          created_at?: string
          expires_at?: string
        }
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// 主持人密码
export const HOST_PASSWORD = process.env.NEXT_PUBLIC_HOST_PASSWORD || 'wedding2024'

// 应用名称
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || '婚礼抽奖系统' 