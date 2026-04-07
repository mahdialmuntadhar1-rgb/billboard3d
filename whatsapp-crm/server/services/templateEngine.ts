/**
 * Template Engine - Handles placeholder replacement and template selection strategies
 */

import { MessageTemplate } from './supabase';

export interface RenderContext {
  business_name?: string;
  city?: string;
  category?: string;
  [key: string]: any;
}

/**
 * Replace placeholders in template body with actual values
 * Supports: {{business_name}}, {{city}}, {{category}}
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

/**
 * Template selection strategies for A/B testing and rotation
 */
export type TemplateStrategy = 'single_template' | 'random_template' | 'even_rotation' | 'weighted_ab_test';

interface TemplateSelectionState {
  lastIndex: number;
  totalSent: number;
}

// In-memory state for rotation (in production, use Redis or database)
const rotationState: Map<string, TemplateSelectionState> = new Map();

/**
 * Select a template based on the specified strategy
 */
export function selectTemplate(
  templates: MessageTemplate[],
  strategy: TemplateStrategy,
  campaignId: string
): MessageTemplate | null {
  if (!templates.length) return null;
  
  if (templates.length === 1 || strategy === 'single_template') {
    return templates[0];
  }
  
  switch (strategy) {
    case 'random_template':
      return templates[Math.floor(Math.random() * templates.length)];
    
    case 'even_rotation': {
      const state = rotationState.get(campaignId) || { lastIndex: -1, totalSent: 0 };
      const nextIndex = (state.lastIndex + 1) % templates.length;
      rotationState.set(campaignId, { lastIndex: nextIndex, totalSent: state.totalSent + 1 });
      return templates[nextIndex];
    }
    
    case 'weighted_ab_test': {
      const totalWeight = templates.reduce((sum, t) => sum + (t.weight || 1), 0);
      let random = Math.random() * totalWeight;
      
      for (const template of templates) {
        random -= (template.weight || 1);
        if (random <= 0) {
          return template;
        }
      }
      return templates[templates.length - 1];
    }
    
    default:
      return templates[0];
  }
}

/**
 * Preview multiple templates with context
 */
export function previewTemplates(
  templates: MessageTemplate[],
  context: RenderContext
): Array<{ template: MessageTemplate; preview: string }> {
  return templates.map(template => ({
    template,
    preview: renderTemplate(template, context),
  }));
}

/**
 * Validate template for required placeholders
 */
export function validateTemplate(template: MessageTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!template.name?.trim()) {
    errors.push('Template name is required');
  }
  
  if (!template.body?.trim()) {
    errors.push('Template body is required');
  }
  
  if (template.body.length > 4096) {
    errors.push('Template body exceeds 4096 characters (WhatsApp limit)');
  }
  
  // Check for unsupported placeholders
  const supportedPlaceholders = ['business_name', 'city', 'category'];
  const allPlaceholders = template.body.match(/\{\{([^}]+)\}\}/g) || [];
  
  allPlaceholders.forEach(placeholder => {
    const key = placeholder.replace(/\{\{|\}\}/g, '');
    if (!supportedPlaceholders.includes(key)) {
      errors.push(`Unsupported placeholder: ${placeholder}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
