import { Router } from 'express';
import { supabase } from '../services/supabase';
import { findBestFAQMatch } from '../services/faqEngine';
import { sendMessage } from '../services/nabda';

const router = Router();

// POST /api/webhook/nabda - Handle incoming WhatsApp messages from Nabda
router.post('/nabda', async (req, res) => {
  try {
    const { 
      message_id,
      from, 
      body, 
      timestamp,
      type = 'text',
      media_url,
    } = req.body;
    
    // Normalize phone number
    const phone = from.startsWith('+') ? from : `+${from}`;
    
    // Check if this is a reply to an existing message
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, campaign_id, business_id, business_name')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const businessId = existingMessage?.[0]?.business_id;
    const businessName = existingMessage?.[0]?.business_name;
    const parentMessageId = existingMessage?.[0]?.id;
    
    // Store incoming message
    const { data: conversationMsg, error } = await supabase
      .from('conversation_messages')
      .insert({
        phone,
        business_id: businessId,
        business_name: businessName,
        direction: 'inbound',
        content: body,
        message_type: type,
        media_url,
        is_read: false,
        nabda_message_id: message_id,
        parent_message_id: parentMessageId,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Check for FAQ auto-reply
    const { data: faqs } = await supabase
      .from('faq_answers')
      .select('*')
      .eq('is_active', true);
    
    const match = findBestFAQMatch(body, faqs || [], 0.5);
    
    let autoReply = null;
    if (match && match.faq.auto_send) {
      // Send auto-reply
      const sendResult = await sendMessage(phone, match.faq.answer);
      
      if (sendResult.success) {
        // Store auto-reply
        const { data: autoReplyMsg } = await supabase
          .from('conversation_messages')
          .insert({
            phone,
            business_id: businessId,
            business_name: businessName,
            direction: 'outbound',
            content: match.faq.answer,
            message_type: 'text',
            is_read: true,
            is_auto_reply: true,
            auto_reply_triggered_by: match.faq.id,
            replied_by: 'system',
            nabda_message_id: sendResult.messageId,
            parent_message_id: conversationMsg.id,
          })
          .select()
          .single();
        
        autoReply = autoReplyMsg;
        
        // Update FAQ usage count
        await supabase
          .from('faq_answers')
          .update({ usage_count: match.faq.usage_count + 1 })
          .eq('id', match.faq.id);
      }
    }
    
    // Update message status if this is a status update
    if (req.body.status && req.body.original_message_id) {
      const status = req.body.status; // delivered, read, failed
      const update: any = {};
      
      if (status === 'delivered') {
        update.status = 'delivered';
        update.delivered_at = new Date().toISOString();
      } else if (status === 'read') {
        update.status = 'read';
        update.read_at = new Date().toISOString();
      } else if (status === 'failed') {
        update.status = 'failed';
        update.error_message = req.body.error || 'Delivery failed';
      }
      
      if (Object.keys(update).length > 0) {
        await supabase
          .from('messages')
          .update(update)
          .eq('nabda_message_id', req.body.original_message_id);
      }
    }
    
    res.json({ 
      received: true, 
      conversation_id: conversationMsg.id,
      auto_reply: autoReply,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/webhook/nabda - Webhook verification (for setup)
router.get('/nabda', (req, res) => {
  // Nabda may require webhook verification
  // Return the challenge if provided
  const challenge = req.query.challenge;
  if (challenge) {
    res.send(challenge);
  } else {
    res.json({ status: 'webhook endpoint active' });
  }
});

// POST /api/webhook/status - Message status updates
router.post('/status', async (req, res) => {
  try {
    const { message_id, status, timestamp, error: errorMsg } = req.body;
    
    const update: any = {};
    
    if (status === 'delivered') {
      update.status = 'delivered';
      update.delivered_at = timestamp || new Date().toISOString();
    } else if (status === 'read') {
      update.status = 'read';
      update.read_at = timestamp || new Date().toISOString();
    } else if (status === 'failed') {
      update.status = 'failed';
      update.error_message = errorMsg || 'Delivery failed';
    }
    
    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from('messages')
        .update(update)
        .eq('nabda_message_id', message_id);
      
      if (error) throw error;
    }
    
    res.json({ processed: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
