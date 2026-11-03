// Only the provider's payment services run inside this disposable SDK frame.
export const paymobFrameCsp = [
  "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "font-src data:",
  "img-src 'self' data: https://accept.paymob.com https://eg.checkout.paymob.com",
  'connect-src https://accept.paymob.com https://oman.paymob.com https://ksa.paymob.com https://uae.paymob.com',
  'frame-src https://eg.checkout.paymob.com https://accept.paymob.com https://om.checkout.paymob.com https://ksa.checkout.paymob.com https://uae.checkout.paymob.com',
  "base-uri 'none'", "object-src 'none'", "frame-ancestors 'self'",
  'form-action https://accept.paymob.com https://eg.checkout.paymob.com'
].join('; ')
