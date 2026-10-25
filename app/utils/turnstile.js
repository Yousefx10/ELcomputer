const scriptId = 'customer-auth-turnstile'
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let pending

// Lazy, shared loader. Never proxy the vendor script or persist challenge tokens.
export const loadTurnstile = () => {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile)
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const script = document.getElementById(scriptId) || document.createElement('script')
    const cleanup = () => { clearTimeout(timer); script.removeEventListener('load', loaded); script.removeEventListener('error', failed) }
    const failed = () => { cleanup(); script.remove(); pending = undefined; reject(new Error('Security check unavailable')) }
    const loaded = () => { if (!window.turnstile?.render) { failed(); return }; cleanup(); resolve(window.turnstile) }
    const timer = setTimeout(failed, 15000)
    script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true })
    if (!script.isConnected) { script.id = scriptId; script.src = scriptUrl; script.async = true; script.defer = true; document.head.append(script) }
  })
  return pending
}
