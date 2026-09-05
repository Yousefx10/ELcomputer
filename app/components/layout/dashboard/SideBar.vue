<template>
  <aside
    id="detailed-dashboard-navigation"
    class="detailed-dashboard-sidebar fixed inset-y-0 right-0 z-50 flex w-72 flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-200 lg:sticky lg:right-auto lg:top-6 lg:z-0 lg:h-[calc(100vh-3rem)] lg:shrink-0 lg:rounded-2xl lg:shadow"
    :class="{ 'is-open': open }"
  >
    <div class="flex items-center justify-between gap-3 border-b px-5 py-5">
      <NuxtLink
        to="/dashboard"
        class="flex min-w-0 items-center gap-3"
        @click="$emit('close')"
      >
        <img
          src="/images/dashboard-logo.png"
          alt="ELcomputer Dashboard"
          class="h-10 max-w-40 object-contain object-left"
        >
      </NuxtLink>

      <button
        type="button"
        aria-label="Close dashboard navigation"
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 lg:hidden"
        @click="$emit('close')"
      >
        <Icon name="lucide:x" size="20" />
      </button>
    </div>

    <div class="px-4 pt-4">
      <label class="relative block">
        <Icon name="lucide:search" size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input v-model="navigationSearch" type="search" aria-label="Find a dashboard page" placeholder="Find a page" class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" />
      </label>
    </div>

    <nav ref="navigationRoot" class="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard navigation">
      <p v-if="!filteredGroups.length" class="px-3 py-4 text-sm text-gray-500">No pages match your search.</p>
      <ul class="space-y-1.5">
        <li
          v-for="group in filteredGroups"
          :key="group.key"
        >
          <button
            v-if="group.children.length"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-bold transition"
            :class="activeGroup?.key === group.key
              ? 'bg-gray-100 text-gray-950'
              : 'text-gray-700 hover:bg-gray-50'"
            :aria-expanded="isGroupExpanded(group.key)"
            :aria-controls="`dashboard-navigation-group-${group.key}`"
            @click="toggleGroup(group.key)"
          >
            <span
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              :class="activeGroup?.key === group.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'"
            >
              <Icon :name="group.icon" size="18" />
            </span>

            <span class="min-w-0 flex-1 truncate">{{ group.detailedLabel || group.label }}</span>

            <Icon
              name="lucide:chevron-down"
              size="17"
              class="shrink-0 transition-transform"
              :class="isGroupExpanded(group.key) ? 'rotate-180' : ''"
            />
          </button>

          <NuxtLink
            v-else
            :to="group.to"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition"
            :class="activeGroup?.key === group.key
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'text-gray-700 hover:bg-gray-100'"
            :aria-current="activeGroup?.key === group.key ? 'page' : undefined"
            @click="$emit('close')"
          >
            <span
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              :class="activeGroup?.key === group.key
                ? 'bg-white/15 text-white'
                : 'bg-gray-100 text-gray-600'"
            >
              <Icon :name="group.icon" size="18" />
            </span>
            <span class="truncate">{{ group.detailedLabel || group.label }}</span>
          </NuxtLink>

          <div
            v-if="group.children.length"
            v-show="isGroupExpanded(group.key)"
            :id="`dashboard-navigation-group-${group.key}`"
            class="ms-6 mt-1.5 border-s border-gray-200 ps-4"
          >
            <NuxtLink
              v-for="item in group.children"
              :key="item.key"
              :to="item.to"
              class="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition last:mb-0"
              :class="activeGroup?.key === group.key && activeItem?.key === item.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'"
              :aria-current="activeGroup?.key === group.key && activeItem?.key === item.key ? 'page' : undefined"
              @click="$emit('close')"
            >
              <Icon :name="item.icon" size="16" class="shrink-0" />
              <span class="min-w-0 truncate">{{ item.detailedLabel || item.label }}</span>
            </NuxtLink>
          </div>
        </li>
      </ul>
    </nav>

    <div class="border-t bg-gray-50 p-4">
      <div class="flex items-center gap-3 rounded-xl bg-white p-3">
        <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">
          {{ adminInitials }}
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold text-gray-900">
            {{ adminName }}
          </p>
          <p class="truncate text-xs text-gray-500">
            {{ adminUser?.email || 'Dashboard user' }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white hover:bg-gray-800"
        @click="$emit('logout')"
      >
        <Icon name="lucide:log-out" size="17" />
        Logout
      </button>
    </div>
  </aside>
</template>

<script setup>
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close', 'logout'])

const {
  adminUser,
  loadAdminAccess
} = useAdminAccess()

await loadAdminAccess()

const {
  activeGroup,
  activeItem,
  navigationGroups
} = useDashboardNavigation()

const expandedGroups = reactive({})
const navigationRoot = ref(null)
const navigationSearch = ref('')
const filteredGroups = computed(() => {
  const query = navigationSearch.value.trim().toLowerCase()
  if (!query) return navigationGroups.value
  return navigationGroups.value.flatMap(group => {
    if (group.label.toLowerCase().includes(query)) return [group]
    const children = group.children.filter(item => `${item.label} ${item.description || ''}`.toLowerCase().includes(query))
    return children.length ? [{ ...group, children }] : []
  })
})

const adminName = computed(() => {
  return String(
    adminUser.value?.full_name
    || adminUser.value?.email
    || 'Dashboard User'
  ).trim()
})

const adminInitials = computed(() => {
  const words = adminName.value.split(/\s+/).filter(Boolean)

  if (words.length > 1) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  }

  return adminName.value.slice(0, 2).toUpperCase()
})

const isGroupExpanded = (groupKey) => {
  return Boolean(navigationSearch.value.trim() || expandedGroups[groupKey])
}

const toggleGroup = (groupKey) => {
  expandedGroups[groupKey] = !isGroupExpanded(groupKey)
}

const revealActiveItem = async () => {
  await nextTick()
  const nav = navigationRoot.value
  const link = nav?.querySelector('[aria-current="page"]')
  if (!nav || !link) return
  const bounds = nav.getBoundingClientRect()
  const itemBounds = link.getBoundingClientRect()
  if (itemBounds.top < bounds.top) nav.scrollTop += itemBounds.top - bounds.top - 8
  else if (itemBounds.bottom > bounds.bottom) nav.scrollTop += itemBounds.bottom - bounds.bottom + 8
}

watch(
  [() => activeGroup.value?.key, () => activeItem.value?.key],
  () => {
    navigationSearch.value = ''
    const groupKey = activeGroup.value?.key

    if (groupKey) {
      expandedGroups[groupKey] = true
    }
    revealActiveItem()
  },
  {
    immediate: true
  }
)
watch(() => props.open, (open) => { if (open) revealActiveItem() })
onMounted(revealActiveItem)
</script>

<style scoped>
.detailed-dashboard-sidebar {
  transform: translateX(100%);
  transition:
    transform 200ms ease,
    visibility 0s linear 200ms;
  visibility: hidden;
}

.detailed-dashboard-sidebar.is-open {
  transform: translateX(0);
  transition-delay: 0s;
  visibility: visible;
}

@media (min-width: 1024px) {
  .detailed-dashboard-sidebar {
    transform: none;
    visibility: visible;
  }
}
</style>
