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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          created_at: string
          default_pdf_footer: string | null
          id: string
          logo_url: string | null
          name: string
          next_due_calculation_method: string
          phone: string | null
          state: string | null
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          default_pdf_footer?: string | null
          id?: string
          logo_url?: string | null
          name: string
          next_due_calculation_method?: string
          phone?: string | null
          state?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          default_pdf_footer?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          next_due_calculation_method?: string
          phone?: string | null
          state?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address_line_1: string | null
          billing_address_line_2: string | null
          billing_city: string | null
          billing_state: string | null
          billing_zip: string | null
          company_id: string
          company_name: string | null
          contact_first_name: string | null
          contact_last_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          search_vector: unknown
          updated_at: string
        }
        Insert: {
          billing_address_line_1?: string | null
          billing_address_line_2?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          company_id: string
          company_name?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          search_vector?: unknown
          updated_at?: string
        }
        Update: {
          billing_address_line_1?: string | null
          billing_address_line_2?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          company_id?: string
          company_name?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          search_vector?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          install_date: string | null
          is_active: boolean
          last_test_result: string | null
          last_tested_date: string | null
          location_description: string
          manufacturer: string
          model: string
          next_due_override: string | null
          next_test_due_date: string | null
          serial_number: string
          service_location_id: string
          service_type: string | null
          size: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          install_date?: string | null
          is_active?: boolean
          last_test_result?: string | null
          last_tested_date?: string | null
          location_description: string
          manufacturer: string
          model: string
          next_due_override?: string | null
          next_test_due_date?: string | null
          serial_number: string
          service_location_id: string
          service_type?: string | null
          size: string
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          install_date?: string | null
          is_active?: boolean
          last_test_result?: string | null
          last_tested_date?: string | null
          location_description?: string
          manufacturer?: string
          model?: string
          next_due_override?: string | null
          next_test_due_date?: string | null
          serial_number?: string
          service_location_id?: string
          service_type?: string | null
          size?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_locations: {
        Row: {
          access_notes: string | null
          address_line_1: string
          address_line_2: string | null
          city: string
          company_id: string
          created_at: string
          customer_id: string
          hazard_type: string | null
          id: string
          is_active: boolean
          latitude: number | null
          location_type: string | null
          longitude: number | null
          nickname: string | null
          on_site_contact_email: string | null
          on_site_contact_first_name: string | null
          on_site_contact_last_name: string | null
          on_site_contact_phone: string | null
          search_vector: unknown
          state: string
          updated_at: string
          water_district: string | null
          zip: string
        }
        Insert: {
          access_notes?: string | null
          address_line_1: string
          address_line_2?: string | null
          city: string
          company_id: string
          created_at?: string
          customer_id: string
          hazard_type?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_type?: string | null
          longitude?: number | null
          nickname?: string | null
          on_site_contact_email?: string | null
          on_site_contact_first_name?: string | null
          on_site_contact_last_name?: string | null
          on_site_contact_phone?: string | null
          search_vector?: unknown
          state: string
          updated_at?: string
          water_district?: string | null
          zip: string
        }
        Update: {
          access_notes?: string | null
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          company_id?: string
          created_at?: string
          customer_id?: string
          hazard_type?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_type?: string | null
          longitude?: number | null
          nickname?: string | null
          on_site_contact_email?: string | null
          on_site_contact_first_name?: string | null
          on_site_contact_last_name?: string | null
          on_site_contact_phone?: string | null
          search_vector?: unknown
          state?: string
          updated_at?: string
          water_district?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          air_inlet_opening: number | null
          check_valve_1_psid: number | null
          check_valve_2_psid: number | null
          company_id: string
          created_at: string
          customer_id: string
          device_id: string
          emailed_at: string | null
          emailed_to: string | null
          id: string
          notes: string | null
          pdf_url: string | null
          relief_valve_opening: number | null
          repairs_made: string | null
          result: string
          retest_check_valve_1_psid: number | null
          retest_check_valve_2_psid: number | null
          retest_date: string | null
          retest_relief_valve_opening: number | null
          retest_result: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_location_id: string
          shutoff_valve_1_condition: string | null
          shutoff_valve_2_condition: string | null
          test_date: string
          test_gauge_calibration_date: string | null
          test_gauge_serial: string
          tester_id: string
          updated_at: string
          water_supply_pressure: number | null
        }
        Insert: {
          air_inlet_opening?: number | null
          check_valve_1_psid?: number | null
          check_valve_2_psid?: number | null
          company_id: string
          created_at?: string
          customer_id: string
          device_id: string
          emailed_at?: string | null
          emailed_to?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          relief_valve_opening?: number | null
          repairs_made?: string | null
          result: string
          retest_check_valve_1_psid?: number | null
          retest_check_valve_2_psid?: number | null
          retest_date?: string | null
          retest_relief_valve_opening?: number | null
          retest_result?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_location_id: string
          shutoff_valve_1_condition?: string | null
          shutoff_valve_2_condition?: string | null
          test_date: string
          test_gauge_calibration_date?: string | null
          test_gauge_serial: string
          tester_id: string
          updated_at?: string
          water_supply_pressure?: number | null
        }
        Update: {
          air_inlet_opening?: number | null
          check_valve_1_psid?: number | null
          check_valve_2_psid?: number | null
          company_id?: string
          created_at?: string
          customer_id?: string
          device_id?: string
          emailed_at?: string | null
          emailed_to?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          relief_valve_opening?: number | null
          repairs_made?: string | null
          result?: string
          retest_check_valve_1_psid?: number | null
          retest_check_valve_2_psid?: number | null
          retest_date?: string | null
          retest_relief_valve_opening?: number | null
          retest_result?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_location_id?: string
          shutoff_valve_1_condition?: string | null
          shutoff_valve_2_condition?: string | null
          test_date?: string
          test_gauge_calibration_date?: string | null
          test_gauge_serial?: string
          tester_id?: string
          updated_at?: string
          water_supply_pressure?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "testers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "testers"
            referencedColumns: ["id"]
          },
        ]
      }
      testers: {
        Row: {
          company_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          license_expiration: string
          license_issuing_authority: string | null
          license_number: string
          phone: string | null
          role: string
          test_gauge_calibration_date: string | null
          test_gauge_serial: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          first_name: string
          id: string
          is_active?: boolean
          last_name: string
          license_expiration: string
          license_issuing_authority?: string | null
          license_number: string
          phone?: string | null
          role?: string
          test_gauge_calibration_date?: string | null
          test_gauge_serial?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          license_expiration?: string
          license_issuing_authority?: string | null
          license_number?: string
          phone?: string | null
          role?: string
          test_gauge_calibration_date?: string | null
          test_gauge_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_and_first_tester: {
        Args: {
          p_company_address_line_1?: string
          p_company_address_line_2?: string
          p_company_city?: string
          p_company_name: string
          p_company_phone?: string
          p_company_state?: string
          p_company_website?: string
          p_company_zip?: string
          p_first_name: string
          p_last_name: string
          p_license_expiration: string
          p_license_issuing_authority?: string
          p_license_number: string
          p_next_due_calculation_method?: string
          p_test_gauge_calibration_date?: string
          p_test_gauge_serial?: string
          p_tester_phone?: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_company_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
