<script setup>
import { normalizeBrandPage, BRAND_ROW_LIMIT } from '~/utils/brandPage'
const model = defineModel({ type: Object, required: true })
defineProps({ disabled: Boolean })
const { t } = useI18n()
const newId = () => globalThis.crypto.randomUUID()
const newItem = () => ({ id: newId(), type: 'image', url: '', poster: '', alt: '', caption: '', link: '' })
const addRow = () => { if (model.value.rows.length < BRAND_ROW_LIMIT) model.value.rows.push({ id: newId(), layout: 'one', items: [newItem()] }) }
const move = (index, delta) => { const rows = model.value.rows; [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]] }
const removeRow = index => { if (confirm(t('brandPages.removeRowConfirm'))) model.value.rows.splice(index, 1) }
const removeItem = (row, index) => { if (confirm(t('brandPages.removeMediaConfirm'))) row.items.splice(index, 1) }
const changeLayout = (row, event) => {
  const value = event.target.value
  if (value === 'one' && row.items.length > 1 && !confirm(t('brandPages.removeMediaConfirm'))) { event.target.value = row.layout; return }
  row.layout = value
  if (value === 'one') row.items.splice(1)
  if (value === 'two' && row.items.length === 1) row.items.push(newItem())
}
const changeType = (item, event) => {
  const value = event.target.value
  if (item.url && !confirm(t('brandPages.replaceMediaConfirm'))) { event.target.value = item.type; return }
  item.type = value; item.url = ''; item.poster = ''
}
if (!model.value?.hero) model.value = normalizeBrandPage(model.value)
</script>

<template>
  <fieldset :disabled="disabled" class="brand-page-editor">
    <legend>{{ $t('brandPages.editorTitle') }}</legend>
    <p class="brand-editor-help">{{ $t('brandPages.optionalContent') }}</p>
    <details>
      <summary>{{ $t('brandPages.hero') }}</summary>
      <div class="brand-editor-fields">
        <DashboardMediaUploadField v-model="model.hero.image" :label="$t('brandPages.heroImage')" section="brands" :disabled="disabled" preview-height-class="h-36" />
        <DashboardMediaUploadField v-model="model.hero.mobile_image" :label="$t('brandPages.mobileHero')" section="brands" :disabled="disabled" preview-height-class="h-28" />
        <label>{{ $t('brandPages.headline') }}<input v-model="model.hero.title" maxlength="200" dir="auto"></label>
        <label>{{ $t('brandPages.supportingText') }}<textarea v-model="model.hero.text" rows="3" maxlength="600" dir="auto" /></label>
        <div class="brand-editor-pair"><label>{{ $t('brandPages.ctaText') }}<input v-model="model.hero.cta_label" maxlength="80" dir="auto"></label><label>{{ $t('brandPages.ctaLink') }}<input v-model="model.hero.cta_url" maxlength="2048" dir="ltr" placeholder="#brand-products"></label></div>
        <div class="brand-editor-pair"><label>{{ $t('brandPages.alignment') }}<select v-model="model.hero.alignment"><option value="start">{{ $t('brandPages.start') }}</option><option value="center">{{ $t('brandPages.center') }}</option><option value="end">{{ $t('brandPages.end') }}</option></select></label><label>{{ $t('brandPages.overlay') }}<input v-model.number="model.hero.overlay" type="range" min="0.55" max="0.85" step="0.05"><span>{{ Math.round(model.hero.overlay * 100) }}%</span></label></div>
      </div>
    </details>
    <details>
      <summary>{{ $t('brandPages.background') }}</summary>
      <div class="brand-editor-fields"><DashboardMediaUploadField v-model="model.background.image" :label="$t('brandPages.wallpaper')" section="brands" :disabled="disabled" preview-height-class="h-28" /><label>{{ $t('brandPages.backgroundColor') }}<input v-model="model.background.color" maxlength="7" dir="ltr" placeholder="#f5f5f5"></label><p class="brand-editor-help">{{ $t('brandPages.backgroundHelp') }}</p></div>
    </details>
    <details>
      <summary>{{ $t('brandPages.story') }}</summary>
      <div class="brand-editor-fields"><label>{{ $t('brandPages.sectionTitle') }}<input v-model="model.story.title" maxlength="200" dir="auto"></label><label>{{ $t('brandPages.storyContent') }}<textarea v-model="model.story.content" rows="7" maxlength="30000" dir="auto" /></label><p class="brand-editor-help">{{ $t('brandPages.markdownHelp') }}</p><label>{{ $t('brandPages.supportingText') }}<textarea v-model="model.story.supporting" rows="3" maxlength="2000" dir="auto" /></label></div>
    </details>
    <div class="brand-editor-rows">
      <div class="brand-editor-row-heading"><h3>{{ $t('brandPages.mediaRows') }}</h3><button type="button" :disabled="disabled || model.rows.length >= BRAND_ROW_LIMIT" @click="addRow">+ {{ $t('brandPages.addRow') }}</button></div>
      <p v-if="!model.rows.length" class="brand-editor-help">{{ $t('brandPages.noRows') }}</p>
      <details v-for="(row, index) in model.rows" :key="row.id" open class="brand-editor-row" :data-row-id="row.id">
        <summary>{{ $t('brandPages.rowNumber', { number: index + 1 }) }}</summary>
        <div class="brand-editor-fields">
          <div class="brand-editor-row-heading"><label>{{ $t('brandPages.rowLayout') }}<select :value="row.layout" @change="changeLayout(row, $event)"><option value="one">{{ $t('brandPages.oneMedia') }}</option><option value="two">{{ $t('brandPages.twoMedia') }}</option></select></label><div class="brand-row-actions"><button type="button" :disabled="disabled || index === 0" :aria-label="$t('brandPages.moveUp', { number: index + 1 })" @click="move(index, -1)">↑</button><button type="button" :disabled="disabled || index === model.rows.length - 1" :aria-label="$t('brandPages.moveDown', { number: index + 1 })" @click="move(index, 1)">↓</button><button type="button" :disabled="disabled" @click="removeRow(index)">{{ $t('brandPages.removeRow') }}</button></div></div>
          <div class="brand-editor-media-grid" :class="{ 'brand-editor-pair': row.layout === 'two' }">
            <div v-for="(item, slot) in row.items" :key="item.id" class="brand-editor-media" :data-media-id="item.id">
              <label>{{ $t('brandPages.mediaType') }}<select :value="item.type" @change="changeType(item, $event)"><option value="image">{{ $t('brandPages.image') }}</option><option value="video">{{ $t('brandPages.video') }}</option></select></label>
              <DashboardMediaUploadField v-if="item.type === 'image'" v-model="item.url" :label="$t('brandPages.image')" section="brands" :disabled="disabled" preview-height-class="h-28" />
              <template v-else><label>{{ $t('brandPages.videoUrl') }}<input v-model="item.url" maxlength="2048" type="url" dir="ltr"></label><p class="brand-editor-help">{{ $t('brandPages.videoHelp') }}</p><DashboardMediaUploadField v-model="item.poster" :label="$t('brandPages.poster')" section="brands" :disabled="disabled" preview-height-class="h-24" /></template>
              <label>{{ $t('brandPages.altText') }}<input v-model="item.alt" maxlength="300" dir="auto"></label>
              <label>{{ $t('brandPages.caption') }}<textarea v-model="item.caption" rows="2" maxlength="1000" dir="auto" /></label>
              <label v-if="item.type === 'image'">{{ $t('brandPages.imageLink') }}<input v-model="item.link" maxlength="2048" dir="ltr"></label>
              <button type="button" :disabled="disabled" @click="removeItem(row, slot)">{{ $t('brandPages.removeMedia') }}</button>
            </div>
          </div>
          <button v-if="row.items.length < (row.layout === 'two' ? 2 : 1)" type="button" :disabled="disabled" @click="row.items.push(newItem())">+ {{ $t('brandPages.addMedia') }}</button>
        </div>
      </details>
    </div>
  </fieldset>
