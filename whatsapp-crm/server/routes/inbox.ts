import { Router } from 'express';
import { supabase, ConversationMessage } from '../services/supabase';
import { sendMessage } from '../services/nabda';
import { findBestFAQMatch } from '../services/faqEngine';

const router = Router();

// GET /api/inbox - List conversations grouped by phone
router.get('/', async (req, res) => {
  try {
    const { limit = 50, unread_only } = req.query;
    
    // Get latest message per phone for conversation list
    const { data: messages, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Group by phone
    const conversations = new Map();
    messages?.forEach((msg: ConversationMessage) => {
      if (!conversations.has(msg.phone)) {
        conversations.set(msg.phone, {
          phone: msg.phone,
          business_id: msg.business_id,
          business_name: msg.business_name,
          last_message: msg,
          unread_count: 0,
          messages: [],
        });
      }
      
      const conv = conversations.get(msg.phone);
      conv.messages.push(msg);
      if (!msg.is_read && msg.direction === 'inbound') {
        conv.unread_count++;
      }
    });
    
    let result = Array.from(conversations.values());
    
    if (unread_only === 'true') {
      result = result.filter(c => c.unread_count > 0);
    }
    
    // Sort by last message time
    result.sort((a, b) => 
      new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
    );
    
    res.json({ 
      conversations: result.slice(0, Number(limit)),
      total: result.length 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inbox/:phone - Get conversation for specific phone
router.get('/conversation/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const { data: messages, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Mark as read
    await supabase
      .from('conversation_messages')
      .update({ is_read: true })
      .eq('phone', phone)
      .eq('direction', 'inbound')
      .eq('is_read', false);
    
    res.json({ 
      phone,
      messages: messages || [],
      business_name: messages?.[0]?.business_name 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/inbox/reply - Send reply to conversation
router.post('/reply', async (req, res) => {
  try {
    const { phone, content, replied_by } = req.body;
    
    if (!phone || !content) {
      return res.status(400).json({ error: 'Phone and content are required' });
    }
    
    // Send via Nabda
    const sendResult = await sendMessage(phone, content);
    
    if (!sendResult.success) {
      return res.status(500).json({ error: sendResult.error || 'Failed to send message' });
    }
    
    // Store in database
    const { data: message, error } = await supabase
      .from('conversation_messages')
      .insert({
        phone,
        content,
        direction: 'outbound',
        message_type: 'text',
        is_read: true,
        replied_by: replied_by || 'user',
        nabda_message_id: sendResult.messageId,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/inbox/suggest - Get FAQ suggestion for reply
router.post('/suggest', async (req, res) => {
  try {
    const { incoming_message } = req.body;
    
    // Get all active FAQs
    const { data: faqs, error } = await supabase
      .from('faq_answers')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    const match = findBestFAQMatch(incoming_message, faqs || [], 0.3);
    
    res.json({
      suggestion: match,
      has_match: !!match,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inbox/unread-count - Get total unread count
router.get('/stats/unread', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact' })
      .eq('direction', 'inbound')
      .eq('is_read', false);
    
    if (error) throw error;
    
    res.json({ unread: count || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/inbox/mark-read - Mark conversation as read
router.post('/mark-read', async (req, res) => {
  try {
    const { phone } = req.body;
    
    const { error } = await supabase
      .from('conversation_messages')
      .update({ is_read: true })
      .eq('phone', phone)
      .eq('direction', 'inbound');
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
