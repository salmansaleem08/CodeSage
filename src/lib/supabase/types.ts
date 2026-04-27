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
      feed_events: {
        Row: {
          id: number;
          actor_id: string;
          event_type: "daily_practice" | "streak_milestone" | "accuracy_improved" | "problems_solved_milestone";
          title: string;
          description: string;
          metadata: Json;
          event_key: string;
          created_at: string;
        };
        Insert: {
          actor_id: string;
          event_type: "daily_practice" | "streak_milestone" | "accuracy_improved" | "problems_solved_milestone";
          title: string;
          description: string;
          metadata?: Json;
          event_key: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      feed_reactions: {
        Row: {
          id: number;
          event_id: number;
          user_id: string;
          reaction: "clap" | "fire" | "insight";
          created_at: string;
        };
        Insert: {
          event_id: number;
          user_id: string;
          reaction: "clap" | "fire" | "insight";
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      feed_comments: {
        Row: {
          id: number;
          event_id: number;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          event_id: number;
          user_id: string;
          body: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      seed_guidance_sessions: {
        Row: {
          id: string;
          user_id: string;
          problem_fingerprint: string;
          language: "cpp" | "python";
          settings_key: string;
          steps: Json;
          frontier_step: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          problem_fingerprint: string;
          language: "cpp" | "python";
          settings_key: string;
          steps: Json;
          frontier_step?: number;
        };
        Update: {
          steps?: Json;
          frontier_step?: number;
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
