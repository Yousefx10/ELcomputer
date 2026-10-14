// v1 is a sparse merchandising contract. No write command consumes this file.
export const CATALOG_VERSION = 'elcomputer_catalog_1'
export const TRANSFER_LIMITS = {
  upload: 4 * 1024 * 1024,
  output: 8 * 1024 * 1024,
  inflated: 16 * 1024 * 1024,
  part: 6 * 1024 * 1024,
  products: 250,
  related: 2500,
  references: 1000,
  rows: 6000,
  columns: 64,
  cells: 100000,
  cell: 100000,
  excelCell: 32767,
}
export const TABLES = {
  Products: [
    'product_key',
    'product_id',
    'expected_revision',
    'tracking_mode',
    'title',
    'slug',
    'sku',
    'description',
    'long_description',
    'category_id',
    'brand_id',
    'price',
    'old_price',
    'selling_mode',
    'is_published',
    'image_url',
    'color_name',
    'color_hex',
    'seo_title',
    'seo_description',
    'seo_image_url',
    'warranty_status',
    'warranty_duration_value',
    'warranty_duration_unit',
    'expected_availability_date',
    'availability_message',
    'preorder_active',
    'preorder_starts_at',
    'preorder_ends_at',
    'preorder_payment_mode',
    'preorder_deposit_percent',
    'preorder_total_limit',
    'preorder_customer_limit',
  ],
  Variants: [
    'product_key',
    'entity_key',
    'id',
    'expected_hash',
    'name',
    'code',
    'sku',
    'color_name',
    'color_hex',
    'is_active',
    'price',
  ],
  Specifications: [
    'product_key',
    'entity_key',
    'id',
    'expected_hash',
    'definition_id',
    'label',
    'value',
    'sort_order',
    'is_highlight',
  ],
  Images: [
    'product_key',
    'entity_key',
    'id',
    'expected_hash',
    'variant_key',
    'image_url',
    'alt_text',
    'sort_order',
  ],
  Categories: ['id', 'slug', 'name', 'name_ar'],
  Brands: ['id', 'slug', 'name'],
  Definitions: ['id', 'key', 'name', 'is_active'],
  Guide: ['schema_version', 'field', 'required', 'en', 'ar'],
}
export const CSV_HEADERS = ['record_type', ...new Set(Object.values(TABLES).flat())]
export const RECORD_TYPES = Object.fromEntries(
  Object.keys(TABLES).map((name) => [name.toLowerCase(), name]),
)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
export const failTransfer = (code) => {
  const error = Error(code)
  error.catalogTransfer = code
  throw error
}
export const badXmlText = (text) =>
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffe\uffff]/.test(text)
export const guideRows = () => [
  {
    schema_version: CATALOG_VERSION,
    field: '$contract',
    required: 'yes',
    en: 'Preview only. No changes are applied.',
    ar: 'معاينة فقط. لا تُطبق أي تغييرات.',
  },
  {
    field: 'matching',
    en: 'Product ID matches exactly. Blank ID creates; SKU/slug never select an existing product.',
    ar: 'المطابقة بمعرف المنتج فقط. المعرف الفارغ لإنشاء منتج؛ لا مطابقة تلقائية برمز SKU أو الرابط.',
  },
  {
    field: 'cells',
    en: 'Blank means omitted. #CLEAR clears optional fields; #EMPTY is empty text. Double a leading # for literal text.',
    ar: 'الخلية الفارغة تعني عدم التغيير. #CLEAR لمسح حقل اختياري؛ #EMPTY لنص فارغ. كرر # في بداية النص الحرفي.',
  },
  {
    field: 'csv',
    en: 'A leading apostrophe protects CSV text and numeric identifiers; double it for a literal apostrophe. XLSX keeps text cells.',
    ar: 'الفاصلة العليا في البداية تحمي نص CSV والمعرفات الرقمية؛ كررها للنص الحرفي. XLSX يحفظ الخلايا النصية.',
  },
  {
    field: 'new_products',
    required: 'title,slug,price,selling_mode,is_published,product_key',
    en: 'New products need active options and an explicit warehouse choice before applying.',
    ar: 'المنتج الجديد يحتاج خيارات نشطة واختيار مستودع صريح قبل التطبيق.',
  },
  {
    field: 'existing_products',
    required: 'product_id,expected_revision,product_key',
    en: 'Existing IDs and revisions are required. Omitted related rows never delete anything.',
    ar: 'المعرف والمراجعة مطلوبان للمنتج الحالي. حذف الصفوف من الملف لا يحذف السجلات.',
  },
  {
    field: 'references',
    en: 'Use existing category, brand and definition UUIDs. Reference sheets are read-only.',
    ar: 'استخدم معرفات UUID الحالية للفئات والعلامات وأسماء المواصفات. أوراق المراجع للقراءة فقط.',
  },
  {
    field: 'related',
    required: 'product_key,entity_key',
    en: 'Existing related IDs require expected_hash. Image variant_key refers to a variant entity_key.',
    ar: 'السجل المرتبط الحالي يحتاج expected_hash. يشير variant_key للصورة إلى entity_key لأحد الخيارات.',
  },
  {
    field: 'new_variants',
    required: 'product_key,entity_key,name,code,is_active',
    en: 'New option definitions must be active. Variant price is read-only; stock and cost are excluded.',
    ar: 'تعريف الخيار الجديد يجب أن يكون نشطًا. سعر الخيار للقراءة فقط؛ المخزون والتكلفة مستبعدان.',
  },
  {
    field: 'new_specifications',
    required: 'product_key,entity_key,label,value,sort_order,is_highlight',
    en: 'Definition ID is optional. Use an active existing definition; write your own value.',
    ar: 'معرف تعريف المواصفة اختياري. استخدم تعريفًا حاليًا نشطًا واكتب القيمة بنفسك.',
  },
  {
    field: 'new_images',
    required: 'product_key,entity_key,variant_key,image_url,sort_order',
    en: 'Use an existing safe image reference and an active option. No image upload is performed.',
    ar: 'استخدم مرجع صورة آمنًا وخيارًا نشطًا. لا يرفع هذا الملف صورًا.',
  },
  {
    field: 'optional',
    en: 'Other fields are optional unless required by warranty/preorder settings. Blank optional fields stay omitted.',
    ar: 'باقي الحقول اختيارية ما لم تتطلبها إعدادات الضمان أو الطلب المسبق. الخانات الاختيارية الفارغة لا تتغير.',
  },
  ...Object.entries(TABLES)
    .filter(([name]) => name !== 'Guide')
    .map(([name, fields]) => ({ field: name, en: fields.join(', '), ar: fields.join(', ') })),
]

