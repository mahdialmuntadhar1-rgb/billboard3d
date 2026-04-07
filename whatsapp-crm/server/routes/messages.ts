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
    const { campaign_id, businesses, test_message_type, landing_page_variant, recipient_count } = req.body;
    
    console.log('[messages/queue] Queue request:', { 
      campaign_id, 
      businessCount: businesses?.length,
      test_message_type,
      landing_page_variant,
      recipient_count
    });
    
    if (!businesses || businesses.length === 0) {
      return res.status(400).json({ error: 'No businesses provided for queuing' });
    }
    
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
    
    // Get internal test phone from config
    const internalTestPhone = process.env.INTERNAL_TEST_PHONE?.trim();
    const includeInternalTest = internalTestPhone && internalTestPhone.length > 0;
    
    // Track phones for duplicate prevention
    const queuedPhones = new Set<string>();
    
    // Generate messages for each business
    const messagesToInsert = [];
    
    // Safety logging
    console.log('[messages/queue] SAFETY LOG:', {
      requestedRecipientCount: recipient_count || businesses.length,
      providedBusinesses: businesses.length,
      internalTestPhone: includeInternalTest ? 'CONFIGURED' : 'NOT CONFIGURED',
      includeInternalTest
    });
    
    for (const business of businesses) {
      // Skip if this phone is already queued (duplicate prevention)
      if (queuedPhones.has(business.selectedPhone)) {
        console.log(`[messages/queue] Duplicate prevention: skipping ${business.selectedPhone}`);
        continue;
      }
      
      // Mark phone as queued
      queuedPhones.add(business.selectedPhone);
      
      // Determine recipient source and traceability
      const isInternalTest = business.selectedPhoneField === 'internal_test' || 
                            (includeInternalTest && business.selectedPhone === internalTestPhone);
      const isManualTest = business.selectedPhoneField === 'manual_test';
      
      const recipientSource = isInternalTest ? 'internal_test' : 
                             isManualTest ? 'manual_test' : 'filtered_audience';
      
      // Select template based on strategy
      const template = selectTemplate(templates, campaign.template_strategy, campaign_id);
      if (!template) continue;
      
      // Render message
      const context = {
        business_name: business.business_name || business.name,
        city: business.city,
        category: business.category,
        governorate: business.governorate,
      };
      const renderedMessage = renderTemplate(template, context);
      
      messagesToInsert.push({
        campaign_id,
        template_id: template.id,
        business_id: business.id,
        business_name: business.business_name || business.name,
        category: business.category,
        city: business.city,
        phone: business.selectedPhone,
        rendered_message: renderedMessage,
        status: 'pending',
        // Traceability fields
        is_internal_test: isInternalTest,
        recipient_source: recipientSource,
        message_mode: test_message_type || 'informative',
        landing_page_variant: landing_page_variant || 'app_intro',
        metadata: {
          original_phone_field: business.selectedPhoneField,
          template_strategy: campaign.template_strategy,
          recipient_count_limit: recipient_count,
          landing_variant: landing_page_variant
        }
      });
    }
    
    // Add internal test phone if not already included
    if (includeInternalTest && !queuedPhones.has(internalTestPhone)) {
      console.log(`[messages/queue] Adding internal test phone: ${internalTestPhone}`);
      
      const template = selectTemplate(templates, campaign.template_strategy, campaign_id);
      if (template) {
        const renderedMessage = renderTemplate(template, {
          business_name: 'اختبار داخلي',
          city: 'اختبار',
          category: 'اختبار',
          governorate: 'اختبار',
        });
        
        messagesToInsert.push({
          campaign_id,
          template_id: template.id,
          business_id: 'internal-test',
          business_name: 'اختبار داخلي (Internal Test)',
          category: 'اختبار',
          city: 'اختبار',
          phone: internalTestPhone,
          rendered_message: renderedMessage,
          status: 'pending',
          is_internal_test: true,
          recipient_source: 'internal_test',
          message_mode: test_message_type || 'informative',
          landing_page_variant: landing_page_variant || 'app_intro',
          metadata: {
            original_phone_field: 'internal_test_config',
            template_strategy: campaign.template_strategy,
            recipient_count_limit: recipient_count,
            auto_added: true,
            landing_variant: landing_page_variant
          }
        });
      }
    }
    
    // Final safety logging
    console.log('[messages/queue] SAFETY LOG - FINAL:', {
      totalMessagesToInsert: messagesToInsert.length,
      internalTestMessages: messagesToInsert.filter(m => m.is_internal_test).length,
      filteredAudienceMessages: messagesToInsert.filter(m => m.recipient_source === 'filtered_audience').length,
      manualTestMessages: messagesToInsert.filter(m => m.recipient_source === 'manual_test').length,
      uniquePhones: queuedPhones.size,
      internalTestPhoneIncluded: includeInternalTest
    });
    
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
      messages,
      safety_summary: {
        total_queued: messages?.length || 0,
        internal_test_count: messagesToInsert.filter(m => m.is_internal_test).length,
        filtered_audience_count: messagesToInsert.filter(m => m.recipient_source === 'filtered_audience').length,
        manual_test_count: messagesToInsert.filter(m => m.recipient_source === 'manual_test').length
      }
    });
    
  } catch (error: any) {
    console.error('[messages/queue] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages/send - Send a batch of pending messages
router.post('/send', async (req, res) => {
  try {
    const { limit = 10, campaign_id } = req.body;
    
    console.log(`[messages/send] Starting send process - limit: ${limit}, campaign: ${campaign_id || 'all'}`);
    
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
    
    if (error) {
      console.error('[messages/send] Database error fetching pending messages:', error);
      throw error;
    }
    
    if (!messages || messages.length === 0) {
      console.log('[messages/send] No pending messages found');
      return res.json({ sent: 0, failed: 0, results: [] });
    }
    
    console.log(`[messages/send] Found ${messages.length} pending messages to process`);
    
    // Log message details before sending
    messages.forEach((message, index) => {
      console.log(`[messages/send] Message ${index + 1}/${messages.length}:`, {
        id: message.id,
        business_name: message.business_name,
        phone: message.phone,
        campaign_id: message.campaign_id,
        template_id: message.template_id,
        message_preview: message.rendered_message.substring(0, 50) + '...'
      });
    });
    
    // Send messages with rate limiting
    const results = [];
    let processedCount = 0;
    
    for (const message of messages) {
      processedCount++;
      console.log(`[messages/send] Processing message ${processedCount}/${messages.length} (${message.id})`);
      
      // Validate phone number
      if (!isValidPhoneNumber(message.phone)) {
        console.log(`[messages/send] Invalid phone number for ${message.business_name}: ${message.phone}`);
        
        const { error: updateError } = await supabase
          .from('messages')
          .update({ 
            status: 'failed', 
            error_message: 'Invalid phone number',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (updateError) {
          console.error(`[messages/send] Failed to update failed status for message ${message.id}:`, updateError);
        } else {
          console.log(`[messages/send] Updated message ${message.id} to failed status (invalid phone)`);
        }
        
        results.push({ id: message.id, success: false, error: 'Invalid phone number' });
        continue;
      }
      
      console.log(`[messages/send] Phone validation passed for ${message.business_name}: ${message.phone}`);
      
      // Send via Nabda
      console.log(`[messages/send] Sending message to ${message.business_name} via Nabda...`);
      const startTime = Date.now();
      
      const sendResult = await sendMessage(message.phone, message.rendered_message);
      
      const sendDuration = Date.now() - startTime;
      console.log(`[messages/send] Nabda API call completed in ${sendDuration}ms for ${message.business_name}:`, {
        success: sendResult.success,
        messageId: sendResult.messageId,
        error: sendResult.error
      });
      
      if (sendResult.success) {
        console.log(`[messages/send] Message sent successfully to ${message.business_name}, Nabda ID: ${sendResult.messageId}`);
        
        const { error: updateError } = await supabase
          .from('messages')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            nabda_message_id: sendResult.messageId,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (updateError) {
          console.error(`[messages/send] Failed to update sent status for message ${message.id}:`, updateError);
        } else {
          console.log(`[messages/send] Updated message ${message.id} to sent status`);
        }
        
        results.push({ id: message.id, success: true, messageId: sendResult.messageId });
      } else {
        console.log(`[messages/send] Message send failed for ${message.business_name}: ${sendResult.error}`);
        
        const { error: updateError } = await supabase
          .from('messages')
          .update({ 
            status: 'failed', 
            error_message: sendResult.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (updateError) {
          console.error(`[messages/send] Failed to update failed status for message ${message.id}:`, updateError);
        } else {
          console.log(`[messages/send] Updated message ${message.id} to failed status`);
        }
        
        results.push({ id: message.id, success: false, error: sendResult.error });
      }
      
      // Rate limit: 1 message per 4 seconds (~15/minute)
      if (processedCount < messages.length) {
        console.log(`[messages/send] Rate limiting: waiting 4000ms before next message...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }
    
    const sentCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[messages/send] Send process completed:`, {
      total: messages.length,
      sent: sentCount,
      failed: failedCount,
      campaign_id: campaign_id || 'all'
    });
    
    // Log final results summary
    results.forEach((result, index) => {
      console.log(`[messages/send] Result ${index + 1}:`, {
        messageId: result.id,
        success: result.success,
        nabdaMessageId: result.messageId,
        error: result.error
      });
    });
    
    res.json({ 
      sent: sentCount,
      failed: failedCount,
      results 
    });
    
  } catch (error: any) {
    console.error('[messages/send] Critical error in send process:', error);
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
