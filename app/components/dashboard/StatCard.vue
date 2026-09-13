<template>
  <component
    :is="rootComponent"
    v-bind="rootAttributes"
    class="group relative block h-full overflow-hidden rounded-[1.35rem] border p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-200"
    :class="[palette.surface, to ? 'hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.1)]' : '']"
    :aria-label="`${label}: ${value}`"
  >
    <span class="pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full bg-white/50 blur-2xl" aria-hidden="true" />
    <div class="relative flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-600">{{ label }}</p>
        <p class="mt-2 break-words text-3xl font-black tracking-tight tabular-nums sm:text-[2rem]" :class="palette.value">
          {{ value }}
        </p>
      </div>
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-white/80" :class="palette.icon" aria-hidden="true">
        <Icon :name="icon" size="21" />
      </span>
    </div>
    <div v-if="caption || badge || $slots.default" class="relative mt-4 border-t border-slate-900/5 pt-3">
      <div v-if="caption || badge" class="flex flex-wrap items-center justify-between gap-2">
        <p v-if="caption" class="text-xs font-medium text-slate-500">{{ caption }}</p>
        <span v-if="badge" class="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-900/5">{{ badge }}</span>
      </div>
      <slot />
    </div>
  </component>
</template>

<script setup>
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  icon: { type: String, required: true },
  tone: { type: String, default: 'blue' },
  caption: { type: String, default: '' },
  badge: { type: String, default: '' },
  to: { type: [String, Object], default: '' }
})

const palettes = {
  blue: { surface: 'border-sky-100 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50', value: 'text-blue-950', icon: 'text-blue-700' },
  cyan: { surface: 'border-cyan-100 bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50', value: 'text-cyan-950', icon: 'text-cyan-700' },
  violet: { surface: 'border-violet-100 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50', value: 'text-violet-950', icon: 'text-violet-700' },
  amber: { surface: 'border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50', value: 'text-amber-950', icon: 'text-amber-700' },
  emerald: { surface: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50', value: 'text-emerald-950', icon: 'text-emerald-700' },
  rose: { surface: 'border-rose-100 bg-gradient-to-br from-rose-50 via-red-50 to-orange-50', value: 'text-rose-950', icon: 'text-rose-700' },
  slate: { surface: 'border-slate-200 bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100', value: 'text-slate-950', icon: 'text-slate-700' }
}

const nuxtLinkComponent = resolveComponent('NuxtLink')
const palette = computed(() => palettes[props.tone] || palettes.blue)
const rootComponent = computed(() => props.to ? nuxtLinkComponent : 'article')
const rootAttributes = computed(() => props.to ? { to: props.to } : {})
</script>