</template>

<style scoped>
.brand-page-editor { min-width:0; border-top:1px solid var(--border); padding-top:24px; }
legend { padding-top:20px; font-size:1.25rem; font-weight:750; }
.brand-editor-help { font-size:.85rem; color:var(--text-secondary); line-height:1.6; margin-block:8px 16px; }
details { border-bottom:1px solid var(--border); }summary { padding-block:18px; font-weight:700; cursor:pointer; min-height:44px; }
.brand-editor-fields { display:grid; min-width:0; gap:16px; padding-bottom:24px; }
.brand-editor-fields label { display:block; min-width:0; font-size:.9rem; font-weight:650; }
.brand-editor-fields :is(input:not([type=range]),textarea,select) { display:block; width:100%; min-width:0; min-height:44px; margin-top:8px; padding:10px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text-primary); font-weight:400; }
input[type=range] { display:block; width:100%; min-height:44px; }textarea { resize:vertical; }
.brand-editor-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.brand-editor-rows { margin-top:24px; }.brand-editor-row-heading { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }.brand-editor-row-heading h3 { font-weight:700; font-size:1.1rem; }
.brand-editor-row-heading>label { flex:1 1 180px; }.brand-row-actions { display:flex; flex-wrap:wrap; gap:8px; }
.brand-editor-row { margin-top:16px; padding-inline:16px; border:1px solid var(--border); border-radius:6px; }
.brand-editor-media { display:grid; min-width:0; gap:14px; padding:16px; background:var(--surface-muted); }.brand-editor-media-grid { display:grid; gap:16px; }
button { min-height:44px; padding:8px 14px; border:1px solid var(--border); border-radius:6px; font-size:.85rem; font-weight:650; background:var(--surface); color:var(--text-primary); }button:disabled { opacity:.45; cursor:not-allowed; }
:is(input,textarea,select,button,summary):focus-visible { outline:3px solid var(--brand); outline-offset:3px; }
@media(max-width:900px) { .brand-editor-pair { grid-template-columns:minmax(0,1fr); }.brand-editor-row { padding-inline:12px; }.brand-editor-media { padding:12px; } }
</style>