export function semanticCell(value) {
  if (value === '') return { kind: 'omit' }
  if (value === '#CLEAR') return { kind: 'clear', value: null }
  if (value === '#EMPTY') return { kind: 'value', value: '' }
  return { kind: 'value', value: value.startsWith('##') ? value.slice(1) : value }
}
export function encodeCell(value) {
  if (value === undefined) return ''
  if (value === null) return '#CLEAR'
  const text = String(value)
  if (text === '') return '#EMPTY'
  return text.startsWith('#') ? '#' + text : text
}
export function assertTables(tables) {
  if (
    Object.keys(tables).length !== Object.keys(TABLES).length ||
    Object.keys(TABLES).some((name) => !Array.isArray(tables[name]))
  )
    failTransfer('structure')
  if (
    tables.Products.length > TRANSFER_LIMITS.products ||
    ['Variants', 'Specifications', 'Images'].reduce((n, name) => n + tables[name].length, 0) >
      TRANSFER_LIMITS.related ||
    ['Categories', 'Brands', 'Definitions'].some(
      (name) => tables[name].length > TRANSFER_LIMITS.references,
    )
  )
    failTransfer('limit')
  const version = tables.Guide.filter((row) => row.field === '$contract')
  if (
    version.length !== 1 ||
    version[0].schema_version !== CATALOG_VERSION ||
    tables.Guide.some((row) => row.schema_version && row.schema_version !== CATALOG_VERSION)
  )
    failTransfer('version')
  return tables
}
