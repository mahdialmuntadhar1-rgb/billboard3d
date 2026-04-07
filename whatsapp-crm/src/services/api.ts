import { Campaign, MessageTemplate, ConversationMessage, FAQAnswer } from '../types';

const API_BASE = '/api';

// Campaigns API
export const campaignsApi = {
  list: async (): Promise<{ campaigns: Campaign[] }> => {
    const res = await fetch(`${API_BASE}/campaigns`);
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  },

  get: async (id: string): Promise<{ campaign: Campaign; templates: MessageTemplate[] }> => {
    const res = await fetch(`${API_BASE}/campaigns/${id}`);
    if (!res.ok) throw new Error('Failed to fetch campaign');
    return res.json();
  },

  create: async (data: Partial<Campaign> & { template_ids: string[] }): Promise<{ campaign: Campaign }> => {
    const res = await fetch(`${API_BASE}/campaigns/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create campaign');
    return res.json();
  },

  update: async (id: string, data: Partial<Campaign>): Promise<{ campaign: Campaign }> => {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update campaign');
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete campaign');
  },

  getStats: async (id: string): Promise<{ stats: any }> => {
    const res = await fetch(`${API_BASE}/campaigns/${id}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },
};

// Templates API
export const templatesApi = {
  list: async (filters?: { is_active?: boolean }): Promise<{ templates: MessageTemplate[] }> => {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
    const res = await fetch(`${API_BASE}/templates?${params}`);
    if (!res.ok) throw new Error('Failed to fetch templates');
    return res.json();
  },

  get: async (id: string): Promise<{ template: MessageTemplate }> => {
    const res = await fetch(`${API_BASE}/templates/${id}`);
    if (!res.ok) throw new Error('Failed to fetch template');
    return res.json();
  },

  create: async (data: Partial<MessageTemplate>): Promise<{ template: MessageTemplate }> => {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create template');
    return res.json();
  },

  update: async (id: string, data: Partial<MessageTemplate>): Promise<{ template: MessageTemplate }> => {
    const res = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update template');
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete template');
  },

  activate: async (id: string, is_active: boolean): Promise<{ template: MessageTemplate }> => {
    const res = await fetch(`${API_BASE}/templates/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) throw new Error('Failed to activate template');
    return res.json();
  },

  validate: async (data: Partial<MessageTemplate>): Promise<{ valid: boolean; errors: string[] }> => {
    const res = await fetch(`${API_BASE}/templates/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to validate template');
    return res.json();
  },
};

// Messages API
export const messagesApi = {
  getStatus: async (): Promise<{ stats: any }> => {
    const res = await fetch(`${API_BASE}/messages/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },

  queue: async (campaignId: string, businesses: any[]): Promise<{ queued: number; messages: any[] }> => {
    const res = await fetch(`${API_BASE}/messages/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, businesses }),
    });
    if (!res.ok) throw new Error('Failed to queue messages');
    return res.json();
  },

  send: async (limit: number = 10, campaignId?: string): Promise<{ sent: number; failed: number; results: any[] }> => {
    const res = await fetch(`${API_BASE}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, campaign_id: campaignId }),
    });
    if (!res.ok) throw new Error('Failed to send messages');
    return res.json();
  },

  getPending: async (campaignId?: string): Promise<{ pending: number }> => {
    const params = campaignId ? `?campaign_id=${campaignId}` : '';
    const res = await fetch(`${API_BASE}/messages/pending${params}`);
    if (!res.ok) throw new Error('Failed to fetch pending count');
    return res.json();
  },
};

// Inbox API
export const inboxApi = {
  list: async (filters?: { unread_only?: boolean; limit?: number }): Promise<{ conversations: any[]; total: number }> => {
    const params = new URLSearchParams();
    if (filters?.unread_only) params.set('unread_only', 'true');
    if (filters?.limit) params.set('limit', String(filters.limit));
    const res = await fetch(`${API_BASE}/inbox?${params}`);
    if (!res.ok) throw new Error('Failed to fetch inbox');
    return res.json();
  },

  getConversation: async (phone: string): Promise<{ phone: string; messages: ConversationMessage[]; business_name?: string }> => {
    const res = await fetch(`${API_BASE}/inbox/conversation/${encodeURIComponent(phone)}`);
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return res.json();
  },

  reply: async (phone: string, content: string, repliedBy?: string): Promise<{ message: ConversationMessage }> => {
    const res = await fetch(`${API_BASE}/inbox/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, content, replied_by: repliedBy }),
    });
    if (!res.ok) throw new Error('Failed to send reply');
    return res.json();
  },

  suggest: async (incomingMessage: string): Promise<{ suggestion: any; has_match: boolean }> => {
    const res = await fetch(`${API_BASE}/inbox/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incoming_message: incomingMessage }),
    });
    if (!res.ok) throw new Error('Failed to get suggestion');
    return res.json();
  },

  getUnreadCount: async (): Promise<{ unread: number }> => {
    const res = await fetch(`${API_BASE}/inbox/stats/unread`);
    if (!res.ok) throw new Error('Failed to fetch unread count');
    return res.json();
  },

  markRead: async (phone: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/inbox/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) throw new Error('Failed to mark as read');
  },
};
