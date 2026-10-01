<template>
  <div class="">
    <div class="mx-auto max-w-6xl space-y-6">
      <DashboardPageIntro
        tag="header"
        :title="activeSettingsSection?.label || 'Settings'"
        :description="activeSettingsSection?.description || 'Choose the settings you want to change.'"
        :container-class="[
          'rounded-2xl bg-white p-6 shadow',
          activeSettingsView === 'gallery' ? 'border border-gray-200/80 !shadow-sm' : ''
        ]"
        title-class="text-3xl font-bold"
      />

      <nav v-if="activeSettingsSection" class="flex flex-wrap items-center justify-between gap-3" :aria-label="$t('common.settingsSections')">
        <NuxtLinkLocale to="/dashboard/settings" class="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
          <Icon name="lucide:arrow-left" size="16" class="directional-icon" /> {{ $t('common.allSettings') }}
        </NuxtLinkLocale>
        <label class="flex min-w-0 items-center gap-3 text-sm text-gray-600">
          <span class="shrink-0">{{ $t('common.goTo') }}</span>
          <select :aria-label="$t('common.settingsSection')" :value="activeSettingsSection.key" class="min-w-0 rounded-xl border border-gray-200 bg-white p-3 text-gray-900" @change="uiNavigateTo(`/dashboard/settings?tab=${$event.target.value}`)">
            <option v-for="item in availableSettingsSections" :key="item.key" :value="item.key">{{ $uiLabel(item.label) }}</option>
          </select>
        </label>
      </nav>

      <div v-if="activeSettingsView === 'general' && !activeSettingsSection" class="space-y-6">
        <label class="relative block">
          <Icon name="lucide:search" size="19" class="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input v-model="settingsSearch" type="search" :aria-label="$t('common.findASetting')" :placeholder="$t('common.findASetting')" class="w-full rounded-xl border border-gray-200 bg-white py-3 ps-11 pe-4 outline-none focus:border-blue-500" />
        </label>
        <section v-for="group in settingsGroups" :key="group.label">
          <h3 class="mb-3 text-sm font-bold text-gray-500">{{ $uiLabel(group.label) }}</h3>
          <div class="grid gap-3 md:grid-cols-2">
            <NuxtLinkLocale v-for="item in group.items" :key="item.key" :to="item.to" class="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-blue-400 hover:shadow-sm">
              <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon :name="item.icon" size="20" /></span>
              <div class="min-w-0 flex-1"><h4 class="font-bold text-gray-900">{{ $uiLabel(item.label) }}</h4><p class="mt-1 text-sm text-gray-500">{{ $uiLabel(item.description) }}</p></div>
              <Icon name="lucide:chevron-right" size="17" class="directional-icon mt-1 shrink-0 text-gray-400" />
            </NuxtLinkLocale>
          </div>
        </section>
        <p v-if="!settingsGroups.length" class="rounded-xl bg-white p-6 text-sm text-gray-500">{{ $t('dashboard.settings.noSettingsMatchYourSearch') }}</p>
      </div>

      <div v-if="pageError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ $uiMessage(pageError) }}
      </div>

      <div
        v-if="!canEditSettings"
        class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700 shadow"
      >
        {{ $t('dashboard.settings.youCanViewTheseSettingsButCannotChangeThem') }}
      </div>

      <fieldset v-if="activeSettingsView === 'general'" :disabled="!canEditSettings" class="min-w-0 space-y-4">
        <section v-show="activeSettingsSection?.section === 'seoSettings'" class="space-y-5 rounded-2xl bg-white p-6 shadow">
          <h3 class="text-2xl font-bold">{{ $t('seo.heading') }}</h3>
          <p class="text-sm text-gray-500">{{ $t('seo.organization') }}</p>
          <label class="block text-sm font-semibold">{{ $t('seo.siteTitle') }}<input v-model="siteSettings.seo_site_title" type="text" :placeholder="siteSettings.site_name" class="mt-2 w-full rounded-lg border p-3" /></label>
          <p v-if="siteSettings.seo_site_title.length > 70" class="text-xs text-amber-700">{{ $t('seo.titleRecommendation') }}</p>
          <label class="block text-sm font-semibold">{{ $t('seo.siteDescription') }}<textarea v-model="siteSettings.seo_default_description" rows="3" class="mt-2 w-full rounded-lg border p-3" /></label>
          <p v-if="siteSettings.seo_default_description.length > 160" class="text-xs text-amber-700">{{ $t('seo.descriptionRecommendation') }}</p>
          <DashboardMediaUploadField v-model="siteSettings.seo_social_image_url" :label="$t('seo.socialImage')" section="site_logo" :preview-alt="$t('seo.socialImage')" :disabled="!canEditSettings" />
          <label class="block text-sm font-semibold">{{ $t('seo.siteUrl') }}<input v-model="siteSettings.seo_site_url" type="url" :placeholder="seoSiteUrlPlaceholder" dir="ltr" class="mt-2 w-full rounded-lg border p-3" /></label>
          <p class="text-sm text-gray-500">{{ $t('seo.urlHelp') }}</p>
          <p v-if="settingsErrorSection === 'seoSettings'" class="text-sm text-red-600">{{ $uiMessage(settingsError) }}</p>
          <p v-if="settingsSuccessSection === 'seoSettings'" class="text-sm text-green-600">{{ $uiMessage(settingsSuccess) }}</p>
          <button type="button" :disabled="!canEditSettings || settingsLoading || !isSettingsSectionDirty('seoSettings')" class="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50" @click="saveSiteSettings('seoSettings')">{{ $t('common.save') }}</button>
        </section>
        <section v-show="activeSettingsSection?.section === 'generalSettings'" class="overflow-hidden rounded-2xl bg-white shadow">
          <button :aria-expanded="openSections.generalSettings"
            type="button"
            @click="toggleSection('generalSettings')"
            class="flex w-full items-center justify-between p-6 text-start"
          >
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.generalSettings') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.mainSiteDetailsAndLogo') }}
              </p>
            </div>

            <Icon
              name="lucide:chevron-down"
              size="20"
              class="transition"
              :class="openSections.generalSettings ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-if="openSections.generalSettings"
            class="border-t p-6"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.siteName') }}</label>
                <input
                  v-model="siteSettings.site_name"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <DashboardMediaUploadField
                v-model="siteSettings.site_logo_url"
                :label="$t('common.siteLogo')"
                section="site_logo"
                :preview-alt="$t('common.siteLogo')"
                preview-height-class="h-24"
                :help-text="$t('dashboard.settings.shownInTheStoreHeaderAndFooter')"
              />

              <section class="space-y-4 rounded-xl border border-gray-200 p-4" aria-labelledby="branding-heading">
                <h3 id="branding-heading" class="font-semibold">{{ $t('common.appearanceAndBranding') }}</h3>
                <label class="block text-sm font-semibold">{{ $t('common.siteTheme') }}
                  <select v-model="siteSettings.site_theme_default" class="mt-2 block w-full rounded-lg border p-3" :disabled="!canEditSettings">
                    <option value="system">{{ $t('common.system') }}</option><option value="light">{{ $t('common.light') }}</option><option value="dark">{{ $t('common.dark') }}</option>
                  </select>
                </label>
                <p class="text-sm text-gray-500">{{ $t('dashboard.settings.visitorsSavedThemeChoicesTakePriority') }}</p>
                <DashboardMediaUploadField v-model="siteSettings.site_logo_light_url" preview-theme="light" :label="$t('common.lightModeLogo')" section="site_logo" :preview-alt="$t('common.lightModeLogo')" preview-height-class="h-24" :disabled="!canEditSettings" :help-text="$t('dashboard.settings.usesTheExistingSiteLogoWhenEmpty')" />
                <DashboardMediaUploadField v-model="siteSettings.site_logo_dark_url" preview-theme="dark" :label="$t('common.darkModeLogo')" section="site_logo" :preview-alt="$t('common.darkModeLogo')" preview-height-class="h-24" :disabled="!canEditSettings" :help-text="$t('dashboard.settings.usesTheLightLogoWhenEmpty')" />
              </section>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.backgroundColor') }}</label>
                <input
                  v-model="siteSettings.site_background_color"
                  type="text"
                  placeholder="#f3f4f6"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.homepageTitle') }}</label>
                <input
                  v-model="siteSettings.landing_page_title"
                  type="text"
                  placeholder="ELcomputer"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div class="md:col-span-2 rounded-2xl border bg-gray-50 p-5">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-bold text-gray-900">{{ $t('dashboard.settings.allowOutOfStockPurchases') }}</p>
                    <p class="mt-1 text-sm text-gray-500">
                      {{ $t('dashboard.settings.allowOrdersForProductsWithNoAvailableStock') }}
                    </p>
                  </div>

                  <div class="flex items-center gap-3">
                    <span
                      class="text-sm font-semibold"
                      :class="siteSettings.allow_out_of_stock_purchases ? 'text-green-600' : 'text-gray-500'"
                    >
                      {{ siteSettings.allow_out_of_stock_purchases ? $t('common.on') : $t('common.off') }}
                    </span>

                    <button
                      type="button"
                      :aria-pressed="siteSettings.allow_out_of_stock_purchases"
                      class="relative inline-flex h-7 w-14 items-center rounded-full transition"
                      :class="siteSettings.allow_out_of_stock_purchases ? 'bg-green-600' : 'bg-gray-300'"
                      @click="siteSettings.allow_out_of_stock_purchases = !siteSettings.allow_out_of_stock_purchases"
                    >
                      <span
                        class="inline-block h-5 w-5 rounded-full bg-white transition"
                        :class="siteSettings.allow_out_of_stock_purchases ? 'translate-x-8' : 'translate-x-1'"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p
                  v-if="settingsErrorSection === 'generalSettings' && settingsError"
                  class="text-sm text-red-600"
                >
                  {{ $uiMessage(settingsError) }}
                </p>

                <p
                  v-if="settingsSuccessSection === 'generalSettings' && settingsSuccess"
                  class="text-sm text-green-600"
                >
                  {{ settingsSuccess }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!isSettingsSectionDirty('generalSettings') || settingsLoading"
                @click="saveSiteSettings('generalSettings')"
                class="rounded-lg px-5 py-3 font-bold text-white"
                :class="isSettingsSectionDirty('generalSettings') && !settingsLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                {{ settingsLoadingSection === 'generalSettings' ? $t('common.saving') : $t('common.saveGeneralSettings') }}
              </button>
            </div>
          </div>
        </section>

        <section v-show="activeSettingsSection?.section === 'homepageReviews'" class="overflow-hidden rounded-2xl bg-white shadow">
          <button :aria-expanded="openSections.homepageReviews"
            type="button"
            class="flex w-full items-center justify-between p-6 text-start"
            @click="toggleSection('homepageReviews')"
          >
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.homepageReviews') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.showOrHideReviewsOnTheHomepage') }}
              </p>
            </div>

            <Icon
              name="lucide:chevron-down"
              size="20"
              class="transition"
              :class="openSections.homepageReviews ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-if="openSections.homepageReviews"
            class="border-t p-6"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="grid gap-4 md:grid-cols-2">
              <div class="rounded-2xl border bg-gray-50 p-5">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-bold text-gray-900">{{ $t('dashboard.settings.showReviewsOnHomepage') }}</p>
                    <p class="mt-1 text-sm text-gray-500">
                      {{ $t('dashboard.settings.displayAMovingCarouselOfRecentCustomerReviews') }}
                    </p>
                  </div>

                  <div class="flex shrink-0 items-center gap-3">
                    <span
                      class="text-sm font-semibold"
                      :class="siteSettings.homepage_reviews_enabled ? 'text-green-600' : 'text-gray-500'"
                    >
                      {{ siteSettings.homepage_reviews_enabled ? $t('common.on') : $t('common.off') }}
                    </span>

                    <button
                      type="button"
                      :aria-label="$t('dashboard.settings.toggleHomepageCustomerReviews')"
                      :disabled="!canEditSettings"
                      :aria-pressed="siteSettings.homepage_reviews_enabled"
                      class="relative inline-flex h-7 w-14 items-center rounded-full transition disabled:cursor-not-allowed"
                      :class="siteSettings.homepage_reviews_enabled ? 'bg-green-600' : 'bg-gray-300'"
                      @click="siteSettings.homepage_reviews_enabled = !siteSettings.homepage_reviews_enabled"
                    >
                      <span
                        class="inline-block h-5 w-5 rounded-full bg-white transition"
                        :class="siteSettings.homepage_reviews_enabled ? 'translate-x-8' : 'translate-x-1'"
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border bg-gray-50 p-5">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-bold text-gray-900">{{ $t('dashboard.settings.showViewAllReviewsButton') }}</p>
                    <p class="mt-1 text-sm text-gray-500">
                      {{ $t('dashboard.settings.addALinkToTheFullReviewsPage') }}
                    </p>
                  </div>

                  <div class="flex shrink-0 items-center gap-3">
                    <span
                      class="text-sm font-semibold"
                      :class="siteSettings.homepage_reviews_view_all_enabled ? 'text-green-600' : 'text-gray-500'"
                    >
                      {{ siteSettings.homepage_reviews_view_all_enabled ? $t('common.on') : $t('common.off') }}
                    </span>

                    <button
                      type="button"
                      :aria-label="$t('dashboard.settings.toggleTheViewAllReviewsButton')"
                      :disabled="!canEditSettings"
                      :aria-pressed="siteSettings.homepage_reviews_view_all_enabled"
                      class="relative inline-flex h-7 w-14 items-center rounded-full transition disabled:cursor-not-allowed"
                      :class="siteSettings.homepage_reviews_view_all_enabled ? 'bg-green-600' : 'bg-gray-300'"
                      @click="siteSettings.homepage_reviews_view_all_enabled = !siteSettings.homepage_reviews_view_all_enabled"
                    >
                      <span
                        class="inline-block h-5 w-5 rounded-full bg-white transition"
                        :class="siteSettings.homepage_reviews_view_all_enabled ? 'translate-x-8' : 'translate-x-1'"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p
                  v-if="settingsErrorSection === 'homepageReviews' && settingsError"
                  class="text-sm text-red-600"
                >
                  {{ $uiMessage(settingsError) }}
                </p>

                <p
                  v-if="settingsSuccessSection === 'homepageReviews' && settingsSuccess"
                  class="text-sm text-green-600"
                >
                  {{ settingsSuccess }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!canEditSettings || !isSettingsSectionDirty('homepageReviews') || settingsLoading"
                class="rounded-lg px-5 py-3 font-bold text-white"
                :class="canEditSettings && isSettingsSectionDirty('homepageReviews') && !settingsLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
                @click="saveSiteSettings('homepageReviews')"
              >
                {{ settingsLoadingSection === 'homepageReviews' ? $t('common.saving') : $t('common.saveHomepageReviews') }}
              </button>
            </div>
          </div>
        </section>

        <section v-show="activeSettingsSection?.section === 'offerCards'" class="overflow-hidden rounded-2xl bg-white shadow">
          <button :aria-expanded="openSections.offerCards"
            type="button"
            @click="toggleSection('offerCards')"
            class="flex w-full items-center justify-between p-6 text-start"
          >
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.offerCards') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.addHomepageOffersAndChooseWhereEachOneLinks') }}
              </p>
            </div>

            <Icon
              name="lucide:chevron-down"
              size="20"
              class="transition"
              :class="openSections.offerCards ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-if="openSections.offerCards"
            class="border-t p-6"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm text-gray-500">
                  {{ $t('dashboard.settings.addATitleImageAndLinkForEachOffer') }}
                </p>
              </div>

              <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
                {{ $t('common.valueCardvalue', { value0: (offerCards.length), value1: (offerCards.length === 1 ? '' : $uiPluralSuffix('s')) }) }}
              </div>
            </div>

            <p v-if="offerCardsError" class="mb-4 text-sm text-red-600">
              {{ $uiMessage(offerCardsError) }}
            </p>

            <div class="overflow-x-auto pb-2">
              <div class="flex gap-4">
                <div class="w-[340px] flex-shrink-0 rounded-2xl border bg-gray-50 p-4">
                  <p class="text-lg font-bold text-gray-900">
                    {{ $t('common.addOfferCard') }}
                  </p>

                  <div class="mt-4 overflow-hidden rounded-2xl bg-black">
                    <div class="relative h-44">
                      <img
                        v-if="newOfferCard.image_url"
                        :src="newOfferCard.image_url"
                        :alt="$t('common.offerCardPreview')"
                        class="absolute inset-0 h-full w-full object-cover"
                      >

                      <div class="absolute inset-0 bg-gradient-to-b from-black/85 via-black/25 to-black/80" />

                      <div class="relative flex h-full flex-col justify-between p-4 text-white">
                        <div>
                          <p
                            v-if="newOfferCard.eyebrow_text"
                            class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80"
                          >
                            {{ newOfferCard.eyebrow_text }}
                          </p>

                          <h4 class="mt-3 text-3xl font-black leading-none">
                            {{ newOfferCard.title || $t('common.offerTitle') }}
                          </h4>
                        </div>

                        <span class="inline-flex w-fit rounded-full border border-white/45 bg-white/15 px-4 py-2 text-sm font-semibold">
                          {{ $t('common.viewOffer') }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 space-y-3">
                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shortLabel') }}</label>
                      <input
                        v-model="newOfferCard.eyebrow_text"
                        type="text"
                        :placeholder="$t('common.moreThan')"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.title') }}</label>
                      <input
                        v-model="newOfferCard.title"
                        type="text"
                        :placeholder="$t('common.40Off')"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <DashboardMediaUploadField
                      v-model="newOfferCard.image_url"
                      :label="$t('common.offerImage')"
                      section="offer_cards"
                      :show-preview="false"
                      :help-text="$t('dashboard.settings.uploadAnImageForThisOffer')"
                    />

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shortcutType') }}</label>
                      <select
                        v-model="newOfferCard.target_type"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                        <option value="search">{{ $t('common.searchResult') }}</option>
                        <option value="product">{{ $t('common.productPage') }}</option>
                      </select>
                    </div>

                    <div v-if="newOfferCard.target_type === 'search'">
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.searchQuery') }}</label>
                      <input
                        v-model="newOfferCard.search_query"
                        type="text"
                        :placeholder="$t('common.gamingMouse')"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div v-else>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.productSlug') }}</label>
                      <input
                        v-model="newOfferCard.product_slug"
                        type="text"
                        placeholder="logitech-g102"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>
                  </div>

                  <button
                    type="button"
                    :disabled="offerCardsLoading"
                    @click="addOfferCard"
                    class="mt-4 w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {{ offerCardsLoading ? $t('common.saving') : $t('common.addOfferCard') }}
                  </button>
                </div>

                <div
                  v-for="offerCard in offerCards"
                  :key="offerCard.id"
                  class="w-[340px] flex-shrink-0 rounded-2xl border bg-white p-4"
                >
                  <div class="overflow-hidden rounded-2xl bg-black">
                    <div class="relative h-44">
                      <img
                        v-if="offerCard.image_url"
                        :src="offerCard.image_url"
                        :alt="$t('common.offerCardPreview')"
                        class="absolute inset-0 h-full w-full object-cover"
                      >

                      <div class="absolute inset-0 bg-gradient-to-b from-black/85 via-black/25 to-black/80" />

                      <div class="relative flex h-full flex-col justify-between p-4 text-white">
                        <div>
                          <p
                            v-if="offerCard.eyebrow_text"
                            class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80"
                          >
                            {{ offerCard.eyebrow_text }}
                          </p>

                          <h4 class="mt-3 text-3xl font-black leading-none">
                            {{ offerCard.title || $t('common.offerTitle') }}
                          </h4>
                        </div>

                        <span class="inline-flex w-fit rounded-full border border-white/45 bg-white/15 px-4 py-2 text-sm font-semibold">
                          {{ $t('common.viewOffer') }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 space-y-3">
                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shortLabel') }}</label>
                      <input
                        v-model="offerCard.eyebrow_text"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.title') }}</label>
                      <input
                        v-model="offerCard.title"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <DashboardMediaUploadField
                      v-model="offerCard.image_url"
                      :label="$t('common.offerImage')"
                      section="offer_cards"
                      :show-preview="false"
                      :help-text="$t('dashboard.settings.uploadAnImageForThisOffer')"
                    />

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shortcutType') }}</label>
                      <select
                        v-model="offerCard.target_type"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                        <option value="search">{{ $t('common.searchResult') }}</option>
                        <option value="product">{{ $t('common.productPage') }}</option>
                      </select>
                    </div>

                    <div v-if="offerCard.target_type === 'search'">
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.searchQuery') }}</label>
                      <input
                        v-model="offerCard.search_query"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div v-else>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.productSlug') }}</label>
                      <input
                        v-model="offerCard.product_slug"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <label class="flex items-center gap-2 text-sm text-gray-600">
                      <input v-model="offerCard.is_enabled" type="checkbox">
                      {{ $t('common.enabled') }}
                    </label>
                  </div>

                  <div class="mt-4 flex gap-2">
                    <button
                      type="button"
                      :disabled="!isOfferCardDirty(offerCard) || offerCardsLoading"
                      @click="saveOfferCard(offerCard)"
                      class="flex-1 rounded-lg px-4 py-3 text-sm font-medium text-white"
                      :class="isOfferCardDirty(offerCard) && !offerCardsLoading
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'cursor-not-allowed bg-gray-300'"
                    >
                      {{ $t('common.save') }}
                    </button>

                    <button
                      type="button"
                      :disabled="offerCardsLoading"
                      @click="deleteOfferCard(offerCard.id)"
                      class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                    >
                      {{ $t('common.delete') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="!offerCards.length" class="mt-4 text-sm text-gray-500">
              {{ $t('dashboard.settings.noOfferCardsYetAddOneAbove') }}
            </p>
          </div>
        </section>

        <section v-show="activeSettingsSection?.section === 'topBarTexts'" class="overflow-hidden rounded-2xl bg-white shadow">
          <button :aria-expanded="openSections.topBarTexts"
            type="button"
            @click="toggleSection('topBarTexts')"
            class="flex w-full items-center justify-between p-6 text-start"
          >
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.announcements') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.messagesShownAboveTheStoreMenu') }}
              </p>
            </div>

            <Icon
              name="lucide:chevron-down"
              size="20"
              class="transition"
              :class="openSections.topBarTexts ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-if="openSections.topBarTexts"
            class="border-t p-6"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="mb-5 grid gap-5 md:grid-cols-[220px_auto]">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('dashboard.settings.topBarRotationSeconds') }}</label>
                <input
                  v-model="siteSettings.top_bar_rotation_seconds"
                  type="number"
                  min="1"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div class="flex items-end justify-start md:justify-end">
                <button
                  type="button"
                  :disabled="!isSettingsSectionDirty('topBarSettings') || settingsLoading"
                  @click="saveSiteSettings('topBarSettings')"
                  class="rounded-lg px-5 py-3 font-bold text-white"
                  :class="isSettingsSectionDirty('topBarSettings') && !settingsLoading
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-300'"
                >
                  {{ settingsLoadingSection === 'topBarSettings' ? $t('common.saving') : $t('common.saveTopBarTiming') }}
                </button>
              </div>
            </div>

            <div class="mb-5 space-y-1">
              <p
                v-if="settingsErrorSection === 'topBarSettings' && settingsError"
                class="text-sm text-red-600"
              >
                {{ $uiMessage(settingsError) }}
              </p>

              <p
                v-if="settingsSuccessSection === 'topBarSettings' && settingsSuccess"
                class="text-sm text-green-600"
              >
                {{ settingsSuccess }}
              </p>
            </div>

            <div class="mb-5 grid gap-3 md:grid-cols-[2fr_auto]">
              <input
                v-model="newTopBarText"
                type="text"
                :placeholder="$t('common.topBarText')"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

              <button
                type="button"
                @click="addTopBarMessage"
                class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
              >
                {{ topBarLoading ? $t('common.saving') : $t('common.addText') }}
              </button>
            </div>

            <p v-if="topBarError" class="mb-4 text-sm text-red-600">
              {{ $uiMessage(topBarError) }}
            </p>

            <div v-if="topBarMessages.length" class="space-y-3">
              <div
                v-for="message in topBarMessages"
                :key="message.id"
                class="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,2fr)_auto]"
              >
                <div class="space-y-3">
                  <input
                    v-model="message.text"
                    type="text"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >

                  <label class="flex items-center gap-2 text-sm text-gray-600">
                    <input v-model="message.is_enabled" type="checkbox">
                    {{ $t('common.enabled') }}
                  </label>
                </div>

                <div class="flex gap-2 self-start">
                  <button
                    type="button"
                    :disabled="!isTopBarMessageDirty(message) || topBarLoading"
                    @click="saveTopBarMessage(message)"
                    class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                    :class="isTopBarMessageDirty(message) && !topBarLoading
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'cursor-not-allowed bg-gray-300'"
                  >
                    {{ $t('common.save') }}
                  </button>

                  <button
                    type="button"
                    @click="deleteTopBarMessage(message.id)"
                    class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                  >
                    {{ $t('common.delete') }}
                  </button>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-gray-500">
              {{ $t('dashboard.settings.noTopBarTextsAddedYet') }}
            </p>
          </div>
        </section>

        <section v-show="activeSettingsSection?.section === 'heroBanners'" class="overflow-hidden rounded-2xl bg-white shadow">
          <button :aria-expanded="openSections.heroBanners"
            type="button"
            @click="toggleSection('heroBanners')"
            class="flex w-full items-center justify-between p-6 text-start"
          >
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.heroBanners') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.chooseTheMainHomepageImagesAndTheirRotationSpeed') }}
              </p>
            </div>

            <Icon
              name="lucide:chevron-down"
              size="20"
              class="transition"
              :class="openSections.heroBanners ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-if="openSections.heroBanners"
            class="border-t p-6"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="mb-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div class="flex items-center justify-between rounded-2xl border bg-gray-50 p-4">
                <div>
                  <p class="text-sm font-semibold text-gray-700">{{ $t('common.heroBanner') }}</p>
                  <p class="text-sm text-gray-500">
                    {{ $t('dashboard.settings.turnTheMainHomeHeroBannerSectionOnOrOff') }}
                  </p>
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-sm font-semibold" :class="siteSettings.hero_enabled ? 'text-green-600' : 'text-gray-500'">
                    {{ siteSettings.hero_enabled ? $t('common.on') : $t('common.off') }}
                  </span>

                  <button
                    type="button"
                    :aria-pressed="siteSettings.hero_enabled"
                    @click="siteSettings.hero_enabled = !siteSettings.hero_enabled"
                    class="relative inline-flex h-7 w-14 items-center rounded-full transition"
                    :class="siteSettings.hero_enabled ? 'bg-green-600' : 'bg-gray-300'"
                  >
                    <span
                      class="inline-block h-5 w-5 rounded-full bg-white transition"
                      :class="siteSettings.hero_enabled ? 'translate-x-8' : 'translate-x-1'"
                    />
                  </button>
                </div>
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.heroRotationSeconds') }}</label>
                <input
                  v-model="siteSettings.hero_rotation_seconds"
                  type="number"
                  min="1"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>
            </div>

            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p
                  v-if="settingsErrorSection === 'heroSettings' && settingsError"
                  class="text-sm text-red-600"
                >
                  {{ $uiMessage(settingsError) }}
                </p>

                <p
                  v-if="settingsSuccessSection === 'heroSettings' && settingsSuccess"
                  class="text-sm text-green-600"
                >
                  {{ settingsSuccess }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!isSettingsSectionDirty('heroSettings') || settingsLoading"
                @click="saveSiteSettings('heroSettings')"
                class="rounded-lg px-5 py-3 font-bold text-white"
                :class="isSettingsSectionDirty('heroSettings') && !settingsLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                {{ settingsLoadingSection === 'heroSettings' ? $t('common.saving') : $t('common.saveHeroSettings') }}
              </button>
            </div>

            <div class="mb-5 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
              <DashboardMediaUploadField
                v-model="newHeroImageUrl"
                :label="$t('common.heroImage')"
                section="hero_banners"
                :preview-alt="$t('common.heroBanner')"
                preview-image-class="object-cover"
                preview-height-class="h-28"
                :help-text="$t('dashboard.settings.uploadTheMainHomepageImage')"
              />

              <input
                v-model="newHeroLinkUrl"
                type="text"
                :placeholder="$t('common.linkUrl')"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

              <button
                type="button"
                @click="addHeroBanner"
                class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
              >
                {{ heroLoading ? $t('common.saving') : $t('common.addBanner') }}
              </button>
            </div>

            <p v-if="heroError" class="mb-4 text-sm text-red-600">
              {{ $uiMessage(heroError) }}
            </p>

            <div v-if="heroBanners.length" class="space-y-3">
              <div
                v-for="banner in heroBanners"
                :key="banner.id"
                class="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]"
              >
                <DashboardMediaUploadField
                  v-model="banner.image_url"
                  :label="$t('common.heroImage')"
                  section="hero_banners"
                  :preview-alt="$t('common.heroBanner')"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                />

                <div class="space-y-3">
                  <input
                    v-model="banner.link_url"
                    type="text"
                    :placeholder="$t('common.linkUrl')"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >

                  <label class="flex items-center gap-2 text-sm text-gray-600">
                    <input v-model="banner.is_enabled" type="checkbox">
                    {{ $t('common.enabled') }}
                  </label>
                </div>

                <div class="flex gap-2 self-start">
                  <button
                    type="button"
                    :disabled="!isHeroBannerDirty(banner) || heroLoading"
                    @click="saveHeroBanner(banner)"
                    class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                    :class="isHeroBannerDirty(banner) && !heroLoading
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'cursor-not-allowed bg-gray-300'"
                  >
                    {{ $t('common.save') }}
                  </button>

                  <button
                    type="button"
                    @click="deleteHeroBanner(banner.id)"
                    class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                  >
                    {{ $t('common.delete') }}
                  </button>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-gray-500">
              {{ $t('dashboard.settings.noHeroBannersAddedYet') }}
            </p>
          </div>
        </section>

        <section v-show="activeSettingsSection?.section === 'bannerAds'" class="overflow-hidden rounded-2xl bg-white shadow">
          <button :aria-expanded="openSections.bannerAds"
            type="button"
            @click="toggleSection('bannerAds')"
            class="flex w-full items-center justify-between p-6 text-start"
          >
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.bannerAds') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.addUpToTwoWidePromotionsBetweenTheMainHomePageSections') }}
              </p>
            </div>

            <Icon
              name="lucide:chevron-down"
              size="20"
              class="transition"
              :class="openSections.bannerAds ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-if="openSections.bannerAds"
            class="border-t p-6"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="grid gap-5 md:grid-cols-2">
              <div class="space-y-4 rounded-2xl border bg-gray-50 p-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-gray-700">{{ $t('common.bannerAd1') }}</p>
                    <p class="text-sm text-gray-500">
                      {{ $t('dashboard.settings.appearsAfterStorePicks') }}
                    </p>
                  </div>

                  <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold" :class="siteSettings.banner_ad_1_enabled ? 'text-green-600' : 'text-gray-500'">
                      {{ siteSettings.banner_ad_1_enabled ? $t('common.on') : $t('common.off') }}
                    </span>

                    <button
                      type="button"
                      :aria-pressed="siteSettings.banner_ad_1_enabled"
                      @click="siteSettings.banner_ad_1_enabled = !siteSettings.banner_ad_1_enabled"
                      class="relative inline-flex h-7 w-14 items-center rounded-full transition"
                      :class="siteSettings.banner_ad_1_enabled ? 'bg-green-600' : 'bg-gray-300'"
                    >
                      <span
                        class="inline-block h-5 w-5 rounded-full bg-white transition"
                        :class="siteSettings.banner_ad_1_enabled ? 'translate-x-8' : 'translate-x-1'"
                      />
                    </button>
                  </div>
                </div>

                <DashboardMediaUploadField
                  v-model="siteSettings.banner_ad_1_image_url"
                  :label="$t('common.bannerAd1Image')"
                  section="banner_ads"
                  :preview-alt="$t('common.bannerAd1')"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                  :help-text="$t('dashboard.settings.shownAfterStorePicksOnTheHomePage')"
                />

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.bannerAd1Link') }}</label>
                  <input
                    v-model="siteSettings.banner_ad_1_link_url"
                    type="text"
                    placeholder="/products/example-product"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>
              </div>

              <div class="space-y-4 rounded-2xl border bg-gray-50 p-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-gray-700">{{ $t('common.bannerAd2') }}</p>
                    <p class="text-sm text-gray-500">
                      {{ $t('dashboard.settings.appearsAfterMoreProducts') }}
                    </p>
                  </div>

                  <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold" :class="siteSettings.banner_ad_2_enabled ? 'text-green-600' : 'text-gray-500'">
                      {{ siteSettings.banner_ad_2_enabled ? $t('common.on') : $t('common.off') }}
                    </span>

                    <button
                      type="button"
                      :aria-pressed="siteSettings.banner_ad_2_enabled"
                      @click="siteSettings.banner_ad_2_enabled = !siteSettings.banner_ad_2_enabled"
                      class="relative inline-flex h-7 w-14 items-center rounded-full transition"
                      :class="siteSettings.banner_ad_2_enabled ? 'bg-green-600' : 'bg-gray-300'"
                    >
                      <span
                        class="inline-block h-5 w-5 rounded-full bg-white transition"
                        :class="siteSettings.banner_ad_2_enabled ? 'translate-x-8' : 'translate-x-1'"
                      />
                    </button>
                  </div>
                </div>

                <DashboardMediaUploadField
                  v-model="siteSettings.banner_ad_2_image_url"
                  :label="$t('common.bannerAd2Image')"
                  section="banner_ads"
                  :preview-alt="$t('common.bannerAd2')"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                  :help-text="$t('dashboard.settings.shownAfterMoreProductsOnTheHomePage')"
                />

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.bannerAd2Link') }}</label>
                  <input
                    v-model="siteSettings.banner_ad_2_link_url"
                    type="text"
                    placeholder="/products/example-product"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p
                  v-if="settingsErrorSection === 'bannerAds' && settingsError"
                  class="text-sm text-red-600"
                >
                  {{ $uiMessage(settingsError) }}
                </p>

                <p
                  v-if="settingsSuccessSection === 'bannerAds' && settingsSuccess"
                  class="text-sm text-green-600"
                >
                  {{ settingsSuccess }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!isSettingsSectionDirty('bannerAds') || settingsLoading"
                @click="saveSiteSettings('bannerAds')"
                class="rounded-lg px-5 py-3 font-bold text-white"
                :class="isSettingsSectionDirty('bannerAds') && !settingsLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                {{ settingsLoadingSection === 'bannerAds' ? $t('common.saving') : $t('common.saveBannerAds') }}
              </button>
            </div>
          </div>
        </section>

      <section v-show="activeSettingsSection?.section === 'paymentSettings'" class="overflow-hidden rounded-2xl bg-white shadow">
        <button
          type="button"
          class="flex w-full items-center justify-between p-6 text-start"
          :aria-expanded="openSections.paymentSettings"
          @click="toggleSection('paymentSettings')"
        >
          <div>
            <h3 class="text-2xl font-bold">{{ $t('common.paymentMethods') }}</h3>
            <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.settings.chooseAvailableMethodsFixedFeesAndTransferInstructions') }}</p>
          </div>
          <Icon name="lucide:chevron-down" size="20" class="transition" :class="openSections.paymentSettings ? 'rotate-180' : ''" />
        </button>

        <div v-if="openSections.paymentSettings" class="border-t p-6" :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''">
          <div class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {{ $t('dashboard.settings.cardAndPaypalControlsConfigureTheCheckoutUiConnectTheirPaymentProvidersBeforeEnablingThemForCustomers') }}
          </div>

          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <article v-for="method in paymentSettingCards" :key="method.value" class="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-3">
                  <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700"><Icon :name="method.icon" size="20" /></span>
                  <div><h4 class="font-bold text-gray-900">{{ $uiLabel(method.label) }}</h4><p class="mt-1 text-sm text-gray-500">{{ method.description }}</p></div>
                </div>
                <button type="button" :aria-pressed="siteSettings[method.enabledField]" class="relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition" :class="siteSettings[method.enabledField] ? 'bg-green-600' : 'bg-gray-300'" @click="siteSettings[method.enabledField] = !siteSettings[method.enabledField]">
                  <span class="inline-block h-5 w-5 rounded-full bg-white transition" :class="siteSettings[method.enabledField] ? 'translate-x-8' : 'translate-x-1'" />
                </button>
              </div>

              <div class="mt-4">
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.fixedFeeEgp') }}</label>
                <input v-model.number="siteSettings[method.feeField]" type="number" min="0" step="0.01" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
              </div>

              <div v-if="method.instructionsField" class="mt-4">
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.transferInstructions') }}</label>
                <textarea v-model="siteSettings[method.instructionsField]" rows="5" :placeholder="$t('dashboard.settings.addTheAccountWalletReferenceAndAnyStepsCustomersNeed')" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"></textarea>
              </div>
            </article>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p v-if="settingsErrorSection === 'paymentSettings' && settingsError" class="text-sm text-red-600">{{ $uiMessage(settingsError) }}</p>
              <p v-if="settingsSuccessSection === 'paymentSettings' && settingsSuccess" class="text-sm text-green-600">{{ settingsSuccess }}</p>
            </div>
            <button type="button" :disabled="!isSettingsSectionDirty('paymentSettings') || settingsLoading" class="rounded-lg px-5 py-3 font-bold text-white" :class="isSettingsSectionDirty('paymentSettings') && !settingsLoading ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'" @click="saveSiteSettings('paymentSettings')">
              {{ settingsLoadingSection === 'paymentSettings' ? $t('common.saving') : $t('common.savePaymentMethods') }}
            </button>
          </div>
        </div>
      </section>

      <section v-show="activeSettingsSection?.section === 'headerLinks'" class="overflow-hidden rounded-2xl bg-white shadow">
        <button :aria-expanded="openSections.headerLinks"
          type="button"
          @click="toggleSection('headerLinks')"
          class="flex w-full items-center justify-between p-6 text-start"
        >
          <div>
            <h3 class="text-2xl font-bold">{{ $t('common.headerNavigationLinks') }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ $t('dashboard.settings.chooseTheLinksInTheStoreMenu') }}
            </p>
          </div>

          <Icon
            name="lucide:chevron-down"
            size="20"
            class="transition"
            :class="openSections.headerLinks ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-if="openSections.headerLinks"
          class="border-t p-6"
          :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
        >
          <div class="mb-5 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input
              v-model="newHeaderLabel"
              type="text"
              :placeholder="$t('common.label')"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="newHeaderUrl"
              type="text"
              placeholder="/"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <button
              type="button"
              :disabled="addingHeaderLink"
              @click="addHeaderLink"
              class="rounded-lg px-4 py-3 font-medium text-white"
              :class="addingHeaderLink
                ? 'cursor-not-allowed bg-gray-400'
                : 'bg-black hover:bg-gray-800'"
            >
              {{ addingHeaderLink ? $t('common.saving') : $t('common.addLink') }}
            </button>
          </div>

          <p class="mb-4 text-sm text-gray-500">
            {{ $t('dashboard.settings.defaultLinksStayFirstNewLinksAppearBelowThem') }}
          </p>

          <p v-if="linkError" class="mb-4 text-sm text-red-600">
            {{ $uiMessage(linkError) }}
          </p>

          <div v-if="headerLinks.length" class="space-y-3">
            <div v-if="defaultHeaderLinks.length" class="grid grid-cols-2 gap-3">
              <div
                v-for="link in defaultHeaderLinks"
                :key="link.id"
                class="rounded-xl border p-4"
              >
                <div class="mb-3 flex items-center gap-2">
                  <p class="font-semibold text-gray-900">
                    {{ $uiLabel(link.label) }}
                  </p>

                  <span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    {{ $t('common.default') }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3">
                  <label class="flex items-center gap-2 text-sm text-gray-600">
                    <input v-model="link.is_enabled" type="checkbox">
                    {{ $t('common.enabled') }}
                  </label>

                  <button
                    type="button"
                    :disabled="!isSiteLinkDirty(link) || isSiteLinkBusy(link.id)"
                    @click="saveSiteLink(link)"
                    class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                    :class="isSiteLinkDirty(link) && !isSiteLinkBusy(link.id)
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'cursor-not-allowed bg-gray-300'"
                  >
                    {{ isSiteLinkSaving(link.id) ? $t('common.saving') : $t('common.save') }}
                  </button>
                </div>
              </div>
            </div>

            <div
              v-for="link in customHeaderLinks"
              :key="link.id"
              class="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_2fr_auto]"
            >
              <div>
                <input
                  v-model="link.label"
                  type="text"
                  :placeholder="$t('common.linkLabel')"
                  class="rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div class="space-y-3">
                <input
                  v-model="link.url"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >

                <label class="flex items-center gap-2 text-sm text-gray-600">
                  <input v-model="link.is_enabled" type="checkbox">
                  {{ $t('common.enabled') }}
                </label>
              </div>

              <div class="flex gap-2 self-start">
                <button
                  type="button"
                  :disabled="!isSiteLinkDirty(link) || isSiteLinkBusy(link.id)"
                  @click="saveSiteLink(link)"
                  class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  :class="isSiteLinkDirty(link) && !isSiteLinkBusy(link.id)
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-300'"
                >
                  {{ isSiteLinkSaving(link.id) ? $t('common.saving') : $t('common.save') }}
                </button>

                <button
                  type="button"
                  :disabled="isSiteLinkBusy(link.id)"
                  @click="deleteSiteLink(link.id)"
                  class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  :class="isSiteLinkDeleting(link.id)
                    ? 'cursor-not-allowed bg-red-400'
                    : 'bg-red-600 hover:bg-red-700'"
                >
                  {{ isSiteLinkDeleting(link.id) ? $t('common.deleting') : $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-gray-500">
            {{ $t('dashboard.settings.noHeaderLinksAddedYet') }}
          </p>
        </div>
      </section>

      <section v-show="activeSettingsSection?.section === 'footerSettings'" class="overflow-hidden rounded-2xl bg-white shadow">
        <button :aria-expanded="openSections.footerSettings"
          type="button"
          @click="toggleSection('footerSettings')"
          class="flex w-full items-center justify-between p-6 text-start"
        >
          <div>
            <h3 class="text-2xl font-bold">{{ $t('common.footerSettings') }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ $t('dashboard.settings.chooseAFooterStyleAndEditItsContent') }}
            </p>
          </div>

          <Icon
            name="lucide:chevron-down"
            size="20"
            class="transition"
            :class="openSections.footerSettings ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-if="openSections.footerSettings"
          class="border-t p-6"
          :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
        >
          <fieldset>
            <legend class="text-sm font-semibold text-gray-700">{{ $t('common.footerStyle') }}</legend>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <label
                v-for="option in footerStyleOptions"
                :key="option.value"
                class="flex cursor-pointer gap-3 rounded-xl border p-4"
                :class="siteSettings.footer_style === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
              >
                <input v-model="siteSettings.footer_style" type="radio" :value="option.value" class="mt-1">
                <span>
                  <strong class="block text-gray-900">{{ $uiLabel(option.label) }}</strong>
                  <span class="mt-1 block text-sm text-gray-500">{{ option.description }}</span>
                </span>
              </label>
            </div>
          </fieldset>

          <div v-if="siteSettings.footer_style === 'classic'" class="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerCtaTitle') }}</label>
              <input v-model="siteSettings.footer_cta_title" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerCtaSubtitle') }}</label>
              <input v-model="siteSettings.footer_cta_subtitle" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerButtonLabel') }}</label>
              <input v-model="siteSettings.footer_cta_button_label" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerButtonLink') }}</label>
              <input v-model="siteSettings.footer_cta_button_url" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerEmail') }}</label>
              <input v-model="siteSettings.footer_email" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerPhone') }}</label>
              <input v-model="siteSettings.footer_phone" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.footerAddress') }}</label>
              <input v-model="siteSettings.footer_address" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.copyrightText') }}</label>
              <input v-model="siteSettings.copyright_text" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            </div>
          </div>

          <div v-else class="mt-6 space-y-5">
            <section class="rounded-2xl border bg-gray-50 p-5">
              <h4 class="font-bold text-gray-900">{{ $t('common.leftCard') }}</h4>
              <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.settings.editTheImageMessageAndButton') }}</p>
              <div class="mt-4 grid gap-5 md:grid-cols-2">
                <DashboardMediaUploadField
                  v-model="siteSettings.footer_modern_card_image_url"
                  :label="$t('common.cardImage')"
                  section="footer"
                  :preview-alt="$t('common.footerCardImage')"
                  preview-height-class="h-28"
                  :help-text="$t('dashboard.settings.aTransparentOrSquareImageWorksBest')"
                />
                <div class="space-y-4">
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.title') }}</label>
                    <input v-model="siteSettings.footer_modern_card_title" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.text') }}</label>
                    <textarea v-model="siteSettings.footer_modern_card_text" rows="3" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"></textarea>
                  </div>
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.buttonText') }}</label>
                  <input v-model="siteSettings.footer_modern_card_button_label" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.buttonLink') }}</label>
                  <input v-model="siteSettings.footer_modern_card_button_url" type="text" placeholder="/help" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
              </div>
            </section>

            <section class="rounded-2xl border bg-gray-50 p-5">
              <h4 class="font-bold text-gray-900">{{ $t('common.communityLink') }}</h4>
              <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.settings.customizeTheJoinOurSlackItem') }}</p>
              <div class="mt-4 grid gap-5 md:grid-cols-2">
                <DashboardMediaUploadField
                  v-model="siteSettings.footer_modern_community_image_url"
                  :label="$t('common.communityImage')"
                  section="footer"
                  :preview-alt="$t('common.communityImage')"
                  preview-height-class="h-24"
                  :help-text="$t('dashboard.settings.uploadTheSlackMarkOrAnotherCommunityIcon')"
                />
                <div class="space-y-4">
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.text') }}</label>
                    <input v-model="siteSettings.footer_modern_community_text" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.link') }}</label>
                    <input v-model="siteSettings.footer_modern_community_url" type="text" placeholder="https://..." class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-2xl border bg-gray-50 p-5">
              <h4 class="font-bold text-gray-900">{{ $t('common.bottomBanner') }}</h4>
              <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.settings.theBannerIsHiddenUntilAnImageIsUploaded') }}</p>
              <div class="mt-4 grid gap-5 md:grid-cols-2">
                <DashboardMediaUploadField
                  v-model="siteSettings.footer_modern_banner_image_url"
                  :label="$t('common.bannerImage')"
                  section="footer"
                  :preview-alt="$t('common.footerBanner')"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                  :help-text="$t('dashboard.settings.useAWideImageForTheBestResult')"
                />
                <div class="space-y-4">
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.imageAltText') }}</label>
                    <input v-model="siteSettings.footer_modern_banner_alt" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.bannerLink') }}</label>
                    <input v-model="siteSettings.footer_modern_banner_url" type="text" placeholder="/search" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-2xl border bg-gray-50 p-5">
              <h4 class="font-bold text-gray-900">{{ $t('common.lowerDetails') }}</h4>
              <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.settings.editTheThreeTextAreasBelowTheBanner') }}</p>
              <div class="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.leftText') }}</label>
                  <input v-model="siteSettings.footer_modern_bottom_left_text" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.leftTextLink') }}</label>
                  <input v-model="siteSettings.footer_modern_bottom_left_url" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
                <div class="md:col-span-2">
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.centerText') }}</label>
                  <input v-model="siteSettings.footer_modern_bottom_center_text" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.rightTitle') }}</label>
                  <input v-model="siteSettings.footer_modern_bottom_right_title" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.rightText') }}</label>
                  <input v-model="siteSettings.footer_modern_bottom_right_text" type="text" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                </div>
              </div>
            </section>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p
                v-if="settingsErrorSection === 'footerSettings' && settingsError"
                class="text-sm text-red-600"
              >
                {{ $uiMessage(settingsError) }}
              </p>

              <p
                v-if="settingsSuccessSection === 'footerSettings' && settingsSuccess"
                class="text-sm text-green-600"
              >
                {{ settingsSuccess }}
              </p>
            </div>

            <button
              type="button"
              :disabled="!isSettingsSectionDirty('footerSettings') || settingsLoading"
              @click="saveSiteSettings('footerSettings')"
              class="rounded-lg px-5 py-3 font-bold text-white"
              :class="isSettingsSectionDirty('footerSettings') && !settingsLoading
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-gray-300'"
            >
              {{ settingsLoadingSection === 'footerSettings' ? $t('common.saving') : $t('common.saveFooterSettings') }}
            </button>
          </div>
        </div>
      </section>

      <section v-show="activeSettingsSection?.section === 'footerLinks'" class="overflow-hidden rounded-2xl bg-white shadow">
        <button :aria-expanded="openSections.footerLinks"
          type="button"
          @click="toggleSection('footerLinks')"
          class="flex w-full items-center justify-between p-6 text-start"
        >
          <div>
            <h3 class="text-2xl font-bold">{{ $t('dashboard.settings.footerLinksAndDetails') }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ $t('dashboard.settings.groupFooterLinksByHeadingLeaveLinksBlankForPlainText') }}
            </p>
          </div>

          <Icon
            name="lucide:chevron-down"
            size="20"
            class="transition"
            :class="openSections.footerLinks ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-if="openSections.footerLinks"
          class="border-t p-6"
          :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
        >
        <div class="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
          <input
            v-model="newFooterSectionTitle"
            type="text"
            :placeholder="$t('common.sectionTitle')"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="newFooterLabel"
              type="text"
              :placeholder="$t('common.label')"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="newFooterUrl"
              type="text"
              :placeholder="$t('common.urlOrLeaveEmpty')"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <button
              type="button"
              :disabled="addingFooterLink"
              @click="addFooterLink"
              class="rounded-lg px-4 py-3 font-medium text-white"
              :class="addingFooterLink
                ? 'cursor-not-allowed bg-gray-400'
                : 'bg-black hover:bg-gray-800'"
            >
              {{ addingFooterLink ? $t('common.saving') : $t('common.addItem') }}
            </button>
          </div>

          <p v-if="linkError" class="mb-4 text-sm text-red-600">
            {{ $uiMessage(linkError) }}
          </p>

          <div v-if="footerLinks.length" class="space-y-3">
            <div
              v-for="link in footerLinks"
              :key="link.id"
              class="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1fr_2fr_auto]"
            >
              <input
                v-model="link.section_title"
                type="text"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

              <input
                v-model="link.label"
                type="text"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

              <div class="space-y-3">
                <input
                  v-model="link.url"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >

                <label class="flex items-center gap-2 text-sm text-gray-600">
                  <input v-model="link.is_enabled" type="checkbox">
                  {{ $t('common.enabled') }}
                </label>
              </div>

              <div class="flex gap-2 self-start">
                <button
                  type="button"
                  :disabled="!isSiteLinkDirty(link) || isSiteLinkBusy(link.id)"
                  @click="saveSiteLink(link)"
                  class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  :class="isSiteLinkDirty(link) && !isSiteLinkBusy(link.id)
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-300'"
                >
                  {{ isSiteLinkSaving(link.id) ? $t('common.saving') : $t('common.save') }}
                </button>

                <button
                  type="button"
                  :disabled="isSiteLinkBusy(link.id)"
                  @click="deleteSiteLink(link.id)"
                  class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  :class="isSiteLinkDeleting(link.id)
                    ? 'cursor-not-allowed bg-red-400'
                    : 'bg-red-600 hover:bg-red-700'"
                >
                  {{ isSiteLinkDeleting(link.id) ? $t('common.deleting') : $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-gray-500">
            {{ $t('dashboard.settings.noFooterItemsAddedYet') }}
          </p>
        </div>
      </section>

      <section v-show="activeSettingsSection?.section === 'dashboardLayout'" class="overflow-hidden rounded-2xl bg-white shadow">
        <button
          type="button"
          class="flex w-full items-center justify-between p-6 text-start"
          :aria-expanded="openSections.dashboardLayout"
          aria-controls="dashboard-layout-settings"
          @click="toggleSection('dashboardLayout')"
        >
          <div>
            <h3 class="text-2xl font-bold">{{ $t('common.dashboardAppearance') }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ $t('dashboard.settings.chooseTheDashboardStyleUsedByEveryAdmin') }}
            </p>
          </div>

          <Icon
            name="lucide:chevron-down"
            size="20"
            class="transition"
            :class="openSections.dashboardLayout ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-if="openSections.dashboardLayout"
          id="dashboard-layout-settings"
          class="border-t p-6"
          :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
        >
          <div
            class="grid gap-4 md:grid-cols-2"
            role="radiogroup"
            :aria-label="$t('common.dashboardAppearance')"
          >
            <label
              v-for="layoutOption in dashboardLayoutOptions"
              :key="layoutOption.value"
              class="rounded-2xl border-2 p-4 text-start transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
              :class="siteSettings.dashboard_layout === layoutOption.value
                ? 'cursor-pointer border-blue-600 bg-blue-50 shadow-sm'
                : canEditSettings
                  ? 'cursor-pointer border-gray-200 bg-white hover:border-gray-300'
                  : 'cursor-not-allowed border-gray-200 bg-white'"
            >
              <input
                v-model="siteSettings.dashboard_layout"
                type="radio"
                name="dashboard-layout"
                :value="layoutOption.value"
                :disabled="!canEditSettings"
                class="sr-only"
              >

              <div class="mb-4 h-32 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 p-2">
                <template v-if="layoutOption.value === 'standard'">
                  <div class="h-4 rounded bg-gray-800" />
                  <div class="mt-2 flex gap-1 rounded-md bg-white p-1 shadow-sm">
                    <span class="h-3 flex-1 rounded-sm bg-blue-500" />
                    <span class="h-3 flex-1 rounded-sm bg-gray-200" />
                    <span class="h-3 flex-1 rounded-sm bg-gray-200" />
                    <span class="h-3 flex-1 rounded-sm bg-gray-200" />
                  </div>
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <span class="h-16 rounded-md bg-white shadow-sm" />
                    <span class="h-16 rounded-md bg-white shadow-sm" />
                    <span class="h-16 rounded-md bg-white shadow-sm" />
                  </div>
                </template>

                <div v-else class="flex h-full gap-2">
                  <div class="w-1/3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                    <div class="h-3 w-3/4 rounded bg-gray-800" />
                    <div class="mt-3 space-y-1.5">
                      <span class="block h-3 rounded bg-blue-100 ring-1 ring-inset ring-blue-200" />
                      <span class="block h-3 rounded bg-gray-100" />
                      <span class="block h-3 rounded bg-gray-100" />
                      <span class="block h-3 rounded bg-gray-100" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex h-5 items-center justify-end rounded-md border border-gray-200 bg-white px-1.5 shadow-sm">
                      <span class="h-2 w-8 rounded bg-gray-200" />
                    </div>
                    <div class="mt-2 grid grid-cols-2 gap-2">
                      <span class="h-20 rounded-lg border border-gray-200 bg-white shadow-sm" />
                      <span class="h-20 rounded-lg border border-gray-200 bg-white shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-bold text-gray-900">{{ $uiLabel(layoutOption.label) }}</p>
                  <p class="mt-1 text-sm text-gray-500">{{ layoutOption.description }}</p>
                </div>

                <span
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                  :class="siteSettings.dashboard_layout === layoutOption.value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white'"
                >
                  <Icon
                    v-if="siteSettings.dashboard_layout === layoutOption.value"
                    name="lucide:check"
                    size="14"
                  />
                </span>
              </div>
            </label>
          </div>

          <p class="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            {{ $t('dashboard.settings.thisChoiceAppliesToEveryDashboardUser') }}
          </p>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p
                v-if="settingsErrorSection === 'dashboardLayout' && settingsError"
                class="text-sm text-red-600"
              >
                {{ $uiMessage(settingsError) }}
              </p>

              <p
                v-if="settingsSuccessSection === 'dashboardLayout' && settingsSuccess"
                class="text-sm text-green-600"
              >
                {{ settingsSuccess }}
              </p>
            </div>

            <button
              type="button"
              :disabled="!canEditSettings || !isSettingsSectionDirty('dashboardLayout') || settingsLoading"
              class="rounded-lg px-5 py-3 font-bold text-white"
              :class="canEditSettings && isSettingsSectionDirty('dashboardLayout') && !settingsLoading
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-gray-300'"
              @click="saveSiteSettings('dashboardLayout')"
            >
              {{ settingsLoadingSection === 'dashboardLayout' ? $t('common.saving') : $t('common.saveAppearance') }}
            </button>
          </div>
        </div>
      </section>

      <section v-show="activeSettingsSection?.section === 'accountDashboard'" class="overflow-hidden rounded-2xl bg-white shadow">
        <div class="p-6">
          <h3 class="text-2xl font-bold">{{ $t('common.customerAccountLayout') }}</h3>
          <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.settings.chooseHowCustomersSeeTheirAccountPagesTheStoreHeaderIsUnchanged') }}</p>
        </div>
        <div class="border-t p-6">
          <div class="grid gap-4 md:grid-cols-2" role="radiogroup" :aria-label="$t('common.customerAccountLayout')">
            <label v-for="option in accountDashboardOptions" :key="option.value"
              class="cursor-pointer rounded-2xl border-2 p-5 transition focus-within:ring-2 focus-within:ring-blue-500"
              :class="siteSettings.account_dashboard_style === option.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'">
              <input v-model="siteSettings.account_dashboard_style" type="radio" name="account-dashboard-style"
                :value="option.value" :disabled="!canEditSettings" class="sr-only">
              <span class="flex items-start justify-between gap-3">
                <span><span class="block font-bold text-gray-900">{{ $uiLabel(option.label) }}</span><span class="mt-1 block text-sm text-gray-600">{{ option.description }}</span></span>
                <Icon v-if="siteSettings.account_dashboard_style === option.value" name="lucide:circle-check" size="21" class="shrink-0 text-blue-700" aria-hidden="true" />
              </span>
            </label>
          </div>
          <p v-if="settingsErrorSection === 'accountDashboard' && settingsError" role="alert" class="mt-4 text-sm text-red-600">{{ $uiMessage(settingsError) }}</p>
          <p v-if="settingsSuccessSection === 'accountDashboard' && settingsSuccess" role="status" class="mt-4 text-sm text-green-700">{{ settingsSuccess }}</p>
          <div class="mt-5 flex justify-end">
            <button type="button" :disabled="!canEditSettings || !isSettingsSectionDirty('accountDashboard') || settingsLoading"
              class="rounded-lg px-5 py-3 font-bold text-white"
              :class="canEditSettings && isSettingsSectionDirty('accountDashboard') && !settingsLoading ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'"
              @click="saveSiteSettings('accountDashboard')">
              {{ settingsLoadingSection === 'accountDashboard' ? $t('common.saving') : $t('common.saveAccountLayout') }}
            </button>
          </div>
        </div>
      </section>

      <section v-show="activeSettingsSection?.section === 'authPage'" class="overflow-hidden rounded-2xl bg-white shadow">
        <div class="border-b p-6">
          <h3 class="text-2xl font-bold">{{ $t('authPage.settingsTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500">{{ $t('authPage.settingsDescription') }}</p>
        </div>
        <div class="space-y-7 p-6">
          <fieldset>
            <legend class="mb-3 font-semibold">{{ $t('authPage.layout') }}</legend>
            <div class="grid gap-3 sm:grid-cols-3">
              <label v-for="layout in authPageLayoutOptions" :key="layout.value" class="flex cursor-pointer items-center gap-2 rounded-xl border p-4 focus-within:ring-2 focus-within:ring-blue-500" :class="siteSettings.auth_page_layout === layout.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'">
                <input v-model="siteSettings.auth_page_layout" type="radio" name="auth-page-layout" :value="layout.value">
                <span>{{ $t(layout.label) }}</span>
              </label>
            </div>
          </fieldset>
          <div class="grid gap-5 md:grid-cols-2">
            <DashboardMediaUploadField v-model="siteSettings.auth_image_light_url" section="auth_page" preview-theme="light" :label="$t('authPage.lightImage')" :preview-alt="$t('authPage.lightImage')" preview-image-class="object-cover" preview-height-class="h-32" :help-text="$t('authPage.imageHelp')" />
            <DashboardMediaUploadField v-model="siteSettings.auth_image_dark_url" section="auth_page" preview-theme="dark" :label="$t('authPage.darkImage')" :preview-alt="$t('authPage.darkImage')" preview-image-class="object-cover" preview-height-class="h-32" :help-text="$t('authPage.darkImageHelp')" />
          </div>
          <label class="block max-w-xs text-sm font-semibold">{{ $t('authPage.imagePosition') }}
            <select v-model="siteSettings.auth_image_position" class="mt-2 block w-full rounded-lg border p-3">
              <option v-for="position in authImagePositionOptions" :key="position.value" :value="position.value">{{ $t(position.label) }}</option>
            </select>
          </label>
          <label class="flex items-center gap-3"><input v-model="siteSettings.auth_show_visual_text" type="checkbox" class="h-4 w-4">{{ $t('authPage.showVisualText') }}</label>
          <div class="grid gap-5 md:grid-cols-2">
            <label v-for="field in authPageTextFields" :key="field.key" class="block text-sm font-semibold" :class="field.wide ? 'md:col-span-2' : ''">{{ $t(field.label) }}
              <input v-model="siteSettings[field.key]" type="text" :maxlength="field.max" :placeholder="$t(field.placeholder)" class="mt-2 block w-full rounded-lg border p-3">
            </label>
          </div>
          <label class="flex items-start gap-3"><input v-model="siteSettings.auth_facebook_enabled" type="checkbox" class="mt-1 h-4 w-4"><span><span class="block font-semibold">{{ $t('authPage.showFacebook') }}</span><span class="block text-sm text-gray-500">{{ $t('authPage.facebookHelp') }}</span></span></label>
          <p v-if="settingsErrorSection === 'authPage' && settingsError" role="alert" class="text-sm text-red-600">{{ $uiMessage(settingsError) }}</p>
          <p v-if="settingsSuccessSection === 'authPage' && settingsSuccess" role="status" class="text-sm text-green-700">{{ settingsSuccess }}</p>
          <div class="flex justify-end"><button type="button" :disabled="!isSettingsSectionDirty('authPage') || settingsLoading" class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" @click="saveSiteSettings('authPage')">{{ settingsLoadingSection === 'authPage' ? $t('common.saving') : $t('authPage.saveSettings') }}</button></div>
        </div>
      </section>

      <DashboardLiveChatSettings
        v-if="activeSettingsSection?.section === 'liveChat'"
        :can-edit="canEditSettings"
      />

      </fieldset>

      <DashboardErpSettings
        v-else-if="activeSettingsView === 'erp'"
        :can-edit="canEditSettings"
      />

      <DashboardSystemReset v-else-if="activeSettingsView === 'reset' && isOwner" @changed="handleSystemResetChanged" />

      <DashboardMediaLibrary
        v-else-if="activeSettingsView === 'gallery'"
        v-model:search="gallerySearchQuery"
        v-model:selected-image="selectedGalleryImage"
        :images="galleryImages"
        :total-items="galleryTotalItems"
        :total-sections="galleryTotalSections"
        :page="galleryCurrentPage"
        :page-size="galleryPageSize"
        :total-pages="galleryTotalPages"
        :loading="galleryLoading"
        :loaded="galleryLoaded"
        :error="galleryError"
        :can-edit="canEditSettings"
        :deleting="galleryDeleting"
        @refresh="loadGalleryImages({ force: true })"
        @page="changeGalleryPage"
        @delete="removeGalleryImage"
      />

      <div v-else-if="activeSettingsView === 'coupons'" class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.coupons') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.createAndManageCouponCodesThatCanBeAppliedDuringCheckout') }}
              </p>
            </div>

            <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
              {{ $t('common.valueCouponvalue', { value0: (coupons.length), value1: (coupons.length === 1 ? '' : $uiPluralSuffix('s')) }) }}
            </div>
          </div>

          <div
            class="mt-6 rounded-2xl border bg-gray-50 p-5"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <h4 class="text-lg font-bold text-gray-900">
              {{ $t('common.addCoupon') }}
            </h4>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.code') }}</label>
                <input
                  v-model="newCoupon.code"
                  type="text"
                  :placeholder="$t('common.save10')"
                  class="w-full rounded-lg border bg-white p-3 uppercase outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.description') }}</label>
                <input
                  v-model="newCoupon.description"
                  type="text"
                  :placeholder="$t('common.10OffSelectedOrders')"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.discountType') }}</label>
                <select
                  v-model="newCoupon.discount_type"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
                  <option value="fixed">{{ $t('common.fixed') }}</option>
                  <option value="percentage">{{ $t('common.percentage') }}</option>
                </select>
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.discountValue') }}</label>
                <input
                  v-model="newCoupon.discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.minimumOrderAmount') }}</label>
                <input
                  v-model="newCoupon.minimum_order_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.usageLimit') }}</label>
                <input
                  v-model="newCoupon.usage_limit"
                  type="number"
                  min="1"
                  :placeholder="$t('dashboard.settings.leaveEmptyForUnlimited')"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.startsAt') }}</label>
                <input
                  v-model="newCoupon.starts_at"
                  type="datetime-local"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.endsAt') }}</label>
                <input
                  v-model="newCoupon.ends_at"
                  type="datetime-local"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>
            </div>

            <label class="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <input v-model="newCoupon.is_active" type="checkbox">
              {{ $t('common.active') }}
            </label>

            <p v-if="couponError" class="mt-4 text-sm text-red-600">
              {{ $uiMessage(couponError) }}
            </p>

            <button
              type="button"
              :disabled="couponLoading"
              class="mt-5 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              @click="addCoupon"
            >
              {{ couponLoading ? $t('common.saving') : $t('common.addCoupon') }}
            </button>
          </div>
        </section>

        <section
          class="rounded-2xl bg-white p-6 shadow"
          :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
        >
          <h3 class="text-2xl font-bold">{{ $t('common.couponList') }}</h3>

          <p class="mt-1 text-sm text-gray-500">
            {{ $t('dashboard.settings.editCodesValuesActiveStatusAndScheduling') }}
          </p>

          <div v-if="coupons.length" class="mt-6 space-y-4">
            <div
              v-for="coupon in coupons"
              :key="coupon.id"
              class="rounded-2xl border p-5"
            >
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.code') }}</label>
                  <input
                    v-model="coupon.code"
                    type="text"
                    class="w-full rounded-lg border p-3 uppercase outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.description') }}</label>
                  <input
                    v-model="coupon.description"
                    type="text"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.discountType') }}</label>
                  <select
                    v-model="coupon.discount_type"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                    <option value="fixed">{{ $t('common.fixed') }}</option>
                    <option value="percentage">{{ $t('common.percentage') }}</option>
                  </select>
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.discountValue') }}</label>
                  <input
                    v-model="coupon.discount_value"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.minimumOrderAmount') }}</label>
                  <input
                    v-model="coupon.minimum_order_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.usageLimit') }}</label>
                  <input
                    v-model="coupon.usage_limit"
                    type="number"
                    min="1"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.startsAt') }}</label>
                  <input
                    v-model="coupon.starts_at"
                    type="datetime-local"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.endsAt') }}</label>
                  <input
                    v-model="coupon.ends_at"
                    type="datetime-local"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>
              </div>

              <div class="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <label class="flex items-center gap-2">
                    <input v-model="coupon.is_active" type="checkbox">
                    {{ $t('common.active') }}
                  </label>

                  <span>{{ $t('common.usedValueTimes', { value0: (coupon.usage_count) }) }}</span>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    :disabled="!isCouponDirty(coupon) || couponLoading"
                    class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                    :class="isCouponDirty(coupon) && !couponLoading
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'cursor-not-allowed bg-gray-300'"
                    @click="saveCoupon(coupon)"
                  >
                    {{ $t('common.save') }}
                  </button>

                  <button
                    type="button"
                    :disabled="couponLoading"
                    class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                    @click="deleteCoupon(coupon.id)"
                  >
                    {{ $t('common.delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="mt-6 text-sm text-gray-500">
            {{ $t('common.noCouponsAddedYet') }}
          </p>
        </section>
      </div>

      <div v-else class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 class="text-2xl font-bold">{{ $t('common.adminLogs') }}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.settings.theLatest50ActionsForEachAdminAccount') }}
              </p>
            </div>

            <div class="flex flex-col gap-3 md:w-[340px]">
              <label class="text-sm font-semibold text-gray-700">{{ $t('common.filterByAdmin') }}</label>

              <select
                v-model="selectedLogAuthor"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
                <option value="">{{ $t('common.allAdmins') }}</option>

                <option
                  v-for="author in adminLogAuthors"
                  :key="author.value"
                  :value="author.value"
                >
                  {{ author.name }}{{ author.email ? ` (${author.email})` : '' }}
                </option>
              </select>
            </div>
          </div>

          <div class="mt-5 flex justify-end">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              @click="loadAdminLogs({ force: true })"
            >
              {{ $t('common.refreshLogs') }}
            </button>
          </div>

          <div v-if="logsMissingTable" class="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
            {{ $t('dashboard.settings.runTheLatestAdminLogsSqlQueryFirstThenRefreshThisPage') }}
          </div>

          <p v-else-if="logsError" class="mt-6 text-sm text-red-600">
            {{ $uiMessage(logsError) }}
          </p>

          <p v-else-if="logsLoading" class="mt-6 text-sm text-gray-500">
            {{ $t('common.loadingLogs') }}
          </p>

          <p v-else-if="!adminLogs.length" class="mt-6 text-sm text-gray-500">
            {{ selectedLogAuthor ? $t('dashboard.settings.noLogsFoundForThisAdminYet') : $t('common.noLogsRecordedYet') }}
          </p>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="log in adminLogs"
              :key="log.id"
              class="rounded-2xl border bg-gray-50 p-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p class="font-semibold text-gray-900">
                    {{ log.description }}
                  </p>

                  <p class="mt-1 text-sm text-gray-500">
                    {{ formatLogDate(log.created_at) }}
                  </p>
                </div>

                <div class="text-sm text-gray-600 md:text-end">
                  <p class="font-semibold text-gray-900">
                    {{ log.author_name || $t('common.admin') }}
                  </p>

                  <p>{{ log.author_email }}</p>

                  <p class="uppercase tracking-wide text-gray-400">
                    {{ log.author_role }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
const seoSiteUrlPlaceholder = useRuntimeConfig().public.siteUrl
const { uiLabel } = useUiLocale()

const { intlLocale } = useUiLocale()

const { uiNavigateTo } = useUiNavigation()

import {
  defaultHeaderLinkDefinitions,
  getDefaultHeaderLinkDefinition,
  isDefaultHeaderLink
} from '~/utils/siteLinks'
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'
import { dashboardSettingsSections } from '~/utils/dashboardSettings'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const route = useUiRoute()

if (getDashboardQueryValue(route, 'tab') === 'users') {
  await uiNavigateTo('/dashboard/hr?tab=users', {
    replace: true
  })
}

const {
  getSnapshot,
  isFresh,
  setSnapshot
} = useDashboardCache()
const {
  hasPermission,
  isOwner
} = useAdminAccess()
const {
  fetchAdminLogs,
  recordAdminLog
} = useAdminLogs()
const {
  deleteGalleryImage,
  fetchGalleryImages
} = useAdminUploads()
const SETTINGS_GENERAL_CACHE_KEY = 'dashboard:settings:general'
const SETTINGS_COUPONS_CACHE_KEY = 'dashboard:settings:coupons'
const SETTINGS_GALLERY_CACHE_KEY = 'dashboard:settings:gallery'

const pageError = ref('')
const canViewGeneralSettings = computed(() => hasPermission('settings.view'))
const canViewGallery = computed(() => hasPermission('settings.view'))
const canAccessCoupons = computed(() => hasPermission('settings.coupons'))
const canEditSettings = computed(() => hasPermission('settings.edit'))
const canViewLogs = computed(() => hasPermission('settings.view'))

const defaultSiteSettings = {
  key: 'default',
  seo_site_title: '', seo_default_description: '', seo_social_image_url: '', seo_site_url: '',
  site_name: 'ELcomputer',
  site_logo_url: '',
  site_logo_light_url: '',
  site_logo_dark_url: '',
  site_theme_default: 'system',
  auth_page_layout: 'split',
  auth_image_light_url: '',
  auth_image_dark_url: '',
  auth_image_position: 'center',
  auth_show_visual_text: true,
  auth_visual_eyebrow: '',
  auth_visual_headline: '',
  auth_visual_supporting_text: '',
  auth_login_heading: '',
  auth_login_supporting_text: '',
  auth_signup_heading: '',
  auth_signup_supporting_text: '',
  auth_facebook_enabled: false,
  site_background_color: '#f3f4f6',
  landing_page_title: 'ELcomputer',
  dashboard_layout: 'standard',
  account_dashboard_style: 'modern',
  allow_out_of_stock_purchases: false,
  homepage_reviews_enabled: true,
  homepage_reviews_view_all_enabled: true,
  hero_enabled: true,
  hero_rotation_seconds: 5,
  top_bar_rotation_seconds: 3,
  banner_ad_1_enabled: true,
  banner_ad_1_image_url: '',
  banner_ad_1_link_url: '',
  banner_ad_2_enabled: true,
  banner_ad_2_image_url: '',
  banner_ad_2_link_url: '',
  payment_card_enabled: false,
  payment_card_fee: 0,
  payment_bank_transfer_enabled: false,
  payment_bank_transfer_fee: 0,
  payment_bank_transfer_instructions: '',
  payment_instapay_enabled: false,
  payment_instapay_fee: 0,
  payment_instapay_instructions: '',
  payment_paypal_enabled: false,
  payment_paypal_fee: 0,
  payment_cash_enabled: true,
  payment_cash_fee: 0,
  footer_cta_title: 'What are you waiting for?',
  footer_cta_subtitle: 'Purchase your fav gear',
  footer_cta_button_label: 'Shop Now',
  footer_cta_button_url: '/',
  footer_email: 'info@elcomputer.net',
  footer_phone: '01505121684',
  footer_address: 'address address',
  copyright_text: '© 2026 All rights reserved by ELCOMPUTER',
  footer_style: 'classic',
  footer_modern_card_image_url: '',
  footer_modern_card_title: 'Need help choosing?',
  footer_modern_card_text: 'Our team can help you find the end setup.',
  footer_modern_card_button_label: 'Contact us',
  footer_modern_card_button_url: '/help',
  footer_modern_community_image_url: '',
  footer_modern_community_text: 'Join our Slack',
  footer_modern_community_url: '',
  footer_modern_banner_image_url: '',
  footer_modern_banner_alt: '',
  footer_modern_banner_url: '',
  footer_modern_bottom_left_text: 'Legal',
  footer_modern_bottom_left_url: '',
  footer_modern_bottom_center_text: '© 2026 All rights reserved by ELCOMPUTER',
  footer_modern_bottom_right_title: '',
  footer_modern_bottom_right_text: ''
}

const siteSettings = reactive({
  ...defaultSiteSettings
})

const heroBanners = ref([])
const topBarMessages = ref([])
const offerCards = ref([])
const siteLinks = ref([])
const coupons = ref([])
const galleryImages = ref([])

const settingsLoading = ref(false)
const settingsLoadingSection = ref('')
const heroLoading = ref(false)
const topBarLoading = ref(false)
const addingHeaderLink = ref(false)
const addingFooterLink = ref(false)
const savingSiteLinkId = ref('')
const deletingSiteLinkId = ref('')

const settingsError = ref('')
const settingsErrorSection = ref('')
const settingsSuccess = ref('')
const settingsSuccessSection = ref('')
const heroError = ref('')
const topBarError = ref('')
const offerCardsError = ref('')
const linkError = ref('')
const couponError = ref('')
const couponLoading = ref(false)
const galleryLoading = ref(false)
const offerCardsLoading = ref(false)
const galleryError = ref('')
const gallerySearchQuery = ref('')
const galleryDeleting = ref(false)
const selectedGalleryImage = ref(null)
const galleryCurrentPage = ref(1)
const galleryTotalPages = ref(1)
const galleryTotalItems = ref(0)
const galleryPageSize = ref(24)
const galleryTotalSections = ref(0)
const logsLoading = ref(false)
const logsError = ref('')
const logsMissingTable = ref(false)
const logsLoaded = ref(false)
const selectedLogAuthor = ref('')
const adminLogs = ref([])
const adminLogAuthors = ref([])

const newHeroImageUrl = ref('')
const newHeroLinkUrl = ref('')
const newTopBarText = ref('')
const newOfferCard = reactive({
  eyebrow_text: '',
  title: '',
  image_url: '',
  target_type: 'search',
  search_query: '',
  product_slug: '',
  is_enabled: true
})
const newHeaderLabel = ref('')
const newHeaderUrl = ref('')
const newFooterSectionTitle = ref('')
const newFooterLabel = ref('')
const newFooterUrl = ref('')
const newCoupon = reactive({
  code: '',
  description: '',
  discount_type: 'fixed',
  discount_value: '',
  minimum_order_amount: '',
  usage_limit: '',
  starts_at: '',
  ends_at: '',
  is_active: true
})
const galleryLoaded = ref(false)
const dashboardLayoutOptions = [
  {
    value: 'standard',
    label: 'Classic',
    description: 'Simple top navigation with the current layout.'
  },
  {
    value: 'detailed',
    label: 'Modern',
    description: 'Sidebar navigation with a cleaner workspace.'
  }
]
const accountDashboardOptions = [
  { value: 'classic', label: 'Classic', description: 'Keep the current account sidebar and summary cards.' },
  { value: 'modern', label: 'Modern', description: 'Grouped account navigation with focused order, wallet and profile sections.' }
]
const authPageLayoutOptions = [
  { value: 'split', label: 'authPage.split' },
  { value: 'centered', label: 'authPage.centered' },
  { value: 'reversed', label: 'authPage.reversed' }
]
const authImagePositionOptions = [
  { value: 'left', label: 'authPage.left' },
  { value: 'center', label: 'authPage.center' },
  { value: 'right', label: 'authPage.right' }
]
const authPageTextFields = [
  { key: 'auth_login_heading', label: 'authPage.loginHeading', placeholder: 'authPage.defaultLoginHeading', max: 80 },
  { key: 'auth_login_supporting_text', label: 'authPage.loginSupporting', placeholder: 'authPage.defaultLoginSupporting', max: 160 },
  { key: 'auth_signup_heading', label: 'authPage.signupHeading', placeholder: 'authPage.defaultSignupHeading', max: 80 },
  { key: 'auth_signup_supporting_text', label: 'authPage.signupSupporting', placeholder: 'authPage.defaultSignupSupporting', max: 160 },
  { key: 'auth_visual_eyebrow', label: 'authPage.visualEyebrow', placeholder: 'authPage.defaultVisualEyebrow', max: 80 },
  { key: 'auth_visual_headline', label: 'authPage.visualHeadline', placeholder: 'authPage.defaultVisualHeadline', max: 120 },
  { key: 'auth_visual_supporting_text', label: 'authPage.visualSupporting', placeholder: 'authPage.defaultVisualSupporting', max: 180, wide: true }
]
const footerStyleOptions = [
  { value: 'classic', label: 'Classic', description: 'Shows contact details, links, and the footer call to action.' },
  { value: 'modern', label: 'Modern', description: 'Shows a card layout with a banner and contact details.' }
]
const paymentSettingCards = [
  { value: 'card', label: 'Credit or debit card', description: 'Card-entry checkout and saved-card previews.', icon: 'lucide:credit-card', enabledField: 'payment_card_enabled', feeField: 'payment_card_fee' },
  { value: 'bank_transfer', label: 'Bank transfer', description: 'Manual transfer with proof of payment.', icon: 'lucide:landmark', enabledField: 'payment_bank_transfer_enabled', feeField: 'payment_bank_transfer_fee', instructionsField: 'payment_bank_transfer_instructions' },
  { value: 'instapay', label: 'InstaPay', description: 'Manual InstaPay transfer with proof of payment.', icon: 'lucide:smartphone', enabledField: 'payment_instapay_enabled', feeField: 'payment_instapay_fee', instructionsField: 'payment_instapay_instructions' },
  { value: 'paypal', label: 'PayPal', description: 'PayPal checkout when its provider is connected.', icon: 'lucide:badge-dollar-sign', enabledField: 'payment_paypal_enabled', feeField: 'payment_paypal_fee' },
  { value: 'cash', label: 'Cash', description: 'Collect cash when the order is delivered.', icon: 'lucide:banknote', enabledField: 'payment_cash_enabled', feeField: 'payment_cash_fee' }
]
const openSections = reactive({
  seoSettings: true,
  generalSettings: true,
  dashboardLayout: true,
  accountDashboard: true,
  authPage: true,
  homepageReviews: false,
  bannerAds: false,
  paymentSettings: false,
  footerSettings: false,
  heroBanners: false,
  offerCards: false,
  topBarTexts: false,
  headerLinks: false,
  footerLinks: false
})
const activeSettingsView = computed(() => {
  const requestedTab = getDashboardQueryValue(route, 'tab')

  if (requestedTab === 'logs' && canViewLogs.value) {
    return 'logs'
  }

  if (requestedTab === 'erp' && canViewGeneralSettings.value) {
    return 'erp'
  }

  if (requestedTab === 'coupons' && canAccessCoupons.value) {
    return 'coupons'
  }

  if (requestedTab === 'reset' && isOwner.value) return 'reset'

  if (requestedTab === 'gallery' && canViewGallery.value) {
    return 'gallery'
  }

  if (canViewGeneralSettings.value) {
    return 'general'
  }

  if (canViewGallery.value) {
    return 'gallery'
  }

  if (canAccessCoupons.value) {
    return 'coupons'
  }

  if (canViewLogs.value) {
    return 'logs'
  }

  return 'general'
})
const settingsSearch = ref('')
const availableSettingsSections = computed(() => dashboardSettingsSections.filter(item => hasPermission(item.permission) && (item.role !== 'owner' || isOwner.value)))
const activeSettingsSection = computed(() => {
  const tab = getDashboardQueryValue(route, 'tab')
  return availableSettingsSections.value.find(item => item.key === tab)
    || (activeSettingsView.value !== 'general' ? availableSettingsSections.value.find(item => item.key === activeSettingsView.value) : null)
})
const settingsGroups = computed(() => {
  const query = settingsSearch.value.trim().toLowerCase()
  return ['Store', 'Homepage', 'Navigation & footer', 'Administration'].map(label => ({
    label,
    items: availableSettingsSections.value.filter(item => item.group === label && `${item.label} ${item.description}`.toLowerCase().includes(query))
  })).filter(group => group.items.length)
})
watch(activeSettingsSection, (item) => {
  if (item?.section) openSections[item.section] = true
}, { immediate: true })

const siteSettingsSectionFields = {
  seoSettings: ['seo_site_title', 'seo_default_description', 'seo_social_image_url', 'seo_site_url'],
  generalSettings: [
    'site_name',
    'site_logo_url',
    'site_logo_light_url',
    'site_logo_dark_url',
    'site_theme_default',
    'site_background_color',
    'landing_page_title',
    'allow_out_of_stock_purchases'
  ],
  dashboardLayout: [
    'dashboard_layout'
  ],
  accountDashboard: [
    'account_dashboard_style'
  ],
  authPage: [
    'auth_page_layout', 'auth_image_light_url', 'auth_image_dark_url', 'auth_image_position',
    'auth_show_visual_text', 'auth_visual_eyebrow', 'auth_visual_headline', 'auth_visual_supporting_text',
    'auth_login_heading', 'auth_login_supporting_text', 'auth_signup_heading', 'auth_signup_supporting_text',
    'auth_facebook_enabled'
  ],
  homepageReviews: [
    'homepage_reviews_enabled',
    'homepage_reviews_view_all_enabled'
  ],
  heroSettings: [
    'hero_enabled',
    'hero_rotation_seconds'
  ],
  topBarSettings: [
    'top_bar_rotation_seconds'
  ],
  bannerAds: [
    'banner_ad_1_enabled',
    'banner_ad_1_image_url',
    'banner_ad_1_link_url',
    'banner_ad_2_enabled',
    'banner_ad_2_image_url',
    'banner_ad_2_link_url'
  ],
  paymentSettings: [
    'payment_card_enabled',
    'payment_card_fee',
    'payment_bank_transfer_enabled',
    'payment_bank_transfer_fee',
    'payment_bank_transfer_instructions',
    'payment_instapay_enabled',
    'payment_instapay_fee',
    'payment_instapay_instructions',
    'payment_paypal_enabled',
    'payment_paypal_fee',
    'payment_cash_enabled',
    'payment_cash_fee'
  ],
  footerSettings: [
    'footer_style',
    'footer_cta_title',
    'footer_cta_subtitle',
    'footer_cta_button_label',
    'footer_cta_button_url',
    'footer_email',
    'footer_phone',
    'footer_address',
    'copyright_text',
    'footer_modern_card_image_url',
    'footer_modern_card_title',
    'footer_modern_card_text',
    'footer_modern_card_button_label',
    'footer_modern_card_button_url',
    'footer_modern_community_image_url',
    'footer_modern_community_text',
    'footer_modern_community_url',
    'footer_modern_banner_image_url',
    'footer_modern_banner_alt',
    'footer_modern_banner_url',
    'footer_modern_bottom_left_text',
    'footer_modern_bottom_left_url',
    'footer_modern_bottom_center_text',
    'footer_modern_bottom_right_title',
    'footer_modern_bottom_right_text'
  ]
}

const siteSettingsSectionLabels = {
  seoSettings: 'Search engines',
  generalSettings: 'General settings',
  dashboardLayout: 'Dashboard appearance',
  accountDashboard: 'Customer account layout',
  authPage: 'Authentication page',
  homepageReviews: 'Homepage reviews',
  heroSettings: 'Hero settings',
  topBarSettings: 'Top bar timing',
  bannerAds: 'Banner ads',
  paymentSettings: 'Payment methods',
  footerSettings: 'Footer settings'
}

const shortenLogValue = (value, maxLength = 60) => {
  const text = String(value || '').trim()

  if (!text) {
    return ''
  }

  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1)}...`
    : text
}

const formatLogDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat(intlLocale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const logSettingsAction = async (description, actionKey, metadata = {}) => {
  logsLoaded.value = false
  await recordAdminLog({
    description,
    actionKey,
    metadata
  })
}

const siteSettingsSnapshot = ref({})
const generalSettingsLoaded = ref(false)
const couponsLoaded = ref(false)
let gallerySearchTimeoutId = null

const toggleSection = (sectionName) => {
  openSections[sectionName] = !openSections[sectionName]
}

const sortHeaderLinksByPosition = (firstLink, secondLink) => {
  const firstSortOrder = Number(firstLink?.sort_order ?? 0)
  const secondSortOrder = Number(secondLink?.sort_order ?? 0)

  if (firstSortOrder !== secondSortOrder) {
    return firstSortOrder - secondSortOrder
  }

  return String(firstLink?.created_at || '').localeCompare(String(secondLink?.created_at || ''))
}

const decorateHeaderLink = (link) => {
  const defaultHeaderLinkDefinition = getDefaultHeaderLinkDefinition(link)

  if (defaultHeaderLinkDefinition) {
    return Object.assign(link, {
      is_default: true,
      default_key: defaultHeaderLinkDefinition.key,
      default_description: defaultHeaderLinkDefinition.description,
      is_url_editable: false,
      link_type: defaultHeaderLinkDefinition.type
    })
  }

  return Object.assign(link, {
    is_default: false,
    default_key: null,
    default_description: '',
    is_url_editable: true,
    link_type: 'link'
  })
}

const headerLinks = computed(() => {
  const existingHeaderLinks = siteLinks.value
    .filter((link) => link.location === 'header')
    .map(decorateHeaderLink)

  const defaultHeaderLinks = defaultHeaderLinkDefinitions
    .map((definition) => {
      return existingHeaderLinks.find((link) => link.default_key === definition.key)
    })
    .filter(Boolean)

  const customLinks = existingHeaderLinks
    .filter((link) => !link.is_default)
    .sort(sortHeaderLinksByPosition)

  return [...defaultHeaderLinks, ...customLinks]
})

const defaultHeaderLinks = computed(() => {
  return headerLinks.value.filter((link) => link.is_default)
})

const customHeaderLinks = computed(() => {
  return headerLinks.value.filter((link) => !isDefaultHeaderLink(link))
})

const footerLinks = computed(() => {
  return siteLinks.value.filter((link) => link.location === 'footer')
})

const isMissingSchemaError = (error) => {
  return ['42P01', '42703', 'PGRST204'].includes(error?.code)
}

const handleTableError = (error) => {
  if (isMissingSchemaError(error)) {
    pageError.value = 'Apply the latest Supabase migration, then refresh this page.'
    return true
  }

  return false
}

const changeGalleryPage = async (page) => {
  const nextPage = Number.parseInt(String(page || ''), 10)

  if (
    !Number.isFinite(nextPage) ||
    nextPage < 1 ||
    nextPage === galleryCurrentPage.value ||
    nextPage > galleryTotalPages.value
  ) {
    return
  }

  galleryCurrentPage.value = nextPage

  if (activeSettingsView.value === 'gallery' && canViewGallery.value) {
    await loadGalleryImages({ force: true })
  }
}

const closeGalleryImage = () => {
  selectedGalleryImage.value = null
}

const mapHeroBanner = (banner) => ({
  ...banner,
  link_url: banner.link_url || '',
  is_enabled: banner.is_enabled ?? true,
  original_image_url: banner.image_url || '',
  original_link_url: banner.link_url || '',
  original_is_enabled: banner.is_enabled ?? true
})

const mapTopBarMessage = (message) => ({
  ...message,
  is_enabled: message.is_enabled ?? true,
  original_text: message.text || '',
  original_is_enabled: message.is_enabled ?? true
})

const normalizeOfferCardPayload = (offerCard) => {
  const targetType = offerCard?.target_type === 'product' ? 'product' : 'search'

  return {
    eyebrow_text: String(offerCard?.eyebrow_text || '').trim() || null,
    title: String(offerCard?.title || '').trim(),
    image_url: String(offerCard?.image_url || '').trim(),
    target_type: targetType,
    search_query: targetType === 'search'
      ? String(offerCard?.search_query || '').trim() || null
      : null,
    product_slug: targetType === 'product'
      ? String(offerCard?.product_slug || '').trim() || null
      : null,
    is_enabled: offerCard?.is_enabled ?? true
  }
}

const mapOfferCard = (offerCard) => {
  const normalizedOfferCard = normalizeOfferCardPayload(offerCard)

  return {
    ...offerCard,
    ...normalizedOfferCard,
    eyebrow_text: normalizedOfferCard.eyebrow_text || '',
    search_query: normalizedOfferCard.search_query || '',
    product_slug: normalizedOfferCard.product_slug || '',
    original_eyebrow_text: normalizedOfferCard.eyebrow_text || '',
    original_title: normalizedOfferCard.title,
    original_image_url: normalizedOfferCard.image_url,
    original_target_type: normalizedOfferCard.target_type,
    original_search_query: normalizedOfferCard.search_query || '',
    original_product_slug: normalizedOfferCard.product_slug || '',
    original_is_enabled: normalizedOfferCard.is_enabled
  }
}

const mapSiteLink = (link) => ({
  ...link,
  section_title: link.section_title || '',
  url: link.url || '',
  is_enabled: link.is_enabled ?? true,
  original_section_title: link.section_title || '',
  original_label: link.label || '',
  original_url: link.url || '',
  original_is_enabled: link.is_enabled ?? true
})

const toDateTimeLocalValue = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

const toIsoDateTimeValue = (value) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue ? new Date(normalizedValue).toISOString() : null
}

const normalizeCouponPayload = (coupon) => {
  const discountValue = Number(coupon.discount_value || 0)
  const minimumOrderAmount = Number(coupon.minimum_order_amount || 0)
  const usageLimit = String(coupon.usage_limit || '').trim()

  return {
    code: String(coupon.code || '').trim().toUpperCase(),
    description: String(coupon.description || '').trim() || null,
    discount_type: coupon.discount_type === 'percentage' ? 'percentage' : 'fixed',
    discount_value: discountValue,
    minimum_order_amount: minimumOrderAmount,
    usage_limit: usageLimit ? Number(usageLimit) : null,
    starts_at: toIsoDateTimeValue(coupon.starts_at),
    ends_at: toIsoDateTimeValue(coupon.ends_at),
    is_active: coupon.is_active ?? true
  }
}

const mapCoupon = (coupon) => {
  const normalizedCoupon = normalizeCouponPayload(coupon)

  return {
    ...coupon,
    ...normalizedCoupon,
    discount_value: String(normalizedCoupon.discount_value || ''),
    minimum_order_amount: String(normalizedCoupon.minimum_order_amount || ''),
    usage_limit: normalizedCoupon.usage_limit === null ? '' : String(normalizedCoupon.usage_limit),
    starts_at: toDateTimeLocalValue(coupon.starts_at),
    ends_at: toDateTimeLocalValue(coupon.ends_at),
    usage_count: Number(coupon.usage_count || 0),
    original_code: normalizedCoupon.code,
    original_description: normalizedCoupon.description || '',
    original_discount_type: normalizedCoupon.discount_type,
    original_discount_value: String(normalizedCoupon.discount_value || ''),
    original_minimum_order_amount: String(normalizedCoupon.minimum_order_amount || ''),
    original_usage_limit: normalizedCoupon.usage_limit === null ? '' : String(normalizedCoupon.usage_limit),
    original_starts_at: toDateTimeLocalValue(coupon.starts_at),
    original_ends_at: toDateTimeLocalValue(coupon.ends_at),
    original_is_active: normalizedCoupon.is_active
  }
}

const normalizeSiteSettings = (source = {}) => ({
  seo_site_title: String(source.seo_site_title || '').trim(),
  seo_default_description: String(source.seo_default_description || '').trim(),
  seo_social_image_url: String(source.seo_social_image_url || '').trim(),
  seo_site_url: String(source.seo_site_url || '').trim(),
  site_name: String(source.site_name || '').trim() || defaultSiteSettings.site_name,
  site_logo_url: String(source.site_logo_url || '').trim(),
  site_logo_light_url: String(source.site_logo_light_url || '').trim(),
  site_logo_dark_url: String(source.site_logo_dark_url || '').trim(),
  site_theme_default: ['system', 'light', 'dark'].includes(source.site_theme_default) ? source.site_theme_default : 'system',
  auth_page_layout: ['split', 'centered', 'reversed'].includes(source.auth_page_layout) ? source.auth_page_layout : 'split',
  auth_image_light_url: String(source.auth_image_light_url || '').trim(),
  auth_image_dark_url: String(source.auth_image_dark_url || '').trim(),
  auth_image_position: ['left', 'center', 'right'].includes(source.auth_image_position) ? source.auth_image_position : 'center',
  auth_show_visual_text: source.auth_show_visual_text ?? true,
  auth_visual_eyebrow: String(source.auth_visual_eyebrow || '').trim().slice(0, 80),
  auth_visual_headline: String(source.auth_visual_headline || '').trim().slice(0, 120),
  auth_visual_supporting_text: String(source.auth_visual_supporting_text || '').trim().slice(0, 180),
  auth_login_heading: String(source.auth_login_heading || '').trim().slice(0, 80),
  auth_login_supporting_text: String(source.auth_login_supporting_text || '').trim().slice(0, 160),
  auth_signup_heading: String(source.auth_signup_heading || '').trim().slice(0, 80),
  auth_signup_supporting_text: String(source.auth_signup_supporting_text || '').trim().slice(0, 160),
  auth_facebook_enabled: source.auth_facebook_enabled === true,
  site_background_color: String(source.site_background_color || '').trim() || defaultSiteSettings.site_background_color,
  landing_page_title: String(source.landing_page_title || '').trim() || defaultSiteSettings.landing_page_title,
  dashboard_layout: String(source.dashboard_layout || '').trim().toLowerCase() === 'detailed'
    ? 'detailed'
    : 'standard',
  account_dashboard_style: String(source.account_dashboard_style || '').trim().toLowerCase() === 'classic'
    ? 'classic'
    : 'modern',
  allow_out_of_stock_purchases: source.allow_out_of_stock_purchases ?? defaultSiteSettings.allow_out_of_stock_purchases,
  homepage_reviews_enabled: source.homepage_reviews_enabled ?? defaultSiteSettings.homepage_reviews_enabled,
  homepage_reviews_view_all_enabled: source.homepage_reviews_view_all_enabled ?? defaultSiteSettings.homepage_reviews_view_all_enabled,
  hero_enabled: source.hero_enabled ?? true,
  hero_rotation_seconds: Math.max(1, Number(source.hero_rotation_seconds) || defaultSiteSettings.hero_rotation_seconds),
  top_bar_rotation_seconds: Math.max(1, Number(source.top_bar_rotation_seconds) || defaultSiteSettings.top_bar_rotation_seconds),
  banner_ad_1_enabled: source.banner_ad_1_enabled ?? true,
  banner_ad_1_image_url: String(source.banner_ad_1_image_url || '').trim(),
  banner_ad_1_link_url: String(source.banner_ad_1_link_url || '').trim(),
  banner_ad_2_enabled: source.banner_ad_2_enabled ?? true,
  banner_ad_2_image_url: String(source.banner_ad_2_image_url || '').trim(),
  banner_ad_2_link_url: String(source.banner_ad_2_link_url || '').trim(),
  payment_card_enabled: source.payment_card_enabled ?? false,
  payment_card_fee: Math.max(0, Number(source.payment_card_fee) || 0),
  payment_bank_transfer_enabled: source.payment_bank_transfer_enabled ?? false,
  payment_bank_transfer_fee: Math.max(0, Number(source.payment_bank_transfer_fee) || 0),
  payment_bank_transfer_instructions: String(source.payment_bank_transfer_instructions || '').trim(),
  payment_instapay_enabled: source.payment_instapay_enabled ?? false,
  payment_instapay_fee: Math.max(0, Number(source.payment_instapay_fee) || 0),
  payment_instapay_instructions: String(source.payment_instapay_instructions || '').trim(),
  payment_paypal_enabled: source.payment_paypal_enabled ?? false,
  payment_paypal_fee: Math.max(0, Number(source.payment_paypal_fee) || 0),
  payment_cash_enabled: source.payment_cash_enabled ?? true,
  payment_cash_fee: Math.max(0, Number(source.payment_cash_fee) || 0),
  footer_cta_title: String(source.footer_cta_title || '').trim(),
  footer_cta_subtitle: String(source.footer_cta_subtitle || '').trim(),
  footer_cta_button_label: String(source.footer_cta_button_label || '').trim(),
  footer_cta_button_url: String(source.footer_cta_button_url || '').trim(),
  footer_email: String(source.footer_email || '').trim(),
  footer_phone: String(source.footer_phone || '').trim(),
  footer_address: String(source.footer_address || '').trim(),
  copyright_text: String(source.copyright_text || '').trim(),
  footer_style: String(source.footer_style || '').trim().toLowerCase() === 'modern' ? 'modern' : 'classic',
  footer_modern_card_image_url: String(source.footer_modern_card_image_url || '').trim(),
  footer_modern_card_title: String(source.footer_modern_card_title || '').trim(),
  footer_modern_card_text: String(source.footer_modern_card_text || '').trim(),
  footer_modern_card_button_label: String(source.footer_modern_card_button_label || '').trim(),
  footer_modern_card_button_url: String(source.footer_modern_card_button_url || '').trim(),
  footer_modern_community_image_url: String(source.footer_modern_community_image_url || '').trim(),
  footer_modern_community_text: String(source.footer_modern_community_text || '').trim(),
  footer_modern_community_url: String(source.footer_modern_community_url || '').trim(),
  footer_modern_banner_image_url: String(source.footer_modern_banner_image_url || '').trim(),
  footer_modern_banner_alt: String(source.footer_modern_banner_alt || '').trim(),
  footer_modern_banner_url: String(source.footer_modern_banner_url || '').trim(),
  footer_modern_bottom_left_text: String(source.footer_modern_bottom_left_text || '').trim(),
  footer_modern_bottom_left_url: String(source.footer_modern_bottom_left_url || '').trim(),
  footer_modern_bottom_center_text: String(source.footer_modern_bottom_center_text || '').trim(),
  footer_modern_bottom_right_title: String(source.footer_modern_bottom_right_title || '').trim(),
  footer_modern_bottom_right_text: String(source.footer_modern_bottom_right_text || '').trim()
})

siteSettingsSnapshot.value = normalizeSiteSettings(defaultSiteSettings)

const syncSiteSettingsSnapshot = () => {
  siteSettingsSnapshot.value = normalizeSiteSettings(siteSettings)
}

const captureGeneralSettingsSnapshot = () => ({
  siteSettings: normalizeSiteSettings(siteSettings),
  heroBanners: heroBanners.value,
  topBarMessages: topBarMessages.value,
  offerCards: offerCards.value,
  siteLinks: siteLinks.value
})

const applyGeneralSettingsSnapshot = (snapshot = {}) => {
  Object.assign(siteSettings, {
    key: 'default',
    ...defaultSiteSettings,
    ...normalizeSiteSettings({
      ...defaultSiteSettings,
      ...(snapshot.siteSettings || {})
    })
  })

  syncSiteSettingsSnapshot()
  heroBanners.value = (snapshot.heroBanners || []).map(mapHeroBanner)
  topBarMessages.value = (snapshot.topBarMessages || []).map(mapTopBarMessage)
  offerCards.value = (snapshot.offerCards || []).map(mapOfferCard)
  siteLinks.value = (snapshot.siteLinks || []).map(mapSiteLink)
}

const syncGeneralSettingsCache = () => {
  setSnapshot(SETTINGS_GENERAL_CACHE_KEY, captureGeneralSettingsSnapshot())
}

const applyCouponsSnapshot = (snapshot = {}) => {
  coupons.value = (snapshot.coupons || []).map(mapCoupon)
}

const syncCouponsCache = () => {
  setSnapshot(SETTINGS_COUPONS_CACHE_KEY, {
    coupons: coupons.value
  })
}

const buildGalleryCacheKey = () => {
  return `${SETTINGS_GALLERY_CACHE_KEY}:${gallerySearchQuery.value.trim().toLowerCase()}:${galleryCurrentPage.value}`
}

const applyGallerySnapshot = (snapshot = {}) => {
  galleryImages.value = snapshot.items || []
  galleryCurrentPage.value = Math.max(1, Number(snapshot.page || galleryCurrentPage.value || 1))
  galleryPageSize.value = Math.max(1, Number(snapshot.pageSize || galleryPageSize.value || 24))
  galleryTotalItems.value = Math.max(0, Number(snapshot.totalItems || 0))
  galleryTotalPages.value = Math.max(1, Number(snapshot.totalPages || 1))
  galleryTotalSections.value = Math.max(0, Number(snapshot.totalSections || 0))
  galleryLoaded.value = true

  if (selectedGalleryImage.value) {
    selectedGalleryImage.value = galleryImages.value.find((image) => {
      return image.publicPath === selectedGalleryImage.value?.publicPath
    }) || null
  }
}

const syncGalleryCache = () => {
  setSnapshot(buildGalleryCacheKey(), {
    items: galleryImages.value,
    page: galleryCurrentPage.value,
    pageSize: galleryPageSize.value,
    totalItems: galleryTotalItems.value,
    totalPages: galleryTotalPages.value,
    totalSections: galleryTotalSections.value
  })
}


const isSettingsSectionDirty = (sectionName) => {
  const normalizedSettings = normalizeSiteSettings(siteSettings)

  return siteSettingsSectionFields[sectionName].some((field) => {
    return normalizedSettings[field] !== siteSettingsSnapshot.value[field]
  })
}

const buildSiteSettingsPayload = (sectionName) => {
  const normalizedSettings = normalizeSiteSettings(siteSettings)
  const payload = {
    key: 'default',
    updated_at: new Date().toISOString()
  }

  siteSettingsSectionFields[sectionName].forEach((field) => {
    if ([
      'site_name',
      'site_background_color',
      'landing_page_title',
      'account_dashboard_style',
      'auth_page_layout',
      'auth_image_position',
      'auth_show_visual_text',
      'auth_facebook_enabled',
      'footer_style',
      'allow_out_of_stock_purchases',
      'homepage_reviews_enabled',
      'homepage_reviews_view_all_enabled',
      'hero_enabled',
      'hero_rotation_seconds',
      'top_bar_rotation_seconds',
      'banner_ad_1_enabled',
      'banner_ad_2_enabled',
      'payment_card_enabled',
      'payment_card_fee',
      'payment_bank_transfer_enabled',
      'payment_bank_transfer_fee',
      'payment_instapay_enabled',
      'payment_instapay_fee',
      'payment_paypal_enabled',
      'payment_paypal_fee',
      'payment_cash_enabled',
      'payment_cash_fee'
    ].includes(field)) {
      payload[field] = normalizedSettings[field]
      return
    }

    payload[field] = normalizedSettings[field] || null
  })

  return payload
}

const getSiteSettings = async () => {
  settingsError.value = ''

  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('key', 'default')
    .maybeSingle()

  if (error) {
    if (!handleTableError(error)) {
      settingsError.value = error.message
    }
    return
  }

  Object.assign(siteSettings, {
    key: 'default',
    ...defaultSiteSettings,
    ...normalizeSiteSettings({
      ...defaultSiteSettings,
      ...(data || {})
    })
  })

  syncSiteSettingsSnapshot()
}

const loadGeneralSettingsData = async ({ force = false } = {}) => {
  // Keep edits when moving between settings sections and the media library.
  if (!force && generalSettingsLoaded.value) return

  const cachedSnapshot = getSnapshot(SETTINGS_GENERAL_CACHE_KEY)

  if (cachedSnapshot) {
    applyGeneralSettingsSnapshot(cachedSnapshot)
    generalSettingsLoaded.value = true
  }

  if (!force && cachedSnapshot && isFresh(SETTINGS_GENERAL_CACHE_KEY)) {
    return
  }

  await Promise.all([
    getSiteSettings(),
    getHeroBanners(),
    getTopBarMessages(),
    getOfferCards(),
    getSiteLinks()
  ])

  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
}

const getHeroBanners = async () => {
  heroError.value = ''

  const { data, error } = await supabase
    .from('site_hero_banners')
    .select('*')
    .order('sort_order')
    .order('created_at')

  if (error) {
    if (!handleTableError(error)) {
      heroError.value = error.message
    }
    return
  }

  heroBanners.value = (data || []).map(mapHeroBanner)
}

const getTopBarMessages = async () => {
  topBarError.value = ''

  const { data, error } = await supabase
    .from('site_top_bar_messages')
    .select('*')
    .order('sort_order')
    .order('created_at')

  if (error) {
    if (!handleTableError(error)) {
      topBarError.value = error.message
    }
    return
  }

  topBarMessages.value = (data || []).map(mapTopBarMessage)
}

const getOfferCards = async () => {
  offerCardsError.value = ''

  const { data, error } = await supabase
    .from('site_offer_cards')
    .select('*')
    .order('sort_order')
    .order('created_at')

  if (error) {
    if (!handleTableError(error)) {
      offerCardsError.value = error.message
    }
    return
  }

  offerCards.value = (data || []).map(mapOfferCard)
}

const getSiteLinks = async () => {
  linkError.value = ''

  const { data, error } = await supabase
    .from('site_links')
    .select('*')
    .order('location')
    .order('section_title')
    .order('sort_order')
    .order('created_at')

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  let siteLinksData = data || []
  const existingHeaderLinks = siteLinksData.filter((link) => link.location === 'header')
  const missingDefaultHeaderLinks = defaultHeaderLinkDefinitions.filter((definition) => {
    return !existingHeaderLinks.some((link) => {
      return getDefaultHeaderLinkDefinition(link)?.key === definition.key
    })
  })

  if (missingDefaultHeaderLinks.length) {
    const { error: insertError } = await supabase
      .from('site_links')
      .insert(missingDefaultHeaderLinks.map((definition, index) => ({
        location: 'header',
        section_title: null,
        label: definition.label,
        url: definition.url,
        sort_order: index,
        is_enabled: true
      })))

    if (insertError) {
      if (!handleTableError(insertError)) {
        linkError.value = insertError.message
      }
      return
    }

    const { data: refreshedData, error: refreshedError } = await supabase
      .from('site_links')
      .select('*')
      .order('location')
      .order('section_title')
      .order('sort_order')
      .order('created_at')

    if (refreshedError) {
      if (!handleTableError(refreshedError)) {
        linkError.value = refreshedError.message
      }
      return
    }

    siteLinksData = refreshedData || []
  }

  siteLinks.value = siteLinksData.map(mapSiteLink)
}

const getCoupons = async () => {
  couponError.value = ''

  const { data, error } = await supabase
    .from('site_coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (!handleTableError(error)) {
      couponError.value = error.message
    }
    return
  }

  coupons.value = (data || []).map(mapCoupon)
}

const loadCouponsData = async ({ force = false } = {}) => {
  const cachedSnapshot = getSnapshot(SETTINGS_COUPONS_CACHE_KEY)

  if (cachedSnapshot) {
    applyCouponsSnapshot(cachedSnapshot)
    couponsLoaded.value = true
  }

  if (!force && cachedSnapshot && isFresh(SETTINGS_COUPONS_CACHE_KEY)) {
    return
  }

  await getCoupons()
  couponsLoaded.value = true
  syncCouponsCache()
}

const loadAdminLogs = async ({ force = false } = {}) => {
  if (!canViewLogs.value) {
    adminLogs.value = []
    adminLogAuthors.value = []
    logsLoaded.value = true
    return
  }

  if (logsLoaded.value && !force) {
    return
  }

  logsLoading.value = true
  logsError.value = ''
  logsMissingTable.value = false

  try {
    const response = await fetchAdminLogs({
      author: selectedLogAuthor.value || undefined
    })

    adminLogs.value = response.items || []
    adminLogAuthors.value = response.authors || []
    logsMissingTable.value = Boolean(response.missingTable)
    logsLoaded.value = true
  } catch (error) {
    logsError.value = error?.data?.statusMessage || error?.message || 'Could not load admin logs.'
  } finally {
    logsLoading.value = false
  }
}

const loadGalleryImages = async ({ force = false } = {}) => {
  galleryError.value = ''

  if (!canViewGallery.value) {
    galleryImages.value = []
    galleryCurrentPage.value = 1
    galleryTotalPages.value = 1
    galleryTotalItems.value = 0
    galleryTotalSections.value = 0
    galleryLoaded.value = true
    return
  }

  const cacheKey = buildGalleryCacheKey()
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyGallerySnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    return
  }

  galleryLoading.value = true

  try {
    const response = await fetchGalleryImages({
      q: gallerySearchQuery.value.trim() || undefined,
      page: galleryCurrentPage.value,
      limit: galleryPageSize.value
    })

    applyGallerySnapshot({
      items: response.items || [],
      page: response.pagination?.page || galleryCurrentPage.value,
      pageSize: response.pagination?.pageSize || galleryPageSize.value,
      totalItems: response.pagination?.totalItems || 0,
      totalPages: response.pagination?.totalPages || 1,
      totalSections: response.totalSections || 0
    })
    syncGalleryCache()
  } catch (error) {
    galleryError.value = error?.data?.statusMessage || error?.message || 'Could not load gallery images.'
  } finally {
    galleryLoading.value = false
  }
}


const saveSiteSettings = async (sectionName) => {
  if (!canEditSettings.value) {
    return
  }

  if (sectionName === 'seoSettings' && siteSettings.seo_site_url) {
    try {
      const url = new URL(siteSettings.seo_site_url)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid')
    } catch {
      settingsError.value = useNuxtApp().$i18n.t('seo.invalidUrl')
      settingsErrorSection.value = 'seoSettings'
      return
    }
  }
  const normalizedSettingsBeforeSave = normalizeSiteSettings(siteSettings)

  settingsError.value = ''
  settingsErrorSection.value = ''
  settingsSuccess.value = ''
  settingsSuccessSection.value = ''
  settingsLoading.value = true
  settingsLoadingSection.value = sectionName

  const { error } = await supabase
    .from('site_settings')
    .upsert(buildSiteSettingsPayload(sectionName), {
      onConflict: 'key'
    })

  settingsLoading.value = false
  settingsLoadingSection.value = ''

  if (error) {
    if (!handleTableError(error)) {
      settingsError.value = error.message
      settingsErrorSection.value = sectionName
    }
    return
  }

  await getSiteSettings()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()

  Object.keys(siteSettingsSectionFields).forEach((otherSectionName) => {
    if (otherSectionName === sectionName) {
      return
    }

    siteSettingsSectionFields[otherSectionName].forEach((field) => {
      if (normalizedSettingsBeforeSave[field] !== siteSettingsSnapshot.value[field]) {
        siteSettings[field] = normalizedSettingsBeforeSave[field]
      }
    })
  })

  await refreshNuxtData('site-content')

  if (sectionName === 'dashboardLayout') {
    await refreshNuxtData('dashboard-appearance')
  }
  if (sectionName === 'accountDashboard') {
    await refreshNuxtData('account-appearance')
  }

  await logSettingsAction(
    `Updated ${siteSettingsSectionLabels[sectionName].toLowerCase()}.`,
    `settings.${sectionName}.update`,
    {
      section: sectionName
    }
  )

  settingsSuccess.value = `${siteSettingsSectionLabels[sectionName]} saved successfully.`
  settingsSuccessSection.value = sectionName
}


const removeGalleryImage = async (image) => {
  if (!image?.publicPath) {
    return
  }

  if (!confirm(`Delete image ${image.name}?`)) {
    return
  }

  galleryDeleting.value = true
  galleryError.value = ''

  try {
    await deleteGalleryImage(image.publicPath)
    await logSettingsAction(
      `Deleted uploaded image ${shortenLogValue(image.name)}.`,
      'settings.gallery.delete',
      {
        image_name: image.name,
        image_path: image.publicPath,
        image_section: image.section
      }
    )
    closeGalleryImage()
    await loadGalleryImages({ force: true })
  } catch (error) {
    galleryError.value = error?.data?.statusMessage || error?.message || 'Could not delete this image.'
  } finally {
    galleryDeleting.value = false
  }
}

const isHeroBannerDirty = (banner) => {
  return banner.image_url !== banner.original_image_url ||
    (banner.link_url || '') !== banner.original_link_url ||
    (banner.is_enabled ?? true) !== banner.original_is_enabled
}

const addHeroBanner = async () => {
  heroError.value = ''

  if (!newHeroImageUrl.value.trim()) {
    heroError.value = 'Hero banner image is required'
    return
  }

  const heroImageUrl = newHeroImageUrl.value.trim()
  const heroLinkUrl = newHeroLinkUrl.value.trim() || null

  heroLoading.value = true

  const { error } = await supabase
    .from('site_hero_banners')
    .insert({
      image_url: heroImageUrl,
      link_url: heroLinkUrl,
      sort_order: heroBanners.value.length
    })

  heroLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      heroError.value = error.message
    }
    return
  }

  newHeroImageUrl.value = ''
  newHeroLinkUrl.value = ''
  await getHeroBanners()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Added hero banner ${shortenLogValue(heroImageUrl)}.`,
    'settings.hero.create',
    {
      image_url: heroImageUrl,
      link_url: heroLinkUrl
    }
  )
}

const saveHeroBanner = async (banner) => {
  heroError.value = ''

  if (!banner.image_url.trim()) {
    heroError.value = 'Hero banner image is required'
    return
  }

  heroLoading.value = true

  const { error } = await supabase
    .from('site_hero_banners')
    .update({
      image_url: banner.image_url.trim(),
      link_url: banner.link_url.trim() || null,
      is_enabled: banner.is_enabled
    })
    .eq('id', banner.id)

  heroLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      heroError.value = error.message
    }
    return
  }

  await getHeroBanners()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Updated hero banner ${shortenLogValue(banner.image_url)}.`,
    'settings.hero.update',
    {
      hero_banner_id: banner.id
    }
  )
}

const deleteHeroBanner = async (bannerId) => {
  heroError.value = ''
  const selectedBanner = heroBanners.value.find((banner) => banner.id === bannerId)

  if (!confirm(uiLabel('Delete this hero banner?'))) {
    return
  }

  heroLoading.value = true

  const { error } = await supabase
    .from('site_hero_banners')
    .delete()
    .eq('id', bannerId)

  heroLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      heroError.value = error.message
    }
    return
  }

  await getHeroBanners()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Deleted hero banner ${shortenLogValue(selectedBanner?.image_url || bannerId)}.`,
    'settings.hero.delete',
    {
      hero_banner_id: bannerId
    }
  )
}

