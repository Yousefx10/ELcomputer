<template>
  <div class="">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Site Settings</h2>
        <p class="mt-2 text-sm text-gray-500">
          Control the store name, logo, banners, top bar text, navigation, and footer content
        </p>
      </div>

      <DashboardSecondaryNav :items="secondaryNavItems" />

      <div v-if="pageError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ pageError }}
      </div>

      <div
        v-if="!canEditSettings && activeSettingsView !== 'users'"
        class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700 shadow"
      >
        This account has view-only access to settings. Saving and editing actions are disabled.
      </div>

      <div v-if="activeSettingsView === 'general'" class="space-y-4">
        <section class="overflow-hidden rounded-2xl bg-white shadow">
          <button
            type="button"
            @click="toggleSection('generalSettings')"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h3 class="text-2xl font-bold">General Settings</h3>
              <p class="mt-1 text-sm text-gray-500">
                Main site details and logo
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
                <label class="mb-2 block text-sm font-semibold text-gray-700">Site Name</label>
                <input
                  v-model="siteSettings.site_name"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <DashboardMediaUploadField
                v-model="siteSettings.site_logo_url"
                label="Site Logo"
                section="site_logo"
                preview-alt="Site logo"
                preview-height-class="h-24"
                help-text="Used in the public navbar and dashboard header."
              />

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Background Color</label>
                <input
                  v-model="siteSettings.site_background_color"
                  type="text"
                  placeholder="#f3f4f6"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Landing Page Title</label>
                <input
                  v-model="siteSettings.landing_page_title"
                  type="text"
                  placeholder="ELcomputer"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p
                  v-if="settingsErrorSection === 'generalSettings' && settingsError"
                  class="text-sm text-red-600"
                >
                  {{ settingsError }}
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
                {{ settingsLoadingSection === 'generalSettings' ? 'Saving...' : 'Save General Settings' }}
              </button>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl bg-white shadow">
          <button
            type="button"
            @click="toggleSection('offerCards')"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h3 class="text-2xl font-bold">Offer Cards</h3>
              <p class="mt-1 text-sm text-gray-500">
                Manage the home offer slider cards and choose whether each card opens search results or a product page.
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
                  Add cards with an upper label, a giant title, an image, and a shortcut target.
                </p>
              </div>

              <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
                {{ offerCards.length }} card{{ offerCards.length === 1 ? '' : 's' }}
              </div>
            </div>

            <p v-if="offerCardsError" class="mb-4 text-sm text-red-600">
              {{ offerCardsError }}
            </p>

            <div class="overflow-x-auto pb-2">
              <div class="flex gap-4">
                <div class="w-[340px] flex-shrink-0 rounded-2xl border bg-gray-50 p-4">
                  <p class="text-lg font-bold text-gray-900">
                    Add Offer Card
                  </p>

                  <div class="mt-4 overflow-hidden rounded-2xl bg-black">
                    <div class="relative h-44">
                      <img
                        v-if="newOfferCard.image_url"
                        :src="newOfferCard.image_url"
                        alt="Offer card preview"
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
                            {{ newOfferCard.title || 'Offer Title' }}
                          </h4>
                        </div>

                        <span class="inline-flex w-fit rounded-full border border-white/45 bg-white/15 px-4 py-2 text-sm font-semibold">
                          View Offer
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 space-y-3">
                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Upper Text</label>
                      <input
                        v-model="newOfferCard.eyebrow_text"
                        type="text"
                        placeholder="More than"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Giant Text</label>
                      <input
                        v-model="newOfferCard.title"
                        type="text"
                        placeholder="40% off"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <DashboardMediaUploadField
                      v-model="newOfferCard.image_url"
                      label="Offer Image"
                      section="offer_cards"
                      :show-preview="false"
                      help-text="Upload the card image stored on the server host."
                    />

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Shortcut Type</label>
                      <select
                        v-model="newOfferCard.target_type"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                        <option value="search">Search Result</option>
                        <option value="product">Product Page</option>
                      </select>
                    </div>

                    <div v-if="newOfferCard.target_type === 'search'">
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Search Query</label>
                      <input
                        v-model="newOfferCard.search_query"
                        type="text"
                        placeholder="gaming mouse"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div v-else>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Product Slug</label>
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
                    {{ offerCardsLoading ? 'Saving...' : 'Add Offer Card' }}
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
                        alt="Offer card preview"
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
                            {{ offerCard.title || 'Offer Title' }}
                          </h4>
                        </div>

                        <span class="inline-flex w-fit rounded-full border border-white/45 bg-white/15 px-4 py-2 text-sm font-semibold">
                          View Offer
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 space-y-3">
                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Upper Text</label>
                      <input
                        v-model="offerCard.eyebrow_text"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Giant Text</label>
                      <input
                        v-model="offerCard.title"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <DashboardMediaUploadField
                      v-model="offerCard.image_url"
                      label="Offer Image"
                      section="offer_cards"
                      :show-preview="false"
                      help-text="Upload the card image stored on the server host."
                    />

                    <div>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Shortcut Type</label>
                      <select
                        v-model="offerCard.target_type"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                        <option value="search">Search Result</option>
                        <option value="product">Product Page</option>
                      </select>
                    </div>

                    <div v-if="offerCard.target_type === 'search'">
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Search Query</label>
                      <input
                        v-model="offerCard.search_query"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <div v-else>
                      <label class="mb-2 block text-sm font-semibold text-gray-700">Product Slug</label>
                      <input
                        v-model="offerCard.product_slug"
                        type="text"
                        class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                      >
                    </div>

                    <label class="flex items-center gap-2 text-sm text-gray-600">
                      <input v-model="offerCard.is_enabled" type="checkbox">
                      Enabled
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
                      Save
                    </button>

                    <button
                      type="button"
                      :disabled="offerCardsLoading"
                      @click="deleteOfferCard(offerCard.id)"
                      class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="!offerCards.length" class="mt-4 text-sm text-gray-500">
              No offer cards added yet. Start by creating one from the first panel.
            </p>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl bg-white shadow">
          <button
            type="button"
            @click="toggleSection('topBarTexts')"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h3 class="text-2xl font-bold">Top Bar Texts</h3>
              <p class="mt-1 text-sm text-gray-500">
                These are the rotating texts shown in the blue bar above the navbar.
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
                <label class="mb-2 block text-sm font-semibold text-gray-700">Top Bar Rotation Seconds</label>
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
                  {{ settingsLoadingSection === 'topBarSettings' ? 'Saving...' : 'Save Top Bar Timing' }}
                </button>
              </div>
            </div>

            <div class="mb-5 space-y-1">
              <p
                v-if="settingsErrorSection === 'topBarSettings' && settingsError"
                class="text-sm text-red-600"
              >
                {{ settingsError }}
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
                placeholder="Top bar text"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

              <button
                type="button"
                @click="addTopBarMessage"
                class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
              >
                {{ topBarLoading ? 'Saving...' : 'Add Text' }}
              </button>
            </div>

            <p v-if="topBarError" class="mb-4 text-sm text-red-600">
              {{ topBarError }}
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
                    Enabled
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
                    Save
                  </button>

                  <button
                    type="button"
                    @click="deleteTopBarMessage(message.id)"
                    class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-gray-500">
              No top bar texts added yet.
            </p>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl bg-white shadow">
          <button
            type="button"
            @click="toggleSection('heroBanners')"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h3 class="text-2xl font-bold">Hero Banners</h3>
              <p class="mt-1 text-sm text-gray-500">
                Control the main hero slider and add multiple hero banners for the home page.
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
                  <p class="text-sm font-semibold text-gray-700">Hero Banner</p>
                  <p class="text-sm text-gray-500">
                    Turn the main home hero banner section on or off
                  </p>
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-sm font-semibold" :class="siteSettings.hero_enabled ? 'text-green-600' : 'text-gray-500'">
                    {{ siteSettings.hero_enabled ? 'ON' : 'OFF' }}
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
                <label class="mb-2 block text-sm font-semibold text-gray-700">Hero Rotation Seconds</label>
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
                  {{ settingsError }}
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
                {{ settingsLoadingSection === 'heroSettings' ? 'Saving...' : 'Save Hero Settings' }}
              </button>
            </div>

            <div class="mb-5 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
              <DashboardMediaUploadField
                v-model="newHeroImageUrl"
                label="Hero Image"
                section="hero_banners"
                preview-alt="Hero banner"
                preview-image-class="object-cover"
                preview-height-class="h-28"
                help-text="Upload a hero banner image stored on the server host."
              />

              <input
                v-model="newHeroLinkUrl"
                type="text"
                placeholder="Link URL"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

              <button
                type="button"
                @click="addHeroBanner"
                class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
              >
                {{ heroLoading ? 'Saving...' : 'Add Banner' }}
              </button>
            </div>

            <p v-if="heroError" class="mb-4 text-sm text-red-600">
              {{ heroError }}
            </p>

            <div v-if="heroBanners.length" class="space-y-3">
              <div
                v-for="banner in heroBanners"
                :key="banner.id"
                class="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]"
              >
                <DashboardMediaUploadField
                  v-model="banner.image_url"
                  label="Hero Image"
                  section="hero_banners"
                  preview-alt="Hero banner"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                />

                <div class="space-y-3">
                  <input
                    v-model="banner.link_url"
                    type="text"
                    placeholder="Link URL"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >

                  <label class="flex items-center gap-2 text-sm text-gray-600">
                    <input v-model="banner.is_enabled" type="checkbox">
                    Enabled
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
                    Save
                  </button>

                  <button
                    type="button"
                    @click="deleteHeroBanner(banner.id)"
                    class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-gray-500">
              No hero banners added yet.
            </p>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl bg-white shadow">
          <button
            type="button"
            @click="toggleSection('bannerAds')"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h3 class="text-2xl font-bold">Banner Ads</h3>
              <p class="mt-1 text-sm text-gray-500">
                Control the two banner ads shown above the keyboard and accessories sections
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
                    <p class="text-sm font-semibold text-gray-700">Banner Ad 1</p>
                    <p class="text-sm text-gray-500">
                      Shows above the keyboard section
                    </p>
                  </div>

                  <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold" :class="siteSettings.banner_ad_1_enabled ? 'text-green-600' : 'text-gray-500'">
                      {{ siteSettings.banner_ad_1_enabled ? 'ON' : 'OFF' }}
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
                  label="Banner Ad 1 Image"
                  section="banner_ads"
                  preview-alt="Banner Ad 1"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                  help-text="Used above the keyboard section on the landing page."
                />

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Banner Ad 1 Link</label>
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
                    <p class="text-sm font-semibold text-gray-700">Banner Ad 2</p>
                    <p class="text-sm text-gray-500">
                      Shows above the accessories section
                    </p>
                  </div>

                  <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold" :class="siteSettings.banner_ad_2_enabled ? 'text-green-600' : 'text-gray-500'">
                      {{ siteSettings.banner_ad_2_enabled ? 'ON' : 'OFF' }}
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
                  label="Banner Ad 2 Image"
                  section="banner_ads"
                  preview-alt="Banner Ad 2"
                  preview-image-class="object-cover"
                  preview-height-class="h-28"
                  help-text="Used above the accessories section on the landing page."
                />

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Banner Ad 2 Link</label>
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
                  {{ settingsError }}
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
                {{ settingsLoadingSection === 'bannerAds' ? 'Saving...' : 'Save Banner Ads' }}
              </button>
            </div>
          </div>
        </section>

      <section class="overflow-hidden rounded-2xl bg-white shadow">
        <button
          type="button"
          @click="toggleSection('headerLinks')"
          class="flex w-full items-center justify-between p-6 text-left"
        >
          <div>
            <h3 class="text-2xl font-bold">Header Navigation Links</h3>
            <p class="mt-1 text-sm text-gray-500">
              Manage the public navbar links shown on the landing page.
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
              placeholder="Label"
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
              {{ addingHeaderLink ? 'Saving...' : 'Add Link' }}
            </button>
          </div>

          <p class="mb-4 text-sm text-gray-500">
            Default links stay at the top and cannot be removed. Any new links appear after them.
          </p>

          <p v-if="linkError" class="mb-4 text-sm text-red-600">
            {{ linkError }}
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
                    {{ link.label }}
                  </p>

                  <span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    Default
                  </span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3">
                  <label class="flex items-center gap-2 text-sm text-gray-600">
                    <input v-model="link.is_enabled" type="checkbox">
                    Enabled
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
                    {{ isSiteLinkSaving(link.id) ? 'Saving...' : 'Save' }}
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
                  placeholder="Link label"
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
                  Enabled
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
                  {{ isSiteLinkSaving(link.id) ? 'Saving...' : 'Save' }}
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
                  {{ isSiteLinkDeleting(link.id) ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-gray-500">
            No header links added yet.
          </p>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl bg-white shadow">
        <button
          type="button"
          @click="toggleSection('footerSettings')"
          class="flex w-full items-center justify-between p-6 text-left"
        >
          <div>
            <h3 class="text-2xl font-bold">Footer Settings</h3>
            <p class="mt-1 text-sm text-gray-500">
              Footer call-to-action, contact details, and copyright text
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
          <div class="grid gap-5 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer CTA Title</label>
              <input
                v-model="siteSettings.footer_cta_title"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer CTA Subtitle</label>
              <input
                v-model="siteSettings.footer_cta_subtitle"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer Button Label</label>
              <input
                v-model="siteSettings.footer_cta_button_label"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer Button Link</label>
              <input
                v-model="siteSettings.footer_cta_button_url"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer Email</label>
              <input
                v-model="siteSettings.footer_email"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer Phone</label>
              <input
                v-model="siteSettings.footer_phone"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-gray-700">Footer Address</label>
              <input
                v-model="siteSettings.footer_address"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-gray-700">Copyright Text</label>
              <input
                v-model="siteSettings.copyright_text"
                type="text"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p
                v-if="settingsErrorSection === 'footerSettings' && settingsError"
                class="text-sm text-red-600"
              >
                {{ settingsError }}
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
              {{ settingsLoadingSection === 'footerSettings' ? 'Saving...' : 'Save Footer Settings' }}
            </button>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl bg-white shadow">
        <button
          type="button"
          @click="toggleSection('footerLinks')"
          class="flex w-full items-center justify-between p-6 text-left"
        >
          <div>
            <h3 class="text-2xl font-bold">Footer Links and Details</h3>
            <p class="mt-1 text-sm text-gray-500">
              Group footer items by section. Leave the URL empty if the item should be plain text only.
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
            placeholder="Section title"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="newFooterLabel"
              type="text"
              placeholder="Label"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="newFooterUrl"
              type="text"
              placeholder="URL or leave empty"
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
              {{ addingFooterLink ? 'Saving...' : 'Add Item' }}
            </button>
          </div>

          <p v-if="linkError" class="mb-4 text-sm text-red-600">
            {{ linkError }}
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
                  Enabled
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
                  {{ isSiteLinkSaving(link.id) ? 'Saving...' : 'Save' }}
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
                  {{ isSiteLinkDeleting(link.id) ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-gray-500">
            No footer items added yet.
          </p>
        </div>
      </section>

      </div>

      <div v-else-if="activeSettingsView === 'gallery'" class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 class="text-2xl font-bold">Gallery</h3>
              <p class="mt-1 text-sm text-gray-500">
                Browse every image uploaded to the server host, preview it, download it, or remove it.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
                {{ galleryTotalItems }} image{{ galleryTotalItems === 1 ? '' : 's' }}
              </div>

              <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
                {{ galleryTotalSections }} section{{ galleryTotalSections === 1 ? '' : 's' }}
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-2xl border bg-gray-50 p-5">
            <div class="flex flex-col gap-3 md:flex-row md:items-end">
              <div class="flex-1">
                <label class="mb-2 block text-sm font-semibold text-gray-700">Search Image</label>
                <input
                  v-model="gallerySearchQuery"
                  type="text"
                  placeholder="Search by file name"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <button
                v-if="gallerySearchQuery.trim()"
                type="button"
                class="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                @click="clearGallerySearch"
              >
                Clear
              </button>
            </div>

            <p class="mt-4 text-sm text-gray-500">
              {{ gallerySearchQuery.trim()
                ? `Showing images matching "${gallerySearchQuery.trim()}".`
                : 'Showing all uploaded images from the server host.' }}
            </p>

            <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm text-gray-500">
              <p>
                Showing {{ galleryPageStart }}-{{ galleryPageEnd }} of {{ galleryTotalItems }}
              </p>

              <p>
                {{ gallerySectionCount }} section{{ gallerySectionCount === 1 ? '' : 's' }} on this page
              </p>
            </div>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-6 shadow">
          <p v-if="galleryError" class="text-sm text-red-600">
            {{ galleryError }}
          </p>

          <p v-else-if="galleryLoading" class="text-sm text-gray-500">
            Loading gallery...
          </p>

          <p v-else-if="!galleryImages.length" class="text-sm text-gray-500">
            No uploaded images found.
          </p>

          <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="image in galleryImages"
              :key="image.publicPath"
              type="button"
              class="overflow-hidden rounded-2xl border text-left transition hover:-translate-y-1 hover:shadow-md"
              @click="openGalleryImage(image)"
            >
              <div class="flex h-44 items-center justify-center bg-gray-100 p-3">
                <img
                  :src="image.publicPath"
                  :alt="image.name"
                  class="h-full w-full object-contain"
                >
              </div>

              <div class="space-y-2 p-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="truncate text-sm font-semibold text-gray-900">
                    {{ image.name }}
                  </p>

                  <span class="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    {{ image.section }}
                  </span>
                </div>

                <p class="text-xs text-gray-500">
                  {{ formatGalleryFileSize(image.size) }}
                </p>

                <p class="text-xs text-gray-400">
                  {{ formatLogDate(image.updated_at) }}
                </p>
              </div>
            </button>
          </div>

          <div
            v-if="galleryImages.length"
            class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          >
            <p class="text-sm text-gray-500">
              Page {{ galleryCurrentPage }} of {{ galleryTotalPages }}
            </p>

            <div class="flex gap-2">
              <button
                type="button"
                :disabled="galleryCurrentPage === 1 || galleryLoading"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                @click="changeGalleryPage(galleryCurrentPage - 1)"
              >
                Previous
              </button>

              <button
                type="button"
                :disabled="galleryCurrentPage === galleryTotalPages || galleryLoading"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                @click="changeGalleryPage(galleryCurrentPage + 1)"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <div
          v-if="selectedGalleryImage"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          @click.self="closeGalleryImage"
        >
          <div class="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 class="text-2xl font-bold text-gray-900">
                  {{ selectedGalleryImage.name }}
                </h4>
                <p class="mt-1 text-sm text-gray-500">
                  {{ selectedGalleryImage.section }} · {{ formatGalleryFileSize(selectedGalleryImage.size) }}
                </p>
                <p class="mt-1 break-all text-xs text-gray-400">
                  {{ selectedGalleryImage.publicPath }}
                </p>
              </div>

              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                @click="closeGalleryImage"
              >
                Close
              </button>
            </div>

            <div class="mt-6 flex max-h-[65vh] items-center justify-center overflow-hidden rounded-2xl bg-gray-100 p-4">
              <img
                :src="selectedGalleryImage.publicPath"
                :alt="selectedGalleryImage.name"
                class="max-h-[60vh] w-full object-contain"
              >
            </div>

            <div class="mt-6 flex flex-wrap justify-end gap-3">
              <a
                :href="getGalleryDownloadUrl(selectedGalleryImage.publicPath)"
                :download="selectedGalleryImage.name"
                class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Download
              </a>

              <button
                v-if="canEditSettings"
                type="button"
                :disabled="galleryDeleting"
                class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                @click="removeGalleryImage(selectedGalleryImage)"
              >
                {{ galleryDeleting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeSettingsView === 'inventory'" class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div
            class="rounded-2xl border bg-gray-50 p-5"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="text-2xl font-bold">Inventory Rules</h3>
                <p class="mt-1 text-sm text-gray-500">
                  Control whether shoppers can still place orders when a product stock is empty.
                </p>
              </div>

              <div class="flex items-center gap-3">
                <span
                  class="text-sm font-semibold"
                  :class="siteSettings.allow_out_of_stock_purchases ? 'text-green-600' : 'text-gray-500'"
                >
                  {{ siteSettings.allow_out_of_stock_purchases ? 'ON' : 'OFF' }}
                </span>

                <button
                  type="button"
                  :aria-pressed="siteSettings.allow_out_of_stock_purchases"
                  @click="siteSettings.allow_out_of_stock_purchases = !siteSettings.allow_out_of_stock_purchases"
                  class="relative inline-flex h-7 w-14 items-center rounded-full transition"
                  :class="siteSettings.allow_out_of_stock_purchases ? 'bg-green-600' : 'bg-gray-300'"
                >
                  <span
                    class="inline-block h-5 w-5 rounded-full bg-white transition"
                    :class="siteSettings.allow_out_of_stock_purchases ? 'translate-x-8' : 'translate-x-1'"
                  />
                </button>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p
                  v-if="settingsErrorSection === 'inventorySettings' && settingsError"
                  class="text-sm text-red-600"
                >
                  {{ settingsError }}
                </p>

                <p
                  v-if="settingsSuccessSection === 'inventorySettings' && settingsSuccess"
                  class="text-sm text-green-600"
                >
                  {{ settingsSuccess }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!isSettingsSectionDirty('inventorySettings') || settingsLoading"
                @click="saveSiteSettings('inventorySettings')"
                class="rounded-lg px-5 py-3 font-bold text-white"
                :class="isSettingsSectionDirty('inventorySettings') && !settingsLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                {{ settingsLoadingSection === 'inventorySettings' ? 'Saving...' : 'Save Inventory Rules' }}
              </button>
            </div>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 class="text-2xl font-bold">Increase Inventory</h3>
              <p class="mt-1 text-sm text-gray-500">
                Pick a product, add the incoming stock quantity, and save the latest cost.
              </p>
            </div>

            <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
              {{ inventoryProducts.length }} product{{ inventoryProducts.length === 1 ? '' : 's' }}
            </div>
          </div>

          <div v-if="!canViewInventory" class="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
            This account needs product view permission to load inventory products.
          </div>

          <div v-else class="mt-6 space-y-4">
            <div v-if="!canEditInventory" class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
              This account needs product edit permission to increase inventory.
            </div>

            <div
              class="rounded-2xl border bg-gray-50 p-5"
              :class="!canEditInventory ? 'pointer-events-none opacity-70' : ''"
            >
              <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
                <div class="flex-1">
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Search Product</label>
                  <input
                    v-model="inventorySearchQuery"
                    type="text"
                    placeholder="Search by product name or slug"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <button
                  v-if="inventorySearchQuery.trim()"
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  @click="clearInventorySearch"
                >
                  Clear
                </button>
              </div>

              <p class="mb-4 text-sm text-gray-500">
                {{ inventorySearchQuery.trim()
                  ? `Showing up to 10 matching products for "${inventorySearchQuery.trim()}".`
                  : 'Showing the latest 10 added products.' }}
              </p>

              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="xl:col-span-2">
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Product</label>
                  <select
                    v-model="selectedInventoryProductId"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                    <option value="">Select product</option>

                    <option
                      v-for="inventoryProduct in inventoryProductOptions"
                      :key="inventoryProduct.id"
                      :value="inventoryProduct.id"
                    >
                      {{ inventoryProduct.title }}{{ inventoryProduct.slug ? ` (${inventoryProduct.slug})` : '' }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Add Quantity</label>
                  <input
                    v-model="inventoryIncreaseQuantity"
                    type="number"
                    min="1"
                    placeholder="1"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">New Product Cost</label>
                  <input
                    v-model="inventoryCostPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>
              </div>

              <div
                v-if="selectedInventoryProduct"
                class="mt-4 grid gap-4 md:grid-cols-3"
              >
                <div class="rounded-xl bg-white p-4">
                  <p class="text-sm text-gray-500">Current Stock</p>
                  <p class="mt-2 text-2xl font-bold text-gray-900">
                    {{ selectedInventoryProduct.stock_quantity }}
                  </p>
                </div>

                <div class="rounded-xl bg-white p-4">
                  <p class="text-sm text-gray-500">Current Cost</p>
                  <p class="mt-2 text-2xl font-bold text-gray-900">
                    {{ formatInventoryMoney(selectedInventoryProduct.cost_price) }}
                  </p>
                </div>

                <div class="rounded-xl bg-white p-4">
                  <p class="text-sm text-gray-500">Stock After Update</p>
                  <p class="mt-2 text-2xl font-bold text-gray-900">
                    {{ nextInventoryStockQuantity }}
                  </p>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-1">
                  <p v-if="inventoryError" class="text-sm text-red-600">
                    {{ inventoryError }}
                  </p>

                  <p v-if="inventorySuccess" class="text-sm text-green-600">
                    {{ inventorySuccess }}
                  </p>
                </div>

                <button
                  type="button"
                  :disabled="!isInventoryIncreaseReady || inventoryLoading || !canEditInventory"
                  @click="increaseInventory"
                  class="rounded-lg px-5 py-3 font-bold text-white"
                  :class="isInventoryIncreaseReady && !inventoryLoading && canEditInventory
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-300'"
                >
                  {{ inventoryLoading ? 'Saving...' : 'Increase Inventory' }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div v-else-if="activeSettingsView === 'coupons'" class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 class="text-2xl font-bold">Coupons</h3>
              <p class="mt-1 text-sm text-gray-500">
                Create and manage coupon codes that can be applied during checkout.
              </p>
            </div>

            <div class="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
              {{ coupons.length }} coupon{{ coupons.length === 1 ? '' : 's' }}
            </div>
          </div>

          <div
            class="mt-6 rounded-2xl border bg-gray-50 p-5"
            :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
          >
            <h4 class="text-lg font-bold text-gray-900">
              Add Coupon
            </h4>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Code</label>
                <input
                  v-model="newCoupon.code"
                  type="text"
                  placeholder="SAVE10"
                  class="w-full rounded-lg border bg-white p-3 uppercase outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Description</label>
                <input
                  v-model="newCoupon.description"
                  type="text"
                  placeholder="10% off selected orders"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Discount Type</label>
                <select
                  v-model="newCoupon.discount_type"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Discount Value</label>
                <input
                  v-model="newCoupon.discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Minimum Order Amount</label>
                <input
                  v-model="newCoupon.minimum_order_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Usage Limit</label>
                <input
                  v-model="newCoupon.usage_limit"
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Starts At</label>
                <input
                  v-model="newCoupon.starts_at"
                  type="datetime-local"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Ends At</label>
                <input
                  v-model="newCoupon.ends_at"
                  type="datetime-local"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                >
              </div>
            </div>

            <label class="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <input v-model="newCoupon.is_active" type="checkbox">
              Active
            </label>

            <p v-if="couponError" class="mt-4 text-sm text-red-600">
              {{ couponError }}
            </p>

            <button
              type="button"
              :disabled="couponLoading"
              class="mt-5 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              @click="addCoupon"
            >
              {{ couponLoading ? 'Saving...' : 'Add Coupon' }}
            </button>
          </div>
        </section>

        <section
          class="rounded-2xl bg-white p-6 shadow"
          :class="!canEditSettings ? 'pointer-events-none opacity-70' : ''"
        >
          <h3 class="text-2xl font-bold">Coupon List</h3>

          <p class="mt-1 text-sm text-gray-500">
            Edit codes, values, active status, and scheduling.
          </p>

          <div v-if="coupons.length" class="mt-6 space-y-4">
            <div
              v-for="coupon in coupons"
              :key="coupon.id"
              class="rounded-2xl border p-5"
            >
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Code</label>
                  <input
                    v-model="coupon.code"
                    type="text"
                    class="w-full rounded-lg border p-3 uppercase outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Description</label>
                  <input
                    v-model="coupon.description"
                    type="text"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Discount Type</label>
                  <select
                    v-model="coupon.discount_type"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Discount Value</label>
                  <input
                    v-model="coupon.discount_value"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Minimum Order Amount</label>
                  <input
                    v-model="coupon.minimum_order_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Usage Limit</label>
                  <input
                    v-model="coupon.usage_limit"
                    type="number"
                    min="1"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Starts At</label>
                  <input
                    v-model="coupon.starts_at"
                    type="datetime-local"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Ends At</label>
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
                    Active
                  </label>

                  <span>Used {{ coupon.usage_count }} times</span>
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
                    Save
                  </button>

                  <button
                    type="button"
                    :disabled="couponLoading"
                    class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                    @click="deleteCoupon(coupon.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="mt-6 text-sm text-gray-500">
            No coupons added yet.
          </p>
        </section>
      </div>

      <div v-else-if="activeSettingsView === 'users'" class="space-y-6">
        <DashboardSettingsUsersTab />
      </div>

      <div v-else class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 class="text-2xl font-bold">Admin Logs</h3>
              <p class="mt-1 text-sm text-gray-500">
                Latest owner and admin actions. Each account keeps its newest 50 logs only.
              </p>
            </div>

            <div class="flex flex-col gap-3 md:w-[340px]">
              <label class="text-sm font-semibold text-gray-700">Filter by Admin</label>

              <select
                v-model="selectedLogAuthor"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
                <option value="">All Admins</option>

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
              Refresh Logs
            </button>
          </div>

          <div v-if="logsMissingTable" class="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
            Run the latest admin logs SQL query first, then refresh this page.
          </div>

          <p v-else-if="logsError" class="mt-6 text-sm text-red-600">
            {{ logsError }}
          </p>

          <p v-else-if="logsLoading" class="mt-6 text-sm text-gray-500">
            Loading logs...
          </p>

          <p v-else-if="!adminLogs.length" class="mt-6 text-sm text-gray-500">
            {{ selectedLogAuthor ? 'No logs found for this admin yet.' : 'No logs recorded yet.' }}
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

                <div class="text-sm text-gray-600 md:text-right">
                  <p class="font-semibold text-gray-900">
                    {{ log.author_name || 'Admin' }}
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
import DashboardSettingsUsersTab from '~/components/dashboard/settings/UsersTab.vue'
import {
  defaultHeaderLinkDefinitions,
  getDefaultHeaderLinkDefinition,
  isDefaultHeaderLink
} from '~/utils/siteLinks'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const route = useRoute()
const {
  getSnapshot,
  invalidate,
  isFresh,
  setSnapshot
} = useDashboardCache()
const {
  hasPermission
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
const canAccessInventory = computed(() => hasPermission('settings.inventory'))
const canEditSettings = computed(() => hasPermission('settings.edit'))
const canViewLogs = computed(() => hasPermission('settings.view'))
const canViewUsers = computed(() => hasPermission('users.view'))
const canViewInventory = computed(() => canAccessInventory.value)
const canEditInventory = computed(() => canAccessInventory.value && canEditSettings.value)

const defaultSiteSettings = {
  key: 'default',
  site_name: 'ELcomputer',
  site_logo_url: '',
  site_background_color: '#f3f4f6',
  landing_page_title: 'ELcomputer',
  allow_out_of_stock_purchases: false,
  hero_enabled: true,
  hero_rotation_seconds: 5,
  top_bar_rotation_seconds: 3,
  banner_ad_1_enabled: true,
  banner_ad_1_image_url: '',
  banner_ad_1_link_url: '',
  banner_ad_2_enabled: true,
  banner_ad_2_image_url: '',
  banner_ad_2_link_url: '',
  footer_cta_title: 'What are you waiting for?',
  footer_cta_subtitle: 'Purchase your fav gear',
  footer_cta_button_label: 'Shop Now',
  footer_cta_button_url: '/',
  footer_email: 'info@elcomputer.net',
  footer_phone: '01505121684',
  footer_address: 'address address',
  copyright_text: '© 2026 All rights reserved by ELCOMPUTER'
}

const siteSettings = reactive({
  ...defaultSiteSettings
})

const heroBanners = ref([])
const topBarMessages = ref([])
const offerCards = ref([])
const siteLinks = ref([])
const coupons = ref([])
const inventoryProducts = ref([])
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
const inventoryLoading = ref(false)
const galleryLoading = ref(false)
const offerCardsLoading = ref(false)
const inventoryError = ref('')
const inventorySuccess = ref('')
const inventorySearchQuery = ref('')
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
const selectedInventoryProductId = ref('')
const selectedInventoryProductSnapshot = ref(null)
const inventoryIncreaseQuantity = ref(1)
const inventoryCostPrice = ref('')
const galleryLoaded = ref(false)
const openSections = reactive({
  generalSettings: true,
  bannerAds: false,
  footerSettings: false,
  heroBanners: false,
  offerCards: false,
  topBarTexts: false,
  headerLinks: false,
  footerLinks: false
})
const activeSettingsView = computed(() => {
  if (route.query.tab === 'logs' && canViewLogs.value) {
    return 'logs'
  }

  if (route.query.tab === 'users' && canViewUsers.value) {
    return 'users'
  }

  if (route.query.tab === 'coupons' && canAccessCoupons.value) {
    return 'coupons'
  }

  if (route.query.tab === 'gallery' && canViewGallery.value) {
    return 'gallery'
  }

  if (route.query.tab === 'inventory' && canAccessInventory.value) {
    return 'inventory'
  }

  if (canViewGeneralSettings.value) {
    return 'general'
  }

  if (canAccessInventory.value) {
    return 'inventory'
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

  if (canViewUsers.value) {
    return 'users'
  }

  return 'general'
})
const secondaryNavItems = computed(() => {
  const items = []

  if (canViewGeneralSettings.value) {
    items.push({
      label: 'General',
      to: '/dashboard/settings',
      active: activeSettingsView.value === 'general'
    })
  }

  if (canViewGallery.value) {
    items.push({
      label: 'Gallery',
      to: '/dashboard/settings?tab=gallery',
      active: activeSettingsView.value === 'gallery'
    })
  }

  if (canAccessInventory.value) {
    items.push({
      label: 'Inventory',
      to: '/dashboard/settings?tab=inventory',
      active: activeSettingsView.value === 'inventory'
    })
  }

  if (canAccessCoupons.value) {
    items.push({
      label: 'Coupon',
      to: '/dashboard/settings?tab=coupons',
      active: activeSettingsView.value === 'coupons'
    })
  }

  if (canViewUsers.value) {
    items.push({
      label: 'Users',
      to: '/dashboard/settings?tab=users',
      active: activeSettingsView.value === 'users'
    })
  }

  if (canViewLogs.value) {
    items.push({
      label: 'Log',
      to: '/dashboard/settings?tab=logs',
      active: activeSettingsView.value === 'logs'
    })
  }

  return items
})

const siteSettingsSectionFields = {
  generalSettings: [
    'site_name',
    'site_logo_url',
    'site_background_color',
    'landing_page_title'
  ],
  inventorySettings: [
    'allow_out_of_stock_purchases'
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
  footerSettings: [
    'footer_cta_title',
    'footer_cta_subtitle',
    'footer_cta_button_label',
    'footer_cta_button_url',
    'footer_email',
    'footer_phone',
    'footer_address',
    'copyright_text'
  ]
}

const siteSettingsSectionLabels = {
  generalSettings: 'General settings',
  inventorySettings: 'Inventory settings',
  heroSettings: 'Hero settings',
  topBarSettings: 'Top bar timing',
  bannerAds: 'Banner ads',
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

  return new Intl.DateTimeFormat('en-US', {
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
const inventoryLoaded = ref(false)
let gallerySearchTimeoutId = null
let inventorySearchTimeoutId = null

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

const gallerySectionCount = computed(() => {
  return new Set(galleryImages.value.map((image) => image.section)).size
})

const galleryPageStart = computed(() => {
  if (!galleryTotalItems.value) {
    return 0
  }

  return (galleryCurrentPage.value - 1) * galleryPageSize.value + 1
})

const galleryPageEnd = computed(() => {
  if (!galleryTotalItems.value) {
    return 0
  }

  return Math.min(galleryCurrentPage.value * galleryPageSize.value, galleryTotalItems.value)
})

const isMissingSchemaError = (error) => error?.code === '42P01' || error?.code === '42703'

const handleTableError = (error) => {
  if (isMissingSchemaError(error)) {
    pageError.value = 'Run the latest dashboard settings SQL query first, then refresh this page.'
    return true
  }

  return false
}

const formatGalleryFileSize = (size = 0) => {
  const normalizedSize = Number(size || 0)

  if (normalizedSize >= 1024 * 1024) {
    return `${(normalizedSize / (1024 * 1024)).toFixed(2)} MB`
  }

  if (normalizedSize >= 1024) {
    return `${(normalizedSize / 1024).toFixed(1)} KB`
  }

  return `${normalizedSize} B`
}

const clearGallerySearch = () => {
  gallerySearchQuery.value = ''
  galleryCurrentPage.value = 1
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

const getGalleryDownloadUrl = (publicPath = '') => {
  return `${publicPath}?download=1`
}

const openGalleryImage = (image) => {
  selectedGalleryImage.value = image
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

const formatInventoryMoney = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const mapInventoryProduct = (product) => ({
  ...product,
  slug: product.slug || '',
  stock_quantity: Number(product.stock_quantity || 0),
  cost_price: Number(product.cost_price || 0)
})

const selectedInventoryProduct = computed(() => {
  const matchedProduct = inventoryProducts.value.find((product) => product.id === selectedInventoryProductId.value)

  if (matchedProduct) {
    return matchedProduct
  }

  if (selectedInventoryProductSnapshot.value?.id === selectedInventoryProductId.value) {
    return selectedInventoryProductSnapshot.value
  }

  return null
})

const inventoryProductOptions = computed(() => {
  const options = [...inventoryProducts.value]

  if (
    selectedInventoryProduct.value &&
    !options.some((product) => product.id === selectedInventoryProduct.value.id)
  ) {
    options.unshift(selectedInventoryProduct.value)
  }

  return options
})

const normalizedInventoryQuantity = computed(() => {
  const quantity = Number.parseInt(inventoryIncreaseQuantity.value, 10)

  if (!Number.isFinite(quantity) || quantity < 1) {
    return 0
  }

  return quantity
})

const nextInventoryStockQuantity = computed(() => {
  if (!selectedInventoryProduct.value) {
    return 0
  }

  return Number(selectedInventoryProduct.value.stock_quantity || 0) + normalizedInventoryQuantity.value
})

const isInventoryIncreaseReady = computed(() => {
  if (!selectedInventoryProductId.value) {
    return false
  }

  if (normalizedInventoryQuantity.value < 1) {
    return false
  }

  if (String(inventoryCostPrice.value).trim() === '') {
    return false
  }

  return Number(inventoryCostPrice.value) >= 0
})

const normalizeInventorySearchTerm = (value) => {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9-\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

const buildInventoryProductsCacheKey = () => {
  return `dashboard:settings:inventory:${normalizeInventorySearchTerm(inventorySearchQuery.value).toLowerCase()}`
}

const clearInventorySearch = () => {
  inventorySearchQuery.value = ''
}

const normalizeSiteSettings = (source = {}) => ({
  site_name: String(source.site_name || '').trim() || defaultSiteSettings.site_name,
  site_logo_url: String(source.site_logo_url || '').trim(),
  site_background_color: String(source.site_background_color || '').trim() || defaultSiteSettings.site_background_color,
  landing_page_title: String(source.landing_page_title || '').trim() || defaultSiteSettings.landing_page_title,
  allow_out_of_stock_purchases: source.allow_out_of_stock_purchases ?? defaultSiteSettings.allow_out_of_stock_purchases,
  hero_enabled: source.hero_enabled ?? true,
  hero_rotation_seconds: Math.max(1, Number(source.hero_rotation_seconds) || defaultSiteSettings.hero_rotation_seconds),
  top_bar_rotation_seconds: Math.max(1, Number(source.top_bar_rotation_seconds) || defaultSiteSettings.top_bar_rotation_seconds),
  banner_ad_1_enabled: source.banner_ad_1_enabled ?? true,
  banner_ad_1_image_url: String(source.banner_ad_1_image_url || '').trim(),
  banner_ad_1_link_url: String(source.banner_ad_1_link_url || '').trim(),
  banner_ad_2_enabled: source.banner_ad_2_enabled ?? true,
  banner_ad_2_image_url: String(source.banner_ad_2_image_url || '').trim(),
  banner_ad_2_link_url: String(source.banner_ad_2_link_url || '').trim(),
  footer_cta_title: String(source.footer_cta_title || '').trim(),
  footer_cta_subtitle: String(source.footer_cta_subtitle || '').trim(),
  footer_cta_button_label: String(source.footer_cta_button_label || '').trim(),
  footer_cta_button_url: String(source.footer_cta_button_url || '').trim(),
  footer_email: String(source.footer_email || '').trim(),
  footer_phone: String(source.footer_phone || '').trim(),
  footer_address: String(source.footer_address || '').trim(),
  copyright_text: String(source.copyright_text || '').trim()
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

const applyInventoryProductsSnapshot = (snapshot = {}) => {
  inventoryProducts.value = (snapshot.items || []).map(mapInventoryProduct)
  inventoryLoaded.value = true

  const matchedSelectedProduct = inventoryProducts.value.find((product) => product.id === selectedInventoryProductId.value)
  if (matchedSelectedProduct) {
    selectedInventoryProductSnapshot.value = matchedSelectedProduct
  }
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
      'allow_out_of_stock_purchases',
      'hero_enabled',
      'hero_rotation_seconds',
      'top_bar_rotation_seconds',
      'banner_ad_1_enabled',
      'banner_ad_2_enabled'
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

const getInventoryProducts = async ({ force = false } = {}) => {
  inventoryError.value = ''

  if (!canViewInventory.value) {
    inventoryProducts.value = []
    return
  }

  const cacheKey = buildInventoryProductsCacheKey()
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyInventoryProductsSnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    return
  }

  const normalizedSearchTerm = normalizeInventorySearchTerm(inventorySearchQuery.value)
  let query = supabase
    .from('products')
    .select('id, title, slug, stock_quantity, cost_price, is_published, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (normalizedSearchTerm) {
    query = query.or(`title.ilike.%${normalizedSearchTerm}%,slug.ilike.%${normalizedSearchTerm}%`)
  }

  const { data, error } = await query

  if (error) {
    if (!handleTableError(error)) {
      inventoryError.value = error.message
    }
    return
  }

  applyInventoryProductsSnapshot({
    items: data || []
  })
  setSnapshot(cacheKey, {
    items: data || []
  })
}

const saveSiteSettings = async (sectionName) => {
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

const increaseInventory = async () => {
  inventoryError.value = ''
  inventorySuccess.value = ''

  if (!canEditInventory.value) {
    inventoryError.value = 'This account cannot update inventory.'
    return
  }

  if (!selectedInventoryProduct.value) {
    inventoryError.value = 'Select a product first.'
    return
  }

  if (normalizedInventoryQuantity.value < 1) {
    inventoryError.value = 'Add quantity must be at least 1.'
    return
  }

  if (String(inventoryCostPrice.value).trim() === '' || Number(inventoryCostPrice.value) < 0) {
    inventoryError.value = 'Enter a valid product cost.'
    return
  }

  inventoryLoading.value = true

  const nextStockQuantity = Number(selectedInventoryProduct.value.stock_quantity || 0) + normalizedInventoryQuantity.value
  const { error } = await supabase
    .from('products')
    .update({
      stock_quantity: nextStockQuantity,
      cost_price: Number(inventoryCostPrice.value || 0)
    })
    .eq('id', selectedInventoryProduct.value.id)

  inventoryLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      inventoryError.value = error.message
    }
    return
  }

  inventorySuccess.value = `Inventory updated for ${selectedInventoryProduct.value.title}.`
  await logSettingsAction(
    `Increased inventory for ${selectedInventoryProduct.value.title} by ${normalizedInventoryQuantity.value}.`,
    'settings.inventory.increase',
    {
      product_id: selectedInventoryProduct.value.id,
      product_title: selectedInventoryProduct.value.title,
      quantity_added: normalizedInventoryQuantity.value,
      cost_price: Number(inventoryCostPrice.value || 0)
    }
  )
  inventoryIncreaseQuantity.value = 1
  invalidate('dashboard:settings:inventory:')
  await getInventoryProducts({ force: true })
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

  if (!confirm('Delete this hero banner?')) {
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

  if (!confirm('Delete this top bar text?')) {
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
    offerCardsError.value = 'Offer giant text is required.'
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

  if (!confirm('Delete this offer card?')) {
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

  if (!confirm('Delete this link item?')) {
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

  if (!confirm('Delete this coupon?')) {
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

watch(selectedInventoryProductId, (productId) => {
  inventoryError.value = ''
  inventorySuccess.value = ''
  inventoryIncreaseQuantity.value = 1

  if (!productId) {
    selectedInventoryProductSnapshot.value = null
    inventoryCostPrice.value = ''
    return
  }

  const matchedProduct = selectedInventoryProduct.value

  if (matchedProduct) {
    selectedInventoryProductSnapshot.value = matchedProduct
  }

  inventoryCostPrice.value = matchedProduct ? String(Number(matchedProduct.cost_price || 0)) : ''
})

watch(inventorySearchQuery, () => {
  if (!canViewInventory.value) {
    return
  }

  clearTimeout(inventorySearchTimeoutId)

  inventorySearchTimeoutId = setTimeout(async () => {
    await getInventoryProducts()
  }, 300)
})

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

const loadActiveSettingsView = async (view = activeSettingsView.value, { force = false } = {}) => {
  if (view === 'logs') {
    await loadAdminLogs({ force })
    return
  }

  if (view === 'inventory') {
    if (canViewInventory.value) {
      await getInventoryProducts({ force })
    }

    return
  }

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
  clearTimeout(inventorySearchTimeoutId)
})

onMounted(async () => {
  await loadActiveSettingsView()
})
</script>
