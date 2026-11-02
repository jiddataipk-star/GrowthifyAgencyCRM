export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          created_by: string | null;
          diff: NonNullable<Json>;
          entity: string;
          entity_id: string;
          id: string;
          label: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          diff?: NonNullable<Json>;
          entity: string;
          entity_id: string;
          id?: string;
          label?: string | null;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          diff?: NonNullable<Json>;
          entity?: string;
          entity_id?: string;
          id?: string;
          label?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          address: string | null;
          archived_at: string | null;
          business_name: string;
          city: string | null;
          contact_name: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          logo_url: string | null;
          niche: Database["public"]["Enums"]["client_niche"];
          notes: string | null;
          ntn: string | null;
          phone: string | null;
          source: Database["public"]["Enums"]["acquisition_source"];
          status: Database["public"]["Enums"]["client_status"];
          tags: string[];
          updated_at: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          business_name: string;
          city?: string | null;
          contact_name?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          niche?: Database["public"]["Enums"]["client_niche"];
          notes?: string | null;
          ntn?: string | null;
          phone?: string | null;
          source?: Database["public"]["Enums"]["acquisition_source"];
          status?: Database["public"]["Enums"]["client_status"];
          tags?: string[];
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          business_name?: string;
          city?: string | null;
          contact_name?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          niche?: Database["public"]["Enums"]["client_niche"];
          notes?: string | null;
          ntn?: string | null;
          phone?: string | null;
          source?: Database["public"]["Enums"]["acquisition_source"];
          status?: Database["public"]["Enums"]["client_status"];
          tags?: string[];
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      demo_records: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity: string;
          entity_id: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity: string;
          entity_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity?: string;
          entity_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          email: string | null;
          id: string;
          joined_on: string | null;
          name: string;
          notes: string | null;
          phone: string | null;
          role: string | null;
          salary: number;
          status: Database["public"]["Enums"]["employee_status"];
          team_member_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          email?: string | null;
          id?: string;
          joined_on?: string | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          salary?: number;
          status?: Database["public"]["Enums"]["employee_status"];
          team_member_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          email?: string | null;
          id?: string;
          joined_on?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          salary?: number;
          status?: Database["public"]["Enums"]["employee_status"];
          team_member_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_team_member_id_fkey";
            columns: ["team_member_id"];
            isOneToOne: true;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          bucket: string;
          created_at: string;
          created_by: string | null;
          entity: string;
          entity_id: string;
          id: string;
          mime_type: string | null;
          name: string;
          path: string;
          size: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bucket?: string;
          created_at?: string;
          created_by?: string | null;
          entity: string;
          entity_id: string;
          id?: string;
          mime_type?: string | null;
          name: string;
          path: string;
          size?: number;
          updated_at?: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          created_by?: string | null;
          entity?: string;
          entity_id?: string;
          id?: string;
          mime_type?: string | null;
          name?: string;
          path?: string;
          size?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_counters: {
        Row: {
          last_value: number;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          last_value?: number;
          year: number;
        };
        Update: {
          last_value?: number;
          year?: number;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          invoice_id: string;
          position: number;
          qty: number;
          unit_price: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          invoice_id: string;
          position?: number;
          qty?: number;
          unit_price: number;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          invoice_id?: string;
          position?: number;
          qty?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount_paid: number;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          discount: number;
          due_date: string;
          id: string;
          issue_date: string;
          notes: string | null;
          number: string;
          paid_at: string | null;
          pdf_url: string | null;
          project_id: string | null;
          sent_at: string | null;
          share_token: string;
          status: Database["public"]["Enums"]["invoice_status"];
          subtotal: number;
          tax: number;
          tax_rate: number;
          total: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paid?: number;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          discount?: number;
          due_date: string;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number: string;
          paid_at?: string | null;
          pdf_url?: string | null;
          project_id?: string | null;
          sent_at?: string | null;
          share_token?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          tax?: number;
          tax_rate?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          amount_paid?: number;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          discount?: number;
          due_date?: string;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string;
          paid_at?: string | null;
          pdf_url?: string | null;
          project_id?: string | null;
          sent_at?: string | null;
          share_token?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          tax?: number;
          tax_rate?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          business: string | null;
          city: string | null;
          converted_client_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          email: string | null;
          est_value: number;
          id: string;
          lost_reason: string | null;
          name: string;
          next_follow_up: string | null;
          notes: string | null;
          phone: string | null;
          position: number;
          service_interest: Database["public"]["Enums"]["service_type"] | null;
          source: Database["public"]["Enums"]["acquisition_source"];
          stage: Database["public"]["Enums"]["lead_stage"];
          stage_changed_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business?: string | null;
          city?: string | null;
          converted_client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          email?: string | null;
          est_value?: number;
          id?: string;
          lost_reason?: string | null;
          name: string;
          next_follow_up?: string | null;
          notes?: string | null;
          phone?: string | null;
          position?: number;
          service_interest?: Database["public"]["Enums"]["service_type"] | null;
          source?: Database["public"]["Enums"]["acquisition_source"];
          stage?: Database["public"]["Enums"]["lead_stage"];
          stage_changed_at?: string;
          updated_at?: string;
        };
        Update: {
          business?: string | null;
          city?: string | null;
          converted_client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          email?: string | null;
          est_value?: number;
          id?: string;
          lost_reason?: string | null;
          name?: string;
          next_follow_up?: string | null;
          notes?: string | null;
          phone?: string | null;
          position?: number;
          service_interest?: Database["public"]["Enums"]["service_type"] | null;
          source?: Database["public"]["Enums"]["acquisition_source"];
          stage?: Database["public"]["Enums"]["lead_stage"];
          stage_changed_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey";
            columns: ["converted_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      milestones: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          name: string;
          paid: boolean;
          paid_tx_id: string | null;
          position: number;
          project_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          name: string;
          paid?: boolean;
          paid_tx_id?: string | null;
          position?: number;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          name?: string;
          paid?: boolean;
          paid_tx_id?: string | null;
          position?: number;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "milestones_paid_tx_id_fkey";
            columns: ["paid_tx_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "milestones_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          interval: string;
          interval_months: number;
          name: string;
          service_type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          interval?: string;
          interval_months?: number;
          name: string;
          service_type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          interval?: string;
          interval_months?: number;
          name?: string;
          service_type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          project_id: string;
          team_member_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          project_id: string;
          team_member_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          project_id?: string;
          team_member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_team_member_id_fkey";
            columns: ["team_member_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deadline: string | null;
          delivered_at: string | null;
          id: string;
          links: NonNullable<Json>;
          notes: string | null;
          progress: number;
          service_type: Database["public"]["Enums"]["service_type"];
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deadline?: string | null;
          delivered_at?: string | null;
          id?: string;
          links?: NonNullable<Json>;
          notes?: string | null;
          progress?: number;
          service_type?: Database["public"]["Enums"]["service_type"];
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at?: string;
          value?: number;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deadline?: string | null;
          delivered_at?: string | null;
          id?: string;
          links?: NonNullable<Json>;
          notes?: string | null;
          progress?: number;
          service_type?: Database["public"]["Enums"]["service_type"];
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          title?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          default_price: number | null;
          description: string | null;
          id: string;
          is_recurring: boolean;
          name: string;
          type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          default_price?: number | null;
          description?: string | null;
          id?: string;
          is_recurring?: boolean;
          name: string;
          type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          default_price?: number | null;
          description?: string | null;
          id?: string;
          is_recurring?: boolean;
          name?: string;
          type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          account_number: string | null;
          account_title: string | null;
          address: string | null;
          bank_name: string | null;
          city: string | null;
          company_name: string;
          country: string;
          created_at: string;
          created_by: string | null;
          default_currency: Database["public"]["Enums"]["currency_code"];
          default_due_days: number;
          default_tax_rate: number;
          email: string | null;
          iban: string | null;
          id: string;
          invoice_footer: string | null;
          invoice_prefix: string;
          logo_path: string | null;
          notify_followups: boolean;
          notify_overdue: boolean;
          notify_renewals: boolean;
          notify_social: boolean;
          ntn: string | null;
          number_format: string;
          payment_notes: string | null;
          phone: string | null;
          show_whatsapp_on_invoice: boolean;
          singleton: boolean;
          strn: string | null;
          tagline: string | null;
          timezone: string;
          updated_at: string;
          wallet_details: string | null;
          website: string | null;
          whatsapp_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_number?: string | null;
          account_title?: string | null;
          address?: string | null;
          bank_name?: string | null;
          city?: string | null;
          company_name?: string;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          default_currency?: Database["public"]["Enums"]["currency_code"];
          default_due_days?: number;
          default_tax_rate?: number;
          email?: string | null;
          iban?: string | null;
          id?: string;
          invoice_footer?: string | null;
          invoice_prefix?: string;
          logo_path?: string | null;
          notify_followups?: boolean;
          notify_overdue?: boolean;
          notify_renewals?: boolean;
          notify_social?: boolean;
          ntn?: string | null;
          number_format?: string;
          payment_notes?: string | null;
          phone?: string | null;
          show_whatsapp_on_invoice?: boolean;
          singleton?: boolean;
          strn?: string | null;
          tagline?: string | null;
          timezone?: string;
          updated_at?: string;
          wallet_details?: string | null;
          website?: string | null;
          whatsapp_number?: string | null;
        };
        Update: {
          account_number?: string | null;
          account_title?: string | null;
          address?: string | null;
          bank_name?: string | null;
          city?: string | null;
          company_name?: string;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          default_currency?: Database["public"]["Enums"]["currency_code"];
          default_due_days?: number;
          default_tax_rate?: number;
          email?: string | null;
          iban?: string | null;
          id?: string;
          invoice_footer?: string | null;
          invoice_prefix?: string;
          logo_path?: string | null;
          notify_followups?: boolean;
          notify_overdue?: boolean;
          notify_renewals?: boolean;
          notify_social?: boolean;
          ntn?: string | null;
          number_format?: string;
          payment_notes?: string | null;
          phone?: string | null;
          show_whatsapp_on_invoice?: boolean;
          singleton?: boolean;
          strn?: string | null;
          tagline?: string | null;
          timezone?: string;
          updated_at?: string;
          wallet_details?: string | null;
          website?: string | null;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      social_accounts: {
        Row: {
          avatar_url: string | null;
          connected_by: string | null;
          connection: Database["public"]["Enums"]["social_connection"];
          created_at: string;
          created_by: string | null;
          external_id: string | null;
          handle: string | null;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          meta: NonNullable<Json>;
          name: string | null;
          platform: Database["public"]["Enums"]["social_platform"];
          profile_url: string | null;
          refresh_token_encrypted: string | null;
          scopes: string[];
          status: Database["public"]["Enums"]["social_status"];
          token_encrypted: string | null;
          token_expires_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          connected_by?: string | null;
          connection?: Database["public"]["Enums"]["social_connection"];
          created_at?: string;
          created_by?: string | null;
          external_id?: string | null;
          handle?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          meta?: NonNullable<Json>;
          name?: string | null;
          platform: Database["public"]["Enums"]["social_platform"];
          profile_url?: string | null;
          refresh_token_encrypted?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["social_status"];
          token_encrypted?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          connected_by?: string | null;
          connection?: Database["public"]["Enums"]["social_connection"];
          created_at?: string;
          created_by?: string | null;
          external_id?: string | null;
          handle?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          meta?: NonNullable<Json>;
          name?: string | null;
          platform?: Database["public"]["Enums"]["social_platform"];
          profile_url?: string | null;
          refresh_token_encrypted?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["social_status"];
          token_encrypted?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      social_metrics_daily: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          engagement: number | null;
          extra: NonNullable<Json>;
          followers: number | null;
          id: string;
          reach: number | null;
          social_account_id: string;
          updated_at: string;
          views: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          engagement?: number | null;
          extra?: NonNullable<Json>;
          followers?: number | null;
          id?: string;
          reach?: number | null;
          social_account_id: string;
          updated_at?: string;
          views?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          engagement?: number | null;
          extra?: NonNullable<Json>;
          followers?: number | null;
          id?: string;
          reach?: number | null;
          social_account_id?: string;
          updated_at?: string;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_metrics_daily_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      social_posts: {
        Row: {
          comments: number | null;
          created_at: string;
          created_by: string | null;
          engagement: number | null;
          external_id: string;
          id: string;
          likes: number | null;
          published_at: string | null;
          shares: number | null;
          social_account_id: string;
          thumbnail_url: string | null;
          title: string | null;
          updated_at: string;
          url: string | null;
          views: number | null;
        };
        ComputedFields: never;
        Insert: {
          comments?: number | null;
          created_at?: string;
          created_by?: string | null;
          engagement?: number | null;
          external_id: string;
          id?: string;
          likes?: number | null;
          published_at?: string | null;
          shares?: number | null;
          social_account_id: string;
          thumbnail_url?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string | null;
          views?: number | null;
        };
        Update: {
          comments?: number | null;
          created_at?: string;
          created_by?: string | null;
          engagement?: number | null;
          external_id?: string;
          id?: string;
          likes?: number | null;
          published_at?: string | null;
          shares?: number | null;
          social_account_id?: string;
          thumbnail_url?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string | null;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_posts_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          amount: number;
          billing_day: number;
          cancelled_at: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          interval_months: number;
          name: string;
          next_due_date: string;
          notes: string | null;
          plan_id: string | null;
          service_type: Database["public"]["Enums"]["service_type"];
          start_date: string;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          billing_day: number;
          cancelled_at?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          interval_months?: number;
          name: string;
          next_due_date: string;
          notes?: string | null;
          plan_id?: string | null;
          service_type?: Database["public"]["Enums"]["service_type"];
          start_date: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          billing_day?: number;
          cancelled_at?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          interval_months?: number;
          name?: string;
          next_due_date?: string;
          notes?: string | null;
          plan_id?: string | null;
          service_type?: Database["public"]["Enums"]["service_type"];
          start_date?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          created_by: string | null;
          done: boolean;
          done_at: string | null;
          due_date: string | null;
          id: string;
          position: number;
          project_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          project_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          project_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          active: boolean;
          avatar_url: string | null;
          created_at: string;
          created_by: string | null;
          email: string;
          id: string;
          last_seen_at: string | null;
          name: string | null;
          role: Database["public"]["Enums"]["member_role"];
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          email: string;
          id?: string;
          last_seen_at?: string | null;
          name?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: string;
          last_seen_at?: string | null;
          name?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          category: Database["public"]["Enums"]["tx_category"];
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          description: string | null;
          employee_id: string | null;
          id: string;
          invoice_id: string | null;
          method: Database["public"]["Enums"]["payment_method"];
          notes: string | null;
          project_id: string | null;
          receipt_url: string | null;
          reference: string | null;
          salary_month: string | null;
          subscription_id: string | null;
          tax_withheld: number;
          type: Database["public"]["Enums"]["tx_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          category: Database["public"]["Enums"]["tx_category"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          description?: string | null;
          employee_id?: string | null;
          id?: string;
          invoice_id?: string | null;
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          project_id?: string | null;
          receipt_url?: string | null;
          reference?: string | null;
          salary_month?: string | null;
          subscription_id?: string | null;
          tax_withheld?: number;
          type: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: Database["public"]["Enums"]["tx_category"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          description?: string | null;
          employee_id?: string | null;
          id?: string;
          invoice_id?: string | null;
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          project_id?: string | null;
          receipt_url?: string | null;
          reference?: string | null;
          salary_month?: string | null;
          subscription_id?: string | null;
          tax_withheld?: number;
          type?: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_billing_months: {
        Args: { p_anchor_day: number; p_date: string; p_months: number };
        Returns: string;
      };
      claim_membership: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["member_role"];
      };
      convert_lead: { Args: { p_lead_id: string; p_project?: Json }; Returns: string };
      cycles_due: {
        Args: { p_as_of: string; p_interval: number; p_next_due: string };
        Returns: number;
      };
      invoice_is_editable: { Args: { p_invoice_id: string }; Returns: boolean };
      is_finance: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_member: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_project_member: { Args: { p_project_id: string }; Returns: boolean };
      mark_milestone_paid: {
        Args: {
          p_method?: Database["public"]["Enums"]["payment_method"];
          p_milestone_id: string;
          p_notes?: string;
          p_paid_on?: string;
          p_receipt_url?: string;
          p_reference?: string;
        };
        Returns: string;
      };
      mark_subscription_paid: {
        Args: {
          p_amount?: number;
          p_method?: Database["public"]["Enums"]["payment_method"];
          p_notes?: string;
          p_paid_on?: string;
          p_receipt_url?: string;
          p_reference?: string;
          p_subscription_id: string;
        };
        Returns: string;
      };
      my_member_id: { Args: Record<PropertyKey, never>; Returns: string };
      my_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["member_role"];
      };
      my_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          current: boolean;
          id: string;
          ip: string;
          updated_at: string;
          user_agent: string;
        }[];
      };
      next_invoice_number: { Args: { p_date?: string }; Returns: string };
      pay_salary: {
        Args: {
          p_amount?: number;
          p_employee_id: string;
          p_method?: Database["public"]["Enums"]["payment_method"];
          p_month: string;
          p_notes?: string;
          p_paid_on?: string;
          p_reference?: string;
        };
        Returns: string;
      };
      record_invoice_payment: {
        Args: {
          p_amount: number;
          p_invoice_id: string;
          p_method?: Database["public"]["Enums"]["payment_method"];
          p_notes?: string;
          p_paid_on?: string;
          p_receipt_url?: string;
          p_reference?: string;
          p_tax_withheld?: number;
        };
        Returns: string;
      };
      report_cashflow: {
        Args: { p_months?: number };
        Returns: {
          balance: number;
          expense: number;
          income: number;
          month: string;
        }[];
      };
      report_kpis: { Args: Record<PropertyKey, never>; Returns: Json };
      report_revenue_by_service: {
        Args: { p_from: string; p_to: string };
        Returns: {
          amount: number;
          service_type: Database["public"]["Enums"]["service_type"];
        }[];
      };
      revoke_my_session: { Args: { p_session_id: string }; Returns: undefined };
      save_invoice: {
        Args: { p_data: Json; p_invoice_id: string; p_items: Json };
        Returns: string;
      };
      search_all: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          id: string;
          kind: string;
          subtitle: string;
          title: string;
        }[];
      };
      storage_project_access: { Args: { p_name: string }; Returns: boolean };
      today_pk: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      acquisition_source: "meta_ad" | "organic" | "referral" | "linkedin" | "other";
      client_niche: "real_estate" | "travel_visa" | "clinic" | "academy" | "ecommerce" | "other";
      client_status: "active" | "paused" | "former";
      currency_code: "PKR" | "USD";
      employee_status: "active" | "on_leave" | "left";
      invoice_status: "draft" | "sent" | "partial" | "paid" | "void";
      lead_stage: "new" | "contacted" | "proposal_sent" | "negotiation" | "won" | "lost";
      member_role: "owner" | "manager" | "staff";
      payment_method:
        | "bank_transfer"
        | "raast"
        | "jazzcash"
        | "easypaisa"
        | "cash"
        | "cheque"
        | "card"
        | "payoneer"
        | "wise"
        | "other";
      project_status: "planning" | "in_progress" | "review" | "delivered" | "on_hold";
      service_type:
        | "custom_software"
        | "ai_automation"
        | "web_app"
        | "whatsapp_api"
        | "ads_management"
        | "other";
      social_connection: "oauth" | "system_user" | "manual";
      social_platform: "facebook" | "instagram" | "youtube" | "threads" | "linkedin" | "tiktok";
      social_status: "not_connected" | "connected" | "needs_reconnect";
      subscription_status: "active" | "paused" | "cancelled";
      tx_category:
        | "project"
        | "subscription"
        | "salary"
        | "contractor"
        | "hosting"
        | "software"
        | "ads_spend"
        | "office"
        | "tax"
        | "other";
      tx_type: "income" | "expense";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      acquisition_source: ["meta_ad", "organic", "referral", "linkedin", "other"],
      client_niche: ["real_estate", "travel_visa", "clinic", "academy", "ecommerce", "other"],
      client_status: ["active", "paused", "former"],
      currency_code: ["PKR", "USD"],
      employee_status: ["active", "on_leave", "left"],
      invoice_status: ["draft", "sent", "partial", "paid", "void"],
      lead_stage: ["new", "contacted", "proposal_sent", "negotiation", "won", "lost"],
      member_role: ["owner", "manager", "staff"],
      payment_method: [
        "bank_transfer",
        "raast",
        "jazzcash",
        "easypaisa",
        "cash",
        "cheque",
        "card",
        "payoneer",
        "wise",
        "other",
      ],
      project_status: ["planning", "in_progress", "review", "delivered", "on_hold"],
      service_type: [
        "custom_software",
        "ai_automation",
        "web_app",
        "whatsapp_api",
        "ads_management",
        "other",
      ],
      social_connection: ["oauth", "system_user", "manual"],
      social_platform: ["facebook", "instagram", "youtube", "threads", "linkedin", "tiktok"],
      social_status: ["not_connected", "connected", "needs_reconnect"],
      subscription_status: ["active", "paused", "cancelled"],
      tx_category: [
        "project",
        "subscription",
        "salary",
        "contractor",
        "hosting",
        "software",
        "ads_spend",
        "office",
        "tax",
        "other",
      ],
      tx_type: ["income", "expense"],
    },
  },
} as const;
