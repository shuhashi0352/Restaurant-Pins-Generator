export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      maps: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          center_lat: number;
          center_lng: number;
          center_label: string;
          radius_meters: number;
          min_rating: number | null;
          min_review_count: number | null;
          max_pins: number;
          icon: string;
          price_level: string;
          open_now: boolean | null;
          visibility: string;
          share_enabled: boolean;
          share_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          center_lat: number;
          center_lng: number;
          center_label: string;
          radius_meters: number;
          min_rating?: number | null;
          min_review_count?: number | null;
          max_pins: number;
          icon: string;
          price_level: string;
          open_now?: boolean | null;
          visibility?: string;
          share_enabled?: boolean;
          share_token?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          center_lat?: number;
          center_lng?: number;
          center_label?: string;
          radius_meters?: number;
          min_rating?: number | null;
          min_review_count?: number | null;
          max_pins?: number;
          icon?: string;
          price_level?: string;
          open_now?: boolean | null;
          visibility?: string;
          share_enabled?: boolean;
          share_token?: string | null;
        };
        Relationships: [];
      };
      pins: {
        Row: {
          id: string;
          map_id: string;
          google_place_id: string;
          name: string;
          address: string | null;
          lat: number;
          lng: number;
          rating: number | null;
          review_count: number | null;
          price_level: string | null;
          google_maps_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          map_id: string;
          google_place_id: string;
          name: string;
          address?: string | null;
          lat: number;
          lng: number;
          rating?: number | null;
          review_count?: number | null;
          price_level?: string | null;
          google_maps_url: string;
        };
        Update: {
          id?: string;
          map_id?: string;
          google_place_id?: string;
          name?: string;
          address?: string | null;
          lat?: number;
          lng?: number;
          rating?: number | null;
          review_count?: number | null;
          price_level?: string | null;
          google_maps_url?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type MapRow = Database["public"]["Tables"]["maps"]["Row"];
export type PinRow = Database["public"]["Tables"]["pins"]["Row"];