const isTopBarMessageDirty = (message) => {
  return message.text !== message.original_text ||
    (message.is_enabled ?? true) !== message.original_is_enabled
}

const addTopBarMessage = async () => {
  topBarError.value = ''

  if (!newTopBarText.value.trim()) {
    topBarError.value = 'Top bar text is required'
    return
  }

  const topBarText = newTopBarText.value.trim()

  topBarLoading.value = true

  const { error } = await supabase
    .from('site_top_bar_messages')
    .insert({
      text: topBarText,
      sort_order: topBarMessages.value.length
    })

  topBarLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      topBarError.value = error.message
    }
    return
  }

  newTopBarText.value = ''
  await getTopBarMessages()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Added top bar text ${shortenLogValue(topBarText)}.`,
    'settings.top-bar.create',
    {
      text: topBarText
    }
  )
}

const saveTopBarMessage = async (message) => {
  topBarError.value = ''

  if (!message.text.trim()) {
    topBarError.value = 'Top bar text is required'
    return
  }

  topBarLoading.value = true

  const { error } = await supabase
    .from('site_top_bar_messages')
    .update({
      text: message.text.trim(),
      is_enabled: message.is_enabled
    })
    .eq('id', message.id)

  topBarLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      topBarError.value = error.message
    }
    return
  }

  await getTopBarMessages()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Updated top bar text ${shortenLogValue(message.text)}.`,
    'settings.top-bar.update',
    {
      top_bar_message_id: message.id
    }
  )
}

