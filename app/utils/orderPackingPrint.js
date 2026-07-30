const escapeHtml = (value) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const formatCurrency = (value, currency = 'EGP') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'EGP').toUpperCase(),
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const getItemSku = (item = {}) => {
  return item.variant_sku
    || item.product_sku
    || item.variant_code
    || 'No SKU'
}

const getItemOption = (item = {}) => {
  return item.variant_name
    || item.variant_color_name
    || ''
}

export const buildOrderPackingDocumentsHtml = ({
  order = {},
  customer = {},
  items = [],
  siteName = 'Store',
  siteLogoUrl = '',
  printedAt = new Date().toISOString()
} = {}) => {
  const orderNumber = order.order_number || `Order #${String(order.id || '').slice(0, 8)}`
  const customerName = `${order.first_name || customer.full_name || 'Customer'} ${order.last_name || ''}`.trim()
  const customerEmail = order.email || customer.email || 'No email saved'
  const customerPhone = order.phone || customer.phone || 'No phone saved'
  const addressLines = [
    order.street_address || customer.address_line_1 || 'No address saved',
    [order.city || customer.city, order.governorate || customer.state].filter(Boolean).join(', '),
    customer.country || (order.governorate ? 'Egypt' : '')
  ].filter(Boolean)
  const itemQuantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0)
  const brandMarkup = siteLogoUrl
    ? `<img class="logo" src="${escapeHtml(siteLogoUrl)}" alt="${escapeHtml(siteName)}">`
    : `<p class="brand-name">${escapeHtml(siteName)}</p>`
  const invoiceRows = items.length
    ? items.map((item) => {
        const option = getItemOption(item)
        const serials = (item.serialized_units || [])
          .map((unit) => unit.unit_code)
          .filter(Boolean)

        return `
          <tr>
            <td>
              <strong>${escapeHtml(item.product_title || 'Product')}</strong>
              ${option ? `<span class="line-detail">${escapeHtml(option)}</span>` : ''}
              ${serials.length ? `<span class="line-detail">Units: ${escapeHtml(serials.join(', '))}</span>` : ''}
            </td>
            <td class="mono">${escapeHtml(getItemSku(item))}</td>
            <td>${escapeHtml(item.quantity)}</td>
            <td>${escapeHtml(formatCurrency(item.unit_price, order.currency))}</td>
            <td>${escapeHtml(formatCurrency(item.line_total, order.currency))}</td>
          </tr>
        `
      }).join('')
    : '<tr><td colspan="5">No order items saved.</td></tr>'
  const packingRows = items.length
    ? items.map((item) => `
        <tr>
          <td>${escapeHtml(item.product_title || 'Product')}</td>
          <td class="mono">${escapeHtml(getItemSku(item))}</td>
          <td>${escapeHtml(item.quantity)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3">No order items saved.</td></tr>'

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(orderNumber)} documents</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        h1, h2, h3, p { margin: 0; }
        .document { min-height: 267mm; }
        .shipping-document { break-before: page; page-break-before: always; }
        .brand { min-height: 56px; margin-bottom: 24px; }
        .logo { display: block; max-height: 56px; max-width: 190px; object-fit: contain; }
        .brand-name { font-size: 26px; font-weight: 800; }
        .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        .eyebrow { color: #6b7280; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
        h1 { margin-top: 6px; font-size: 28px; }
        h2 { font-size: 22px; }
        .muted { color: #6b7280; }
        .right { text-align: right; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
        .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 15px; }
        .card h3 { margin-bottom: 10px; color: #6b7280; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
        .stack > * + * { margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; vertical-align: top; font-size: 12px; }
        th { color: #6b7280; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
        .line-detail { display: block; margin-top: 4px; color: #6b7280; font-size: 10px; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .totals { width: 300px; margin: 20px 0 0 auto; }
        .totals-row { display: flex; justify-content: space-between; gap: 18px; padding: 6px 0; color: #4b5563; font-size: 13px; }
        .totals-row.total { margin-top: 6px; border-top: 2px solid #111827; padding-top: 10px; color: #111827; font-size: 17px; font-weight: 800; }
        .shipping-frame { border: 3px solid #111827; padding: 24px; }
        .shipping-order { margin-top: 8px; font-size: 34px; font-weight: 900; letter-spacing: .03em; }
        .recipient { margin-top: 26px; border-top: 2px solid #111827; padding-top: 22px; }
        .recipient-name { font-size: 30px; font-weight: 900; }
        .recipient-phone { margin-top: 10px; font-size: 22px; font-weight: 700; }
        .address { margin-top: 20px; font-size: 20px; line-height: 1.5; }
        .shipping-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
        .shipping-meta .card { border-width: 2px; }
        .footer-note { margin-top: 20px; color: #6b7280; font-size: 10px; }
        @media print {
          .document { break-after: page; page-break-after: always; }
          .shipping-document { break-after: auto; page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      <section class="document invoice-document">
        <div class="brand">${brandMarkup}</div>
        <header class="header">
          <div>
            <p class="eyebrow">Customer bill</p>
            <h1>${escapeHtml(orderNumber)}</h1>
          </div>
          <div class="right muted">
            <p>Ordered ${escapeHtml(formatDate(order.created_at))}</p>
            <p>Printed ${escapeHtml(formatDate(printedAt))}</p>
          </div>
        </header>

        <div class="grid">
          <section class="card">
            <h3>Purchaser</h3>
            <div class="stack">
              <p><strong>${escapeHtml(customerName)}</strong></p>
              <p>${escapeHtml(customerEmail)}</p>
              <p>${escapeHtml(customerPhone)}</p>
            </div>
          </section>
          <section class="card">
            <h3>Delivery address</h3>
            <div class="stack">${addressLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>
          </section>
          <section class="card">
            <h3>Payment</h3>
            <div class="stack">
              <p>${escapeHtml(order.payment_method || 'Not selected')}</p>
              <p class="muted">Coupon: ${escapeHtml(order.coupon_code || 'None')}</p>
            </div>
          </section>
          <section class="card">
            <h3>Shipping</h3>
            <p>${escapeHtml(order.shipping_method || 'Not selected')}</p>
          </section>
        </div>

        <table>
          <thead>
            <tr><th>Product</th><th>SKU / code</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
          </thead>
          <tbody>${invoiceRows}</tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(order.subtotal_amount, order.currency))}</span></div>
          <div class="totals-row"><span>Discount</span><span>- ${escapeHtml(formatCurrency(order.discount_amount, order.currency))}</span></div>
          <div class="totals-row total"><span>Total</span><span>${escapeHtml(formatCurrency(order.total_amount, order.currency))}</span></div>
        </div>
      </section>

      <section class="document shipping-document">
        <div class="shipping-frame">
          <div class="brand">${brandMarkup}</div>
          <p class="eyebrow">Shipping paper</p>
          <p class="shipping-order">${escapeHtml(orderNumber)}</p>

          <div class="recipient">
            <p class="eyebrow">Deliver to</p>
            <p class="recipient-name">${escapeHtml(customerName)}</p>
            <p class="recipient-phone">${escapeHtml(customerPhone)}</p>
            <div class="address">${addressLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>
          </div>

          <div class="shipping-meta">
            <section class="card">
              <h3>Shipping method</h3>
              <p><strong>${escapeHtml(order.shipping_method || 'Not selected')}</strong></p>
            </section>
            <section class="card">
              <h3>Payment</h3>
              <p><strong>${escapeHtml(order.payment_method || 'Not selected')}</strong></p>
            </section>
            <section class="card">
              <h3>Package contents</h3>
              <p><strong>${escapeHtml(items.length)} lines · ${escapeHtml(itemQuantity)} items</strong></p>
            </section>
          </div>

          <table style="margin-top: 24px">
            <thead><tr><th>Contents</th><th>SKU / code</th><th>Qty</th></tr></thead>
            <tbody>${packingRows}</tbody>
          </table>
        </div>
        <p class="footer-note">Prepared from confirmed scan results for ${escapeHtml(orderNumber)}.</p>
      </section>
    </body>
  </html>`
}
