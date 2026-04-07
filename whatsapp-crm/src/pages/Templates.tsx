import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, AlertCircle, X, Eye, FileText } from 'lucide-react';
import { templatesApi } from '../services/api';
import { MessageTemplate } from '../types';
import { renderTemplate } from '../services/templateEngine';

const CTA_TYPES = [
  { value: 'none', label: 'No CTA' },
  { value: 'link', label: 'Link/Button' },
  { value: 'reply', label: 'Reply Prompt' },
  { value: 'call', label: 'Call to Action' },
];

const PREVIEW_CONTEXT = {
  business_name: 'Al-Mansour Restaurant',
  city: 'Baghdad',
  category: 'Restaurant',
};

export default function Templates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    body: '',
    cta_type: 'none',
    cta_value: '',
    weight: 1,
    is_active: true,
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await templatesApi.list();
      setTemplates(res.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const validate = async () => {
    const result = await templatesApi.validate({
      name: formData.name,
      body: formData.body,
      cta_type: formData.cta_type as any,
      cta_value: formData.cta_value,
    });
    setValidationErrors(result.errors);
    return result.valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = await validate();
    if (!isValid) return;

    setSaving(true);
    try {
      if (editingTemplate) {
        await templatesApi.update(editingTemplate.id, formData as Partial<MessageTemplate>);
      } else {
        await templatesApi.create(formData as Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>);
      }
      
      setShowModal(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await templatesApi.delete(id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleToggleActive = async (template: MessageTemplate) => {
    try {
      await templatesApi.activate(template.id, !template.is_active);
      loadTemplates();
    } catch (error) {
      console.error('Failed to toggle template:', error);
    }
  };

  const openEditModal = (template: MessageTemplate) => {
    setEditingTemplate(template);
    const formData = {
      name: template.name,
      body: template.body,
      cta_type: template.cta_type as 'none' | 'link' | 'reply' | 'call',
      cta_value: template.cta_value || '',
      weight: template.weight,
      is_active: template.is_active
    };
    setFormData(formData);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      body: '',
      cta_type: 'none',
      cta_value: '',
      weight: 1,
      is_active: true,
    });
    setValidationErrors([]);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    resetForm();
  };

  const getPreview = (template: MessageTemplate) => {
    return renderTemplate(template, PREVIEW_CONTEXT);
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
          <h1 className="text-3xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-gray-600 mt-1">Create and manage message templates for your campaigns</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(template => (
          <div 
            key={template.id} 
            className={`bg-white rounded-xl shadow-sm border transition-all ${
              template.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                <div className="flex items-center gap-1">
                  {template.is_active ? (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 line-clamp-3 mb-4">{template.body}</p>

              {template.cta_type !== 'none' && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span className="font-medium">CTA:</span>
                  <span>{CTA_TYPES.find(c => c.value === template.cta_type)?.label}</span>
                  {template.cta_value && (
                    <span className="truncate max-w-32">- {template.cta_value}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPreview(showPreview === template.id ? null : template.id)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleToggleActive(template)}
                  className={`p-1.5 rounded ${
                    template.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={template.is_active ? 'Deactivate' : 'Activate'}
                >
                  {template.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>

              {/* Preview */}
              {showPreview === template.id && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Preview:</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{getPreview(template)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No templates yet. Create your first template to get started.</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  placeholder="e.g., Welcome Message"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Body
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    Use {'{{business_name}}'}, {'{{city}}'}, {'{{category}}'}
                  </span>
                </label>
                <textarea
                  required
                  value={formData.body}
                  onChange={e => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  rows={6}
                  placeholder="Hello {{business_name}}, we're reaching out to businesses in {{city}}..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.body.length}/4096 characters
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Type</label>
                  <select
                    value={formData.cta_type}
                    onChange={e => setFormData({ ...formData, cta_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  >
                    {CTA_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {formData.cta_type !== 'none' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CTA Value</label>
                    <input
                      type="text"
                      value={formData.cta_value}
                      onChange={e => setFormData({ ...formData, cta_value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                      placeholder={formData.cta_type === 'link' ? 'https://example.com' : 'Call us now!'}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (for A/B testing)
                  <span className="text-xs text-gray-500 font-normal ml-2">Higher = more frequent</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.weight}
                  onChange={e => setFormData({ ...formData, weight: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                />
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">Please fix the following:</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-red-600">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Live Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Live Preview</label>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {editingTemplate 
                      ? getPreview({ ...editingTemplate, ...formData } as MessageTemplate)
                      : formData.body
                          .replace(/\{\{business_name\}\}/g, PREVIEW_CONTEXT.business_name)
                          .replace(/\{\{city\}\}/g, PREVIEW_CONTEXT.city)
                          .replace(/\{\{category\}\}/g, PREVIEW_CONTEXT.category)
                    }
                  </p>
                  {formData.cta_type !== 'none' && formData.cta_value && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-sm text-blue-600">{formData.cta_value}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
