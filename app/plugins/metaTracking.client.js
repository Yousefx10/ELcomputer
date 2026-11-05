import {subscribeStorefrontAudience} from '~/composables/useStorefrontAudience'
import {metaAnalyticsNames,metaPublicPath} from '~/utils/metaTracking'
export default defineNuxtPlugin(nuxt=>{
 const tracking=useMetaTracking(),route=useRoute()
 let lastPage=''
 const pageView=()=>{if(!metaPublicPath(route.path)){window.fbq?.('consent','revoke');return}if(!tracking.allowed()||lastPage===route.fullPath)return;lastPage=route.fullPath;void tracking.track('PageView');if(route.path.replace(/^\/ar/,'').startsWith('/search')&&typeof route.query.q==='string'&&route.query.q.trim())void tracking.track('Search')}
 const listener=event=>{
  const detail=event.detail||{},name=metaAnalyticsNames[detail.eventName]||detail.eventName
  if(name==='Purchase'){void tracking.purchase(detail.orderId);return}
  if(['ViewContent','AddToCart','InitiateCheckout','AddPaymentInfo'].includes(name))void tracking.track(name,detail)
 }
 window.addEventListener('store-meta-event',listener)
 const stopAudience=subscribeStorefrontAudience(()=>{lastPage='';void tracking.initialize().then(pageView)});nuxt.hook('app:beforeUnmount',()=>{stopAudience();window.removeEventListener('store-meta-event',listener)})
 nuxt.hook('app:mounted',async()=>{await tracking.initialize();pageView()})
 nuxt.hook('page:finish',()=>{pageView();const match=route.path.match(/^\/(?:ar\/)?account\/orders\/([a-f0-9-]{36})$/i);if(match)void tracking.purchase(match[1])})
})
