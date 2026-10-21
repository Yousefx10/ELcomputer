<template>
  <div class="grid gap-2 sm:grid-cols-2">
    <label class="block text-sm font-semibold text-gray-700">{{ label }} · EN
      <component :is="multiline ? 'textarea' : 'input'" :value="modelValue[field] || ''" :rows="multiline ? 3 : undefined" :maxlength="500" dir="ltr" class="mt-2 w-full rounded-lg border bg-white p-3 font-normal" @input="update(field, $event.target.value)" />
    </label>
    <label class="block text-sm font-semibold text-gray-700">{{ label }} · العربية
      <component :is="multiline ? 'textarea' : 'input'" :value="modelValue[`${field}_ar`] || ''" :rows="multiline ? 3 : undefined" :maxlength="500" dir="rtl" class="mt-2 w-full rounded-lg border bg-white p-3 font-normal" @input="update(`${field}_ar`, $event.target.value)" />
    </label>
  </div>
</template>
<script setup>
const props = defineProps({ modelValue: { type: Object, required: true }, field: { type: String, required: true }, label: { type: String, required: true }, multiline: Boolean })
const emit = defineEmits(['update:modelValue'])
const update = (field, value) => emit('update:modelValue', { ...props.modelValue, [field]: value })
</script>
