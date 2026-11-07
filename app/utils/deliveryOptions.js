// Delivery options for the chosen governorate and payment method. Governorate pricing,
// when configured, replaces the company's single price; uncovered options are hidden.
export const checkoutDeliveryOptions = (options, governorate, method) => {
  const area = String(governorate || '').trim().toLowerCase()
  return options.filter(option =>
    option.governorates.some(name => name.trim().toLowerCase() === area)
    && (method !== 'cash' || option.cashAvailable === true)
    && (!option.prices || Number.isFinite(option.prices[area])))
    .map(option => option.prices ? { ...option, price: option.prices[area] } : option)
}