const deleteTopBarMessage = async (messageId) => {
  topBarError.value = ''
  const selectedMessage = topBarMessages.value.find((message) => message.id === messageId)

  if (!confirm(uiLabel('Delete this top bar text?'))) {
    return
  }

  topBarLoading.value = true

  const { error } = await supabase
    .from('site_top_bar_messages')
    .delete()
    .eq('id', messageId)

  topBarLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      topBarError.value = error.message
    }
    return
  }

  await getTopBarMessages()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Deleted top bar text ${shortenLogValue(selectedMessage?.text || messageId)}.`,
    'settings.top-bar.delete',
    {
      top_bar_message_id: messageId
    }
  )
}

const resetNewOfferCard = () => {
  newOfferCard.eyebrow_text = ''
  newOfferCard.title = ''
  newOfferCard.image_url = ''
  newOfferCard.target_type = 'search'
  newOfferCard.search_query = ''
  newOfferCard.product_slug = ''
  newOfferCard.is_enabled = true
}

const isOfferCardDirty = (offerCard) => {
  return String(offerCard.eyebrow_text || '').trim() !== offerCard.original_eyebrow_text ||
    String(offerCard.title || '').trim() !== offerCard.original_title ||
    String(offerCard.image_url || '').trim() !== offerCard.original_image_url ||
    String(offerCard.target_type || '') !== offerCard.original_target_type ||
    String(offerCard.search_query || '').trim() !== offerCard.original_search_query ||
    String(offerCard.product_slug || '').trim() !== offerCard.original_product_slug ||
    (offerCard.is_enabled ?? true) !== offerCard.original_is_enabled
}

const validateOfferCardPayload = (offerCard) => {
  const payload = normalizeOfferCardPayload(offerCard)

  if (!payload.title) {
    offerCardsError.value = 'Enter an offer title.'
    return null
  }

  if (!payload.image_url) {
    offerCardsError.value = 'Offer image is required.'
    return null
  }

  if (payload.target_type === 'search' && !payload.search_query) {
    offerCardsError.value = 'Search query is required for search result cards.'
    return null
  }

  if (payload.target_type === 'product' && !payload.product_slug) {
    offerCardsError.value = 'Product slug is required for product cards.'
    return null
  }

  return payload
}

const addOfferCard = async () => {
  offerCardsError.value = ''
  const payload = validateOfferCardPayload(newOfferCard)

  if (!payload) {
    return
  }

  offerCardsLoading.value = true

  const { error } = await supabase
    .from('site_offer_cards')
    .insert({
      ...payload,
      sort_order: offerCards.value.length
    })

  offerCardsLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      offerCardsError.value = error.message
    }
    return
  }

  resetNewOfferCard()
  await getOfferCards()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Added offer card ${shortenLogValue(payload.title)}.`,
    'settings.offer-cards.create',
    {
      title: payload.title,
      target_type: payload.target_type
    }
  )
}

