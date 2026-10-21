<template>
  <fieldset :disabled="disabled" class="mt-6 space-y-5">
    <p class="text-sm text-gray-500">{{ $t('modernFooter.editHint') }}</p>
    <section class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.brand') }}</h4>
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.brand.enabled" type="checkbox">{{ $t('modernFooter.showSection') }}</label>
      <div class="grid gap-4 md:grid-cols-2">
        <DashboardMediaUploadField v-model="draft.brand.logo_url" :label="$t('modernFooter.logoLight')" section="footer" :disabled="disabled" />
        <DashboardMediaUploadField v-model="draft.brand.logo_dark_url" :label="$t('modernFooter.logoDark')" section="footer" :disabled="disabled" />
      </div>
      <p class="text-sm text-gray-500">{{ $t('modernFooter.logoHint') }}</p>
      <DashboardFooterText v-model="draft.brand" field="description" :label="$t('modernFooter.description')" multiline />
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.brand.social_enabled" type="checkbox">{{ $t('modernFooter.showSocials') }}</label>
      <DashboardFooterText v-model="draft.brand" field="social_heading" :label="$t('modernFooter.socialHeading')" />
      <div v-for="(item, index) in draft.brand.socials" :key="item.id" class="space-y-3 rounded-lg border bg-white p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label class="flex items-center gap-2 text-sm"><input v-model="item.enabled" type="checkbox">{{ $t('modernFooter.visible') }}</label>
          <div class="flex gap-2"><button type="button" :disabled="index === 0" :aria-label="$t('modernFooter.moveUp')" @click="move(draft.brand.socials, index, -1)">↑</button><button type="button" :disabled="index === draft.brand.socials.length - 1" :aria-label="$t('modernFooter.moveDown')" @click="move(draft.brand.socials, index, 1)">↓</button><button type="button" class="text-sm text-red-600" @click="draft.brand.socials.splice(index, 1)">{{ $t('modernFooter.remove') }}</button></div>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-sm">{{ $t('modernFooter.platform') }}<select v-model="item.platform" class="mt-2 w-full rounded-lg border p-3"><option v-for="name in Object.keys(footerSocialIcons)" :key="name" :value="name">{{ name }}</option></select></label>
          <label class="text-sm">{{ $t('modernFooter.accessibleLabel') }}<input v-model="item.label" maxlength="80" class="mt-2 w-full rounded-lg border p-3"></label>
          <label class="text-sm">{{ $t('modernFooter.destination') }}<input v-model="item.url" maxlength="2048" dir="ltr" class="mt-2 w-full rounded-lg border p-3"></label>
        </div>
      </div>
      <button type="button" :disabled="draft.brand.socials.length >= 12" class="rounded-lg border px-4 py-2 text-sm" @click="draft.brand.socials.push({ id: id(), platform: 'other', label: '', url: '', enabled: true })">{{ $t('modernFooter.addSocial') }}</button>
    </section>
    <section v-for="(column, index) in draft.columns" :key="index" class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.navigationColumn', { number: index + 1 }) }}</h4>
      <label class="flex items-center gap-2 text-sm"><input v-model="column.enabled" type="checkbox">{{ $t('modernFooter.showSection') }}</label>
      <DashboardFooterText v-model="draft.columns[index]" field="title" :label="$t('modernFooter.heading')" />
      <DashboardFooterLinks v-model="column.links" badges />
    </section>
    <section class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.newsletter') }}</h4>
      <label class="block text-sm">{{ $t('modernFooter.state') }}<select v-model="draft.newsletter.state" class="mt-2 w-full rounded-lg border bg-white p-3"><option value="hidden">{{ $t('modernFooter.hidden') }}</option><option value="disabled">{{ $t('modernFooter.disabled') }}</option></select></label>
      <p class="text-sm text-gray-500">{{ $t('modernFooter.noBackend') }}</p>
      <DashboardFooterText v-model="draft.newsletter" field="title" :label="$t('modernFooter.heading')" />
      <DashboardFooterText v-model="draft.newsletter" field="description" :label="$t('modernFooter.description')" multiline />
      <DashboardFooterText v-model="draft.newsletter" field="placeholder" :label="$t('modernFooter.placeholder')" />
      <DashboardFooterText v-model="draft.newsletter" field="button" :label="$t('modernFooter.button')" />
    </section>
    <section class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.support') }}</h4>
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.support.enabled" type="checkbox">{{ $t('modernFooter.showSection') }}</label>
      <DashboardFooterText v-model="draft.support" field="hours" :label="$t('modernFooter.hours')" />
      <DashboardFooterText v-model="draft.support" field="label" :label="$t('modernFooter.contactLabel')" />
      <label class="block text-sm">{{ $t('modernFooter.contactUrl') }}<input v-model="draft.support.url" type="text" dir="ltr" maxlength="2048" class="mt-2 w-full rounded-lg border bg-white p-3"></label>
    </section>
    <section class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.appDownloads') }}</h4>
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.apps.enabled" type="checkbox">{{ $t('modernFooter.showSection') }}</label>
      <DashboardFooterText v-model="draft.apps" field="title" :label="$t('modernFooter.heading')" />
      <DashboardFooterText v-model="draft.apps" field="description" :label="$t('modernFooter.description')" />
      <div v-for="(item, index) in draft.apps.items" :key="item.id" class="space-y-3 rounded-lg border bg-white p-3">
        <div class="flex flex-wrap items-center gap-4"><label class="flex items-center gap-2 text-sm"><input v-model="item.enabled" type="checkbox">{{ $t('modernFooter.visible') }}</label><button type="button" :disabled="index === 0" :aria-label="$t('modernFooter.moveUp')" @click="move(draft.apps.items, index, -1)">↑</button><button type="button" :disabled="index === draft.apps.items.length - 1" :aria-label="$t('modernFooter.moveDown')" @click="move(draft.apps.items, index, 1)">↓</button><button type="button" class="text-sm text-red-600" @click="draft.apps.items.splice(index, 1)">{{ $t('modernFooter.remove') }}</button></div>
        <label class="block text-sm">{{ $t('modernFooter.platform') }}<select v-model="item.platform" class="mt-2 w-full rounded-lg border p-3"><option value="apple">App Store</option><option value="google">Google Play</option></select></label>
        <label class="block text-sm">{{ $t('modernFooter.destination') }}<input v-model="item.url" dir="ltr" maxlength="2048" class="mt-2 w-full rounded-lg border p-3"></label>
        <DashboardMediaUploadField v-model="item.image_url" :label="$t('modernFooter.appBadge')" section="footer" :disabled="disabled" />
      </div>
      <button type="button" :disabled="draft.apps.items.length >= 2" class="rounded-lg border px-4 py-2 text-sm" @click="draft.apps.items.push({ id: id(), platform: 'apple', enabled: false, url: '', image_url: '' })">{{ $t('modernFooter.addApp') }}</button>
    </section>
    <section class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.paymentMethods') }}</h4>
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.payments.enabled" type="checkbox">{{ $t('modernFooter.showSection') }}</label>
      <p class="text-sm text-gray-500">{{ $t('modernFooter.paymentHint') }}</p>
      <DashboardFooterText v-model="draft.payments" field="title" :label="$t('modernFooter.heading')" />
      <div v-for="(item, index) in draft.payments.items" :key="item.id" class="space-y-3 rounded-lg border bg-white p-3">
        <div class="flex flex-wrap items-center gap-4"><label class="flex items-center gap-2 text-sm"><input v-model="item.enabled" type="checkbox">{{ $t('modernFooter.visible') }}</label><button type="button" :disabled="index === 0" :aria-label="$t('modernFooter.moveUp')" @click="move(draft.payments.items, index, -1)">↑</button><button type="button" :disabled="index === draft.payments.items.length - 1" :aria-label="$t('modernFooter.moveDown')" @click="move(draft.payments.items, index, 1)">↓</button><button type="button" class="text-sm text-red-600" @click="draft.payments.items.splice(index, 1)">{{ $t('modernFooter.remove') }}</button></div>
        <label class="block text-sm">{{ $t('modernFooter.paymentMethod') }}<select v-model="item.method" class="mt-2 w-full rounded-lg border p-3"><option v-for="method in footerMethods" :key="method" :value="method">{{ $t(`modernFooter.methods.${method}`) }}</option></select></label>
        <p class="text-sm text-gray-500">{{ settings[`payment_${item.method}_enabled`] === true ? $t('modernFooter.methodEnabled') : $t('modernFooter.methodHidden') }}</p>
        <label class="block text-sm">{{ $t('modernFooter.accessibleLabel') }}<input v-model="item.label" maxlength="80" class="mt-2 w-full rounded-lg border p-3"></label>
        <DashboardMediaUploadField v-model="item.image_url" :label="$t('modernFooter.paymentLogo')" section="footer" :disabled="disabled" />
      </div>
      <button type="button" :disabled="draft.payments.items.length >= 12" class="rounded-lg border px-4 py-2 text-sm" @click="draft.payments.items.push({ id: id(), method: 'card', label: '', image_url: '', enabled: false })">{{ $t('modernFooter.addPayment') }}</button>
    </section>
    <section class="space-y-4 rounded-xl border bg-gray-50 p-4">
      <h4 class="font-bold">{{ $t('modernFooter.bottomRow') }}</h4>
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.bottom.enabled" type="checkbox">{{ $t('modernFooter.showSection') }}</label>
      <DashboardFooterText v-model="draft.bottom" field="copyright" :label="$t('modernFooter.copyright')" />
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.bottom.show_year" type="checkbox">{{ $t('modernFooter.currentYear') }}</label>
      <DashboardFooterLinks v-model="draft.bottom.links" :limit="20" />
    </section>
  </fieldset>
</template>

<script setup>
import { resolveModernFooter, normalizeModernFooter, footerSocialIcons, footerMethods } from '~/utils/modernFooter'
const props = defineProps({ modelValue: { type: Object, default: null }, settings: { type: Object, required: true }, links: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const draft = ref(resolveModernFooter({ ...props.settings, footer_modern_config: props.modelValue }, props.links))
watch(() => props.modelValue, value => {
  if (value && JSON.stringify(value) !== JSON.stringify(draft.value)) draft.value = normalizeModernFooter(value)
})
watch(draft, value => emit('update:modelValue', JSON.parse(JSON.stringify(value))), { deep: true })
const id = () => crypto.randomUUID()
const move = (rows, index, delta) => { const [row] = rows.splice(index, 1); rows.splice(index + delta, 0, row) }
</script>
