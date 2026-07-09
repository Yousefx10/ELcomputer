<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Site Settings</h2>
        <p class="mt-2 text-sm text-gray-500">
          Control the store name, logo, banners, top bar text, navigation, and footer content
        </p>
      </div>

      <div v-if="pageError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ pageError }}
      </div>

      <div class="space-y-4">
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

          <div v-if="openSections.generalSettings" class="border-t p-6">
            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Site Name</label>
                <input
                  v-model="siteSettings.site_name"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Site Logo URL</label>
                <input
                  v-model="siteSettings.site_logo_url"
                  type="text"
                  placeholder="https://example.com/logo.png"
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

          <div v-if="openSections.topBarTexts" class="border-t p-6">
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

          <div v-if="openSections.heroBanners" class="border-t p-6">
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

            <div class="mb-5 grid gap-3 md:grid-cols-[2fr_2fr_auto]">
              <input
                v-model="newHeroImageUrl"
                type="text"
                placeholder="Image URL"
                class="rounded-lg border p-3 outline-none focus:border-blue-500"
              >

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
                class="grid gap-3 rounded-xl border p-4 md:grid-cols-[120px_minmax(0,2fr)_minmax(0,2fr)_auto]"
              >
                <div class="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-gray-100 p-2">
                  <img
                    v-if="banner.image_url"
                    :src="banner.image_url"
                    alt="Hero banner"
                    class="h-full w-full object-cover"
                  >
                </div>

                <input
                  v-model="banner.image_url"
                  type="text"
                  class="rounded-lg border p-3 outline-none focus:border-blue-500"
                >

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

          <div v-if="openSections.bannerAds" class="border-t p-6">
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

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Banner Ad 1 Image URL</label>
                  <input
                    v-model="siteSettings.banner_ad_1_image_url"
                    type="text"
                    placeholder="https://example.com/banner-1.jpg"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>

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

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-700">Banner Ad 2 Image URL</label>
                  <input
                    v-model="siteSettings.banner_ad_2_image_url"
                    type="text"
                    placeholder="https://example.com/banner-2.jpg"
                    class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
                  >
                </div>

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
      </div>

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

        <div v-if="openSections.headerLinks" class="border-t p-6">
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
              @click="addHeaderLink"
              class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
            >
              {{ linkLoading ? 'Saving...' : 'Add Link' }}
            </button>
          </div>

          <p v-if="linkError" class="mb-4 text-sm text-red-600">
            {{ linkError }}
          </p>

          <div v-if="headerLinks.length" class="space-y-3">
            <div
              v-for="link in headerLinks"
              :key="link.id"
              class="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_2fr_auto]"
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
                  :disabled="!isSiteLinkDirty(link) || linkLoading"
                  @click="saveSiteLink(link)"
                  class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  :class="isSiteLinkDirty(link) && !linkLoading
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-300'"
                >
                  Save
                </button>

                <button
                  type="button"
                  @click="deleteSiteLink(link.id)"
                  class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
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

        <div v-if="openSections.footerSettings" class="border-t p-6">
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

        <div v-if="openSections.footerLinks" class="border-t p-6">
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
              @click="addFooterLink"
              class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
            >
              {{ linkLoading ? 'Saving...' : 'Add Item' }}
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
                  :disabled="!isSiteLinkDirty(link) || linkLoading"
                  @click="saveSiteLink(link)"
                  class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  :class="isSiteLinkDirty(link) && !linkLoading
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-300'"
                >
                  Save
                </button>

                <button
                  type="button"
                  @click="deleteSiteLink(link.id)"
                  class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
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
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()

const pageError = ref('')

