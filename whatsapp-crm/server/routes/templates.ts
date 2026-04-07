import { Router } from 'express';
import { supabase, MessageTemplate } from '../services/supabase';
import { validateTemplate } from '../services/templateEngine';

const router = Router();

// GET /api/templates - List all templates
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    
    let query = supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ templates: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates - Create new template
router.post('/', async (req, res) => {
  try {
    const { name, body, cta_type, cta_value, weight, is_active } = req.body;
    
    const template: Partial<MessageTemplate> = {
      name,
      body,
      cta_type: cta_type || 'none',
      cta_value,
      weight: weight || 1,
      is_active: is_active ?? true,
    };
    
    // Validate
    const validation = validateTemplate(template as MessageTemplate);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }
    
    const { data, error } = await supabase
      .from('message_templates')
      .insert(template)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ template: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/templates/:id - Get single template
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, body, cta_type, cta_value, weight, is_active } = req.body;
    
    const update: Partial<MessageTemplate> = {
      name,
      body,
      cta_type,
      cta_value,
      weight,
      is_active,
    };
    
    // Remove undefined values
    Object.keys(update).forEach(key => {
      if (update[key as keyof MessageTemplate] === undefined) {
        delete update[key as keyof MessageTemplate];
      }
    });
    
    const { data, error } = await supabase
      .from('message_templates')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ template: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates/:id/activate - Activate/deactivate template
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const { data, error } = await supabase
      .from('message_templates')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ template: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates/validate - Validate template body
router.post('/validate', async (req, res) => {
  try {
    const { name, body, cta_type, cta_value } = req.body;
    
    const template: Partial<MessageTemplate> = {
      name,
      body,
      cta_type,
      cta_value,
    };
    
    const validation = validateTemplate(template as MessageTemplate);
    
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