const saveOfferCard = async (offerCard) => {
  offerCardsError.value = ''
  const payload = validateOfferCardPayload(offerCard)

  if (!payload) {
    return
  }

  offerCardsLoading.value = true

  const { error } = await supabase
    .from('site_offer_cards')
    .update(payload)
    .eq('id', offerCard.id)

  offerCardsLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      offerCardsError.value = error.message
    }
    return
  }

  await getOfferCards()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Updated offer card ${shortenLogValue(payload.title)}.`,
    'settings.offer-cards.update',
    {
      offer_card_id: offerCard.id,
      title: payload.title,
      target_type: payload.target_type
    }
  )
}

const deleteOfferCard = async (offerCardId) => {
  offerCardsError.value = ''
  const selectedOfferCard = offerCards.value.find((offerCard) => offerCard.id === offerCardId)

  if (!confirm(uiLabel('Delete this offer card?'))) {
    return
  }

  offerCardsLoading.value = true

  const { error } = await supabase
    .from('site_offer_cards')
    .delete()
    .eq('id', offerCardId)

  offerCardsLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      offerCardsError.value = error.message
    }
    return
  }

  await getOfferCards()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Deleted offer card ${shortenLogValue(selectedOfferCard?.title || offerCardId)}.`,
    'settings.offer-cards.delete',
    {
      offer_card_id: offerCardId,
      title: selectedOfferCard?.title || ''
    }
  )
}