const defaultSiteSettings = {
  key: 'default',
  site_name: 'ELcomputer',
  site_logo_url: '',
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
const siteLinks = ref([])

const settingsLoading = ref(false)
const settingsLoadingSection = ref('')
const heroLoading = ref(false)
const topBarLoading = ref(false)
const linkLoading = ref(false)

const settingsError = ref('')
const settingsErrorSection = ref('')
const settingsSuccess = ref('')
const settingsSuccessSection = ref('')
const heroError = ref('')
const topBarError = ref('')
const linkError = ref('')

const newHeroImageUrl = ref('')
const newHeroLinkUrl = ref('')
const newTopBarText = ref('')
const newHeaderLabel = ref('')
const newHeaderUrl = ref('')
const newFooterSectionTitle = ref('')
const newFooterLabel = ref('')
const newFooterUrl = ref('')
const openSections = reactive({
  generalSettings: true,
  bannerAds: false,
  footerSettings: false,
  heroBanners: false,
  topBarTexts: false,
  headerLinks: false,
  footerLinks: false
})

const siteSettingsSectionFields = {
  generalSettings: [
    'site_name',
    'site_logo_url'
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
  heroSettings: 'Hero settings',
  topBarSettings: 'Top bar timing',
  bannerAds: 'Banner ads',
  footerSettings: 'Footer settings'
}

const siteSettingsSnapshot = ref({})

const toggleSection = (sectionName) => {
  openSections[sectionName] = !openSections[sectionName]
}

const headerLinks = computed(() => {
  return siteLinks.value.filter((link) => link.location === 'header')
})

const footerLinks = computed(() => {
  return siteLinks.value.filter((link) => link.location === 'footer')
})

const isMissingTableError = (error) => error?.code === '42P01'

const handleTableError = (error) => {
  if (isMissingTableError(error)) {
    pageError.value = 'Run the site settings SQL query first, then refresh this page.'
    return true
  }

  return false
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

const normalizeSiteSettings = (source = {}) => ({
  site_name: String(source.site_name || '').trim() || defaultSiteSettings.site_name,
  site_logo_url: String(source.site_logo_url || '').trim(),
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

  siteLinks.value = (data || []).map(mapSiteLink)
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

  settingsSuccess.value = `${siteSettingsSectionLabels[sectionName]} saved successfully.`
  settingsSuccessSection.value = sectionName
}

const isHeroBannerDirty = (banner) => {
  return banner.image_url !== banner.original_image_url ||
    (banner.link_url || '') !== banner.original_link_url ||
    (banner.is_enabled ?? true) !== banner.original_is_enabled
}

const addHeroBanner = async () => {
  heroError.value = ''

  if (!newHeroImageUrl.value.trim()) {
    heroError.value = 'Hero banner image URL is required'
    return
  }

  heroLoading.value = true

  const { error } = await supabase
    .from('site_hero_banners')
    .insert({
      image_url: newHeroImageUrl.value.trim(),
      link_url: newHeroLinkUrl.value.trim() || null,
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
  await refreshNuxtData('site-content')
}

const saveHeroBanner = async (banner) => {
  heroError.value = ''

  if (!banner.image_url.trim()) {
    heroError.value = 'Hero banner image URL is required'
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
  await refreshNuxtData('site-content')
}

const deleteHeroBanner = async (bannerId) => {
  heroError.value = ''

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
  await refreshNuxtData('site-content')
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

  topBarLoading.value = true

  const { error } = await supabase
    .from('site_top_bar_messages')
    .insert({
      text: newTopBarText.value.trim(),
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
  await refreshNuxtData('site-content')
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
  await refreshNuxtData('site-content')
}

const deleteTopBarMessage = async (messageId) => {
  topBarError.value = ''

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
  await refreshNuxtData('site-content')
}

const isSiteLinkDirty = (link) => {
  return (link.section_title || '') !== link.original_section_title ||
    link.label !== link.original_label ||
    (link.url || '') !== link.original_url ||
    (link.is_enabled ?? true) !== link.original_is_enabled
}

const addHeaderLink = async () => {
  linkError.value = ''

  if (!newHeaderLabel.value.trim() || !newHeaderUrl.value.trim()) {
    linkError.value = 'Header link label and URL are required'
    return
  }

  linkLoading.value = true

  const { error } = await supabase
    .from('site_links')
    .insert({
      location: 'header',
      label: newHeaderLabel.value.trim(),
      url: newHeaderUrl.value.trim(),
      sort_order: headerLinks.value.length
    })

  linkLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  newHeaderLabel.value = ''
  newHeaderUrl.value = ''
  await getSiteLinks()
  await refreshNuxtData('site-content')
}

const addFooterLink = async () => {
  linkError.value = ''

  if (!newFooterSectionTitle.value.trim() || !newFooterLabel.value.trim()) {
    linkError.value = 'Footer section title and label are required'
    return
  }

  linkLoading.value = true

  const { error } = await supabase
    .from('site_links')
    .insert({
      location: 'footer',
      section_title: newFooterSectionTitle.value.trim(),
      label: newFooterLabel.value.trim(),
      url: newFooterUrl.value.trim() || null,
      sort_order: footerLinks.value.length
    })

  linkLoading.value = false

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
  await refreshNuxtData('site-content')
}

const saveSiteLink = async (link) => {
  linkError.value = ''

  if (!link.label.trim()) {
    linkError.value = 'Link label is required'
    return
  }

  if (link.location === 'header' && !link.url.trim()) {
    linkError.value = 'Header link URL is required'
    return
  }

  if (link.location === 'footer' && !link.section_title.trim()) {
    linkError.value = 'Footer section title is required'
    return
  }

  linkLoading.value = true

  const { error } = await supabase
    .from('site_links')
    .update({
      section_title: link.location === 'footer' ? link.section_title.trim() : null,
      label: link.label.trim(),
      url: link.url.trim() || null,
      is_enabled: link.is_enabled
    })
    .eq('id', link.id)

  linkLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  await getSiteLinks()
  await refreshNuxtData('site-content')
}

const deleteSiteLink = async (linkId) => {
  linkError.value = ''

  if (!confirm('Delete this link item?')) {
    return
  }

  linkLoading.value = true

  const { error } = await supabase
    .from('site_links')
    .delete()
    .eq('id', linkId)

  linkLoading.value = false

  if (error) {
    if (!handleTableError(error)) {
      linkError.value = error.message
    }
    return
  }

  await getSiteLinks()
  await refreshNuxtData('site-content')
}

await Promise.all([
  getSiteSettings(),
  getHeroBanners(),
  getTopBarMessages(),
  getSiteLinks()
])
</script>
