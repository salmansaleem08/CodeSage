export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          bio: string;
          interests: string[];
          degree: string;
          avatar_url: string | null;
          default_mode: "SEED" | "FOCUS" | "SHADOW";
          default_hint_level: number;
          code_preference: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          bio?: string;
          interests?: string[];
          degree?: string;
          avatar_url?: string | null;
          default_mode?: "SEED" | "FOCUS" | "SHADOW";
          default_hint_level?: number;
          code_preference?: string;
        };
        Update: {
          email?: string;
          full_name?: string;
          bio?: string;
          interests?: string[];
          degree?: string;
          avatar_url?: string | null;
          default_mode?: "SEED" | "FOCUS" | "SHADOW";
          default_hint_level?: number;
          code_preference?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: number;
          user_id: string;
          friend_id: string;
          status: "pending" | "accepted";
          created_at: string;
        };
        Insert: {
          user_id: string;
          friend_id: string;
          status?: "pending" | "accepted";
        };
        Update: {
          status?: "pending" | "accepted";
        };
        Relationships: [];
      };
      problem_attempts: {
        Row: {
          id: number;
          user_id: string;
          problem_id: string;
          topic: "Strings" | "Arrays" | "Loops" | "OOP" | "Data Structures" | "Recursion" | "Other";
          is_correct: boolean;
          attempts_count: number;
          hints_used: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          problem_id: string;
          topic: "Strings" | "Arrays" | "Loops" | "OOP" | "Data Structures" | "Recursion" | "Other";
          is_correct?: boolean;
          attempts_count?: number;
          hints_used?: number;
        };
        Update: {
          is_correct?: boolean;
          attempts_count?: number;
          hints_used?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
