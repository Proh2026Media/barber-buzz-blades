export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      barbershops: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["barbershop_status"];
          timezone: string;
          custom_domain: string | null;
          custom_domain_status: "none" | "pending_dns" | "active" | "error";
          domain_verify_token: string | null;
          domain_verified_at: string | null;
          domain_last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string;
          status?: Database["public"]["Enums"]["barbershop_status"];
          timezone?: string;
          custom_domain?: string | null;
          custom_domain_status?: "none" | "pending_dns" | "active" | "error";
          domain_verify_token?: string | null;
          domain_verified_at?: string | null;
          domain_last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["barbershop_status"];
          timezone?: string;
          custom_domain?: string | null;
          custom_domain_status?: "none" | "pending_dns" | "active" | "error";
          domain_verify_token?: string | null;
          domain_verified_at?: string | null;
          domain_last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      barbershop_settings: {
        Row: {
          barbershop_id: string;
          display_name: string | null;
          logo_url: string | null;
          logo_background_color: string | null;
          login_image_url: string | null;
          login_layout: string;
          font_family: string;
          custom_font_url: string | null;
          custom_font_name: string | null;
          custom_font_faces: Json;
          font_scope: string;
          header_font_weight: number;
          header_font_style: string;
          corner_style: string;
          floating_chrome: boolean;
          primary_color: string;
          accent_color: string;
          tagline: string;
          booking_instructions: string;
          booking_horizon_days: number;
          survey_program_enabled: boolean;
          sports_enabled: boolean;
          waiting_enabled: boolean;
          waiting_cutoff_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          barbershop_id: string;
          display_name?: string | null;
          logo_url?: string | null;
          logo_background_color?: string | null;
          login_image_url?: string | null;
          login_layout?: string;
          font_family?: string;
          custom_font_url?: string | null;
          custom_font_name?: string | null;
          custom_font_faces?: Json;
          font_scope?: string;
          header_font_weight?: number;
          header_font_style?: string;
          corner_style?: string;
          floating_chrome?: boolean;
          primary_color?: string;
          accent_color?: string;
          tagline?: string;
          booking_instructions?: string;
          booking_horizon_days?: number;
          survey_program_enabled?: boolean;
          sports_enabled?: boolean;
          waiting_enabled?: boolean;
          waiting_cutoff_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          barbershop_id?: string;
          display_name?: string | null;
          logo_url?: string | null;
          logo_background_color?: string | null;
          login_image_url?: string | null;
          login_layout?: string;
          font_family?: string;
          custom_font_url?: string | null;
          custom_font_name?: string | null;
          custom_font_faces?: Json;
          font_scope?: string;
          header_font_weight?: number;
          header_font_style?: string;
          corner_style?: string;
          floating_chrome?: boolean;
          primary_color?: string;
          accent_color?: string;
          tagline?: string;
          booking_instructions?: string;
          booking_horizon_days?: number;
          survey_program_enabled?: boolean;
          sports_enabled?: boolean;
          waiting_enabled?: boolean;
          waiting_cutoff_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "barbershop_settings_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: true;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          whatsapp_e164: string | null;
          whatsapp_opt_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          whatsapp_e164?: string | null;
          whatsapp_opt_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          whatsapp_e164?: string | null;
          whatsapp_opt_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          barbershop_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          barbershop_id?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          barbershop_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_members: {
        Row: {
          id: string;
          barbershop_id: string;
          user_id: string;
          staff_id: string;
          role: Database["public"]["Enums"]["shop_member_role"];
          ownership_percent: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          user_id: string;
          staff_id: string;
          role: Database["public"]["Enums"]["shop_member_role"];
          ownership_percent?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shop_members"]["Insert"]>;
        Relationships: [];
      };
      shop_change_requests: {
        Row: {
          id: string;
          barbershop_id: string;
          requested_by: string;
          approved_by: string | null;
          kind: string;
          payload: Json;
          status: Database["public"]["Enums"]["shop_change_status"];
          decision_note: string | null;
          created_at: string;
          decided_at: string | null;
          applied_at: string | null;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          requested_by: string;
          approved_by?: string | null;
          kind: string;
          payload: Json;
          status?: Database["public"]["Enums"]["shop_change_status"];
          decision_note?: string | null;
          created_at?: string;
          decided_at?: string | null;
          applied_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["shop_change_requests"]["Insert"]>;
        Relationships: [];
      };
      shop_change_approvals: {
        Row: {
          request_id: string;
          user_id: string;
          approved: boolean;
          note: string | null;
          decided_at: string;
        };
        Insert: {
          request_id: string;
          user_id: string;
          approved: boolean;
          note?: string | null;
          decided_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shop_change_approvals"]["Insert"]>;
        Relationships: [];
      };
      staff_services: {
        Row: {
          id: string;
          barbershop_id: string;
          staff_id: string;
          service_id: string;
          display_name: string | null;
          duration_minutes: number;
          price_cents: number;
          active: boolean;
          icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          staff_id: string;
          service_id: string;
          display_name?: string | null;
          duration_minutes: number;
          price_cents: number;
          active?: boolean;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_services"]["Insert"]>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          barbershop_id: string;
          name: string;
          duration_minutes: number;
          price_cents: number;
          active: boolean;
          icon: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          name: string;
          duration_minutes?: number;
          price_cents?: number;
          active?: boolean;
          icon?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          barbershop_id?: string;
          name?: string;
          duration_minutes?: number;
          price_cents?: number;
          active?: boolean;
          icon?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          id: string;
          barbershop_id: string;
          display_name: string;
          active: boolean;
          user_id: string | null;
          booking_slug: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          display_name: string;
          active?: boolean;
          user_id?: string | null;
          booking_slug?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          barbershop_id?: string;
          display_name?: string;
          active?: boolean;
          user_id?: string | null;
          booking_slug?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          barbershop_id: string;
          customer_id: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          booked_price_cents: number | null;
          public_token: string;
          series_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          customer_id: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          booked_price_cents?: number | null;
          public_token?: string;
          series_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          barbershop_id?: string;
          customer_id?: string;
          service_id?: string;
          staff_id?: string;
          starts_at?: string;
          ends_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          booked_price_cents?: number | null;
          public_token?: string;
          series_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: {
          id: string;
          barbershop_id: string;
          weekday: number;
          is_open: boolean;
          opens_at: string;
          closes_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          weekday: number;
          is_open?: boolean;
          opens_at?: string;
          closes_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          barbershop_id?: string;
          weekday?: number;
          is_open?: boolean;
          opens_at?: string;
          closes_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_blocks: {
        Row: {
          id: string;
          barbershop_id: string;
          staff_id: string | null;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          staff_id?: string | null;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          barbershop_id?: string;
          staff_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_blocks_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_blocks_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_accounts: {
        Row: {
          user_id: string;
          barbershop_id: string;
          points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          barbershop_id: string;
          points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          barbershop_id?: string;
          points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_ledger: {
        Row: {
          id: string;
          user_id: string;
          barbershop_id: string;
          delta: number;
          reason: string;
          appointment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          barbershop_id: string;
          delta: number;
          reason: string;
          appointment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          barbershop_id?: string;
          delta?: number;
          reason?: string;
          appointment_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_ledger_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_channels: {
        Row: {
          barbershop_id: string;
          instance_name: string;
          status: Database["public"]["Enums"]["whatsapp_channel_status"];
          display_phone: string | null;
          enabled: boolean;
          notify_booking: boolean;
          notify_reminder: boolean;
          reminder_hours_before: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          barbershop_id: string;
          instance_name: string;
          status?: Database["public"]["Enums"]["whatsapp_channel_status"];
          display_phone?: string | null;
          enabled?: boolean;
          notify_booking?: boolean;
          notify_reminder?: boolean;
          reminder_hours_before?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_channels"]["Insert"]>;
        Relationships: [];
      };
      whatsapp_outbox: {
        Row: {
          id: string;
          barbershop_id: string;
          to_e164: string;
          template_key: string;
          body: string;
          payload: Json;
          status: Database["public"]["Enums"]["whatsapp_outbox_status"];
          provider_message_id: string | null;
          error: string | null;
          attempts: number;
          dedupe_key: string;
          scheduled_at: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          to_e164: string;
          template_key: string;
          body: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["whatsapp_outbox_status"];
          provider_message_id?: string | null;
          error?: string | null;
          attempts?: number;
          dedupe_key: string;
          scheduled_at?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_outbox"]["Insert"]>;
        Relationships: [];
      };
      whatsapp_message_templates: {
        Row: {
          barbershop_id: string;
          template_key: string;
          body: string;
          updated_at: string;
        };
        Insert: {
          barbershop_id: string;
          template_key: string;
          body: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_message_templates"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_templates_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      email_outbox: {
        Row: {
          id: string;
          barbershop_id: string;
          to_email: string;
          template_key: string;
          subject: string;
          body: string;
          payload: Json;
          status: Database["public"]["Enums"]["email_outbox_status"];
          error: string | null;
          attempts: number;
          dedupe_key: string;
          scheduled_at: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          to_email: string;
          template_key: string;
          subject: string;
          body: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["email_outbox_status"];
          error?: string | null;
          attempts?: number;
          dedupe_key: string;
          scheduled_at?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_outbox"]["Insert"]>;
        Relationships: [];
      };
      booking_series: {
        Row: {
          id: string;
          barbershop_id: string;
          customer_id: string;
          service_id: string;
          staff_id: string;
          kind: Database["public"]["Enums"]["booking_series_kind"];
          weekday: number | null;
          interval_days: number | null;
          local_time: string;
          anchor_starts_at: string;
          active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          customer_id: string;
          service_id: string;
          staff_id: string;
          kind: Database["public"]["Enums"]["booking_series_kind"];
          weekday?: number | null;
          interval_days?: number | null;
          local_time: string;
          anchor_starts_at: string;
          active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_series"]["Insert"]>;
        Relationships: [];
      };
      auth_otp_challenges: {
        Row: {
          id: string;
          user_id: string | null;
          barbershop_id: string;
          channel: Database["public"]["Enums"]["auth_otp_channel"];
          destination: string;
          code_hash: string;
          purpose: Database["public"]["Enums"]["auth_otp_purpose"];
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          barbershop_id: string;
          channel: Database["public"]["Enums"]["auth_otp_channel"];
          destination: string;
          code_hash: string;
          purpose: Database["public"]["Enums"]["auth_otp_purpose"];
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["auth_otp_challenges"]["Insert"]>;
        Relationships: [];
      };
      google_connections: {
        Row: {
          id: string;
          user_id: string;
          google_email: string | null;
          scopes: string[];
          access_token: string;
          refresh_token: string | null;
          token_expires_at: string | null;
          calendar_sync_enabled: boolean;
          contacts_sync_enabled: boolean;
          last_calendar_sync_at: string | null;
          last_contacts_sync_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_email?: string | null;
          scopes?: string[];
          access_token: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          calendar_sync_enabled?: boolean;
          contacts_sync_enabled?: boolean;
          last_calendar_sync_at?: string | null;
          last_contacts_sync_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_connections"]["Insert"]>;
        Relationships: [];
      };
      google_calendar_events: {
        Row: {
          id: string;
          user_id: string;
          google_event_id: string;
          calendar_id: string;
          title: string | null;
          description: string | null;
          starts_at: string;
          ends_at: string;
          all_day: boolean;
          html_link: string | null;
          raw: Json;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_event_id: string;
          calendar_id?: string;
          title?: string | null;
          description?: string | null;
          starts_at: string;
          ends_at: string;
          all_day?: boolean;
          html_link?: string | null;
          raw?: Json;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_calendar_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      shop_can_manage_whatsapp: { Args: { p_shop_id: string }; Returns: boolean };
      normalize_br_whatsapp: { Args: { p_raw: string }; Returns: string };
      save_my_whatsapp: {
        Args: { p_raw: string; p_opt_in: boolean };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      process_whatsapp_reminders: { Args: Record<string, never>; Returns: number };
      claim_whatsapp_outbox: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["whatsapp_outbox"]["Row"][];
      };
      complete_whatsapp_outbox: {
        Args: {
          p_id: string;
          p_ok: boolean;
          p_provider_message_id?: string | null;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      enqueue_whatsapp_message: {
        Args: {
          p_shop_id: string;
          p_to_e164: string;
          p_template_key: string;
          p_body: string;
          p_dedupe_key: string;
          p_payload?: Json;
          p_scheduled_at?: string;
        };
        Returns: string;
      };
      lookup_appointment_by_token: { Args: { p_token: string }; Returns: Json };
      send_client_notice: {
        Args: { p_shop_id: string; p_customer_id: string; p_preset: string };
        Returns: Json;
      };
      create_booking_series: {
        Args: {
          p_shop_id: string;
          p_service_id: string;
          p_staff_id: string;
          p_starts_at: string;
          p_kind: string;
          p_interval_days?: number | null;
        };
        Returns: Json;
      };
      stop_booking_series: { Args: { p_series_id: string }; Returns: undefined };
      extend_booking_series: { Args: Record<string, never>; Returns: number };
      claim_email_outbox: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["email_outbox"]["Row"][];
      };
      complete_email_outbox: {
        Args: { p_id: string; p_ok: boolean; p_error?: string | null };
        Returns: undefined;
      };
      get_my_google_connection: {
        Args: Record<string, never>;
        Returns: Json;
      };
      join_shop_as_customer: {
        Args: { p_shop_ref: string };
        Returns: Json;
      };
      get_shop_join_preview: {
        Args: { p_shop_ref: string };
        Returns: Json;
      };
      get_public_shop_branding: {
        Args: { p_shop_ref: string };
        Returns: {
          shop_id: string;
          shop_name: string;
          display_name: string | null;
          logo_url: string | null;
          logo_background_color: string | null;
          font_family: string | null;
          custom_font_url: string | null;
          header_font_weight: number | null;
          header_font_style: string | null;
          corner_style: string | null;
          primary_color: string | null;
          accent_color: string | null;
        }[];
      };
      get_public_shop_branding_v2: {
        Args: { p_shop_ref: string };
        Returns: {
          shop_id: string;
          shop_name: string;
          display_name: string | null;
          logo_url: string | null;
          logo_background_color: string | null;
          font_family: string | null;
          custom_font_url: string | null;
          header_font_weight: number | null;
          header_font_style: string | null;
          corner_style: string | null;
          primary_color: string | null;
          accent_color: string | null;
          login_layout: string | null;
          login_image_url: string | null;
        }[];
      };
      get_partner_wallet: { Args: { p_shop_id: string }; Returns: Json };
      get_partner_clients: { Args: { p_shop_id: string }; Returns: Json };
      get_client_profile: {
        Args: { p_shop_id: string; p_customer_id: string };
        Returns: Json;
      };
      get_customer_rhythm: { Args: { p_shop_id: string }; Returns: Json };
      get_partner_rhythm: { Args: { p_shop_id: string }; Returns: Json };
      get_my_shop_permissions: { Args: { p_shop_id: string }; Returns: Json };
      get_shop_permissions: { Args: { p_shop_id: string }; Returns: Json };
      save_shop_permissions: {
        Args: { p_shop_id: string; p_matrix: Json };
        Returns: Json;
      };
      shop_permission_granted: {
        Args: { p_shop_id: string; p_permission: string };
        Returns: boolean;
      };
      record_customer_survey_response: {
        Args: { p_appointment_id: string; p_question: string; p_answer: string };
        Returns: string;
      };
      get_service_interest_insights: {
        Args: { p_shop_id: string | null; p_from: string; p_to: string };
        Returns: Json;
      };
      cancel_appointment: { Args: { p_id: string; p_reason?: string | null }; Returns: undefined };
      get_appointment_cancellations: { Args: { p_shop_id?: string | null }; Returns: Json };
      export_my_data: { Args: Record<string, never>; Returns: Json };
      list_privacy_requests: { Args: { p_admin: boolean }; Returns: Json };
      request_account_deletion: { Args: Record<string, never>; Returns: string };
      update_privacy_request: { Args: { p_id: string; p_status: string }; Returns: undefined };
      withdraw_appointment_confirmation: { Args: { p_id: string }; Returns: undefined };
      waiting_action: {
        Args: { p_id: string; p_action: string; p_service_id?: string | null };
        Returns: string | null;
      };
      get_waiting_state: { Args: { p_shop_id: string }; Returns: Json };
      get_appointment_attendance: { Args: { p_id: string }; Returns: Json };
      set_shop_sports_module: {
        Args: { p_shop_id: string; p_enabled: boolean };
        Returns: undefined;
      };
      save_appointment_occurrence: {
        Args: {
          p_id: string;
          p_customer_delay: number | null;
          p_shop_delay: number | null;
          p_no_show: boolean;
        };
        Returns: undefined;
      };
      get_occurrence_insights: {
        Args: { p_shop_id: string | null; p_from: string; p_to: string };
        Returns: Json;
      };
      record_attendance: {
        Args: { p_appointment_id: string; p_stage: string };
        Returns: undefined;
      };
      get_business_insights: {
        Args: { p_shop_id: string | null; p_from: string; p_to: string };
        Returns: Json;
      };
      get_my_privacy: { Args: Record<string, never>; Returns: Json };
      save_my_privacy: {
        Args: { p_analytics: boolean; p_surveys: boolean; p_marketing: boolean };
        Returns: undefined;
      };
      next_customer_survey: { Args: Record<string, never>; Returns: Json };
      answer_customer_survey: {
        Args: { p_id: string; p_answer: string | null };
        Returns: undefined;
      };
      record_customer_usage: {
        Args: { p_id: string; p_shop_id: string; p_event: string };
        Returns: undefined;
      };
      erase_my_optional_data: { Args: Record<string, never>; Returns: undefined };

      reschedule_own_appointment: {
        Args: {
          p_appointment_id: string;
          p_service_id: string;
          p_staff_id: string;
          p_starts_at: string;
          p_ends_at: string;
        };
        Returns: string;
      };
      get_staff_busy_intervals: {
        Args: { p_staff_id: string; p_starts_at: string; p_ends_at: string };
        Returns: { starts_at: string; ends_at: string }[];
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_shop_role: {
        Args: {
          p_shop_id: string;
          p_roles: Database["public"]["Enums"]["app_role"][];
        };
        Returns: boolean;
      };
      request_shop_change: {
        Args: { p_shop_id: string; p_kind: string; p_payload: Json };
        Returns: Json;
      };
      decide_shop_change: {
        Args: { p_request_id: string; p_approve: boolean; p_note?: string | null };
        Returns: Json;
      };
      cancel_shop_change: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      get_team_schedule: {
        Args: { p_shop_id: string; p_from: string; p_to: string };
        Returns: Json;
      };
      get_shop_access_context: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      get_professional_insights: {
        Args: { p_shop_id: string; p_from: string; p_to: string };
        Returns: Json;
      };
      resolve_direct_booking_staff: {
        Args: { p_shop_slug: string; p_staff_slug: string };
        Returns: Json;
      };
      resolve_shop_by_slug: {
        Args: { p_shop_ref: string };
        Returns: string;
      };
      list_shop_slug_redirects: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      list_staff_slug_redirects: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      delete_shop_slug_redirect: {
        Args: { p_redirect_id: string };
        Returns: undefined;
      };
      delete_staff_slug_redirect: {
        Args: { p_redirect_id: string };
        Returns: undefined;
      };
      request_shop_departure: {
        Args: {
          p_shop_id: string;
          p_mode: "take" | "forfeit";
          p_dest_shop_id?: string | null;
        };
        Returns: Json;
      };
      approve_portfolio_release: {
        Args: { p_request_id: string; p_note?: string | null };
        Returns: Json;
      };
      reject_portfolio_release: {
        Args: { p_request_id: string; p_note?: string | null };
        Returns: Json;
      };
      complete_shop_departure: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      list_shop_departure_requests: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      create_own_barbershop: {
        Args: { p_name: string };
        Returns: Json;
      };
      resolve_shop_by_host: {
        Args: { p_host: string };
        Returns: Json;
      };
      get_shop_domain_settings: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      shop_has_booking_slug: {
        Args: { p_shop_id: string; p_booking_slug: string };
        Returns: boolean;
      };
      admin_reset_externa_barbearia: {
        Args: { p_confirm: string };
        Returns: Json;
      };
      set_shop_custom_domain: {
        Args: { p_shop_id: string; p_domain: string };
        Returns: Json;
      };
      clear_shop_custom_domain: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      mark_shop_domain_status: {
        Args: {
          p_shop_id: string;
          p_status: "none" | "pending_dns" | "active" | "error";
          p_error?: string | null;
        };
        Returns: Json;
      };
      get_public_shop_branding_by_host: {
        Args: { p_host: string };
        Returns: Json;
      };
      list_active_custom_domains: {
        Args: Record<string, never>;
        Returns: Json;
      };
      create_direct_appointment: {
        Args: {
          p_shop_slug: string;
          p_staff_slug: string;
          p_service_id: string;
          p_starts_at: string;
          p_ends_at: string;
        };
        Returns: string;
      };
      platform_add_shop_member: {
        Args: {
          p_shop_id: string;
          p_user_id: string;
          p_role: Database["public"]["Enums"]["shop_member_role"];
          p_ownership_percent?: number | null;
          p_display_name?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "customer" | "shop_admin" | "platform_admin";
      barbershop_status: "active" | "suspended";
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "reschedule_requested";
      shop_member_role: "owner" | "partner" | "associate" | "employee";
      shop_change_status: "pending" | "approved" | "rejected" | "cancelled";
      whatsapp_channel_status: "disconnected" | "qr" | "connecting" | "open";
      whatsapp_outbox_status: "pending" | "sending" | "sent" | "failed";
      email_outbox_status: "pending" | "sending" | "sent" | "failed";
      booking_series_kind: "weekday" | "interval_days";
      booking_series_exception_reason:
        | "skipped_busy"
        | "cancelled"
        | "rescheduled_out"
        | "series_stopped";
      auth_otp_channel: "whatsapp" | "email";
      auth_otp_purpose: "login" | "recovery";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "shop_admin", "platform_admin"] as const,
      barbershop_status: ["active", "suspended"] as const,
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "reschedule_requested",
      ] as const,
      shop_member_role: ["owner", "partner", "associate", "employee"] as const,
      shop_change_status: ["pending", "approved", "rejected", "cancelled"] as const,
      email_outbox_status: ["pending", "sending", "sent", "failed"] as const,
      booking_series_kind: ["weekday", "interval_days"] as const,
      booking_series_exception_reason: [
        "skipped_busy",
        "cancelled",
        "rescheduled_out",
        "series_stopped",
      ] as const,
    },
  },
} as const;
