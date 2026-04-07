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

export interface Business {
  id: string;
  name: string;
  phone: string;
  city?: string;
  category?: string;
  [key: string]: any;
}

export interface Conversation {
  phone: string;
  business_id?: string;
  business_name?: string;
  last_message: ConversationMessage;
  unread_count: number;
  messages: ConversationMessage[];
}
