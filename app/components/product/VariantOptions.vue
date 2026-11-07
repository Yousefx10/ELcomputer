<script setup>
import { configuredVariantDimensions, resolveVariantCombination, optionChoiceAvailable, variantIsAvailable } from '~/utils/productOptions'
import { labelColor, lightColor } from '~/utils/productFamily'
const props = defineProps({
  variants: { type: Array, required: true }, selectedId: { type: String, default: '' },
  allowBackorder: Boolean, preorder: Boolean, stockIndependent: Boolean,
  colorChoices: Boolean, preview: { type: Function, required: true },
  color: { type: Function, required: true }, stockLabel: { type: Function, required: true }
})
const emit = defineEmits(['select'])
const { locale } = useI18n()
const dimensions = computed(() => configuredVariantDimensions(props.variants))
const selection = ref({})
const policy = computed(() => ({ allowBackorder: props.allowBackorder, preorder: props.preorder, stockIndependent: props.stockIndependent }))
const initialSelection = () => Object.fromEntries(dimensions.value.filter(d => d.values.length === 1).map(d => [d.key, d.values[0]]))
watch(() => [props.selectedId, props.variants], () => {
  const row = props.variants.find(v => v.id === props.selectedId)
  selection.value = row?.option_values && dimensions.value.length ? { ...row.option_values } : initialSelection()
}, { immediate: true })
const choose = (key, value) => {
  if (!optionChoiceAvailable(props.variants, selection.value, key, value, policy.value)) return
  selection.value = { ...selection.value, [key]: value }
  emit('select', resolveVariantCombination(props.variants, dimensions.value, selection.value))
}
const swatch = (key, value) => {
  if (key !== 'color') return ''
  const colors = [...new Set(props.variants.filter(v => v.option_values?.color === value).map(props.color).filter(Boolean))]
  return colors.length === 1 ? colors[0] : labelColor(value)
}
// A color choice shows its own photo when every matching option shares one.
const photo = (key, value) => {
  if (key !== 'color') return ''
  const images = [...new Set(props.variants.filter(v => v.option_values?.color === value).map(props.preview).filter(Boolean))]
  return images.length === 1 ? images[0] : ''
}
const stem = (key, value) => key === 'switch' ? labelColor(value) || 'unknown' : ''
const knownDimensions = new Set(['color', 'model', 'switch', 'size', 'capacity', 'version'])
const keyboard = event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  if (!buttons.length) return
  event.preventDefault()
  const current = buttons.indexOf(event.target)
  let step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1
  if (locale.value === 'ar' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) step *= -1
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (Math.max(0, current) + step + buttons.length) % buttons.length
  buttons[next].focus(); buttons[next].click()
}
const firstChoice = dimension => dimension.values.find(value => optionChoiceAvailable(props.variants, selection.value, dimension.key, value, policy.value))
const firstVariant = computed(() => props.variants.find(v => variantIsAvailable(v, policy.value))?.id)
const reset = () => { selection.value = initialSelection(); emit('select', null) }
</script>

<template>
  <div class="pdp-variants">
    <template v-if="dimensions.length">
      <fieldset v-for="dimension in dimensions" :key="dimension.key" class="pdp-option-dimension">
        <legend>{{ knownDimensions.has(dimension.key) ? $t(`modernProduct.options.${dimension.key}`) : dimension.key }}<span v-if="selection[dimension.key]">: <bdi>{{ selection[dimension.key] }}</bdi></span></legend>
        <div class="pdp-option-values" role="radiogroup" :aria-label="knownDimensions.has(dimension.key) ? $t(`modernProduct.options.${dimension.key}`) : dimension.key" @keydown="keyboard">
          <button v-for="value in dimension.values" :key="value" type="button" role="radio" :aria-checked="selection[dimension.key] === value"
            :disabled="!optionChoiceAvailable(variants, selection, dimension.key, value, policy)"
            :tabindex="selection[dimension.key] === value || !selection[dimension.key] && firstChoice(dimension) === value ? 0 : -1" @click="choose(dimension.key, value)">
            <span v-if="photo(dimension.key, value)" class="pdp-option-photo"><img :src="photo(dimension.key, value)" alt="" width="44" height="44" loading="lazy"></span>
            <span v-else-if="swatch(dimension.key, value)" class="pdp-swatch" :data-light="lightColor(swatch(dimension.key, value))" :style="{ backgroundColor: swatch(dimension.key, value) }" aria-hidden="true" />
            <span v-else-if="stem(dimension.key, value)" class="pdp-switch-stem" :data-known="stem(dimension.key, value) !== 'unknown'" :style="stem(dimension.key, value) !== 'unknown' ? { '--stem': stem(dimension.key, value) } : undefined" aria-hidden="true" /><bdi>{{ value }}</bdi>
          </button>
        </div>
      </fieldset>
    </template>
    <template v-else>
      <h2>{{ colorChoices ? $t('common.color') : $t('common.chooseAnOption') }}</h2>
      <div class="pdp-variant-options" role="radiogroup" :aria-label="$t('common.productOptions')" @keydown="keyboard">
        <button v-for="variant in variants" :key="variant.id" type="button" role="radio" :aria-checked="selectedId === variant.id"
          :tabindex="selectedId === variant.id || !selectedId && firstVariant === variant.id ? 0 : -1" :disabled="!variantIsAvailable(variant, policy)" @click="emit('select', variant)">
          <span v-if="preview(variant)" class="pdp-variant-image"><img :src="preview(variant)" alt="" width="52" height="52" loading="lazy"></span>
          <span v-else-if="color(variant)" class="pdp-swatch" :style="{ backgroundColor: color(variant) }" aria-hidden="true" />
          <span><strong>{{ colorChoices ? variant.color_name : variant.name }}</strong><small v-if="stockLabel(variant)">{{ $uiLabel(stockLabel(variant)) }}</small></span>
          <Icon v-if="selectedId === variant.id" name="lucide:check" size="16" aria-hidden="true" />
        </button>
      </div>
    </template>
    <button v-if="dimensions.length && Object.keys(selection).some(key => dimensions.find(d => d.key === key)?.values.length > 1)" type="button" class="pdp-option-reset" @click="reset">{{ $t('modernProduct.clearSelection') }}</button>
    <p v-if="!selectedId" class="pdp-hint">{{ $t('modernProduct.chooseOptions') }}</p>
  </div>
</template>
