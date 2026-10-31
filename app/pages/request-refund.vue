<script setup>
const { uiLabel } = useUiLocale()
usePageSeo(() => ({ title: uiLabel('Request Refund'), index: false }))
</script>
<template>
  <main class="store-container py-10 sm:py-14">
    <section class="mx-auto max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7" aria-labelledby="refund-heading">
      <h1 id="refund-heading" class="text-2xl font-bold text-[var(--text-primary)]">{{ $t('common.requestRefund') }}</h1>
      <p class="mt-4 text-[var(--text-secondary)]">{{ $t('account.orders.forAReturnOrRefundTellUsWhichItemNeedsHelp') }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <NuxtLinkLocale to="/account/orders" class="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 font-semibold text-white">{{ $t('common.myOrders') }}</NuxtLinkLocale>
        <NuxtLinkLocale to="/account/support" class="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 font-semibold text-[var(--text-primary)]">{{ $t('common.contactSupport') }}</NuxtLinkLocale>
      </div>
    </section>
  </main>
</template>
