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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          product_id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          product_id: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          product_id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          evidence_urls: string[] | null
          id: string
          order_id: string
          raised_by: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          order_id: string
          raised_by: string
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          order_id?: string
          raised_by?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string | null
          following_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string
          order_id: string
          product_id: string
          quantity: number
          seller_id: string
          title: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          order_id: string
          product_id: string
          quantity: number
          seller_id: string
          title: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          order_id?: string
          product_id?: string
          quantity?: number
          seller_id?: string
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string
          buyer_id: string
          city: string
          created_at: string
          delivery_otp: string | null
          escrow_status: string | null
          full_name: string
          id: string
          notes: string | null
          otp_attempts: number | null
          payment_method: string
          payment_ref: string | null
          phone: string
          shipping_fee: number
          state: string
          status: string
          subtotal: number
          total: number
          tracking_code: string
          updated_at: string
        }
        Insert: {
          address_line: string
          buyer_id: string
          city: string
          created_at?: string
          delivery_otp?: string | null
          escrow_status?: string | null
          full_name: string
          id?: string
          notes?: string | null
          otp_attempts?: number | null
          payment_method?: string
          payment_ref?: string | null
          phone: string
          shipping_fee?: number
          state: string
          status?: string
          subtotal?: number
          total?: number
          tracking_code?: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          buyer_id?: string
          city?: string
          created_at?: string
          delivery_otp?: string | null
          escrow_status?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          otp_attempts?: number | null
          payment_method?: string
          payment_ref?: string | null
          phone?: string
          shipping_fee?: number
          state?: string
          status?: string
          subtotal?: number
          total?: number
          tracking_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at?: string
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category: string
          color: string | null
          condition: string
          created_at: string
          description: string | null
          extra_images: string[]
          id: string
          image_url: string
          location: string | null
          original_price: number | null
          price: number
          seller_id: string
          size: string | null
          status: string
          title: string
        }
        Insert: {
          brand?: string | null
          category: string
          color?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          extra_images?: string[]
          id?: string
          image_url: string
          location?: string | null
          original_price?: number | null
          price: number
          seller_id: string
          size?: string | null
          status?: string
          title: string
        }
        Update: {
          brand?: string | null
          category?: string
          color?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          extra_images?: string[]
          id?: string
          image_url?: string
          location?: string | null
          original_price?: number | null
          price?: number
          seller_id?: string
          size?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_image: string | null
          created_at: string
          fcm_token: string | null
          followers_count: number | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          location: string | null
          rating: number | null
          role: string | null
          style_tags: string[] | null
          total_sales: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_image?: string | null
          created_at?: string
          fcm_token?: string | null
          followers_count?: number | null
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          location?: string | null
          rating?: number | null
          role?: string | null
          style_tags?: string[] | null
          total_sales?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_image?: string | null
          created_at?: string
          fcm_token?: string | null
          followers_count?: number | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          location?: string | null
          rating?: number | null
          role?: string | null
          style_tags?: string[] | null
          total_sales?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string
          photos: string[] | null
          rating: number
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          photos?: string[] | null
          rating: number
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          photos?: string[] | null
          rating?: number
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          net_amount: number
          order_id: string | null
          platform_commission: number | null
          status: string
          type: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          net_amount: number
          order_id?: string | null
          platform_commission?: number | null
          status?: string
          type: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          net_amount?: number
          order_id?: string | null
          platform_commission?: number | null
          status?: string
          type?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications: {
        Row: {
          created_at: string
          document_url: string
          id: string
          notes: string | null
          selfie_url: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_url: string
          id?: string
          notes?: string | null
          selfie_url: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_url?: string
          id?: string
          notes?: string | null
          selfie_url?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          pending_balance: number
          updated_at: string
          user_id: string
          withdrawn_balance: number
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          pending_balance?: number
          updated_at?: string
          user_id: string
          withdrawn_balance?: number
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          pending_balance?: number
          updated_at?: string
          user_id?: string
          withdrawn_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_listings: {
        Row: {
          id: string
          giver_id: string
          title: string
          description: string | null
          category: string
          condition: string
          images: string[]
          brand: string | null
          size: string | null
          color: string | null
          specifications: string | null
          intended_beneficiary_description: string | null
          location: string
          deadline: string | null
          status: "draft" | "published" | "applications_closed" | "awarded" | "withdrawn" | "completed"
          selected_application_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          giver_id: string
          title: string
          description?: string | null
          category: string
          condition: string
          images?: string[]
          brand?: string | null
          size?: string | null
          color?: string | null
          specifications?: string | null
          intended_beneficiary_description?: string | null
          location: string
          deadline?: string | null
          status?: "draft" | "published" | "applications_closed" | "awarded" | "withdrawn" | "completed"
          selected_application_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          giver_id?: string
          title?: string
          description?: string | null
          category?: string
          condition?: string
          images?: string[]
          brand?: string | null
          size?: string | null
          color?: string | null
          specifications?: string | null
          intended_beneficiary_description?: string | null
          location?: string
          deadline?: string | null
          status?: "draft" | "published" | "applications_closed" | "awarded" | "withdrawn" | "completed"
          selected_application_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_listings_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_gift_selected_application"
            columns: ["selected_application_id"]
            isOneToOne: false
            referencedRelation: "gift_applications"
            referencedColumns: ["id"]
          }
        ]
      }
      gift_applications: {
        Row: {
          id: string
          gift_id: string
          applicant_id: string
          application_type: "self" | "someone_else"
          intended_recipient_description: string | null
          message: string
          status: "pending" | "shortlisted" | "selected" | "not_selected" | "withdrawn"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gift_id: string
          applicant_id: string
          application_type: "self" | "someone_else"
          intended_recipient_description?: string | null
          message: string
          status?: "pending" | "shortlisted" | "selected" | "not_selected" | "withdrawn"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gift_id?: string
          applicant_id?: string
          application_type?: "self" | "someone_else"
          intended_recipient_description?: string | null
          message?: string
          status?: "pending" | "shortlisted" | "selected" | "not_selected" | "withdrawn"
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_applications_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gift_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      gift_handovers: {
        Row: {
          id: string
          gift_id: string
          giver_id: string
          recipient_id: string
          application_id: string
          meeting_location: string
          collection_date: string
          collection_time: string
          collection_instructions: string | null
          recipient_confirmed_attendance: boolean
          recipient_attendance_confirmed_at: string | null
          giver_confirmed_handover: boolean
          giver_handover_confirmed_at: string | null
          recipient_confirmed_receipt: boolean
          recipient_receipt_confirmed_at: string | null
          recipient_feedback: string | null
          recipient_feedback_rating: number | null
          recipient_feedback_at: string | null
          is_completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gift_id: string
          giver_id: string
          recipient_id: string
          application_id: string
          meeting_location: string
          collection_date: string
          collection_time: string
          collection_instructions?: string | null
          recipient_confirmed_attendance?: boolean
          recipient_attendance_confirmed_at?: string | null
          giver_confirmed_handover?: boolean
          giver_handover_confirmed_at?: string | null
          recipient_confirmed_receipt?: boolean
          recipient_receipt_confirmed_at?: string | null
          recipient_feedback?: string | null
          recipient_feedback_rating?: number | null
          recipient_feedback_at?: string | null
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gift_id?: string
          giver_id?: string
          recipient_id?: string
          application_id?: string
          meeting_location?: string
          collection_date?: string
          collection_time?: string
          collection_instructions?: string | null
          recipient_confirmed_attendance?: boolean
          recipient_attendance_confirmed_at?: string | null
          giver_confirmed_handover?: boolean
          giver_handover_confirmed_at?: string | null
          recipient_confirmed_receipt?: boolean
          recipient_receipt_confirmed_at?: string | null
          recipient_feedback?: string | null
          recipient_feedback_rating?: number | null
          recipient_feedback_at?: string | null
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_handovers_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: true
            referencedRelation: "gift_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_handovers_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_handovers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_handovers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "gift_applications"
            referencedColumns: ["id"]
          }
        ]
      }
      gift_reports: {
        Row: {
          id: string
          reporter_id: string
          gift_id: string | null
          application_id: string | null
          reason: string
          details: string | null
          status: "pending" | "reviewed" | "action_taken" | "dismissed"
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          gift_id?: string | null
          application_id?: string | null
          reason: string
          details?: string | null
          status?: "pending" | "reviewed" | "action_taken" | "dismissed"
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          gift_id?: string | null
          application_id?: string | null
          reason?: string
          details?: string | null
          status?: "pending" | "reviewed" | "action_taken" | "dismissed"
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_reports_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gift_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_reports_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "gift_applications"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          entity_id: string | null
          link_url: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: string
          entity_id?: string | null
          link_url?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          entity_id?: string | null
          link_url?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      public_seller_profiles: {
        Row: {
          avatar_url: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      select_gift_recipient: {
        Args: {
          p_gift_id: string
          p_application_id: string
        }
        Returns: Json
      }
      shortlist_gift_applicant: {
        Args: {
          p_application_id: string
          p_shortlist: boolean
        }
        Returns: Json
      }
      arrange_gift_handover: {
        Args: {
          p_gift_id: string
          p_meeting_location: string
          p_collection_date: string
          p_collection_time: string
          p_collection_instructions?: string | null
        }
        Returns: Json
      }
      confirm_handover_step: {
        Args: {
          p_gift_id: string
          p_step: string
        }
        Returns: Json
      }
      verify_delivery_otp: {
        Args: {
          target_order_id: string
          entered_otp: string
        }
        Returns: Json
      }
      confirm_delivery: {
        Args: {
          target_order_id: string
        }
        Returns: Json
      }
      get_platform_commission_percent: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
