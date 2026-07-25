<template>
  <aside
    id="detailed-dashboard-navigation"
    class="detailed-dashboard-sidebar fixed inset-y-0 start-0 z-50 flex w-72 flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-6 lg:z-0 lg:h-[calc(100vh-3rem)] lg:shrink-0 lg:rounded-2xl lg:shadow"
    :class="{ 'is-open': open }"
  >
    <div class="flex items-center justify-between gap-3 border-b px-5 py-5">
      <NuxtLink
        to="/dashboard"
        class="flex min-w-0 items-center gap-3"
        @click="$emit('close')"
      >
        <img
          :src="logoUrl || '/images/dashboard-logo.png'"
          :alt="`${siteName} Dashboard`"
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

    <nav class="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard navigation">
      <ul class="space-y-1.5">
        <li
          v-for="group in navigationGroups"
          :key="group.key"
        >
          <button
            v-if="group.children.length"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-bold transition"
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
                ? 'bg-black text-white'
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
              ? 'bg-black text-white'
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
              :class="activeItem?.key === item.key
                ? 'bg-lime-300 text-gray-950 shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'"
              :aria-current="activeItem?.key === item.key ? 'page' : undefined"
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
  logoUrl: {
    type: String,
    default: ''
  },
  open: {
    type: Boolean,
    default: false
  },
  siteName: {
    type: String,
    default: 'ELcomputer'
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
  if (Object.prototype.hasOwnProperty.call(expandedGroups, groupKey)) {
    return expandedGroups[groupKey]
  }

  return activeGroup.value?.key === groupKey
}

const toggleGroup = (groupKey) => {
  expandedGroups[groupKey] = !isGroupExpanded(groupKey)
}

watch(
  () => activeGroup.value?.key,
  (groupKey) => {
    if (groupKey) {
      expandedGroups[groupKey] = true
    }
  },
  {
    immediate: true
  }
)
</script>

<style scoped>
.detailed-dashboard-sidebar {
  transform: translateX(-100%);
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

:global([dir='rtl']) .detailed-dashboard-sidebar {
  transform: translateX(100%);
}

:global([dir='rtl']) .detailed-dashboard-sidebar.is-open {
  transform: translateX(0);
}

@media (min-width: 1024px) {
  .detailed-dashboard-sidebar,
  :global([dir='rtl']) .detailed-dashboard-sidebar {
    transform: none;
    visibility: visible;
  }
}
</style>
