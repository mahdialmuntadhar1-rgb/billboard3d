// Simple template engine for frontend preview
export interface RenderContext {
  business_name?: string;
  city?: string;
  category?: string;
  [key: string]: any;
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

/**
 * Replace placeholders in template body (frontend version)
 */
export function renderTemplate(template: MessageTemplate, context: RenderContext): string {
  let rendered = template.body;
  
  // Replace known placeholders
  rendered = rendered.replace(/\{\{business_name\}\}/g, context.business_name || 'there');
  rendered = rendered.replace(/\{\{city\}\}/g, context.city || 'your city');
  rendered = rendered.replace(/\{\{category\}\}/g, context.category || 'your business');
  
  // Replace any additional context variables
  Object.keys(context).forEach(key => {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    rendered = rendered.replace(regex, String(context[key] || ''));
  });
  
  // Clean up any remaining unknown placeholders
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');
  
  // Add CTA if present
  if (template.cta_type !== 'none' && template.cta_value) {
    switch (template.cta_type) {
      case 'link':
        rendered += `\n\n${template.cta_value}`;
        break;
      case 'reply':
        rendered += `\n\nReply with: ${template.cta_value}`;
        break;
      case 'call':
        rendered += `\n\nCall us: ${template.cta_value}`;
        break;
    }
  }
  
  return rendered.trim();
}
