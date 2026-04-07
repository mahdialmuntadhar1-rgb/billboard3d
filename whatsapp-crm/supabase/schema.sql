-- Enable required extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Businesses table (must exist before messages references it)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  phone_1 VARCHAR(50), -- Primary phone number
  phone_2 VARCHAR(50), -- Secondary phone number  
  whatsapp VARCHAR(50), -- WhatsApp number
  governorate VARCHAR(100), -- Governorate/Province
  city VARCHAR(100), -- City
  category VARCHAR(100), -- Business category
  status VARCHAR(50) DEFAULT 'approved', -- approved, pending, suspended
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed
  template_strategy VARCHAR(50) DEFAULT 'single_template', -- single_template, random_template, even_rotation, weighted_ab_test
  audience_filters JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  cta_type VARCHAR(50) DEFAULT 'none', -- none, link, reply, call
  cta_value TEXT,
  is_active BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 1, -- for weighted A/B testing
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAQ answers table (must exist before conversation_messages references it)
CREATE TABLE IF NOT EXISTS faq_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_keywords TEXT[] NOT NULL, -- array of keywords to match
  answer TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_send BOOLEAN DEFAULT false, -- whether to auto-send or just suggest
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign templates junction table
CREATE TABLE IF NOT EXISTS campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, template_id)
);

-- Messages queue table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  template_id UUID REFERENCES message_templates(id),
  business_id UUID, -- can reference any business table
  business_name VARCHAR(255),
  category VARCHAR(255),
  city VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  rendered_message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, delivered, read
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  nabda_message_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation messages (inbox) - created after faq_answers exists
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(50) NOT NULL,
  business_id UUID,
  business_name VARCHAR(255),
  direction VARCHAR(20) NOT NULL, -- inbound, outbound
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, image, document, etc.
  media_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_auto_reply BOOLEAN DEFAULT false,
  auto_reply_triggered_by UUID REFERENCES faq_answers(id),
  replied_by VARCHAR(255), -- user email or 'system'
  parent_message_id UUID REFERENCES messages(id),
  nabda_message_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template performance stats (for A/B testing)
CREATE TABLE IF NOT EXISTS template_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, campaign_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_governorate ON businesses(governorate);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_phone ON conversation_messages(phone);
CREATE INDEX IF NOT EXISTS idx_conversation_created_at ON conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_direction ON conversation_messages(direction);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_campaign_id ON campaign_templates(campaign_id);

-- Enable RLS (Row Level Security) - adjust policies as needed
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service role (backend access)
DROP POLICY IF EXISTS "service_role_full_access_businesses" ON businesses;
CREATE POLICY "service_role_full_access_businesses" ON businesses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_campaigns" ON campaigns;
CREATE POLICY "service_role_full_access_campaigns" ON campaigns
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_message_templates" ON message_templates;
CREATE POLICY "service_role_full_access_message_templates" ON message_templates
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_campaign_templates" ON campaign_templates;
CREATE POLICY "service_role_full_access_campaign_templates" ON campaign_templates
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_messages" ON messages;
CREATE POLICY "service_role_full_access_messages" ON messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_conversation_messages" ON conversation_messages;
CREATE POLICY "service_role_full_access_conversation_messages" ON conversation_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_faq_answers" ON faq_answers;
CREATE POLICY "service_role_full_access_faq_answers" ON faq_answers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_template_stats" ON template_stats;
CREATE POLICY "service_role_full_access_template_stats" ON template_stats
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers (safe with IF NOT EXISTS approach)
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates;
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_faq_answers_updated_at ON faq_answers;
CREATE TRIGGER update_faq_answers_updated_at
  BEFORE UPDATE ON faq_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_template_stats_updated_at ON template_stats;
CREATE TRIGGER update_template_stats_updated_at
  BEFORE UPDATE ON template_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