const isSiteLinkDirty = (link) => {
  return (link.section_title || '') !== link.original_section_title ||
    link.label !== link.original_label ||
    (link.url || '') !== link.original_url ||
    (link.is_enabled ?? true) !== link.original_is_enabled
}

const isSiteLinkSaving = (linkId) => {
  return savingSiteLinkId.value === linkId
}

const isSiteLinkDeleting = (linkId) => {
  return deletingSiteLinkId.value === linkId
}

const isSiteLinkBusy = (linkId) => {
  return isSiteLinkSaving(linkId) || isSiteLinkDeleting(linkId)
}

const addHeaderLink = async () => {
  linkError.value = ''

  if (!newHeaderLabel.value.trim() || !newHeaderUrl.value.trim()) {
    linkError.value = 'Header link label and URL are required'
    return
  }

  const headerLabel = newHeaderLabel.value.trim()
  const headerUrl = newHeaderUrl.value.trim()

  addingHeaderLink.value = true

  const { error } = await supabase
    .from('site_links')
    .insert({
      location: 'header',
      label: headerLabel,
      url: headerUrl,
      sort_order: defaultHeaderLinkDefinitions.length + customHeaderLinks.value.length
    })

  addingHeaderLink.value = false

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  newHeaderLabel.value = ''
  newHeaderUrl.value = ''
  await getSiteLinks()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Added header link ${headerLabel}.`,
    'settings.header-link.create',
    {
      label: headerLabel,
      url: headerUrl
    }
  )
}

const addFooterLink = async () => {
  linkError.value = ''

  if (!newFooterSectionTitle.value.trim() || !newFooterLabel.value.trim()) {
    linkError.value = 'Footer section title and label are required'
    return
  }

  const footerSectionTitle = newFooterSectionTitle.value.trim()
  const footerLabel = newFooterLabel.value.trim()
  const footerUrl = newFooterUrl.value.trim() || null

  addingFooterLink.value = true

  const { error } = await supabase
    .from('site_links')
    .insert({
      location: 'footer',
      section_title: footerSectionTitle,
      label: footerLabel,
      url: footerUrl,
      sort_order: footerLinks.value.length
    })

  addingFooterLink.value = false

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  newFooterSectionTitle.value = ''
  newFooterLabel.value = ''
  newFooterUrl.value = ''
  await getSiteLinks()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Added footer link ${footerLabel} under ${footerSectionTitle}.`,
    'settings.footer-link.create',
    {
      section_title: footerSectionTitle,
      label: footerLabel,
      url: footerUrl
    }
  )
}

