import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Play, Pause, BarChart3, Filter, Check, X } from 'lucide-react';
import { campaignsApi, templatesApi } from '../services/api';
import { Campaign, MessageTemplate, Business } from '../types';

const TEMPLATE_STRATEGIES = [
  { value: 'single_template', label: 'Single Template', description: 'Use one template for all messages' },
  { value: 'random_template', label: 'Random Selection', description: 'Randomly pick from available templates' },
  { value: 'even_rotation', label: 'Even Rotation', description: 'Rotate through templates equally' },
  { value: 'weighted_ab_test', label: 'Weighted A/B Test', description: 'Test templates with custom weights' },
];

// Mock business data - replace with actual API
const MOCK_BUSINESSES: Business[] = [
  { id: '1', name: 'Al-Mansour Restaurant', phone: '+9647701234567', city: 'Baghdad', category: 'Restaurant' },
  { id: '2', name: 'Tech Solutions Ltd', phone: '+9647707654321', city: 'Basra', category: 'Technology' },
  { id: '3', name: 'Al-Rasheed Pharmacy', phone: '+9647709876543', city: 'Mosul', category: 'Healthcare' },
];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template_strategy: 'single_template',
    selectedTemplates: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [campaignsRes, templatesRes] = await Promise.all([
        campaignsApi.list(),
        templatesApi.list({ is_active: true }),
      ]);
      setCampaigns(campaignsRes.campaigns);
      setTemplates(templatesRes.templates);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedTemplates.length === 0) {
      alert('Please select at least one template');
      return;
    }

    setSaving(true);
    try {
      await campaignsApi.create({
        name: formData.name,
        description: formData.description,
        template_strategy: formData.template_strategy as any,
        template_ids: formData.selectedTemplates,
      });
      
      setShowCreateModal(false);
      setFormData({ name: '', description: '', template_strategy: 'single_template', selectedTemplates: [] });
      loadData();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await campaignsApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const handleQueueMessages = async () => {
    if (!selectedCampaign) return;
    
    setSaving(true);
    try {
      // In production, fetch actual businesses based on audience_filters
      await campaignsApi.create({
        ...selectedCampaign,
        template_ids: [],
      });
      
      // Queue messages for the businesses
      // This is a mock - in production you'd fetch actual filtered businesses
      await import('../services/api').then(({ messagesApi }) => 
        messagesApi.queue(selectedCampaign.id, MOCK_BUSINESSES)
      );
      
      setShowQueueModal(false);
      alert(`Queued ${MOCK_BUSINESSES.length} messages`);
    } catch (error) {
      console.error('Failed to queue messages:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.includes(id)
        ? prev.selectedTemplates.filter(t => t !== id)
        : [...prev.selectedTemplates, id]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600 mt-1">Manage your outreach campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No campaigns yet. Create your first campaign to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{campaign.description || 'No description'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Strategy: {TEMPLATE_STRATEGIES.find(s => s.value === campaign.template_strategy)?.label}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelectedCampaign(campaign); setShowQueueModal(true); }}
                    className="p-2 text-whatsapp-green hover:bg-green-50 rounded-lg"
                    title="Queue Messages"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="View Stats"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Create Campaign</h2>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  placeholder="e.g., Spring Promotion 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  rows={3}
                  placeholder="Describe the purpose of this campaign..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Strategy</label>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATE_STRATEGIES.map(strategy => (
                    <button
                      key={strategy.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, template_strategy: strategy.value })}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        formData.template_strategy === strategy.value
                          ? 'border-whatsapp-green bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{strategy.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{strategy.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Templates</label>
                <div className="space-y-2 max-h-48 overflow-auto border border-gray-200 rounded-lg p-3">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => toggleTemplate(template.id)}
                      className={`w-full p-3 border rounded-lg flex items-center gap-3 text-left transition-colors ${
                        formData.selectedTemplates.includes(template.id)
                          ? 'border-whatsapp-green bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {formData.selectedTemplates.includes(template.id) ? (
                        <Check className="w-4 h-4 text-whatsapp-green" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-300 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{template.name}</p>
                        <p className="text-xs text-gray-500 truncate">{template.body.substring(0, 60)}...</p>
                      </div>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-center text-gray-500 py-4">
                      No templates available. <a href="/templates" className="text-whatsapp-green">Create one first</a>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || formData.selectedTemplates.length === 0}
                  className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Queue Modal */}
      {showQueueModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Queue Messages</h2>
              <p className="text-gray-500 mt-1">{selectedCampaign.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  This will queue messages for <strong>{MOCK_BUSINESSES.length} businesses</strong> based on your audience filters.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg divide-y">
                {MOCK_BUSINESSES.map(business => (
                  <div key={business.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{business.name}</p>
                      <p className="text-xs text-gray-500">{business.phone} • {business.city}</p>
                    </div>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowQueueModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQueueMessages}
                  disabled={saving}
                  className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? 'Queueing...' : 'Queue Messages'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
