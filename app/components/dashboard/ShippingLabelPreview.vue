<template>
  <Teleport to="body">
    <div data-shipping-label-preview class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" @click.self="close">
      <section data-label-dialog @keydown="handleKeys" role="dialog" aria-modal="true" :aria-labelledby="titleId" class="max-h-[94vh] w-full max-w-3xl overflow-auto rounded-lg border shipping-label-surface shadow-lg">
        <header data-label-controls class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b shipping-label-surface p-3">
          <div><h4 :id="titleId" class="text-base font-semibold">{{ $t('shippingLabel.title') }}</h4><p class="mt-1 text-xs"><span>AWB:</span> <bdi class="font-mono">{{ document.identity.awb }}</bdi></p></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" :disabled="loading || !!failure" class="min-h-11 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" @click="print">{{ $t('shippingLabel.print') }}</button>
            <button ref="closeButton" type="button" class="min-h-11 rounded-lg border px-3 py-2 text-sm" @click="close">{{ $t('common.close') }}</button>
          </div>
        </header>
        <p v-if="loading" data-label-controls role="status" class="p-4 text-sm">{{ $t('shippingLabel.loading') }}</p>
        <p v-if="failure" data-label-controls role="alert" class="p-4 text-sm shipping-label-error">{{ $t('shippingLabel.unavailable') }}</p>
        <div data-label-pages class="space-y-3 overflow-auto shipping-label-canvas-area p-3">
          <canvas v-for="(page,index) in pages" :key="index" :ref="el=>canvases[index]=el" role="img" :aria-label="$t('shippingLabel.page',{number:index+1})" data-label-page class="mx-auto block shipping-label-paper shadow-sm" :style="{width:page.width+'pt',maxWidth:'100%',height:'auto','--label-width':page.width+'pt','--label-height':page.height+'pt'}" />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import {ref,nextTick,onMounted,onBeforeUnmount} from 'vue'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
const props=defineProps({document:{type:Object,required:true},autoPrint:{type:Boolean,default:false}})
const emit=defineEmits(['close'])
const pages=ref([]),loading=ref(true),failure=ref(false),closeButton=ref(null),canvases=[]
const titleId='shipping-label-'+props.document.identity.jobId
let task,render,disposed=false,pageStyle,previousFocus
const cleanupPrint=()=>{document.body.classList.remove('shipping-label-printing');pageStyle?.remove();pageStyle=null;window.removeEventListener('afterprint',cleanupPrint)}
const close=()=>emit('close')
const handleKeys=event=>{
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
 if(event.key!=='Tab')return
 const buttons=[...event.currentTarget.querySelectorAll('button:not([disabled])')],first=buttons[0],last=buttons.at(-1)
 if(first&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last))){event.preventDefault();(event.shiftKey?last:first).focus()}
}
const print=()=>{
  if(loading.value||failure.value||disposed||!pages.value.length)return
  cleanupPrint();pageStyle=document.createElement('style')
  pageStyle.textContent=pages.value.map((page,index)=>`@page shippingLabelPage${index} {size:${page.width}pt ${page.height}pt;margin:0} body.shipping-label-printing [data-label-page]:nth-child(${index+1}) {page:shippingLabelPage${index}}`).join('\n')
  document.head.appendChild(pageStyle);document.body.classList.add('shipping-label-printing')
  window.addEventListener('afterprint',cleanupPrint,{once:true})
  try{window.print()}catch{cleanupPrint();failure.value=true}
}
onMounted(async()=>{
 previousFocus=document.activeElement;await nextTick();closeButton.value?.focus()
 try{
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
  if(disposed)return
  pdfjs.GlobalWorkerOptions.workerSrc=workerUrl
  task=pdfjs.getDocument({data:new Uint8Array(props.document.bytes),isEvalSupported:false,useWasm:false,enableXfa:false,maxImageSize:10000000,stopAtErrors:true,standardFontDataUrl:new URL(`/_nuxt/pdfjs-${pdfjs.version}/standard_fonts/`,window.location.origin).href})
  const pdf=await task.promise
  if(disposed)return
  if(pdf.numPages<1||pdf.numPages>4)throw Error('Invalid pages')
  const documents=[]
  for(let n=1;n<=pdf.numPages;n++){
   const page=await pdf.getPage(n),view=page.getViewport({scale:1})
   if(!Number.isFinite(view.width)||!Number.isFinite(view.height)||view.width<10||view.height<10||view.width>1500||view.height>1500)throw Error('Invalid page')
   documents.push({page,width:view.width,height:view.height})
  }
  pages.value=documents.map(({width,height})=>({width,height}));await nextTick()
  for(let i=0;i<documents.length;i++){
   if(disposed)return
   const page=documents[i].page,scale=Math.min(300/72,Math.sqrt(10000000/(documents[i].width*documents[i].height))),viewport=page.getViewport({scale}),canvas=canvases[i]
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
   render=page.render({canvas,viewport,annotationMode:pdfjs.AnnotationMode.DISABLE});await render.promise;page.cleanup()
  }
  if(!disposed){loading.value=false;if(props.autoPrint)await nextTick().then(print)}
 }catch{if(!disposed){failure.value=true;loading.value=false}}
})
onBeforeUnmount(()=>{disposed=true;cleanupPrint();if(previousFocus?.isConnected)previousFocus.focus();render?.cancel();task?.destroy();for(const canvas of canvases)if(canvas){canvas.width=0;canvas.height=0}})
</script>

<style>
.shipping-label-surface { background:var(--surface,#fff);color:var(--text-primary,#172842);border-color:var(--border,#d1d5db); }
.shipping-label-surface button { color:inherit;border-color:var(--border,#d1d5db); }
.shipping-label-canvas-area { background:var(--surface-muted,#f3f4f6); }
.shipping-label-paper { background:#fff; }
.shipping-label-error { color:var(--danger,#b91c1c); }

@media print {
  body.shipping-label-printing { margin:0!important; background:white!important; }
  body.shipping-label-printing > :not([data-shipping-label-preview]) { display:none!important; }
  body.shipping-label-printing [data-shipping-label-preview],body.shipping-label-printing [data-label-dialog],body.shipping-label-printing [data-label-pages] { position:static!important;display:block!important;overflow:visible!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:white!important;box-shadow:none!important; }
  body.shipping-label-printing [data-label-controls] { display:none!important; }
  body.shipping-label-printing [data-label-page] { display:block!important;width:var(--label-width)!important;height:var(--label-height)!important;max-width:none!important;margin:0!important;box-shadow:none!important;break-after:page; }
  body.shipping-label-printing [data-label-page]:last-child { break-after:auto; }
}
</style>
