export const specialOrderNotice = (settings = {}, locale = 'en') => {
  const arabic = String(locale).startsWith('ar')
  return String(settings[arabic ? 'backorder_fulfillment_message_ar' : 'backorder_fulfillment_message'] || '').trim()
    || (arabic ? 'طلب خاص. سنؤكد التوفر وموعد التوصيل قبل تنفيذ الطلب.'
      : 'Special order. We’ll confirm availability and delivery timing before fulfillment.')
}
