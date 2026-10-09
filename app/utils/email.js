// Plain-text template sources become escaped, branded HTML. No executable markup.
import { claimCommunicationTemplateVariables } from './claimCommunications.js'
export const emailVariables = [...new Set(['customer_name', 'reference', 'message', 'store_name',...claimCommunicationTemplateVariables])]
export const emailAddress = value => {
 if (typeof value !== 'string' || value.length > 254 || value !== value.trim() || !/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value) || value.includes('..') || value.split('@')[0].length > 64 || value.split('@')[1].split('.').some(x => x.length>63 || x.startsWith('-') || x.endsWith('-'))) throw Error('Enter a valid email address.')
 return value.toLowerCase()
}
export const emailLine = (value, max = 200, required = true) => {
 if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f\u2028\u2029]/.test(value) || required && !value.trim()) throw Error('Invalid email field.')
 return value.trim()
}
export const emailBody = value => {
 if (typeof value !== 'string' || !value.trim() || value.length > 20000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw Error('Invalid email body.')
 return value.replace(/\r\n?/g,'\n').trim()
}
export const escapeEmailHtml = value => String(value).replace(/[&<>"']/g, x => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[x])
export const renderEmailSource = (source, values = {}, subject = false) => {
 if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key=>!emailVariables.includes(key))) throw Error('Invalid email placeholders.')
 const rendered = source.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
  if (!emailVariables.includes(key) || typeof values[key] !== 'string' || values[key].length > 4000) throw Error('Complete the template placeholders.')
  return values[key]
 })
 if (/[{}]/.test(source.replace(/\{\{([a-z_]+)\}\}/g,''))) throw Error('Use supported placeholders only.')
 return subject ? emailLine(rendered) : emailBody(rendered)
}
export const emailLayout = ({ subject, body, locale, brand, unsubscribeUrl = '',action_url = '' }) => {
 const rtl = locale === 'ar', e = escapeEmailHtml
 if(action_url&&!/^https:\/\/new\.elcomputer\.net\/(?:ar\/)?account\/after-sales\/[a-f0-9-]{36}$/i.test(action_url))throw Error('Invalid claim account link.')
 const footer = (action_url?`<p><a href="${e(action_url)}" rel="noreferrer">${rtl?'عرض المطالبة في حسابي':'View claim in My Account'}</a></p>`:'')+(unsubscribeUrl ? `<p><a href="${e(unsubscribeUrl)}">${rtl ? 'إلغاء الاشتراك في الرسائل التسويقية' : 'Unsubscribe from marketing email'}</a></p>` : '')
 return `<!doctype html><html lang="${rtl?'ar':'en'}" dir="${rtl?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${e(subject)}</title></head><body style="margin:0;background:#f3f4f6;color:#111827;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:#fff;border-radius:12px"><tr><td style="padding:24px;border-bottom:1px solid #e5e7eb;font-weight:bold">${e(brand)}</td></tr><tr><td style="padding:24px;line-height:1.7;overflow-wrap:anywhere;text-align:${rtl?'right':'left'}"><h1 style="font-size:22px;margin:0 0 20px">${e(subject)}</h1>${body.split('\n\n').map(p=>`<p style="margin:0 0 16px">${e(p).replace(/\n/g,'<br>')}</p>`).join('')}${footer}</td></tr></table></td></tr></table></body></html>`
}
