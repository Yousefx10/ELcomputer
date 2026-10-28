import {createSSRApp,h,Suspense,ref,shallowRef,reactive,computed,watch,effectScope,onMounted,onBeforeUnmount,onScopeDispose,nextTick,useId} from 'vue'
import Navbar from '../../app/components/layout/NavBar.vue'
import Account from '../../app/layouts/account.vue'
import {useCustomerIdentity} from '../../app/composables/useCustomerIdentity.js'
import {useCustomerDisplayProfile} from '../../app/composables/useCustomerDisplayProfile.js'
export function setup(fixture,server=false){
 const user=ref(fixture.actor?{id:fixture.actor,user_metadata:fixture.metadata||{},email:'synthetic@example.invalid'}:null),claims=ref(fixture.serverClaims||user.value),session=ref(user.value?{user:user.value}:null),state=new Map(),reads=[],actions=[]
 const controls={reads,actions,resolve(index,profile,error=false){reads[index].resolve(error?{error:Error('Synthetic unavailable')}:{data:profile})},switchTo(id,metadata={},staleClaims=true){session.value=id?{user:{id,user_metadata:metadata}}:null;if(!staleClaims)claims.value=session.value?.user||null}}
 const supabase={auth:{async signOut(){actions.push('signOut');session.value=null;claims.value=null;return {error:null}}},from(table){
  if(table!=='customer_profiles')throw Error('Unexpected profile table')
  return {select:columns=>({eq(field,id){return {maybeSingle:()=>({abortSignal:signal=>new Promise(resolve=>reads.push({id,columns,resolve,signal}))})}}})}
 }}
 let app
 const translate=(key,params={})=>{let value=key.split('.').reduce((v,k)=>v?.[k],fixture.messages);if(typeof value!=='string')throw Error('Missing translation '+key);for(const[k,v]of Object.entries(params))value=value.replaceAll('{'+k+'}',String(v));return value}
 Object.assign(globalThis,{ref,shallowRef,reactive,computed,watch,effectScope,onMounted,onBeforeUnmount,onScopeDispose,nextTick,useId,useCustomerIdentity,useCustomerDisplayProfile,
 useNuxtApp:()=>({vueApp:app}),useSupabaseSession:()=>session,useSupabaseUser:()=>claims,useSupabaseClient:()=>supabase,
 useState:(key,initial)=>{if(!state.has(key))state.set(key,ref(initial()));return state.get(key)},
 useCategoryLocale:()=>({categoryName:row=>row.name}),useUiLocale:()=>({intlLocale:ref(fixture.locale==='ar'?'ar-EG':'en-EG'),uiLabel:value=>value}),useUiNavigation:()=>({uiNavigateTo:path=>actions.push(path)}),
 useUiRoute:()=>({path:'/',fullPath:'/',query:{}}),useI18n:()=>({t:translate,locale:ref(fixture.locale)}),useCart:()=>({itemCount:ref(0),subtotal:ref(0),loadCart:()=>{}}),
 useSiteContent:()=>({data:ref({settings:{site_name:'Synthetic store'},headerLinks:[{id:'fixture-departments',link_type:'categories-dropdown'}],navbarCategories:[],customPages:[]})}),useAccountAppearance:()=>({data:ref({account_dashboard_style:'modern'})})})
 // Nuxt returns the same app object to every consumer.
 const nuxt={};globalThis.useNuxtApp=()=>nuxt
 app=createSSRApp({setup(){return()=>h(Suspense,null,{default:()=>h('div',{class:'storefront'},[h(Navbar),fixture.account?h(Account,null,{default:()=>h('p','Synthetic account content')}):null]),fallback:()=>h('div','Loading')})}});nuxt.vueApp=app
 app.component('NuxtLinkLocale',{props:['to'],render(){return h('a',{href:typeof this.to==='string'?this.to:this.to.path+(this.to.query?'?'+new URLSearchParams(this.to.query):'')},this.$slots.default?.())}})
 app.component('Icon',{props:['size'],setup:props=>()=>h('span',{class:'iconify',style:{display:'inline-block',width:props.size+'px',height:props.size+'px'},'aria-hidden':'true'})})
 app.component('BrandLogo',{setup:()=>()=>h('span','Synthetic store')})
 app.component('LayoutSearchBar',{setup:()=>()=>h('div',{class:'store-search-wrap'},h('div',{class:'store-search'},h('input',{'aria-label':'Search'})))})
 app.component('NuxtLayout',{setup:(_,ctx)=>()=>h('section',{'data-fixture-layout':'default'},ctx.slots.default?.())})
 app.component('AccountNavigation',{setup:()=>()=>h('a',{href:'/account/profile'},'Profile')})
 app.config.globalProperties.$t=translate;app.config.globalProperties.$uiLabel=value=>value
 if(!server)window.__nav=controls
 return {app,controls}
}
