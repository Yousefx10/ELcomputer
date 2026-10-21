<template>
  <div class="space-y-3">
    <p v-if="!rows.length" class="text-sm text-gray-500">{{ $t('modernFooter.noLinks') }}</p>
    <div v-for="(item, index) in rows" :key="item.id" class="space-y-3 rounded-lg border bg-white p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="flex items-center gap-2 text-sm"><input v-model="item.enabled" type="checkbox">{{ $t('modernFooter.visible') }}</label>
        <div class="flex gap-2">
          <button type="button" :disabled="index === 0" :aria-label="$t('modernFooter.moveUp')" class="rounded border px-3 py-1 disabled:opacity-40" @click="move(index, -1)">↑</button>
          <button type="button" :disabled="index === rows.length - 1" :aria-label="$t('modernFooter.moveDown')" class="rounded border px-3 py-1 disabled:opacity-40" @click="move(index, 1)">↓</button>
          <button type="button" class="rounded border px-3 py-1 text-sm text-red-600" @click="rows.splice(index, 1)">{{ $t('modernFooter.remove') }}</button>
        </div>
      </div>
      <DashboardFooterText v-model="rows[index]" field="label" :label="$t('modernFooter.linkLabel')" />
      <label class="block text-sm font-semibold text-gray-700">{{ $t('modernFooter.destination') }}<input v-model="item.url" type="text" dir="ltr" maxlength="2048" class="mt-2 w-full rounded-lg border p-3 font-normal" placeholder="/help"></label>
      <DashboardFooterText v-if="badges" v-model="rows[index]" field="badge" :label="$t('modernFooter.badge')" />
    </div>
    <button type="button" :disabled="rows.length >= limit" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-40" @click="add">{{ $t('modernFooter.addLink') }}</button>
  </div>
</template>
<script setup>
const rows = defineModel({ type: Array, required: true })
defineProps({ badges: Boolean, limit: { type: Number, default: 30 } })
const add = () => rows.value.push({ id: crypto.randomUUID(), label: '', label_ar: '', url: '', badge: '', badge_ar: '', enabled: true })
const move = (index, delta) => { const [row] = rows.value.splice(index, 1); rows.value.splice(index + delta, 0, row) }
</script>
