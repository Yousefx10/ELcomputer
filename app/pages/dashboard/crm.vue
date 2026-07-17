<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow">
      <h2 class="text-4xl font-bold">CRM</h2>
      <p class="mt-2 text-sm text-gray-500">
        Manage suppliers and B2B customers separately from online store shoppers.
      </p>
    </div>

    <DashboardCommerceCrmTab />
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})
</script>
