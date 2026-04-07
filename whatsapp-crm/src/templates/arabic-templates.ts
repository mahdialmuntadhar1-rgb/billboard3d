/**
 * Arabic-First WhatsApp Templates for Belive/CRM Testing
 * These templates are designed for Iraqi business owners
 */

export const ARABIC_TEMPLATES = {
  // 1. Informative Introduction
  informative: {
    name: 'تعريف بالمنصة / Platform Introduction',
    body: `السلام عليكم {{business_name}} 👋

نحن منصة "بليف" - دليل الأعمال العراقي.

نريد أن نساعدك في الوصول لزبائن أكثر عبر الإنترنت.

📍 موقعك: {{city}}
🏷 التصنيف: {{category}}

هل ترغب بمعرفة المزيد؟

شكراً لوقتك 🙏`,
    cta_type: 'link',
    cta_value: 'https://app.belive.iq/intro',
    description: 'رسالة تعريفية بسيطة تشرح المنصة',
    weight: 25
  },

  // 2. Claim Business
  claim_business: {
    name: 'استلام صفحة العمل / Claim Business',
    body: `السلام عليكم {{business_name}} 🏪

تم إضافة عملك إلى دليل "بليف"!

📍 {{city}} - {{category}}

هل تريد:
✓ إدارة صفحتك بنفسك؟
✓ تحديث الصور والمعلومات؟
✓ التواصل مباشرة مع الزبائن؟

اضغط للاستلام مجاناً 👇`,
    cta_type: 'link',
    cta_value: 'https://app.belive.iq/claim/{{business_id}}',
    description: 'دعوة لاستلام إدارة الصفحة',
    weight: 25
  },

  // 3. Profile Preview
  profile_preview: {
    name: 'معاينة الصفحة / Profile Preview',
    body: `السلام عليكم {{business_name}} 👋

هكذا تظهر صفحتك على "بليف":

🏪 {{business_name}}
📍 {{city}} - {{governorate}}
🏷 {{category}}

شاهد صفحتك كما يراها الزبائن:
👇`,
    cta_type: 'link',
    cta_value: 'https://app.belive.iq/business/{{business_id}}',
    description: 'عرض كيف تظهر الصفحة للزبائن',
    weight: 25
  },

  // 4. Reply Question
  reply_question: {
    name: 'سؤال / Question',
    body: `السلام عليكم {{business_name}} 👋

نحن من منصة "بليف" - دليل الأعمال العراقي.

📍 موقعك مسجل: {{city}}

هل ترغب بإدارة صفحتك على المنصة؟

رد بـ:
✅ نعم
❌ لا

شكراً 🙏`,
    cta_type: 'reply',
    cta_value: null,
    description: 'سؤال يتوقع إجابة نعم/لا',
    weight: 25
  }
};

// Template metadata for UI display
export const TEMPLATE_METADATA = [
  { id: 'informative', label: 'معلوماتية / Informative', description: 'رسالة تعريفية بسيطة', color: 'blue' },
  { id: 'claim_business', label: 'استلام الصفحة / Claim', description: 'دعوة لاستلام الإدارة', color: 'green' },
  { id: 'profile_preview', label: 'معاينة الصفحة / Preview', description: 'عرض مظهر الصفحة', color: 'purple' },
  { id: 'reply_question', label: 'سؤال / Question', description: 'سؤال يتوقع إجابة', color: 'orange' }
];

// Landing page variants metadata
export const LANDING_PAGE_VARIANTS = [
  { id: 'app_intro', label: 'تعريف بالتطبيق / App Intro', description: 'صفحة تعريفية عامة بالمنصة', url: '/intro' },
  { id: 'business_profile', label: 'صفحة العمل / Business Profile', description: 'الصفحة الرئيسية للعمل', url: '/business/{{business_id}}' },
  { id: 'claim_page', label: 'صفحة الاستلام / Claim Page', description: 'صفحة تركز على الاستلام', url: '/claim/{{business_id}}' }
];

export default ARABIC_TEMPLATES;
