/* Application bridge. Paymob's unmodified 1.2.8 SDK owns every payment field. */
(() => {
  'use strict'
  const parentOrigin = location.origin
  let channel = '', initialized = false, submitted = false, authorizing = false, cardValid = false, observer, approval
  const send = (type, extra = {}) => {
    if (channel) parent.postMessage({ source: 'paymob-frame-v1', channel, type, ...extra }, parentOrigin)
  }
  const receive = event => {
    if (event.source !== parent || event.origin !== parentOrigin) return
    const input = event.data
    if (initialized && input?.source === 'storefront-pixel-v1' && input.type === 'authorize-result'
      && input.channel === channel && input.requestId === approval?.id) {
      approval.resolve(input.allowed === true); return
    }
    if (initialized) return
    if (!input || input.source !== 'storefront-pixel-v1' || input.type !== 'initialize'
      || !/^[0-9a-f-]{36}$/i.test(input.channel || '')) return
    channel = input.channel
    const options = input.options, expiry = Date.parse(input.expiresAt)
    if (!Number.isFinite(expiry) || expiry <= Date.now() || !options || typeof options.publicKey !== 'string' || typeof options.clientSecret !== 'string'
      || !/^(egy_)?pk_(test|live)_.{1,450}$/.test(options.publicKey)
      || !/^(egy_)?csk_(test|live)_.{1,450}$/.test(options.clientSecret)
      || options.publicKey.match(/_(test|live)_/)[1] !== options.clientSecret.match(/_(test|live)_/)[1]
      || !Array.isArray(options.paymentMethods) || options.paymentMethods.length !== 1 || !['card', 'apple-pay'].includes(options.paymentMethods[0])
      || options.paymentMethods[0] === 'apple-pay' && (!window.isSecureContext || !window.ApplePaySession?.canMakePayments?.())) {
      initialized = true; send('unavailable'); return
    }
    initialized = true
    document.documentElement.lang = input.locale === 'ar' ? 'ar' : 'en'
    document.documentElement.dir = input.locale === 'ar' ? 'rtl' : 'ltr'
    try {
      if (typeof window.Pixel !== 'function') throw Error('SDK unavailable')
      // The iframe is the SDK lifecycle boundary; removing it disposes its globals,
      // shadow roots, requests and event listeners without private vendor methods.
      new window.Pixel({
        publicKey: options.publicKey, clientSecret: options.clientSecret,
        elementId: 'paymob-card', paymentMethods: [...options.paymentMethods],
        showSaveCard: false, forceSaveCard: false, showPaymobLogo: true,
        customStyle: options.customStyle,
        cardValidationChanged: valid => { cardValid = valid === true },
        beforePaymentComplete: async () => {
          if (Date.now() >= expiry) { send('unavailable'); return false }
          if (submitted || authorizing || options.paymentMethods[0] === 'card' && !cardValid) return false
          authorizing = true
          const allowed = await new Promise(resolve => {
            const id = crypto.randomUUID(), timer = setTimeout(() => resolve(false), 12000)
            approval = { id, resolve: value => { clearTimeout(timer); resolve(value) } }
            send('authorize', { requestId: id })
          })
          approval = null; authorizing = false
          if (!allowed) { send('unavailable', { beforeSubmit: false }); return false }
          submitted = true; send('submitted'); return true
        },
        // Ignore all provider payload fields. Only server-verified status can pay.
        afterPaymentComplete: () => send('complete'),
        // The documented cancellation hook is exclusive to Apple Pay.
        // It closes UI; it never resets financial submission evidence.
        onPaymentCancel: () => { if (options.paymentMethods[0] === 'apple-pay') send('cancel') }
      })
      observer = new ResizeObserver(() => send('height', { height: Math.min(1600, Math.max(360, Math.ceil(document.body.scrollHeight))) }))
      observer.observe(document.body)
      send('mounted')
    } catch { send('unavailable', { beforeSubmit: !submitted }) }
  }
  window.addEventListener('message', receive)
  window.addEventListener('pagehide', () => { approval?.resolve(false); observer?.disconnect(); window.removeEventListener('message', receive) }, { once: true })
  parent.postMessage({ source: 'paymob-frame-v1', type: 'ready' }, parentOrigin)
})()
