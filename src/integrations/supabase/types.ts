export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abandoned_registrations: {
        Row: {
          converted: boolean
          created_at: string
          email: string
          event_id: string
          event_slug: string
          event_title: string
          full_name: string | null
          id: string
          reminder_1_sent_at: string | null
          reminder_2_sent_at: string | null
          reminder_3_sent_at: string | null
          updated_at: string
        }
        Insert: {
          converted?: boolean
          created_at?: string
          email: string
          event_id: string
          event_slug: string
          event_title: string
          full_name?: string | null
          id?: string
          reminder_1_sent_at?: string | null
          reminder_2_sent_at?: string | null
          reminder_3_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          converted?: boolean
          created_at?: string
          email?: string
          event_id?: string
          event_slug?: string
          event_title?: string
          full_name?: string | null
          id?: string
          reminder_1_sent_at?: string | null
          reminder_2_sent_at?: string | null
          reminder_3_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_advertisements: {
        Row: {
          contact_info: Json | null
          created_at: string
          description: string | null
          event_id: string | null
          guest_info: Json | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          personnel: Json | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          guest_info?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          personnel?: Json | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          guest_info?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          personnel?: Json | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_advertisements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_announcements: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_text: string | null
          link_url: string | null
          message: string | null
          priority: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_text?: string | null
          link_url?: string | null
          message?: string | null
          priority?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_text?: string | null
          link_url?: string | null
          message?: string | null
          priority?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: string | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          target: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          target?: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          target?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      attendee_accounts: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendee_imports: {
        Row: {
          created_at: string
          event_date: string | null
          event_duration: string | null
          event_id: string | null
          event_title: string
          file_name: string
          file_url: string | null
          id: string
          imported_count: number
          organizer_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_duration?: string | null
          event_id?: string | null
          event_title: string
          file_name: string
          file_url?: string | null
          id?: string
          imported_count?: number
          organizer_id: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_duration?: string | null
          event_id?: string | null
          event_title?: string
          file_name?: string
          file_url?: string | null
          id?: string
          imported_count?: number
          organizer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_imports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_notes: {
        Row: {
          attendee_email: string
          created_at: string
          id: string
          note: string
          organizer_id: string
        }
        Insert: {
          attendee_email: string
          created_at?: string
          id?: string
          note: string
          organizer_id: string
        }
        Update: {
          attendee_email?: string
          created_at?: string
          id?: string
          note?: string
          organizer_id?: string
        }
        Relationships: []
      }
      attendee_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          organization: string | null
          organizer_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_title?: string | null
          organization?: string | null
          organizer_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          organization?: string | null
          organizer_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendee_tags: {
        Row: {
          attendee_email: string
          created_at: string
          id: string
          organizer_id: string
          tag: string
        }
        Insert: {
          attendee_email: string
          created_at?: string
          id?: string
          organizer_id: string
          tag: string
        }
        Update: {
          attendee_email?: string
          created_at?: string
          id?: string
          organizer_id?: string
          tag?: string
        }
        Relationships: []
      }
      banned_emails: {
        Row: {
          banned_at: string
          banned_by: string | null
          email: string
          id: string
          phone: string | null
          reason: string | null
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          email: string
          id?: string
          phone?: string | null
          reason?: string | null
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          email?: string
          id?: string
          phone?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      crm_smart_lists: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          organizer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          organizer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          organizer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          event_id: string | null
          event_title: string
          id: string
          issue: string
          status: string
          updated_at: string
          user_email: string
          user_name: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          event_title: string
          id?: string
          issue: string
          status?: string
          updated_at?: string
          user_email: string
          user_name: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          event_title?: string
          id?: string
          issue?: string
          status?: string
          updated_at?: string
          user_email?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_discussions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          author_email: string | null
          author_name: string
          created_at: string
          event_id: string
          id: string
          is_visible: boolean
          question: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          author_email?: string | null
          author_name: string
          created_at?: string
          event_id: string
          id?: string
          is_visible?: boolean
          question: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          author_email?: string | null
          author_name?: string
          created_at?: string
          event_id?: string
          id?: string
          is_visible?: boolean
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_discussions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          access_token: string
          created_at: string
          email: string | null
          event_id: string
          id: string
          is_active: boolean
          name: string
          organizer_id: string
          phone: string | null
        }
        Insert: {
          access_token?: string
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          organizer_id: string
          phone?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organizer_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_views: {
        Row: {
          created_at: string
          event_id: string
          id: string
          referrer: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          referrer?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlist: {
        Row: {
          created_at: string
          custom_answers: Json | null
          email: string
          event_id: string
          full_name: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string | null
          phone: string
          position: number
          status: string
        }
        Insert: {
          created_at?: string
          custom_answers?: Json | null
          email: string
          event_id: string
          full_name: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          phone: string
          position?: number
          status?: string
        }
        Update: {
          created_at?: string
          custom_answers?: Json | null
          email?: string
          event_id?: string
          full_name?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          phone?: string
          position?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          about: string | null
          accepted_payment_methods: string[] | null
          category: string
          created_at: string
          custom_questions: Json | null
          date: string
          details: string | null
          duration: string | null
          end_date: string | null
          expected_attendees: number | null
          host: string | null
          id: string
          image_url: string | null
          includes: string[] | null
          is_postponed: boolean | null
          is_published: boolean | null
          location: string
          map_link: string | null
          materials: Json | null
          organizer_id: string | null
          partners: string[] | null
          payment_info: Json | null
          payment_instructions: string | null
          postponed_date: string | null
          postponed_location: string | null
          registration_closed_reason: string | null
          registration_enabled: boolean
          registration_fields: Json | null
          short_description: string | null
          slug: string
          speakers: Json | null
          ticket_only_mode: boolean
          ticket_price: string
          ticket_tiers: Json | null
          time: string
          title: string
          updated_at: string
          vendor_pricing: Json | null
          vendor_registration_enabled: boolean | null
          video_url: string | null
          waitlist_enabled: boolean | null
          what_to_expect: string[] | null
        }
        Insert: {
          about?: string | null
          accepted_payment_methods?: string[] | null
          category?: string
          created_at?: string
          custom_questions?: Json | null
          date: string
          details?: string | null
          duration?: string | null
          end_date?: string | null
          expected_attendees?: number | null
          host?: string | null
          id?: string
          image_url?: string | null
          includes?: string[] | null
          is_postponed?: boolean | null
          is_published?: boolean | null
          location: string
          map_link?: string | null
          materials?: Json | null
          organizer_id?: string | null
          partners?: string[] | null
          payment_info?: Json | null
          payment_instructions?: string | null
          postponed_date?: string | null
          postponed_location?: string | null
          registration_closed_reason?: string | null
          registration_enabled?: boolean
          registration_fields?: Json | null
          short_description?: string | null
          slug: string
          speakers?: Json | null
          ticket_only_mode?: boolean
          ticket_price?: string
          ticket_tiers?: Json | null
          time: string
          title: string
          updated_at?: string
          vendor_pricing?: Json | null
          vendor_registration_enabled?: boolean | null
          video_url?: string | null
          waitlist_enabled?: boolean | null
          what_to_expect?: string[] | null
        }
        Update: {
          about?: string | null
          accepted_payment_methods?: string[] | null
          category?: string
          created_at?: string
          custom_questions?: Json | null
          date?: string
          details?: string | null
          duration?: string | null
          end_date?: string | null
          expected_attendees?: number | null
          host?: string | null
          id?: string
          image_url?: string | null
          includes?: string[] | null
          is_postponed?: boolean | null
          is_published?: boolean | null
          location?: string
          map_link?: string | null
          materials?: Json | null
          organizer_id?: string | null
          partners?: string[] | null
          payment_info?: Json | null
          payment_instructions?: string | null
          postponed_date?: string | null
          postponed_location?: string | null
          registration_closed_reason?: string | null
          registration_enabled?: boolean
          registration_fields?: Json | null
          short_description?: string | null
          slug?: string
          speakers?: Json | null
          ticket_only_mode?: boolean
          ticket_price?: string
          ticket_tiers?: Json | null
          time?: string
          title?: string
          updated_at?: string
          vendor_pricing?: Json | null
          vendor_registration_enabled?: boolean | null
          video_url?: string | null
          waitlist_enabled?: boolean | null
          what_to_expect?: string[] | null
        }
        Relationships: []
      }
      organizer_profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          event_categories: string[] | null
          id: string
          is_profile_public: boolean | null
          is_suspended: boolean | null
          logo_url: string | null
          organization_name: string
          payment_details: string | null
          phone: string | null
          social_links: Json | null
          subscription_expires_at: string | null
          subscription_paid: boolean | null
          subscription_plan: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          event_categories?: string[] | null
          id?: string
          is_profile_public?: boolean | null
          is_suspended?: boolean | null
          logo_url?: string | null
          organization_name: string
          payment_details?: string | null
          phone?: string | null
          social_links?: Json | null
          subscription_expires_at?: string | null
          subscription_paid?: boolean | null
          subscription_plan?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          event_categories?: string[] | null
          id?: string
          is_profile_public?: boolean | null
          is_suspended?: boolean | null
          logo_url?: string | null
          organization_name?: string
          payment_details?: string | null
          phone?: string | null
          social_links?: Json | null
          subscription_expires_at?: string | null
          subscription_paid?: boolean | null
          subscription_plan?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          attendance_confirmed: string | null
          attendee_type: string
          bank_name: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          custom_answers: Json | null
          email: string
          email_sent: boolean | null
          event_id: string
          event_slug: string
          full_name: string
          id: string
          payment_method: string
          phone: string
          receipt_url: string | null
          source: string
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          attendance_confirmed?: string | null
          attendee_type?: string
          bank_name?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          custom_answers?: Json | null
          email: string
          email_sent?: boolean | null
          event_id: string
          event_slug: string
          full_name: string
          id?: string
          payment_method: string
          phone: string
          receipt_url?: string | null
          source?: string
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Update: {
          attendance_confirmed?: string | null
          attendee_type?: string
          bank_name?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          custom_answers?: Json | null
          email?: string
          email_sent?: boolean | null
          event_id?: string
          event_slug?: string
          full_name?: string
          id?: string
          payment_method?: string
          phone?: string
          receipt_url?: string | null
          source?: string
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_sessions: {
        Row: {
          created_at: string
          device_type: string
          id: string
          last_heartbeat: string
          session_id: string
          staff_token: string
        }
        Insert: {
          created_at?: string
          device_type?: string
          id?: string
          last_heartbeat?: string
          session_id: string
          staff_token: string
        }
        Update: {
          created_at?: string
          device_type?: string
          id?: string
          last_heartbeat?: string
          session_id?: string
          staff_token?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          addons: Json | null
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          organizer_id: string
          plan: string
          receipt_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_number: string | null
          updated_at: string
        }
        Insert: {
          addons?: Json | null
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          organizer_id: string
          plan: string
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_number?: string | null
          updated_at?: string
        }
        Update: {
          addons?: Json | null
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          organizer_id?: string
          plan?: string
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          registration_id: string | null
          respondent_email: string | null
          respondent_name: string | null
          survey_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          registration_id?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          survey_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          registration_id?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          is_active: boolean
          organizer_id: string
          questions: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_active?: boolean
          organizer_id: string
          questions?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_active?: boolean
          organizer_id?: string
          questions?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_accounts: {
        Row: {
          created_at: string
          id: string
          link_token: string | null
          linked_at: string | null
          role: string
          telegram_chat_id: number | null
          telegram_reminders_enabled: boolean
          telegram_updates_enabled: boolean
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_token?: string | null
          linked_at?: string | null
          role?: string
          telegram_chat_id?: number | null
          telegram_reminders_enabled?: boolean
          telegram_updates_enabled?: boolean
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_token?: string | null
          linked_at?: string | null
          role?: string
          telegram_chat_id?: number | null
          telegram_reminders_enabled?: boolean
          telegram_updates_enabled?: boolean
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_announcements: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string
          organizer_id: string
          sent_count: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message: string
          organizer_id: string
          sent_count?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string
          organizer_id?: string
          sent_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_reminders: {
        Row: {
          created_at: string
          event_id: string
          id: string
          registration_id: string | null
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          telegram_chat_id: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          registration_id?: string | null
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          telegram_chat_id: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          registration_id?: string | null
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          telegram_chat_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_reminders_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization: string | null
          quote: string
          rating: number | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization?: string | null
          quote: string
          rating?: number | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization?: string | null
          quote?: string
          rating?: number | null
          role?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_registrations: {
        Row: {
          booth_size: string | null
          brand_name: string | null
          contact_person: string
          created_at: string
          description: string | null
          email: string
          event_id: string
          files: string[] | null
          id: string
          organizer_notes: string | null
          phone: string
          power_required: boolean | null
          selected_package: string | null
          selected_package_price: string | null
          special_requirements: string | null
          status: string
          updated_at: string
          vendor_name: string
          vendor_type: string
          website: string | null
        }
        Insert: {
          booth_size?: string | null
          brand_name?: string | null
          contact_person: string
          created_at?: string
          description?: string | null
          email: string
          event_id: string
          files?: string[] | null
          id?: string
          organizer_notes?: string | null
          phone: string
          power_required?: boolean | null
          selected_package?: string | null
          selected_package_price?: string | null
          special_requirements?: string | null
          status?: string
          updated_at?: string
          vendor_name: string
          vendor_type?: string
          website?: string | null
        }
        Update: {
          booth_size?: string | null
          brand_name?: string | null
          contact_person?: string
          created_at?: string
          description?: string | null
          email?: string
          event_id?: string
          files?: string[] | null
          id?: string
          organizer_notes?: string | null
          phone?: string
          power_required?: boolean | null
          selected_package?: string | null
          selected_package_price?: string | null
          special_requirements?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string
          vendor_type?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_event_for_registration: {
        Args: { event_slug: string }
        Returns: {
          event_date: string
          event_id: string
          event_location: string
          event_slug_out: string
          event_time: string
          event_title: string
        }[]
      }
      get_homepage_live_stats: {
        Args: never
        Returns: {
          events_count: number
          organizers_count: number
          registrations_count: number
        }[]
      }
      get_organizer_remaining_slots: {
        Args: { event_uuid: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      quick_register_self: {
        Args: {
          p_email?: string
          p_event_slug: string
          p_full_name: string
          p_organization?: string
          p_phone: string
        }
        Returns: {
          ticket_id: string
        }[]
      }
      staff_checkin_attendee: {
        Args: { p_access_token: string; p_ticket_id: string }
        Returns: {
          attendee_email: string
          attendee_name: string
          checked_in_time: string
          message: string
          result_status: string
        }[]
      }
      staff_get_event_stats: {
        Args: { p_access_token: string }
        Returns: {
          my_checkins: number
          recent_checkins: Json
          total_approved: number
          total_checked_in: number
        }[]
      }
      staff_search_attendees: {
        Args: { p_access_token: string; p_query: string }
        Returns: {
          attendee_type: string
          checked_in: boolean
          checked_in_at: string
          email: string
          full_name: string
          phone: string
          status: string
          ticket_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "organizer" | "staff" | "attendee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "organizer", "staff", "attendee"],
    },
  },
} as const
