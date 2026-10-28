export const specialOrderNotice = (settings = {}, locale = 'en') => {
  const arabic = String(locale).startsWith('ar')
  return String(settings[arabic ? 'backorder_fulfillment_message_ar' : 'backorder_fulfillment_message'] || '').trim()
    || (arabic ? 'طلب خاص. سنؤكد التوفر وموعد التوصيل قبل تنفيذ الطلب.'
      : 'Special order. We’ll confirm availability and delivery timing before fulfillment.')
}
// The existing sales option separates customer presentation from warehouse data.
// Checkout still enforces the configured delivery terms and physical allocation.
export const usesUnrecordedStockSales = (product, settings = {}) =>
  settings?.inventory_tracking_required === false && (product?.selling_mode || 'normal') === 'normal'

// Shared with cart normalization: a serialized item cannot use the ordinary
// bulk backorder switch when inventory tracking is required.
export const allowsCartBackorder = (product, settings = {}) =>
  usesUnrecordedStockSales(product, settings)
  || Boolean(product?.allow_out_of_stock_purchases) && !product?.is_serialized
  || product?.selling_mode === 'preorder'
