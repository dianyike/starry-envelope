export type BottleType =
  | 'normal'    // 普通瓶
  | 'local'     // 同縣市瓶
  | 'question'  // 提問瓶
  | 'wish'      // 祝願瓶
  | 'vent'      // 發洩瓶
  | 'truth'     // 真話瓶
  | 'secret'    // 暗號瓶
  | 'relay'     // 傳遞瓶

export type BottleStatus = 'floating' | 'picked' | 'retrieved' | 'deleted'

export type InteractionType =
  | 'picked'        // 撈到
  | 'washed_ashore' // 沖上海灘
  | 'replied'       // 回覆
  | 'thrown_back'   // 扔回海里
  | 'disliked'      // 厭惡
  | 'reported'      // 檢舉

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string | null
          city: string | null
          fishing_nets: number
          points: number
          nets_reset_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          nickname?: string | null
          city?: string | null
          fishing_nets?: number
          points?: number
          nets_reset_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nickname?: string | null
          city?: string | null
          fishing_nets?: number
          points?: number
          nets_reset_at?: string | null
          created_at?: string
        }
      }
      bottles: {
        Row: {
          id: string
          author_id: string | null
          author_name: string | null
          content: string
          image_url: string | null
          bottle_type: BottleType
          secret_code: string | null
          city: string | null
          is_pushable: boolean
          relay_count: number
          current_holder_id: string | null
          status: BottleStatus
          created_at: string
        }
        Insert: {
          id?: string
          author_id?: string | null
          author_name?: string | null
          content: string
          image_url?: string | null
          bottle_type: BottleType
          secret_code?: string | null
          city?: string | null
          is_pushable?: boolean
          relay_count?: number
          current_holder_id?: string | null
          status?: BottleStatus
          created_at?: string
        }
        Update: {
          id?: string
          author_id?: string | null
          author_name?: string | null
          content?: string
          image_url?: string | null
          bottle_type?: BottleType
          secret_code?: string | null
          city?: string | null
          is_pushable?: boolean
          relay_count?: number
          current_holder_id?: string | null
          status?: BottleStatus
          created_at?: string
        }
      }
      bottle_interactions: {
        Row: {
          id: string
          bottle_id: string
          user_id: string
          interaction_type: InteractionType
          created_at: string
        }
        Insert: {
          id?: string
          bottle_id: string
          user_id: string
          interaction_type: InteractionType
          created_at?: string
        }
        Update: {
          id?: string
          bottle_id?: string
          user_id?: string
          interaction_type?: InteractionType
          created_at?: string
        }
      }
      replies: {
        Row: {
          id: string
          bottle_id: string
          author_id: string | null
          author_name: string | null
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          bottle_id: string
          author_id?: string | null
          author_name?: string | null
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          bottle_id?: string
          author_id?: string | null
          author_name?: string | null
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
      beach: {
        Row: {
          id: string
          user_id: string
          bottle_id: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bottle_id: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bottle_id?: string
          is_read?: boolean
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          bottle_id: string
          reporter_id: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bottle_id: string
          reporter_id: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bottle_id?: string
          reporter_id?: string
          reason?: string | null
          created_at?: string
        }
      }
    }
  }
}
