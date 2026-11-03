<script setup>
import { familyChoices, familyValue, familyMemberLabel, familySwatch } from '~/utils/productFamily'
const props = defineProps({ family: { type: Object, default: null }, productId: { type: String, required: true } })
const { locale } = useI18n()
const visible = computed(() => props.family?.members?.length > 1 && props.family.members.some(row => row.product_id === props.productId))
const axes = computed(() => (props.family?.axes || []).map(axis => ({ ...axis, choices: familyChoices(props.family, props.productId, axis.key) })))
const allCombinations = computed(() => visible.value && props.family.members.some(row => !axes.value.some(axis => axis.choices.includes(row))))
const href = row => `/products/${encodeURIComponent(row.slug)}`
</script>

<template>
  <section v-if="visible" class="pdp-family" :aria-label="$t('productFamily.standalone')" data-product-family>
    <p class="pdp-family-heading">{{ $t('productFamily.standalone') }}</p>
    <div v-for="axis in axes" :key="axis.key" class="pdp-family-axis" role="group" :aria-label="locale === 'ar' ? axis.label_ar || axis.label : axis.label">
      <p class="pdp-family-label">{{ locale === 'ar' ? axis.label_ar || axis.label : axis.label }}</p>
      <div class="pdp-family-choices">
        <NuxtLinkLocale v-for="row in axis.choices" :key="row.product_id" :to="href(row)" class="pdp-family-choice" :aria-current="row.product_id === productId ? 'page' : undefined">
          <span v-if="axis.key === 'color' && familySwatch(row)" class="pdp-family-swatch" :style="{ backgroundColor: familySwatch(row) }" aria-hidden="true" />
          {{ familyValue(row, axis.key, locale) }}
        </NuxtLinkLocale>
      </div>
    </div>
    <div v-if="allCombinations" class="pdp-family-choices" :aria-label="$t('productFamily.allOptions')">
      <NuxtLinkLocale v-for="row in family.members" :key="row.product_id" :to="href(row)" class="pdp-family-choice" :aria-current="row.product_id === productId ? 'page' : undefined">{{ familyMemberLabel(family, row, locale) }}</NuxtLinkLocale>
    </div>
    <p class="pdp-family-hint">{{ $t('productFamily.navigationHelp') }}</p>
  </section>
</template>

<style scoped>
.pdp-family{margin-block:1.25rem;padding-block:1rem;border-block:1px solid var(--pdp-border,#e2e8f0)}
.pdp-family-heading,.pdp-family-label{font-size:.875rem;font-weight:600;margin:0 0 .5rem}
.pdp-family-axis+.pdp-family-axis{margin-block-start:.75rem}.pdp-family-choices{display:flex;flex-wrap:wrap;gap:.5rem}
.pdp-family-choice{display:inline-flex;align-items:center;gap:.5rem;min-height:44px;padding:.5rem .75rem;border:1px solid var(--pdp-border,#cbd5e1);border-radius:.5rem;color:inherit;text-decoration:none;overflow-wrap:anywhere}
.pdp-family-choice[aria-current=page]{border-color:currentColor;font-weight:700}.pdp-family-choice:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.pdp-family-swatch{width:1rem;height:1rem;border:1px solid #94a3b8;border-radius:50%;flex-shrink:0}.pdp-family-hint{font-size:.75rem;margin:.5rem 0 0;opacity:.75}
</style>
