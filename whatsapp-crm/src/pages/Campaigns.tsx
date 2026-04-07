import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, BarChart3, AlertTriangle, Check } from 'lucide-react';
import { campaignsApi, templatesApi, businessesApi } from '../services/api';
import { Campaign, MessageTemplate } from '../types';

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
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testRecipientType, setTestRecipientType] = useState<'database' | 'manual'>('database');
  const [testMessageType, setTestMessageType] = useState<'informative' | 'question' | 'cta'>('informative');
  const [landingPageVariant, setLandingPageVariant] = useState<'business_profile' | 'claim_page' | 'app_intro'>('app_intro');
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
      console.log('[Campaigns] Test recipient type:', testRecipientType);
      console.log('[Campaigns] Test phone:', testPhoneNumber);
      console.log('[Campaigns] Filters:', audienceFilters);

      // Validate manual test phone if in manual mode
      if (testMode && testRecipientType === 'manual') {
        if (!testPhoneNumber || testPhoneNumber.length < 10) {
          alert('Please enter a valid test phone number');
          setSaving(false);
          return;
        }
      }

      let queueRes;

      if (testMode && testRecipientType === 'manual' && testPhoneNumber) {
        // Manual test recipient - override database audience completely
        console.log('[Campaigns] Using manual test recipient:', testPhoneNumber);
        queueRes = {
          success: true,
          businesses: [{
            id: 'test-recipient',
            business_name: 'Test Recipient (Manual)',
            selectedPhone: testPhoneNumber.startsWith('+964') ? testPhoneNumber : '+964' + testPhoneNumber.replace(/^0/, ''),
            selectedPhoneField: 'manual_test',
            governorate: 'Test',
            city: 'Test',
            category: 'Test'
          }],
          total_with_phones: 1,
          testMode: true,
          manualRecipient: true
        };
      } else {
        // Database audience (test mode with limit or full production)
        queueRes = await businessesApi.queue(
          selectedCampaign.id,
          audienceFilters,
          testMode,
          testLimit
        );
      }

      if (!queueRes.success) {
        throw new Error('Failed to prepare recipients for queuing');
      }

      console.log('[Campaigns] Recipients prepared:', queueRes);

      // Queue messages using the prepared recipients
      const messagesRes = await import('../services/api').then(({ messagesApi }) => 
        messagesApi.queue(selectedCampaign.id, queueRes.businesses, testMessageType, landingPageVariant, testLimit)
      );

      console.log('[Campaigns] Messages queued:', messagesRes);

      setShowQueueModal(false);
      
      const modeText = testMode 
        ? (testRecipientType === 'manual' 
            ? `Manual Test to ${testPhoneNumber}` 
            : `Test Mode (${queueRes.total_with_phones} recipients)`)
        : `${queueRes.total_with_phones} recipients`;
      
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

      {/* Create Modal - ENHANCED WITH TEST MODE */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">إنشاء حملة جديدة / Create Campaign</h2>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              {/* TEST MODE SECTION - PROMINENT */}
              <div className="border-2 border-yellow-400 rounded-lg p-4 bg-yellow-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">TESTING</span>
                  <h3 className="font-bold text-yellow-900">وضع الاختبار / Test Mode</h3>
                </div>
                
                {/* Test Mode Toggle */}
                <div className="flex items-center justify-between mb-4 p-3 bg-white rounded-lg border border-yellow-300">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-7 rounded-full transition-colors cursor-pointer ${testMode ? 'bg-yellow-500' : 'bg-gray-300'}`}
                         onClick={() => setTestMode(!testMode)}>
                      <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${testMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <label className={`font-bold ${testMode ? 'text-yellow-800' : 'text-gray-700'}`}>
                        {testMode ? '✓ وضع الاختبار مفعل / TEST MODE ON' : 'تفعيل وضع الاختبار / Enable Test Mode'}
                      </label>
                      <p className="text-xs text-gray-500">اختر هنا قبل الإرسال / Select before sending</p>
                    </div>
                  </div>
                </div>

                {testMode && (
                  <>
                    {/* Recipient Type Selection */}
                    <div className="mb-4 p-3 bg-white rounded-lg border border-yellow-300">
                      <label className="block text-sm font-bold text-yellow-900 mb-3">
                        إرسال الاختبار إلى / Send Test To:
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-yellow-100">
                          <input
                            type="radio"
                            name="testRecipient"
                            checked={testRecipientType === 'database'}
                            onChange={() => setTestRecipientType('database')}
                            className="w-5 h-5 text-yellow-600"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">قاعدة البيانات (محدود) / Database (Limited)</span>
                            <p className="text-xs text-gray-500">إرسال لعدد محدد من الأعمال / Send to limited businesses</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-yellow-100">
                          <input
                            type="radio"
                            name="testRecipient"
                            checked={testRecipientType === 'manual'}
                            onChange={() => setTestRecipientType('manual')}
                            className="w-5 h-5 text-yellow-600"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">رقم هاتفي فقط / My Phone Only</span>
                            <p className="text-xs text-gray-500">إرسال لهاتفي فقط، لا أحد غيري / Send to my phone only</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Manual Phone Input */}
                    {testRecipientType === 'manual' && (
                      <div className="mt-3 p-4 bg-yellow-100 rounded-lg border-2 border-yellow-400">
                        <label className="block text-sm font-bold text-yellow-900 mb-2">
                          أدخل رقم هاتفك للاختبار / Enter Your Test Phone:
                        </label>
                        <input
                          type="tel"
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                          placeholder="07XXXXXXXX أو +964XXXXXXXXX"
                          className="w-full px-4 py-3 border-2 border-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono text-lg"
                        />
                        <p className="text-xs text-yellow-800 mt-2">
                          يقبل: 07XXXXXXXX أو +964XXXXXXXXX / Accepts: 07XXXXXXXX or +964XXXXXXXXX
                        </p>
                        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded">
                          <p className="text-sm font-bold text-red-700">
                            ⚠️ سيتم الإرسال لهذا الرقم فقط - لا أحد غيرك سيتلقى الرسالة
                          </p>
                          <p className="text-xs text-red-600">
                            Only this number will receive messages - NO database contacts will be messaged
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Database Recipient Count */}
                    {testRecipientType === 'database' && (
                      <div className="mt-3 p-4 bg-white rounded-lg border border-yellow-300">
                        <label className="block text-sm font-bold text-yellow-900 mb-2">
                          عدد المستلمين / Recipient Count:
                        </label>
                        <div className="flex gap-3">
                          {[1, 3, 5, 10].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setTestLimit(num)}
                              className={`px-4 py-2 rounded-lg font-bold ${
                                testLimit === num 
                                  ? 'bg-yellow-500 text-white' 
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-yellow-700 mt-2">
                          سيتم إرسال {testLimit} رسائل فقط / Only {testLimit} messages will be sent
                        </p>
                      </div>
                    )}

                    {/* Message Type */}
                    <div className="mt-4 p-3 bg-white rounded-lg border border-yellow-300">
                      <label className="block text-sm font-bold text-yellow-900 mb-2">
                        نوع الرسالة / Message Type:
                      </label>
                      <select
                        value={testMessageType}
                        onChange={(e) => setTestMessageType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      >
                        <option value="informative">معلوماتية / Informative</option>
                        <option value="question">سؤال وإجابة / Question & Reply</option>
                        <option value="cta">دعوة للتصرف / Call-to-Action</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الحملة / Campaign Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  placeholder="مثال: حملة ربيع 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف / Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  rows={3}
                  placeholder="وصف الحملة..."
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

      {/* Queue Modal - ARABIC-FIRST REDESIGN */}
      {showQueueModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-white">
              <h2 className="text-2xl font-bold text-gray-900">إرسال رسائل الحملة / Send Campaign Messages</h2>
              <p className="text-gray-600 mt-1">{selectedCampaign.name}</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Test Mode Section - ARABIC-FIRST */}
              <div className={`border-2 rounded-lg p-5 ${testMode ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 border-gray-300'}`}>
                {/* Header with Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${testMode ? 'bg-yellow-500 text-white' : 'bg-gray-400 text-white'}`}>
                    {testMode ? 'وضع الاختبار مفعل' : 'وضع الاختبار معطل'}
                  </span>
                  <h3 className="font-bold text-lg text-gray-900">إعدادات الاختبار / Test Settings</h3>
                </div>
                
                {/* Test Mode Toggle */}
                <div className="flex items-center justify-between mb-5 p-4 bg-white rounded-lg border border-yellow-300 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-8 rounded-full transition-colors cursor-pointer relative ${testMode ? 'bg-yellow-500' : 'bg-gray-300'}`}
                         onClick={() => setTestMode(!testMode)}>
                      <div className={`w-7 h-7 bg-white rounded-full shadow-lg absolute top-0.5 transition-all ${testMode ? 'left-6' : 'left-0.5'}`} />
                    </div>
                    <div>
                      <label className={`font-bold text-lg ${testMode ? 'text-yellow-800' : 'text-gray-700'}`}>
                        {testMode ? '✓ TEST MODE ON / وضع الاختبار مفعل' : 'Enable Test Mode / تفعيل وضع الاختبار'}
                      </label>
                      <p className="text-sm text-gray-500">
                        {testMode ? 'آمن للاختبار - Safe for testing' : 'اختر للإرسال الحقيقي - Select for real sending'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${testMode ? 'bg-yellow-200 text-yellow-900' : 'bg-gray-200 text-gray-700'}`}>
                    {testMode ? 'TESTING / اختبار' : 'PRODUCTION / إنتاج'}
                  </span>
                </div>

                {testMode && (
                  <>
                    {/* Recipient Type Selection - ARABIC-FIRST */}
                    <div className="mb-5 p-4 bg-white rounded-lg border-2 border-yellow-300 shadow-sm">
                      <label className="block text-base font-bold text-gray-900 mb-3">
                        إرسال الاختبار إلى / Send Test To:
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-all ${testRecipientType === 'database' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'}`}>
                          <input
                            type="radio"
                            name="testRecipient"
                            checked={testRecipientType === 'database'}
                            onChange={() => setTestRecipientType('database')}
                            className="w-5 h-5 text-yellow-600"
                          />
                          <div>
                            <span className="text-base font-bold text-gray-900 block">قاعدة البيانات (محدود)</span>
                            <span className="text-sm text-gray-600">Database (Limited)</span>
                            <p className="text-xs text-gray-500 mt-1">إرسال لعدد محدد من الأعمال</p>
                          </div>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-all ${testRecipientType === 'manual' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'}`}>
                          <input
                            type="radio"
                            name="testRecipient"
                            checked={testRecipientType === 'manual'}
                            onChange={() => setTestRecipientType('manual')}
                            className="w-5 h-5 text-yellow-600"
                          />
                          <div>
                            <span className="text-base font-bold text-gray-900 block">رقم هاتفي فقط</span>
                            <span className="text-sm text-gray-600">My Phone Only</span>
                            <p className="text-xs text-green-600 mt-1 font-medium">✓ الأكثر أماناً / Safest</p>
                          </div>
                        </label>
                      </div>

                      {/* Manual Test Phone Input - ARABIC-FIRST */}
                      {testRecipientType === 'manual' && (
                        <div className="mt-4 p-5 bg-yellow-100 rounded-lg border-2 border-yellow-500 shadow-inner">
                          <label className="block text-base font-bold text-yellow-900 mb-3">
                            أدخل رقم هاتفك للاختبار / Enter Your Test Phone:
                          </label>
                          <input
                            type="tel"
                            value={testPhoneNumber}
                            onChange={(e) => setTestPhoneNumber(e.target.value)}
                            placeholder="07XXXXXXXX أو +964XXXXXXXXX"
                            className="w-full px-4 py-4 text-lg border-2 border-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono bg-white"
                          />
                          <p className="text-sm text-yellow-800 mt-2">
                            يقبل: 07XXXXXXXX أو +964XXXXXXXXX / Accepts both formats
                          </p>
                          <div className="mt-4 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                            <p className="text-base font-bold text-red-800 text-center">
                              ⚠️ سيتم الإرسال لهذا الرقم فقط
                            </p>
                            <p className="text-sm text-red-700 text-center">
                              Only this number will receive messages - ZERO database contacts
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Database Recipient Count - ARABIC-FIRST */}
                      {testRecipientType === 'database' && (
                        <div className="mt-4 p-5 bg-white rounded-lg border-2 border-yellow-300">
                          <label className="block text-base font-bold text-gray-900 mb-3">
                            عدد المستلمين / Recipient Count:
                          </label>
                          <div className="flex gap-3 flex-wrap">
                            {[1, 3, 5, 10].map(num => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setTestLimit(num)}
                                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                                  testLimit === num 
                                    ? 'bg-yellow-500 text-white shadow-md' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                          <p className="text-sm text-yellow-700 mt-3">
                            سيتم إرسال <strong>{testLimit}</strong> رسائل فقط + رقم الاختبار الداخلي / 
                            Only <strong>{testLimit}</strong> messages + internal test number
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Message Type & Landing Page - SIDE BY SIDE */}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      {/* Message Type Selector - ARABIC-FIRST */}
                      <div className="p-4 bg-white rounded-lg border-2 border-yellow-300">
                        <label className="block text-base font-bold text-gray-900 mb-3">
                          نوع الرسالة / Message Type:
                        </label>
                        <select
                          value={testMessageType}
                          onChange={(e) => setTestMessageType(e.target.value as any)}
                          className="w-full px-3 py-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-base"
                        >
                          <option value="informative">معلوماتية / Informative</option>
                          <option value="claim_business">استلام الصفحة / Claim Business</option>
                          <option value="profile_preview">معاينة الصفحة / Profile Preview</option>
                          <option value="reply_question">سؤال / Question</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          {testMessageType === 'informative' && 'رسالة تعريفية بسيطة / Simple intro message'}
                          {testMessageType === 'claim_business' && 'دعوة لاستلام إدارة الصفحة / Invite to claim listing'}
                          {testMessageType === 'profile_preview' && 'عرض كيف تظهر الصفحة / Show how page appears'}
                          {testMessageType === 'reply_question' && 'سؤال يتوقع إجابة / Question expecting reply'}
                        </p>
                      </div>

                      {/* Landing Page Variant - NEW */}
                      <div className="p-4 bg-white rounded-lg border-2 border-blue-300">
                        <label className="block text-base font-bold text-gray-900 mb-3">
                          صفحة الهبوط / Landing Page:
                        </label>
                        <select
                          value={landingPageVariant}
                          onChange={(e) => setLandingPageVariant(e.target.value as any)}
                          className="w-full px-3 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
                        >
                          <option value="app_intro">تعريف بالتطبيق / App Intro</option>
                          <option value="business_profile">صفحة العمل / Business Profile</option>
                          <option value="claim_page">صفحة الاستلام / Claim Page</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          {landingPageVariant === 'app_intro' && 'صفحة تعريفية عامة / General intro page'}
                          {landingPageVariant === 'business_profile' && 'صفحة العمل نفسها / The actual business page'}
                          {landingPageVariant === 'claim_page' && 'صفحة تركز على الاستلام / Claim-focused page'}
                        </p>
                      </div>
                    </div>

                    {/* Test Mode Safety Summary - ARABIC-FIRST */}
                    <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-red-800 text-base mb-2">
                            ملخص الأمان / Safety Summary
                          </p>
                          <div className="text-sm text-red-700 space-y-1">
                            {testRecipientType === 'manual' ? (
                              <>
                                <p>✓ <strong>الوضع الأكثر أماناً</strong> - safest mode</p>
                                <p>✓ سيتم الإرسال فقط إلى: <strong>{testPhoneNumber || '(لم يتم الإدخال)'}</strong></p>
                                <p>✓ عدد المستلمين: <strong>1</strong> (هاتفك فقط)</p>
                                <p>✓ لا يتم إرسال أي رسائل لقاعدة البيانات</p>
                                <p>✓ Zero database contacts will be messaged</p>
                              </>
                            ) : (
                              <>
                                <p>✓ سيتم الإرسال إلى: <strong>{testLimit}</strong> عمل من قاعدة البيانات</p>
                                <p>✓ بالإضافة إلى: رقم الاختبار الداخلي (إذا مُكن)</p>
                                <p>✓ لن يتم الإرسال للجمهور الكامل</p>
                                <p>✓ Limited to {testLimit} recipients, NOT full audience</p>
                              </>
                            )}
                            <p className="mt-2 pt-2 border-t border-red-200">
                              نوع الرسالة: <strong>
                                {testMessageType === 'informative' && 'معلوماتية'}
                                {testMessageType === 'claim_business' && 'استلام الصفحة'}
                                {testMessageType === 'profile_preview' && 'معاينة الصفحة'}
                                {testMessageType === 'reply_question' && 'سؤال'}
                              </strong> / Message type: <strong>{testMessageType}</strong>
                            </p>
                            <p>
                              صفحة الهبوط: <strong>
                                {landingPageVariant === 'app_intro' && 'تعريف بالتطبيق'}
                                {landingPageVariant === 'business_profile' && 'صفحة العمل'}
                                {landingPageVariant === 'claim_page' && 'صفحة الاستلام'}
                              </strong> / Landing: <strong>{landingPageVariant}</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!testMode && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-800 text-lg">وضع الإنتاج / PRODUCTION MODE</p>
                        <p className="text-base text-blue-700 mt-2">
                          سيتم الإرسال لجميع المستلمين المطابقين للفلاتر في قاعدة البيانات
                        </p>
                        <p className="text-sm text-blue-600">
                          Campaign will send to ALL matching database recipients
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
                  disabled={saving || (testMode && testRecipientType === 'database' && (!businessStats || businessStats.withValidPhones === 0)) || (testMode && testRecipientType === 'manual' && !testPhoneNumber)}
                  className={`px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold ${
                    testMode 
                      ? 'bg-yellow-500 text-yellow-900 hover:bg-yellow-600' 
                      : 'bg-whatsapp-green text-white hover:bg-green-600'
                  }`}
                >
                  {saving ? 'Queueing...' : (
                    testMode 
                      ? (testRecipientType === 'manual' 
                          ? `Send Test to ${testPhoneNumber || '...'}` 
                          : `Send Test to ${Math.min(testLimit, businessStats?.withValidPhones || 0)} Recipients`)
                      : `Send to All ${businessStats?.withValidPhones || 0} Recipients`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
