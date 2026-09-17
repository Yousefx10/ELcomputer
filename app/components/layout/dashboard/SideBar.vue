<template>
  <aside
    id="detailed-dashboard-navigation"
    class="detailed-dashboard-sidebar fixed inset-y-0 z-50 flex flex-col overflow-hidden lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:shrink-0"
    :class="{ 'is-open': open }"
  >
    <div class="sidebar-brand relative flex min-h-[76px] items-center border-b border-slate-200/80 px-4">
      <NuxtLink
        to="/dashboard"
        class="sidebar-brand-link flex min-w-0 items-center gap-3 rounded-xl"
        @click="$emit('close')"
      >
        <span class="sidebar-brand-mark" aria-hidden="true">
          <img
            v-if="siteLogoUrl"
            :src="siteLogoUrl"
            :alt="siteName"
            class="h-full w-full object-contain"
          >
          <span v-else>{{ siteInitial }}</span>
        </span>
        <span class="min-w-0 pe-10 lg:pe-0">
          <span class="block truncate text-[15px] font-bold tracking-[-0.01em] text-slate-950">{{ siteName }}</span>
          <span class="mt-0.5 block text-[11px] font-medium text-slate-500">Admin workspace</span>
        </span>
      </NuxtLink>

      <button
        type="button"
        aria-label="Close dashboard navigation"
        class="sidebar-close absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        @click="$emit('close')"
      >
        <Icon name="lucide:x" size="20" />
      </button>
    </div>

    <div class="px-3 pb-1 pt-4">
      <label class="sidebar-search relative block">
        <Icon name="lucide:search" size="16" class="sidebar-search-icon pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="navigationSearch"
          type="search"
          aria-label="Find a dashboard page"
          placeholder="Find a page"
          class="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        >
      </label>
    </div>

    <nav ref="navigationRoot" class="sidebar-navigation min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3" aria-label="Dashboard navigation">
      <p class="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Workspace</p>
      <p v-if="!filteredGroups.length" class="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-500">No pages match your search.</p>
      <ul v-else class="space-y-1">
        <li
          v-for="group in filteredGroups"
          :key="group.key"
        >
          <button
            v-if="group.children.length"
            type="button"
            class="dashboard-nav-row relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-[13px] font-semibold"
            :class="{ 'is-current': activeGroup?.key === group.key }"
            :aria-expanded="isGroupExpanded(group.key)"
            :aria-controls="`dashboard-navigation-group-${group.key}`"
            @click="toggleGroup(group.key)"
          >
            <span
              class="dashboard-nav-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            >
              <Icon :name="group.icon" size="17" />
            </span>

            <span class="min-w-0 flex-1 truncate">{{ group.detailedLabel || group.label }}</span>

            <Icon
              name="lucide:chevron-down"
              size="16"
              class="shrink-0 text-slate-400 transition-transform duration-200"
              :class="isGroupExpanded(group.key) ? 'rotate-180' : ''"
            />
          </button>

          <NuxtLink
            v-else
            :to="group.to"
            class="dashboard-nav-row relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold"
            :class="{ 'is-current': activeGroup?.key === group.key }"
            :aria-current="activeGroup?.key === group.key ? 'page' : undefined"
            @click="selectGroup(group.key)"
          >
            <span
              class="dashboard-nav-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            >
              <Icon :name="group.icon" size="17" />
            </span>
            <span class="truncate">{{ group.detailedLabel || group.label }}</span>
          </NuxtLink>

          <div
            v-if="group.children.length"
            v-show="isGroupExpanded(group.key)"
            :id="`dashboard-navigation-group-${group.key}`"
            class="dashboard-subnav ms-4 my-1.5 space-y-0.5 border-s border-slate-200 ps-4"
          >
            <NuxtLink
              v-for="item in group.children"
              :key="item.key"
              :to="item.to"
              class="dashboard-subnav-row relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium lg:min-h-9"
              :class="{ 'is-current': activeGroup?.key === group.key && activeItem?.key === item.key }"
              :aria-current="activeGroup?.key === group.key && activeItem?.key === item.key ? 'page' : undefined"
              @click="selectGroup(group.key)"
            >
              <Icon :name="item.icon" size="15" class="shrink-0" />
              <span class="min-w-0 truncate">{{ item.detailedLabel || item.label }}</span>
            </NuxtLink>
          </div>
        </li>
      </ul>
    </nav>

    <div ref="accountRoot" class="sidebar-account shrink-0 border-t border-slate-200/80 p-3" @keydown="handleAccountKeydown" @focusout="handleAccountFocusOut">
      <button
        ref="accountButton"
        type="button"
        class="sidebar-account-button flex w-full items-center gap-3 rounded-xl p-2 text-start"
        :aria-expanded="accountOpen"
        aria-controls="dashboard-account-actions"
        @click="accountOpen = !accountOpen"
      >
        <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white ring-2 ring-white">{{ adminInitials }}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[13px] font-semibold text-slate-900">{{ adminName }}</span>
          <span class="mt-0.5 block truncate text-[11px] text-slate-500">{{ adminUser?.email || 'Dashboard user' }}</span>
        </span>
        <Icon :name="accountOpen ? 'lucide:chevron-down' : 'lucide:chevron-up'" size="15" class="shrink-0 text-slate-400" />
      </button>
      <div v-if="accountOpen" id="dashboard-account-actions" class="pt-1.5">
        <button type="button" class="sidebar-logout inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700" @click="logout">
          <Icon name="lucide:log-out" size="16" /> Logout
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { getConfiguredStoreImageUrl } from '~/utils/storefront'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'logout'])

