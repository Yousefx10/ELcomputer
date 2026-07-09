<template>
  <header class="w-full">
    <nav class="w-full">
      <ul class="flex w-full flex-wrap justify-center gap-2 p-2 md:flex-nowrap md:gap-0">
        <li
          v-for="link in links"
          :key="link.to"
          class="md:flex-1"
        >
          <NuxtLink
            :to="link.to"
            class="block rounded-lg px-4 py-3 text-center hover:bg-black hover:text-white md:w-full md:rounded-none"
          >
            {{ link.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<script setup>
const links = [
  {
    label: 'Home',
    to: '/dashboard'
  },
  {
    label: 'Products',
    to: '/dashboard/products'
  },
  {
    label: 'Categories',
    to: '/dashboard/products/categories'
  },
  {
    label: 'Brands',
    to: '/dashboard/products/brands'
  }
]
</script>
