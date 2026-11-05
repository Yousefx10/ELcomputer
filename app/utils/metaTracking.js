export const metaPublicPath=path=>{
 let clean;try{clean=decodeURIComponent(String(path||'/').split(/[?#]/,1)[0])}catch{return null}
 return clean.startsWith('/')&&!clean.startsWith('//')&&!/^\/(?:ar\/)?(?:(?:dashboard|account|api)(?:\/|$)|sms\/unsubscribe(?:\/|$)|checkout\/)/.test(clean)&&!/[\u0000-\u001f]/.test(clean)?clean.slice(0,500):null
}
export const metaBrowserPrivacyAllowed=()=>typeof navigator!=='undefined'&&navigator.globalPrivacyControl!==true&&!['1','yes'].includes(String(navigator.doNotTrack||globalThis.doNotTrack||'').toLowerCase())
export const emitMetaEvent=(eventName,payload={})=>{
 if(typeof window!=='undefined'&&metaBrowserPrivacyAllowed())window.dispatchEvent(new CustomEvent('store-meta-event',{detail:{eventName,...payload}}))
}
export const metaAnalyticsNames={product_view:'ViewContent',checkout_started:'InitiateCheckout'}