const { data: siteContent } = await useSiteContent()

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

const expandedGroup = ref(null)
const accountOpen = ref(false)
const accountRoot = ref(null)
const accountButton = ref(null)
const logout = () => {
  accountOpen.value = false
  emit('logout')
}
const closeAccountOutside = (event) => {
  if (!accountRoot.value?.contains(event.target)) accountOpen.value = false
}
const handleAccountFocusOut = (event) => {
  if (!accountRoot.value?.contains(event.relatedTarget)) accountOpen.value = false
}
const handleAccountKeydown = (event) => {
  if (event.key !== 'Escape' || !accountOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  accountOpen.value = false
  accountButton.value?.focus()
}
const selectGroup = (key) => {
  expandedGroup.value = key
  accountOpen.value = false
  emit('close')
}
const navigationRoot = ref(null)
const navigationSearch = ref('')
const siteName = computed(() => String(siteContent.value?.settings?.site_name || 'Store').trim() || 'Store')
const siteLogoUrl = computed(() => getConfiguredStoreImageUrl(siteContent.value?.settings?.site_logo_url))
const siteInitial = computed(() => siteName.value.slice(0, 1).toUpperCase())
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
  return expandedGroup.value === groupKey
}

const toggleGroup = (groupKey) => {
  expandedGroup.value = isGroupExpanded(groupKey) ? null : groupKey
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
    expandedGroup.value = activeGroup.value?.key || null
    accountOpen.value = false
    revealActiveItem()
  },
  {
    immediate: true
  }
)
watch(navigationSearch, (query) => {
  if (!query.trim()) expandedGroup.value = activeGroup.value?.key || null
  else if (!filteredGroups.value.some(group => group.key === expandedGroup.value)) expandedGroup.value = filteredGroups.value[0]?.key || null
})
watch(() => props.open, (open) => {
  accountOpen.value = false
  if (open) revealActiveItem()
})
onMounted(() => {
  revealActiveItem()
  document.addEventListener('pointerdown', closeAccountOutside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeAccountOutside))
</script>

<style scoped>
.detailed-dashboard-sidebar {
  inset-inline-start: 0;
  width: min(18rem, calc(100vw - 1rem));
  border-inline-end: 1px solid rgb(226 232 240 / 0.9);
  background: rgb(255 255 255);
  box-shadow: 18px 0 48px rgb(15 23 42 / 0.14);
  transform: translateX(-100%);
  transition:
    transform 200ms ease,
    visibility 0s linear 200ms;
  visibility: hidden;
}

:global([dir='rtl']) .detailed-dashboard-sidebar {
  box-shadow: -18px 0 48px rgb(15 23 42 / 0.14);
  transform: translateX(100%);
}

.detailed-dashboard-sidebar.is-open {
  transform: translateX(0);
  transition-delay: 0s;
  visibility: visible;
}

.sidebar-brand {
  background: rgb(255 255 255 / 0.72);
}

.sidebar-brand-link {
  max-width: calc(100% - 2.75rem);
  padding: 0.35rem;
  color: inherit;
}

.sidebar-brand-link:hover {
  color: inherit;
}

.sidebar-brand-mark {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgb(219 234 254);
  border-radius: 0.7rem;
  background: white;
  padding: 0.3rem;
  color: rgb(29 78 216);
  font-size: 0.8rem;
  font-weight: 800;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
}

.sidebar-close {
  inset-inline-end: 0.75rem;
}

.sidebar-search-icon {
  inset-inline-start: 0.85rem;
}

.sidebar-search input {
  padding-inline: 2.45rem 0.85rem;
}

.sidebar-navigation {
  scrollbar-color: rgb(203 213 225) transparent;
  scrollbar-width: thin;
}

.dashboard-nav-row,
.dashboard-subnav-row,
.sidebar-account-button,
.sidebar-logout {
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.dashboard-nav-row {
  color: rgb(71 85 105);
}

.dashboard-nav-row::before,
.dashboard-subnav-row::before {
  position: absolute;
  inset-block: 0.45rem;
  inset-inline-start: -0.18rem;
  width: 3px;
  border-radius: 999px;
  background: rgb(37 99 235);
  content: '';
  opacity: 0;
  transform: scaleY(0.45);
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.dashboard-nav-row:hover {
  background: rgb(241 245 249);
  color: rgb(15 23 42);
}

.dashboard-nav-row.is-current {
  background: rgb(239 246 255);
  color: rgb(15 23 42);
}

.dashboard-nav-row.is-current::before,
.dashboard-subnav-row.is-current::before {
  opacity: 1;
  transform: scaleY(1);
}

.dashboard-nav-icon {
  background: rgb(241 245 249);
  color: rgb(100 116 139);
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.dashboard-nav-row:hover .dashboard-nav-icon {
  background: rgb(226 232 240);
  color: rgb(51 65 85);
}

.dashboard-nav-row.is-current .dashboard-nav-icon {
  background: rgb(219 234 254);
  color: rgb(37 99 235);
}

.dashboard-subnav-row {
  color: rgb(100 116 139);
}

.dashboard-subnav-row::before {
  inset-inline-start: -1.08rem;
}

.dashboard-subnav-row:hover {
  background: rgb(241 245 249);
  color: rgb(15 23 42);
}

.dashboard-subnav-row.is-current {
  background: rgb(239 246 255 / 0.85);
  color: rgb(29 78 216);
  font-weight: 650;
}

.sidebar-account {
  background: rgb(255 255 255 / 0.72);
}

.sidebar-account-button:hover,
.sidebar-logout:hover {
  background: rgb(241 245 249);
  color: rgb(15 23 42);
}

.sidebar-brand-link:focus-visible,
.dashboard-nav-row:focus-visible,
.dashboard-subnav-row:focus-visible,
.sidebar-close:focus-visible,
.sidebar-account-button:focus-visible,
.sidebar-logout:focus-visible {
  outline: 3px solid rgb(59 130 246 / 0.45);
  outline-offset: 2px;
}

@media (min-width: 1024px) {
  .detailed-dashboard-sidebar {
    inset-inline-start: auto;
    width: 17rem;
    border: 0;
    border-inline-end: 1px solid rgb(226 232 240 / 0.9);
    border-radius: 0;
    box-shadow: none;
    transform: none;
    visibility: visible;
  }

  :global([dir='rtl']) .detailed-dashboard-sidebar {
    box-shadow: none;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detailed-dashboard-sidebar,
  .dashboard-nav-row,
  .dashboard-subnav-row,
  .dashboard-nav-icon,
  .dashboard-nav-row::before,
  .dashboard-subnav-row::before {
    transition-duration: 0.01ms;
  }
}
</style>