const saveSiteLink = async (link) => {
  linkError.value = ''
  const defaultHeaderLinkDefinition = getDefaultHeaderLinkDefinition(link)

  if (!link.label.trim()) {
    linkError.value = 'Link label is required'
    return
  }

  if (
    link.location === 'header' &&
    !defaultHeaderLinkDefinition &&
    !link.url.trim()
  ) {
    linkError.value = 'Header link URL is required'
    return
  }

  if (link.location === 'footer' && !link.section_title.trim()) {
    linkError.value = 'Footer section title is required'
    return
  }

  savingSiteLinkId.value = link.id

  const payload = {
    section_title: link.location === 'footer' ? link.section_title.trim() : null,
    label: link.label.trim(),
    url: link.url.trim() || null,
    is_enabled: link.is_enabled
  }

  if (defaultHeaderLinkDefinition) {
    payload.label = defaultHeaderLinkDefinition.label

    if (defaultHeaderLinkDefinition.isUrlEditable) {
      payload.url = link.url.trim() || defaultHeaderLinkDefinition.url || null
    } else {
      payload.url = defaultHeaderLinkDefinition.url
    }
  }

  const { error } = await supabase
    .from('site_links')
    .update(payload)
    .eq('id', link.id)

  savingSiteLinkId.value = ''

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  await getSiteLinks()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Updated ${link.location} link ${shortenLogValue(link.label)}.`,
    `settings.${link.location}-link.update`,
    {
      link_id: link.id,
      location: link.location
    }
  )
}

const deleteSiteLink = async (linkId) => {
  linkError.value = ''
  const selectedLink = siteLinks.value.find((link) => link.id === linkId)

  if (selectedLink && isDefaultHeaderLink(selectedLink)) {
    linkError.value = 'Default header links cannot be removed.'
    return
  }

  if (!confirm(uiLabel('Delete this link item?'))) {
    return
  }

  deletingSiteLinkId.value = linkId

  const { error } = await supabase
    .from('site_links')
    .delete()
    .eq('id', linkId)

  deletingSiteLinkId.value = ''

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  await getSiteLinks()
  generalSettingsLoaded.value = true
  syncGeneralSettingsCache()
  await refreshNuxtData('site-content')
  await logSettingsAction(
    `Deleted ${selectedLink?.location || 'site'} link ${shortenLogValue(selectedLink?.label || linkId)}.`,
    `settings.${selectedLink?.location || 'site'}-link.delete`,
    {
      link_id: linkId,
      location: selectedLink?.location || null
    }
  )
}

const validateCouponForm = (coupon, isNewCoupon = false) => {
  const normalizedCoupon = normalizeCouponPayload(coupon)

  if (!normalizedCoupon.code) {
    couponError.value = 'Coupon code is required.'
    return null
  }

  if (normalizedCoupon.discount_value <= 0) {
    couponError.value = 'Discount value must be greater than zero.'
    return null
  }

  if (normalizedCoupon.discount_type === 'percentage' && normalizedCoupon.discount_value > 100) {
    couponError.value = 'Percentage discount cannot be greater than 100.'
    return null
  }

  if (normalizedCoupon.minimum_order_amount < 0) {
    couponError.value = 'Minimum order amount cannot be negative.'
    return null
  }

  if (
    normalizedCoupon.starts_at &&
    normalizedCoupon.ends_at &&
    new Date(normalizedCoupon.starts_at).getTime() > new Date(normalizedCoupon.ends_at).getTime()
  ) {
    couponError.value = 'Coupon end date must be after the start date.'
    return null
  }

  if (!isNewCoupon) {
    return normalizedCoupon
  }

  return normalizedCoupon
}

const isCouponDirty = (coupon) => {
  return String(coupon.code || '').trim().toUpperCase() !== coupon.original_code ||
    String(coupon.description || '').trim() !== coupon.original_description ||
    String(coupon.discount_type || '') !== coupon.original_discount_type ||
    String(coupon.discount_value || '') !== coupon.original_discount_value ||
    String(coupon.minimum_order_amount || '') !== coupon.original_minimum_order_amount ||
    String(coupon.usage_limit || '') !== coupon.original_usage_limit ||
    String(coupon.starts_at || '') !== coupon.original_starts_at ||
    String(coupon.ends_at || '') !== coupon.original_ends_at ||
    (coupon.is_active ?? true) !== coupon.original_is_active
}

const resetNewCoupon = () => {
  newCoupon.code = ''
  newCoupon.description = ''
  newCoupon.discount_type = 'fixed'
  newCoupon.discount_value = ''
  newCoupon.minimum_order_amount = ''
  newCoupon.usage_limit = ''
  newCoupon.starts_at = ''
  newCoupon.ends_at = ''
  newCoupon.is_active = true
}

const addCoupon = async () => {
  couponError.value = ''
  const payload = validateCouponForm(newCoupon, true)

  if (!payload) {
    return
  }

  couponLoading.value = true

  const { error } = await supabase
    .from('site_coupons')
    .insert({
      ...payload,
      usage_count: 0,
      updated_at: new Date().toISOString()
    })

  couponLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      couponError.value = error.message
    }
    return
  }

  resetNewCoupon()
  await getCoupons()
  couponsLoaded.value = true
  syncCouponsCache()
  await logSettingsAction(
    `Added coupon ${payload.code}.`,
    'settings.coupons.create',
    {
      coupon_code: payload.code
    }
  )
}

const saveCoupon = async (coupon) => {
  couponError.value = ''
  const payload = validateCouponForm(coupon)

  if (!payload) {
    return
  }

  couponLoading.value = true

  const { error } = await supabase
    .from('site_coupons')
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', coupon.id)

  couponLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      couponError.value = error.message
    }
    return
  }

  await getCoupons()
  couponsLoaded.value = true
  syncCouponsCache()
  await logSettingsAction(
    `Updated coupon ${payload.code}.`,
    'settings.coupons.update',
    {
      coupon_id: coupon.id,
      coupon_code: payload.code
    }
  )
}

const deleteCoupon = async (couponId) => {
  couponError.value = ''
  const selectedCoupon = coupons.value.find((coupon) => coupon.id === couponId)

  if (!confirm(uiLabel('Delete this coupon?'))) {
    return
  }

  couponLoading.value = true

  const { error } = await supabase
    .from('site_coupons')
    .delete()
    .eq('id', couponId)

  couponLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      couponError.value = error.message
    }
    return
  }

  await getCoupons()
  couponsLoaded.value = true
  syncCouponsCache()
  await logSettingsAction(
    `Deleted coupon ${selectedCoupon?.code || couponId}.`,
    'settings.coupons.delete',
    {
      coupon_id: couponId,
      coupon_code: selectedCoupon?.code || ''
    }
  )
}

watch(gallerySearchQuery, () => {
  if (activeSettingsView.value !== 'gallery' || !canViewGallery.value) {
    return
  }

  clearTimeout(gallerySearchTimeoutId)
  galleryCurrentPage.value = 1

  gallerySearchTimeoutId = setTimeout(async () => {
    await loadGalleryImages({ force: true })
  }, 300)
})

const handleSystemResetChanged = () => {
  generalSettingsLoaded.value = false
  couponsLoaded.value = false
  galleryLoaded.value = false
  logsLoaded.value = false
  adminLogs.value = []
  galleryImages.value = []
  coupons.value = []
}

const loadActiveSettingsView = async (view = activeSettingsView.value, { force = false } = {}) => {
  if (view === 'erp') return

  if (view === 'logs') {
    await loadAdminLogs({ force })
    return
  }


  if (view === 'reset') return

  if (view === 'gallery') {
    await loadGalleryImages({ force })
    return
  }

  if (view === 'coupons') {
    await loadCouponsData({ force })
    return
  }

  await loadGeneralSettingsData({ force })
}

watch(activeSettingsView, async (view, previousView) => {
  if (view === previousView) {
    return
  }

  await loadActiveSettingsView(view)
})

watch(selectedLogAuthor, async () => {
  logsLoaded.value = false

  if (activeSettingsView.value === 'logs') {
    await loadAdminLogs({ force: true })
  }
})

onBeforeUnmount(() => {
  clearTimeout(gallerySearchTimeoutId)
})

onMounted(async () => {
  await loadActiveSettingsView()
})
</script>
