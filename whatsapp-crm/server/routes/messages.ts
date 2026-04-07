import { Router } from 'express';
import { supabase, Message, MessageTemplate } from '../services/supabase';
import { sendMessage, isValidPhoneNumber } from '../services/nabda';
import { renderTemplate, selectTemplate } from '../services/templateEngine';

const router = Router();

// GET /api/messages/status - Get queue status
router.get('/status', async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('status')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const stats = {
      total: messages?.length || 0,
      pending: messages?.filter(m => m.status === 'pending').length || 0,
      sent: messages?.filter(m => m.status === 'sent').length || 0,
      delivered: messages?.filter(m => m.status === 'delivered').length || 0,
      read: messages?.filter(m => m.status === 'read').length || 0,
      failed: messages?.filter(m => m.status === 'failed').length || 0,
    };
    
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages/queue - Queue messages for a campaign
router.post('/queue', async (req, res) => {
  try {
    const { campaign_id, businesses } = req.body;
    
    // Get campaign with templates
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, campaign_templates(template_id, message_templates(*))')
      .eq('id', campaign_id)
      .single();
    
    if (campaignError) throw campaignError;
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const templates: MessageTemplate[] = campaign.campaign_templates
      ?.map((ct: any) => ct.message_templates)
      .filter(Boolean) || [];
    
    if (templates.length === 0) {
      return res.status(400).json({ error: 'No templates linked to campaign' });
    }
    
    // Generate messages for each business
    const messagesToInsert = [];
    
    // Testing mode: if no businesses provided, create test message
    if (!businesses || businesses.length === 0) {
      // Select template based on strategy
      const template = selectTemplate(templates, campaign.template_strategy, campaign_id);
      if (template) {
        // Render message with test data
        const context = {
          business_name: 'Test Business',
          city: 'Baghdad',
          category: 'Technology',
        };
        const renderedMessage = renderTemplate(template, context);
        
        messagesToInsert.push({
          campaign_id,
          template_id: template.id,
          business_id: null,
          business_name: 'Test Business',
          category: 'Technology',
          city: 'Baghdad',
          phone: '9647701995386',
          rendered_message: renderedMessage,
          status: 'pending',
        });
      }
    } else {
      // Normal mode: process provided businesses
      for (const business of businesses) {
        // Select template based on strategy
        const template = selectTemplate(templates, campaign.template_strategy, campaign_id);
        if (!template) continue;
        
        // Render message
        const context = {
          business_name: business.name,
          city: business.city,
          category: business.category,
        };
        const renderedMessage = renderTemplate(template, context);
        
        messagesToInsert.push({
          campaign_id,
          template_id: template.id,
          business_id: business.id,
          business_name: business.name,
          category: business.category,
          city: business.city,
          phone: business.phone,
          rendered_message: renderedMessage,
          status: 'pending',
        });
      }
    }
    
    // Insert messages
    const { data: messages, error: insertError } = await supabase
      .from('messages')
      .insert(messagesToInsert)
      .select();
    
    if (insertError) throw insertError;
    
    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaign_id);
    
    res.json({ 
      queued: messages?.length || 0,
      messages 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages/send - Send a batch of pending messages
router.post('/send', async (req, res) => {
  try {
    const { limit = 10, campaign_id } = req.body;
    
    // Fetch pending messages
    let query = supabase
      .from('messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    if (!messages || messages.length === 0) {
      return res.json({ sent: 0, results: [] });
    }
    
    // Send messages with rate limiting
    const results = [];
    for (const message of messages) {
      if (!isValidPhoneNumber(message.phone)) {
        await supabase
          .from('messages')
          .update({ status: 'failed', error_message: 'Invalid phone number' })
          .eq('id', message.id);
        
        results.push({ id: message.id, success: false, error: 'Invalid phone number' });
        continue;
      }
      
      // Send via Nabda
      const sendResult = await sendMessage(message.phone, message.rendered_message);
      
      if (sendResult.success) {
        await supabase
          .from('messages')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            nabda_message_id: sendResult.messageId 
          })
          .eq('id', message.id);
        
        results.push({ id: message.id, success: true, messageId: sendResult.messageId });
      } else {
        await supabase
          .from('messages')
          .update({ 
            status: 'failed', 
            error_message: sendResult.error 
          })
          .eq('id', message.id);
        
        results.push({ id: message.id, success: false, error: sendResult.error });
      }
      
      // Rate limit: 1 message per 4 seconds (~15/minute)
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }
    
    res.json({ 
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/messages/pending - Get pending message count
router.get('/pending', async (req, res) => {
  try {
    const { campaign_id } = req.query;
    
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('status', 'pending');
    
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }
    
    const { count, error } = await query;
    
    if (error) throw error;
    
    res.json({ pending: count || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
