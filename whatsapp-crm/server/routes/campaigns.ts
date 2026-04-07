import { Router } from 'express';
import { supabase, Campaign, CampaignTemplate } from '../services/supabase';

const router = Router();

// GET /api/campaigns - List all campaigns
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ campaigns: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns/create - Create new campaign
router.post('/create', async (req, res) => {
  try {
    const { name, description, template_strategy, audience_filters, template_ids } = req.body;
    
    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        name,
        description,
        template_strategy: template_strategy || 'single_template',
        audience_filters: audience_filters || {},
        status: 'draft',
      })
      .select()
      .single();
    
    if (campaignError) throw campaignError;
    
    // Link templates
    if (template_ids && template_ids.length > 0) {
      const campaignTemplates = template_ids.map((templateId: string) => ({
        campaign_id: campaign.id,
        template_id: templateId,
      }));
      
      const { error: linkError } = await supabase
        .from('campaign_templates')
        .insert(campaignTemplates);
      
      if (linkError) throw linkError;
    }
    
    res.json({ campaign });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/campaigns/:id - Get campaign with templates
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();
    
    if (campaignError) throw campaignError;
    
    const { data: templates, error: templatesError } = await supabase
      .from('campaign_templates')
      .select('template_id, message_templates(*)')
      .eq('campaign_id', id);
    
    if (templatesError) throw templatesError;
    
    res.json({ 
      campaign, 
      templates: templates?.map((t: any) => t.message_templates) || [] 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/campaigns/:id - Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, template_strategy, audience_filters, status } = req.body;
    
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        name,
        description,
        template_strategy,
        audience_filters,
        status,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ campaign: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/campaigns/:id/stats - Get campaign statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('status, template_id')
      .eq('campaign_id', id);
    
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

export default router;
