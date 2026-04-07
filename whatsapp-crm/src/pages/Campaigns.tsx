import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Play, Pause, BarChart3, Filter, Check, X, AlertTriangle, Users, Phone } from 'lucide-react';
import { campaignsApi, templatesApi, businessesApi } from '../services/api';
import { Campaign, MessageTemplate, Business } from '../types';

const TEMPLATE_STRATEGIES = [
  { value: 'single_template', label: 'Single Template', description: 'Use one template for all messages' },
  { value: 'random_template', label: 'Random Selection', description: 'Randomly pick from available templates' },
  { value: 'even_rotation', label: 'Even Rotation', description: 'Rotate through templates equally' },
  { value: 'weighted_ab_test', label: 'Weighted A/B Test', description: 'Test templates with custom weights' },
];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New state for real business data
  const [businessStats, setBusinessStats] = useState<any>(null);
  const [sampleBusinesses, setSampleBusinesses] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>(null);
  const [testMode, setTestMode] = useState(true);
  const [testLimit, setTestLimit] = useState(10);
  const [audienceFilters, setAudienceFilters] = useState({
    governorate: '',
    city: '',
    category: '',
    status: 'approved'
  });

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
      const [campaignsRes, templatesRes, filterRes] = await Promise.all([
        campaignsApi.list(),
        templatesApi.list({ is_active: true }),
        businessesApi.getFilters()
      ]);
      setCampaigns(campaignsRes.campaigns);
      setTemplates(templatesRes.templates);
      setFilterOptions(filterRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBusinessData = async () => {
    try {
      console.log('[Campaigns] Loading business data with filters:', audienceFilters);
      
      const [statsRes, sampleRes] = await Promise.all([
        businessesApi.preview(audienceFilters),
        businessesApi.previewSample(audienceFilters, 5)
      ]);
      
      if (statsRes.success) {
        setBusinessStats(statsRes.stats);
      }
      
      if (sampleRes.success) {
        setSampleBusinesses(sampleRes.businesses);
      }
      
      console.log('[Campaigns] Business data loaded:', { stats: statsRes.stats, sampleCount: sampleRes.businesses.length });
    } catch (error) {
      console.error('Failed to load business data:', error);
      setBusinessStats(null);
      setSampleBusinesses([]);
    }
  };

  useEffect(() => {
    if (showQueueModal && selectedCampaign) {
      loadBusinessData();
    }
  }, [showQueueModal, selectedCampaign, audienceFilters]);

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
      console.log('[Campaigns] Queueing messages for campaign:', selectedCampaign.id);
      console.log('[Campaigns] Test mode:', testMode, 'Test limit:', testLimit);
      console.log('[Campaigns] Filters:', audienceFilters);

      // Get businesses for queuing
      const queueRes = await businessesApi.queue(
        selectedCampaign.id,
        audienceFilters,
        testMode,
        testLimit
      );

      if (!queueRes.success) {
        throw new Error('Failed to prepare businesses for queuing');
      }

      console.log('[Campaigns] Businesses prepared:', queueRes);

      // Queue messages using the prepared businesses
      const messagesRes = await import('../services/api').then(({ messagesApi }) => 
        messagesApi.queue(selectedCampaign.id, queueRes.businesses)
      );

      console.log('[Campaigns] Messages queued:', messagesRes);

      setShowQueueModal(false);
      
      const modeText = testMode ? `Test Mode (${queueRes.total_with_phones} recipients)` : `${queueRes.total_with_phones} recipients`;
      alert(`Successfully queued ${messagesRes.queued} messages in ${modeText}`);

    } catch (error) {
      console.error('Failed to queue messages:', error);
      alert(`Failed to queue messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
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
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Queue Messages</h2>
              <p className="text-gray-500 mt-1">{selectedCampaign.name}</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Test Mode Toggle */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="testMode"
                      checked={testMode}
                      onChange={(e) => setTestMode(e.target.checked)}
                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <label htmlFor="testMode" className="font-medium text-yellow-800">
                      Test Mode
                    </label>
                  </div>
                  {testMode && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="testLimit" className="text-sm text-yellow-700">Limit:</label>
                      <select
                        id="testLimit"
                        value={testLimit}
                        onChange={(e) => setTestLimit(Number(e.target.value))}
                        className="px-2 py-1 text-sm border border-yellow-300 rounded focus:ring-yellow-500 focus:border-yellow-500"
                      >
                        <option value={5}>5 recipients</option>
                        <option value={10}>10 recipients</option>
                        <option value={20}>20 recipients</option>
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-sm text-yellow-700">
                  {testMode 
                    ? `Only ${testLimit} recipients will be queued for testing. No full campaign sending.`
                    : 'All matching recipients will be queued for full campaign sending.'
                  }
                </p>
              </div>

              {/* Audience Filters */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Audience Filters</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Governorate</label>
                    <select
                      value={audienceFilters.governorate}
                      onChange={(e) => setAudienceFilters(prev => ({ ...prev, governorate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    >
                      <option value="">All Governorates</option>
                      {filterOptions?.governorates.map((gov: string) => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <select
                      value={audienceFilters.city}
                      onChange={(e) => setAudienceFilters(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    >
                      <option value="">All Cities</option>
                      {filterOptions?.cities.map((city: string) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={audienceFilters.category}
                      onChange={(e) => setAudienceFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    >
                      <option value="">All Categories</option>
                      {filterOptions?.categories.map((cat: string) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Business Stats */}
              {businessStats ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-3">Audience Statistics</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{businessStats.total}</div>
                      <div className="text-sm text-blue-700">Total Businesses</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{businessStats.withValidPhones}</div>
                      <div className="text-sm text-green-700">With Valid Phones</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{businessStats.withoutValidPhones}</div>
                      <div className="text-sm text-red-700">Without Valid Phones</div>
                    </div>
                  </div>
                  {testMode && (
                    <div className="mt-3 text-center text-sm text-blue-700">
                      <strong>Test Mode:</strong> Will queue {Math.min(testLimit, businessStats.withValidPhones)} recipients
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 rounded w-1/4 mx-auto mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/6 mx-auto"></div>
                  </div>
                </div>
              )}

              {/* Sample Businesses Preview */}
              {sampleBusinesses.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Sample Recipients (First 5)</h3>
                  <div className="border border-gray-200 rounded-lg divide-y max-h-64 overflow-auto">
                    {sampleBusinesses.map((business: any, index: number) => (
                      <div key={index} className="p-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{business.business_name}</p>
                          <p className="text-xs text-gray-500">
                            {business.governorate} {business.city && `> ${business.city}`}
                          </p>
                          <p className="text-xs text-gray-400">{business.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-green-600">{business.selectedPhone}</p>
                          <p className="text-xs text-gray-400">{business.selectedPhoneField}</p>
                        </div>
                        <Check className="w-4 h-4 text-green-500 ml-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning if no businesses found */}
              {businessStats && businessStats.withValidPhones === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">No valid recipients found</p>
                      <p className="text-sm text-red-700 mt-1">
                        Try adjusting your filters or ensure businesses have valid phone numbers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Supabase Environment Warning */}
              {!process.env.SUPABASE_URL && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-orange-800">Missing Supabase Configuration</p>
                      <p className="text-sm text-orange-700 mt-1">
                        Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowQueueModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQueueMessages}
                  disabled={saving || !businessStats || businessStats.withValidPhones === 0}
                  className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Queueing...' : `Queue ${testMode ? `Test (${Math.min(testLimit, businessStats?.withValidPhones || 0)})` : 'All'} Messages`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
