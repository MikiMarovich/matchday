// Basado en los tipos generados desde Supabase (MCP generate_typescript_types), compactado
// y con ajustes de nulabilidad en argumentos opcionales y en get_match_roster.
// Si cambia el esquema, regenerar y volver a aplicar esos ajustes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type RegistrationRow = {
  cancellation_reason: string | null
  cancelled_at: string | null
  confirmed_at: string | null
  created_at: string
  id: string
  match_id: string
  payment_account_snapshot: string | null
  payment_alias_snapshot: string | null
  payment_deadline: string | null
  payment_holder_snapshot: string | null
  payment_provider_snapshot: Database['public']['Enums']['payment_provider'] | null
  price_snapshot: number
  receipt_path: string | null
  receipt_submitted_at: string | null
  rejection_reason: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  status: Database['public']['Enums']['registration_status']
  updated_at: string
  user_id: string
  waitlisted_at: string | null
}

type MatchRow = {
  created_at: string
  ends_at: string | null
  id: string
  location: string
  max_players: number
  notes: string | null
  payment_window_minutes: number
  price: number
  starts_at: string
  status: Database['public']['Enums']['match_status']
  title: string
  updated_at: string
}

type PaymentSettingRow = {
  account_number: string
  alias: string
  created_at: string
  holder_name: string
  id: string
  is_active: boolean
  provider: Database['public']['Enums']['payment_provider']
  updated_at: string
}

type ReturnsOne<T extends string> = {
  from: '*'
  to: T
  isOneToOne: true
  isSetofReturn: false
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      admins: {
        Row: { created_at: string; email: string }
        Insert: { created_at?: string; email: string }
        Update: { created_at?: string; email?: string }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: MatchRow
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          location: string
          max_players: number
          notes?: string | null
          payment_window_minutes?: number
          price: number
          starts_at: string
          status?: Database['public']['Enums']['match_status']
          title: string
          updated_at?: string
        }
        Update: Partial<MatchRow>
        Relationships: []
      }
      notifications_log: {
        Row: {
          created_at: string
          error: string | null
          id: number
          provider_message_id: string | null
          recipient_email: string
          registration_id: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          provider_message_id?: string | null
          recipient_email: string
          registration_id?: string | null
          status: string
          type: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          provider_message_id?: string | null
          recipient_email?: string
          registration_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_log_registration_id_fkey'
            columns: ['registration_id']
            isOneToOne: false
            referencedRelation: 'registrations'
            referencedColumns: ['id']
          },
        ]
      }
      payment_settings: {
        Row: PaymentSettingRow
        Insert: {
          account_number: string
          alias: string
          created_at?: string
          holder_name: string
          id?: string
          is_active?: boolean
          provider: Database['public']['Enums']['payment_provider']
          updated_at?: string
        }
        Update: Partial<PaymentSettingRow>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          position: Database['public']['Enums']['player_position'] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          position?: Database['public']['Enums']['player_position'] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          position?: Database['public']['Enums']['player_position'] | null
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: RegistrationRow
        Insert: Partial<RegistrationRow> & {
          match_id: string
          price_snapshot: number
          status: Database['public']['Enums']['registration_status']
          user_id: string
        }
        Update: Partial<RegistrationRow>
        Relationships: [
          {
            foreignKeyName: 'registrations_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registrations_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registrations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_match: {
        Args: {
          p_ends_at: string | null
          p_location: string
          p_max_players: number
          p_notes?: string | null
          p_payment_window_minutes?: number
          p_price: number
          p_starts_at: string
          p_title: string
        }
        Returns: MatchRow
        SetofOptions: ReturnsOne<'matches'>
      }
      admin_save_payment_setting: {
        Args: {
          p_account_number: string
          p_alias: string
          p_holder_name: string
          p_id: string | null
          p_provider: Database['public']['Enums']['payment_provider']
        }
        Returns: PaymentSettingRow
        SetofOptions: ReturnsOne<'payment_settings'>
      }
      admin_set_match_status: {
        Args: {
          p_match_id: string
          p_status: Database['public']['Enums']['match_status']
        }
        Returns: MatchRow
        SetofOptions: ReturnsOne<'matches'>
      }
      admin_set_payment_setting_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: PaymentSettingRow
        SetofOptions: ReturnsOne<'payment_settings'>
      }
      admin_update_match: {
        Args: {
          p_ends_at: string | null
          p_location: string
          p_match_id: string
          p_max_players: number
          p_notes?: string | null
          p_payment_window_minutes: number
          p_price: number
          p_starts_at: string
          p_title: string
        }
        Returns: MatchRow
        SetofOptions: ReturnsOne<'matches'>
      }
      approve_payment: {
        Args: { p_registration_id: string }
        Returns: RegistrationRow
        SetofOptions: ReturnsOne<'registrations'>
      }
      cancel_registration: {
        Args: { p_reason?: string | null; p_registration_id: string }
        Returns: RegistrationRow
        SetofOptions: ReturnsOne<'registrations'>
      }
      expire_pending_payments: { Args: { p_match_id: string }; Returns: number }
      get_match_roster: {
        Args: { p_match_id: string }
        // Ajustado a mano: full_name, avatar_url y position pueden venir null.
        Returns: {
          avatar_url: string | null
          full_name: string | null
          grupo: 'CONFIRMED' | 'PENDING' | 'WAITLIST'
          is_me: boolean
          orden: number
          position: Database['public']['Enums']['player_position'] | null
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      promote_from_waitlist: {
        Args: { p_deadline?: string | null; p_match_id: string }
        Returns: RegistrationRow
        SetofOptions: ReturnsOne<'registrations'>
      }
      register_for_match: {
        Args: { p_match_id: string }
        Returns: RegistrationRow
        SetofOptions: ReturnsOne<'registrations'>
      }
      reject_payment: {
        Args: { p_reason: string; p_registration_id: string }
        Returns: RegistrationRow
        SetofOptions: ReturnsOne<'registrations'>
      }
      submit_receipt: {
        Args: { p_receipt_path: string; p_registration_id: string }
        Returns: RegistrationRow
        SetofOptions: ReturnsOne<'registrations'>
      }
    }
    Enums: {
      match_status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'PLAYED' | 'CANCELLED'
      payment_provider: 'MERCADO_PAGO' | 'NARANJA_X'
      player_position: 'ARQUERO' | 'DEFENSOR' | 'MEDIOCAMPISTA' | 'DELANTERO'
      registration_status:
        | 'PENDING_PAYMENT'
        | 'PENDING_REVIEW'
        | 'CONFIRMED'
        | 'WAITLIST'
        | 'REJECTED'
        | 'CANCELLED'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

export const Constants = {
  public: {
    Enums: {
      match_status: ['DRAFT', 'OPEN', 'CLOSED', 'PLAYED', 'CANCELLED'],
      payment_provider: ['MERCADO_PAGO', 'NARANJA_X'],
      player_position: ['ARQUERO', 'DEFENSOR', 'MEDIOCAMPISTA', 'DELANTERO'],
      registration_status: [
        'PENDING_PAYMENT',
        'PENDING_REVIEW',
        'CONFIRMED',
        'WAITLIST',
        'REJECTED',
        'CANCELLED',
      ],
    },
  },
} as const
