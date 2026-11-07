<script setup>
import { familyChoices, familyValue, familyMemberLabel, familyChoiceStyle, familyChoiceColor, lightColor } from '~/utils/productFamily'
import { usePublicImageUrl } from '~/composables/usePublicImageUrl'
const props = defineProps({ family: { type: Object, default: null }, productId: { type: String, required: true } })
const { locale } = useI18n()
const publicImage = usePublicImageUrl()
const failed = ref([])
const visible = computed(() => props.family?.members?.length > 1 && props.family.members.some(row => row.product_id === props.productId))
const current = computed(() => props.family?.members?.find(row => row.product_id === props.productId) || null)
const axes = computed(() => (props.family?.axes || []).map(axis => ({ ...axis, style: familyChoiceStyle(axis.key), choices: familyChoices(props.family, props.productId, axis.key) })))
const allCombinations = computed(() => visible.value && props.family.members.some(row => !axes.value.some(axis => axis.choices.includes(row))))
const href = row => `/products/${encodeURIComponent(row.slug)}`
const axisLabel = axis => locale.value === 'ar' ? axis.label_ar || axis.label : axis.label
const photo = row => row.image_url && !failed.value.includes(row.image_url) ? publicImage(row.image_url) : ''
const broken = row => { if (row.image_url && !failed.value.includes(row.image_url)) failed.value = [...failed.value, row.image_url] }
const color = (row, key) => familyChoiceColor(row, key)
</script>

<template>
  <section v-if="visible" class="pdp-family" :aria-label="$t('productFamily.standalone')" data-product-family>
    <div v-for="axis in axes" :key="axis.key" class="pdp-family-axis" role="group" :aria-label="axisLabel(axis)">
      <p class="pdp-family-label">{{ axisLabel(axis) }}<template v-if="current">: <bdi>{{ familyValue(current, axis.key, locale) }}</bdi></template></p>
      <div class="pdp-family-choices" :data-style="axis.style">
        <NuxtLinkLocale v-for="row in axis.choices" :key="row.product_id" :to="href(row)" class="pdp-family-choice" :data-style="axis.style"
          :aria-current="row.product_id === productId ? 'page' : undefined" :title="row.title || undefined">
          <template v-if="axis.style === 'photo'">
            <span class="pdp-family-photo">
              <img v-if="photo(row)" :src="photo(row)" alt="" width="72" height="72" loading="lazy" decoding="async" @error="broken(row)">
              <span v-else-if="color(row, axis.key)" class="pdp-family-dot" :data-light="lightColor(color(row, axis.key))" :style="{ backgroundColor: color(row, axis.key) }" aria-hidden="true" />
              <Icon v-else name="lucide:image" size="20" aria-hidden="true" />
              <Icon v-if="row.product_id === productId" name="lucide:check" class="pdp-family-check" size="13" aria-hidden="true" />
            </span>
            <span class="pdp-family-name"><bdi>{{ familyValue(row, axis.key, locale) }}</bdi></span>
          </template>
          <template v-else>
            <span v-if="axis.style === 'switch'" class="pdp-switch-stem" :data-known="!!color(row, axis.key)" :style="color(row, axis.key) ? { '--stem': color(row, axis.key) } : undefined" aria-hidden="true" />
            <bdi>{{ familyValue(row, axis.key, locale) }}</bdi>
          </template>
        </NuxtLinkLocale>
      </div>
    </div>
    <div v-if="allCombinations" class="pdp-family-choices" :aria-label="$t('productFamily.allOptions')">
      <NuxtLinkLocale v-for="row in family.members" :key="row.product_id" :to="href(row)" class="pdp-family-choice" :aria-current="row.product_id === productId ? 'page' : undefined">{{ familyMemberLabel(family, row, locale) }}</NuxtLinkLocale>
    </div>
  </section>
</template>

<style scoped>
.pdp-family{margin-block:1.1rem;display:grid;gap:.9rem}
.pdp-family-label{font-size:.875rem;font-weight:600;margin:0 0 .5rem;color:var(--text-secondary,#475569)}
.pdp-family-label bdi{color:var(--text-primary,#0f172a);font-weight:700}
.pdp-family-choices{display:flex;flex-wrap:wrap;gap:.5rem}
.pdp-family-choice{position:relative;display:inline-flex;align-items:center;gap:.5rem;min-height:44px;padding:.45rem .8rem;border:1px solid var(--border,#cbd5e1);border-radius:.6rem;background:var(--surface,#fff);color:inherit;font-size:.875rem;font-weight:600;text-decoration:none;overflow-wrap:anywhere;transition:border-color .15s,box-shadow .15s,transform .15s}
.pdp-family-choice:hover{border-color:var(--brand-text,#1d4ed8)}
.pdp-family-choice[aria-current=page]{border-color:var(--brand,#2563eb);box-shadow:0 0 0 1px var(--brand,#2563eb);color:var(--brand-text,#1d4ed8)}
.pdp-family-choice:focus-visible{outline:2px solid var(--brand-text,#1d4ed8);outline-offset:3px}
.pdp-family-choice[data-style=photo]{flex-direction:column;align-items:stretch;gap:.35rem;width:5.9rem;padding:.35rem .35rem .45rem;text-align:center}
.pdp-family-photo{position:relative;display:grid;place-items:center;aspect-ratio:1;border-radius:.45rem;background:#fff;overflow:hidden;color:var(--text-secondary,#64748b)}
.pdp-family-photo img{width:100%;height:100%;object-fit:contain;padding:.2rem}
.pdp-family-dot{width:2rem;height:2rem;border-radius:50%}
.pdp-family-dot[data-light=true]{box-shadow:inset 0 0 0 1px #cbd5e1}
.pdp-family-check{position:absolute;inset-block-start:.25rem;inset-inline-end:.25rem;padding:2px;border-radius:999px;background:var(--brand,#2563eb);color:#fff;box-sizing:content-box}
.pdp-family-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.75rem;line-height:1.25;font-weight:600}
@media (hover:hover) and (prefers-reduced-motion:no-preference){.pdp-family-choice[data-style=photo]:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgb(15 23 42 / .1)}}
</style>
