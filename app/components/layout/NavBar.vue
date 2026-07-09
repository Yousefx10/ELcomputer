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
          <a
            v-if="isExternalUrl(link.url)"
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
          @click="isMenuOpen = false"
        >
          <a
            v-if="isExternalUrl(link.url)"
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
const { data: siteContent } = await useSiteContent()

const isMenuOpen = ref(false)

const siteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => siteContent.value?.settings?.site_logo_url || '')
const headerLinks = computed(() => siteContent.value?.headerLinks || [])

const isExternalUrl = (value) => {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}
</script>
