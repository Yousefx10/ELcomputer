<script setup>
const props = defineProps({ field: { type: Object, required: true }, modelValue: { default: null }, inheritedValue: { default: null }, scoped: Boolean, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const inherited = computed(() => props.scoped && props.modelValue == null)
const value = computed(() => inherited.value ? props.inheritedValue : props.modelValue)
const selected = ref('')
const update = next => emit('update:modelValue', next)
const toggle = event => update(event.target.checked ? null : (props.inheritedValue ?? (props.field.type === 'list' ? [] : props.field.type === 'boolean' ? false : props.field.type === 'integer' ? 14 : props.field.options?.[0] ?? 'Africa/Cairo')))
const add = () => { if (selected.value && !(value.value || []).includes(selected.value)) update([...(value.value || []), selected.value]); selected.value = '' }
const move = (index, direction) => { const list = [...value.value]; [list[index], list[index + direction]] = [list[index + direction], list[index]]; update(list) }
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4" :data-policy-field="field.key">
    <label :for="`policy-${field.key}`" class="block text-sm font-semibold text-slate-900">{{ $t(`afterSales.fields.${field.key}`) }}</label>
    <label v-if="scoped" class="mt-2 flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" :checked="inherited" :disabled="disabled" :data-inherit="field.key" @change="toggle">
      {{ $t('afterSales.inherit') }}
    </label>
    <select v-if="field.type === 'boolean'" :id="`policy-${field.key}`" :value="String(value)" :disabled="disabled || inherited" class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" @change="update($event.target.value === 'true')">
      <option value="true">{{ $t('afterSales.enabled') }}</option><option value="false">{{ $t('afterSales.disabled') }}</option>
    </select>
    <select v-else-if="field.type === 'enum'" :id="`policy-${field.key}`" :value="value" :disabled="disabled || inherited" class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" @change="update($event.target.value)">
      <option v-for="option in field.options" :key="option" :value="option">{{ $t(`afterSales.values.${option}`) }}</option>
    </select>
    <input v-else-if="field.type === 'integer' || field.type === 'timezone'" :id="`policy-${field.key}`" :type="field.type === 'integer' ? 'number' : 'text'" :value="value" :min="field.min" :max="field.max" :disabled="disabled || inherited" class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" dir="ltr" @input="update(field.type === 'integer' ? Number($event.target.value) : $event.target.value)">
    <div v-else class="mt-2 space-y-2">
      <p v-if="!value?.length" class="text-sm text-slate-600">{{ $t('afterSales.emptyList') }}</p>
      <div v-for="(option, index) in value" :key="option" class="flex items-center gap-2 text-sm text-slate-700">
        <span class="min-w-0 flex-1">{{ $t(`afterSales.values.${option}`) }}</span>
        <button type="button" :disabled="disabled || inherited || index === 0" :aria-label="$t('afterSales.moveUp')" class="rounded border px-2 py-1 disabled:opacity-40" @click="move(index, -1)">↑</button>
        <button type="button" :disabled="disabled || inherited || index === value.length - 1" :aria-label="$t('afterSales.moveDown')" class="rounded border px-2 py-1 disabled:opacity-40" @click="move(index, 1)">↓</button>
        <button type="button" :disabled="disabled || inherited" :aria-label="$t('common.remove')" class="rounded border px-2 py-1 disabled:opacity-40" @click="update(value.filter(item => item !== option))">×</button>
      </div>
      <div class="flex gap-2">
        <select :id="`policy-${field.key}`" v-model="selected" :disabled="disabled || inherited" class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
          <option value="">{{ $t('afterSales.choose') }}</option><option v-for="option in field.options.filter(option => !value?.includes(option))" :key="option" :value="option">{{ $t(`afterSales.values.${option}`) }}</option>
        </select>
        <button type="button" :disabled="disabled || inherited || !selected" class="rounded-lg border px-3 py-2 text-sm text-slate-700 disabled:opacity-40" @click="add">{{ $t('afterSales.add') }}</button>
      </div>
    </div>
  </div>
</template>
