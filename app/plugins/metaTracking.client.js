import {subscribeStorefrontAudience} from '~/composables/useStorefrontAudience'
import {metaAnalyticsNames,metaPublicPath} from '~/utils/metaTracking'
export default defineNuxtPlugin(nuxt=>{
 const tracking=useMetaTracking(),route=useRoute()
 let lastPage=''
 // A product view can fire before settings load or before the visitor answers the banner.
 let heldView=null
 const flushView=()=>{if(heldView&&heldView.page===route.fullPath&&tracking.allowed()){const detail=heldView.detail;heldView=null;void tracking.track('ViewContent',detail)}}
 const pageView=()=>{if(!metaPublicPath(route.path)){window.fbq?.('consent','revoke');return}if(!tracking.allowed()||lastPage===route.fullPath)return;lastPage=route.fullPath;void tracking.track('PageView');if(route.path.replace(/^\/ar/,'').startsWith('/search')&&typeof route.query.q==='string'&&route.query.q.trim())void tracking.track('Search')}
 const listener=event=>{
  const detail=event.detail||{},name=metaAnalyticsNames[detail.eventName]||detail.eventName
  if(name==='Purchase'){void tracking.purchase(detail.orderId);return}
  if(name==='ViewContent'&&!tracking.allowed()){heldView={detail,page:route.fullPath};return}
  if(['ViewContent','AddToCart','InitiateCheckout','AddPaymentInfo'].includes(name))void tracking.track(name,detail)
 }
 window.addEventListener('store-meta-event',listener)
 const stopAudience=subscribeStorefrontAudience(()=>{lastPage='';void tracking.initialize().then(pageView)});nuxt.hook('app:beforeUnmount',()=>{stopAudience();window.removeEventListener('store-meta-event',listener)})
 watch(()=>tracking.state.value.choice,choice=>{if(choice==='granted')flushView()})
 nuxt.hook('app:mounted',async()=>{await tracking.initialize();pageView();flushView()})
 nuxt.hook('page:finish',()=>{pageView();flushView();const match=route.path.match(/^\/(?:ar\/)?account\/orders\/([a-f0-9-]{36})$/i);if(match)void tracking.purchase(match[1])})
})
