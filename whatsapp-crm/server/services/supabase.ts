import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Service role client - backend only, bypasses RLS
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Types for database tables
export interface Business {
  id: string;
  business_name: string;
  phone_1?: string;
  phone_2?: string;
  whatsapp?: string;
  governorate?: string;
  city?: string;
  category?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  template_strategy: 'single_template' | 'random_template' | 'even_rotation' | 'weighted_ab_test';
  audience_filters: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  cta_type: 'none' | 'link' | 'reply' | 'call';
  cta_value?: string;
  is_active: boolean;
  weight: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CampaignTemplate {
  id: string;
  campaign_id: string;
  template_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  campaign_id: string;
  template_id?: string;
  business_id?: string;
  business_name?: string;
  category?: string;
  city?: string;
  phone: string;
  rendered_message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  nabda_message_id?: string;
  // Traceability fields for testing workflow
  is_internal_test?: boolean;
  recipient_source?: 'filtered_audience' | 'internal_test' | 'manual_test';
  message_mode?: 'informative' | 'claim_business' | 'profile_preview' | 'reply_question';
  landing_page_variant?: 'business_profile' | 'claim_page' | 'app_intro';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  phone: string;
  business_id?: string;
  business_name?: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  media_url?: string;
  is_read: boolean;
  is_auto_reply: boolean;
  auto_reply_triggered_by?: string;
  replied_by?: string;
  parent_message_id?: string;
  nabda_message_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface FAQAnswer {
  id: string;
  question_keywords: string[];
  answer: string;
  is_active: boolean;
  auto_send: boolean;
  confidence_threshold: number;
  usage_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TemplateStats {
  id: string;
  template_id: string;
  campaign_id: string;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}
