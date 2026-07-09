<template>
  <header class="bg-black text-white">
    <nav class="container mx-auto flex items-center justify-between px-4 py-6">
      <div>
        <NuxtLink to="/" class="flex items-center gap-3">
          <img
            v-if="siteLogoUrl"
            :src="siteLogoUrl"
            :alt="siteName"
            class="h-10 w-auto object-contain"
          />

          <span v-else class="text-lg font-semibold">
            {{ siteName }}
          </span>
        </NuxtLink>
      </div>

      <ul class="hidden items-center gap-4 whitespace-nowrap lg:flex">
        <li v-for="link in headerLinks" :key="link.id">
          <div
            v-if="isShopCategoryLink(link)"
            class="group relative"
          >
            <button type="button" class="flex items-center gap-1">
              <span>{{ link.label }}</span>
              <Icon name="lucide:chevron-down" size="16" />
            </button>

            <div class="absolute left-0 top-full z-20 hidden min-w-56 rounded-xl bg-white p-3 text-black shadow-lg group-hover:block">
              <p v-if="!headerCategories.length" class="text-sm text-gray-500">
                No categories yet.
              </p>

              <ul v-else class="space-y-2">
                <li
                  v-for="category in headerCategories"
                  :key="category.id"
                  class="text-sm text-gray-700"
                >
                  {{ category.name }}
                </li>
              </ul>
            </div>
          </div>

          <a
            v-else-if="isExternalUrl(link.url)"
            :href="link.url"
            target="_blank"
            rel="noreferrer"
          >
            {{ link.label }}
          </a>

          <NuxtLink v-else :to="link.url || '/'">
            {{ link.label }}
          </NuxtLink>
        </li>

        <li><input type="search" class="w-56 rounded-full border px-4 py-1"></li>

        <li>
          <NuxtLink to="/dashboard/login" class="text-sm font-medium">
            Dashboard Login
          </NuxtLink>
        </li>

        <li>
          <NuxtLink to="/login">
            <Icon name="lucide:user" size="24" />
          </NuxtLink>
        </li>

        <li><Icon name="lucide:shopping-cart" size="24" /></li>
      </ul>

      <button class="cursor-pointer text-white lg:hidden" @click="isMenuOpen = !isMenuOpen">
        <Icon name="lucide:menu" size="28" />
      </button>
    </nav>

    <div v-if="isMenuOpen" class="flex justify-center px-6 pb-6 lg:hidden">
      <ul class="grid grid-cols-2 gap-4">
        <li
          v-for="link in headerLinks"
          :key="link.id"
          :class="isShopCategoryLink(link) ? 'col-span-2' : ''"
        >
          <details
            v-if="isShopCategoryLink(link)"
            class="rounded-xl bg-white/10 p-3"
          >
            <summary class="flex cursor-pointer items-center justify-between">
              <span>{{ link.label }}</span>
              <Icon name="lucide:chevron-down" size="16" />
            </summary>

            <p v-if="!headerCategories.length" class="mt-3 text-sm text-gray-200">
              No categories yet.
            </p>

            <ul v-else class="mt-3 space-y-2 text-sm text-gray-200">
              <li
                v-for="category in headerCategories"
                :key="category.id"
              >
                {{ category.name }}
              </li>
            </ul>
          </details>

          <a
            v-else-if="isExternalUrl(link.url)"
            :href="link.url"
            target="_blank"
            rel="noreferrer"
            @click="isMenuOpen = false"
          >
            {{ link.label }}
          </a>

          <NuxtLink v-else :to="link.url || '/'" @click="isMenuOpen = false">
            {{ link.label }}
          </NuxtLink>
        </li>

        <li class="col-span-2"><input type="search" placeholder="Search..." class="w-56 rounded-full border px-4 py-1"></li>

        <li class="col-span-2" @click="isMenuOpen = false">
          <NuxtLink to="/dashboard/login">
            Dashboard Login
          </NuxtLink>
        </li>

        <li @click="isMenuOpen = false">
          <NuxtLink to="/login">
            <Icon name="lucide:user" size="24" />
          </NuxtLink>
        </li>

        <li @click="isMenuOpen = false"><Icon name="lucide:shopping-cart" size="24" /></li>
      </ul>
    </div>
  </header>
</template>

<script setup>
import { defaultHeaderLinkDefinitions } from '~/utils/siteLinks'

const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()
const { data: categoriesData } = await useAsyncData('navbar-categories', async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name')

  if (error) {
    return []
  }

  return data || []
})

const isMenuOpen = ref(false)

const siteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => siteContent.value?.settings?.site_logo_url || '')
const headerLinks = computed(() => siteContent.value?.headerLinks || [])
const headerCategories = computed(() => categoriesData.value || [])
const shopCategoryLinkKey = defaultHeaderLinkDefinitions.find((link) => link.key === 'shop-category')?.key

const isExternalUrl = (value) => {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

const isShopCategoryLink = (link) => {
  return link?.default_key === shopCategoryLinkKey || link?.label === 'Shop Category'
}
</script>
