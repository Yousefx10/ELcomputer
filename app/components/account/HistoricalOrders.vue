<script setup>
const scope=useCustomerScope()
const {locale}=useI18n()
const labels={
 en:{title:'Previous orders',note:'Historical records. No new payment or shipment.',connect:'Connect previous orders',connected:'Previous orders checked.',failed:'Could not load previous orders. Please try again.',empty:'No previous orders are connected.',loading:'Loading previous orders…',details:'Details',next:'Next',previous:'Previous',billing:'Billing address',shipping:'Delivery address',refund:'Historical refund',payment:'Payment method',status:'Recorded status',profile:'Previous profile and addresses'},
 ar:{title:'الطلبات السابقة',note:'سجلات سابقة. لا تنشئ دفعة أو شحنة جديدة.',connect:'ربط الطلبات السابقة',connected:'تم التحقق من الطلبات السابقة.',failed:'تعذر تحميل الطلبات السابقة. حاول مرة أخرى.',empty:'لا توجد طلبات سابقة مرتبطة.',loading:'جارٍ تحميل الطلبات السابقة…',details:'التفاصيل',next:'التالي',previous:'السابق',billing:'عنوان الفاتورة',shipping:'عنوان التوصيل',refund:'استرداد سابق',payment:'طريقة الدفع',status:'الحالة المسجلة',profile:'الملف والعناوين السابقة'}
}
const copy=computed(()=>labels[locale.value==='ar'?'ar':'en'])
const rows=ref([]),profiles=ref([]),total=ref(0),offset=ref(0),loading=ref(false),connecting=ref(false),error=ref(false),notice=ref(false),details=ref({})
let generation=0
scope.onInvalidate(()=>{generation++;rows.value=[];profiles.value=[];details.value={};error.value=false;notice.value=false})
const load=async()=>{
 const current=++generation;loading.value=true;error.value=false;details.value={}
 try{const result=await scope.request('/api/account/history',{query:{offset:offset.value},timeout:15000,retry:0});if(current===generation&&scope.isCurrent()){rows.value=result.orders;profiles.value=result.profiles||[];total.value=result.total}}
 catch{if(current===generation&&scope.isCurrent())error.value=true}
 finally{if(current===generation)loading.value=false}
}
const connect=async()=>{
 if(connecting.value)return;connecting.value=true;error.value=false;notice.value=false
 try{await scope.request('/api/account/history/claim',{method:'POST',body:{confirmed:true},timeout:15000,retry:0});if(scope.isCurrent()){notice.value=true;offset.value=0;await load()}}
 catch{if(scope.isCurrent())error.value=true}
 finally{if(scope.isCurrent())connecting.value=false}
}
const show=async order=>{
 const key=order.source_id+':'+order.legacy_id
 if(details.value[key]){delete details.value[key];return}
 try{const data=await scope.request('/api/account/history/'+order.source_id+'/'+order.legacy_id,{timeout:15000,retry:0});if(scope.isCurrent())details.value[key]=data}
 catch{if(scope.isCurrent())error.value=true}
}
const address=value=>['first_name','last_name','company','address_1','address_2','city','state','postcode','country','phone','email'].map(key=>value?.[key]).filter(v=>v!==null&&v!==undefined&&v!=='').join(', ')
const move=amount=>{offset.value+=amount;load()}
onMounted(load)
</script>

<template>
 <section class="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-700" :aria-label="copy.title">
  <div class="flex flex-wrap items-center justify-between gap-3">
   <div><h2 class="text-lg font-bold">{{ copy.title }}</h2><p class="text-sm text-slate-600 dark:text-slate-400">{{ copy.note }}</p></div>
   <button type="button" class="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50 dark:border-slate-600" :disabled="connecting||loading" @click="connect">{{ copy.connect }}</button>
  </div>
  <p v-if="error" role="alert" class="text-sm text-red-600 dark:text-red-400">{{ copy.failed }}</p>
  <p v-if="notice" role="status" class="text-sm">{{ copy.connected }}</p>
  <details v-for="profile in profiles" :key="profile.source_id" class="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
   <summary class="cursor-pointer font-semibold">{{ copy.profile }}</summary>
   <p class="mt-2 break-words">{{ profile.profile.display_name }}</p>
   <p v-if="address(profile.billing_address)" class="mt-2 break-words">{{ copy.billing }}: {{ address(profile.billing_address) }}</p>
   <p v-if="address(profile.shipping_address)" class="mt-2 break-words">{{ copy.shipping }}: {{ address(profile.shipping_address) }}</p>
  </details>
  <p v-if="loading" role="status" class="text-sm">{{ copy.loading }}</p>
  <p v-else-if="!error&&!rows.length" class="text-sm text-slate-600 dark:text-slate-400">{{ copy.empty }}</p>
  <article v-for="order in rows" :key="order.source_id+':'+order.legacy_id" class="space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
   <div class="flex flex-wrap items-center justify-between gap-2"><span>{{ order.kind==='shop_order_refund'?copy.refund:'#'+order.legacy_id }}</span><span dir="ltr">{{ order.total }} {{ order.currency }}</span></div>
   <div class="flex flex-wrap items-center justify-between gap-2"><span>{{ copy.status }}: {{ order.status }}</span><button type="button" class="min-h-10 px-2 font-semibold text-blue-700 dark:text-blue-400" :aria-expanded="Boolean(details[order.source_id+':'+order.legacy_id])" @click="show(order)">{{ copy.details }}</button></div>
   <div v-if="details[order.source_id+':'+order.legacy_id]" class="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
    <template v-for="detail in [details[order.source_id+':'+order.legacy_id]]" :key="order.legacy_id">
     <p v-if="detail.order.payment_title||detail.order.payment_method">{{ copy.payment }}: {{ detail.order.payment_title||detail.order.payment_method }}</p>
     <p v-for="item in detail.items" :key="item.legacy_id" class="break-words">{{ item.title }}<span v-if="item.quantity"> × {{ item.quantity }}</span></p>
     <p v-if="address(detail.order.billing_address)" class="break-words">{{ copy.billing }}: {{ address(detail.order.billing_address) }}</p>
     <p v-if="address(detail.order.shipping_address)" class="break-words">{{ copy.shipping }}: {{ address(detail.order.shipping_address) }}</p>
     <p v-for="(event,index) in detail.order.fulfillment_events||[]" :key="index" class="break-words">{{ event.date }} — {{ event.status }}</p>
    </template>
   </div>
  </article>
  <div v-if="total>10" class="flex items-center justify-between text-sm"><button type="button" class="min-h-10 px-3 disabled:opacity-50" :disabled="offset===0||loading" @click="move(-10)">{{ copy.previous }}</button><button type="button" class="min-h-10 px-3 disabled:opacity-50" :disabled="offset+10>=total||loading" @click="move(10)">{{ copy.next }}</button></div>
 </section>
</template>
