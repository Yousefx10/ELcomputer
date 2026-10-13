<template>
  <div class="">
    <p v-if="externalErp" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ $t('erp.localInventoryRetained') }}</p>
    <DashboardPageIntro
      :title="$t('common.editProduct')"
      :description="`Product ID: ${id}`"
      container-class=""
      title-class="my-5 text-center text-4xl font-bold"
      description-class="mb-6 text-center text-sm text-gray-500"
    />

    <div v-if="pending && !product" class="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-center shadow">
      {{ $t('common.loadingProduct') }}
    </div>

    <div
      v-else-if="fetchError && !product"
      class="mx-auto max-w-6xl rounded-2xl bg-red-50 p-6 text-center text-red-600 shadow"
    >
      {{ $t('common.errorValue', { value0: (fetchError.message) }) }}
    </div>

    <div v-else-if="product" class="mx-auto max-w-6xl space-y-6">
      <p v-if="refreshRequired" role="alert" class="text-sm text-red-600">{{ $t('productEditor.refreshFailed') }}</p>
      <form
        @submit.prevent="updateProduct"
        class="grid gap-5 rounded-2xl bg-white p-6 shadow md:grid-cols-2"
      >
        <fieldset :disabled="pending || formLoading || saving || saveUnconfirmed || refreshRequired || !hasPermission('products.edit')" class="contents">
        <div class="md:col-span-2 flex items-center justify-between rounded-2xl border bg-gray-50 p-4">
          <div>
            <p class="text-sm font-semibold text-gray-700">{{ $t('common.storeVisibility') }}</p>
            <p class="text-sm text-gray-500">
              {{ $t('productEditor.visibilityHelp') }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold" :class="isPublished ? 'text-green-600' : 'text-gray-500'">
              {{ isPublished ? $t('productEditor.published') : $t('productEditor.draft') }}
            </span>

            <button
              type="button"
              :aria-pressed="isPublished"
              :aria-label="$t('common.storeVisibility')"
              @click="isPublished = !isPublished"
              class="relative inline-flex h-7 w-14 items-center rounded-full transition"
              :class="isPublished ? 'bg-green-600' : 'bg-gray-300'"
            >
              <span
                class="inline-block h-5 w-5 rounded-full bg-white transition"
                :class="isPublished ? 'translate-x-8' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>

        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">{{ $t('common.productDetails') }}</h3>
          <p class="text-sm text-gray-500">
            {{ $t('productEditor.separate') }}
          </p>
        </div>

        <div>
          <label for="product-title" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.title') }}</label>
          <input
            v-model="title"
            id="product-title"
            :aria-invalid="Boolean(fieldErrors.title || saveField === 'title')"
            :aria-describedby="fieldErrors.title || saveField === 'title' ? 'product-title-error' : undefined"
            type="text"
            :placeholder="$t('common.productTitle')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.title || saveField === 'title'" id="product-title-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.title ? $t('productEditor.field.title') : saveError }}</p>
        </div>

        <div>
          <label for="product-slug" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.slug') }}</label>

          <div class="flex gap-2">
            <input
              v-model="slug"
            id="product-slug"
            :aria-invalid="Boolean(fieldErrors.slug || saveField === 'slug')"
            :aria-describedby="fieldErrors.slug || saveField === 'slug' ? 'product-slug-error' : undefined"
              type="text"
              placeholder="product-slug"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <button
              type="button"
              @click="useTitleSlug"
              class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
            >
              {{ $t('common.generate') }}
            </button>
          </div>
          <p v-if="fieldErrors.slug || saveField === 'slug'" id="product-slug-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.slug ? $t('productEditor.field.slug') : saveError }}</p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.category') }}</label>
          <select
            v-model="categoryId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noCategory') }}</option>

            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.categories && !categories.length" class="mt-2 text-xs text-gray-500">
            {{ $t('productEditor.noCategories') }}
            <NuxtLinkLocale v-if="hasPermission('categories.add') && true" to="/dashboard/products/categories" @click.prevent="openPrerequisite('/dashboard/products/categories')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.createCategory') }}</NuxtLinkLocale>
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.brand') }}</label>
          <select
            v-model="brandId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noBrand') }}</option>

            <option
              v-for="brand in brands"
              :key="brand.id"
              :value="brand.id"
            >
              {{ brand.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.brands && !brands.length" class="mt-2 text-xs text-gray-500">
            {{ $t('productEditor.noBrands') }}
            <NuxtLinkLocale v-if="hasPermission('brands.add') && true" to="/dashboard/products/brands" @click.prevent="openPrerequisite('/dashboard/products/brands')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.createBrand') }}</NuxtLinkLocale>
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.preferredSupplierOptional') }}</label>
          <select
            v-model="defaultSupplierId"
            :disabled="externalErp"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noPreferredSupplier') }}</option>

            <option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :value="supplier.id"
            >
              {{ supplier.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.suppliers && !suppliers.length" class="mt-2 text-xs text-gray-500">
            {{ $t('productEditor.noSuppliers') }}
            <NuxtLinkLocale v-if="(hasPermission('products.add') || hasPermission('products.edit')) && !externalErp" to="/dashboard/crm" @click.prevent="openPrerequisite('/dashboard/crm')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.manageSuppliers') }}</NuxtLinkLocale>
          </p>
          <p class="mt-2 text-xs text-gray-500">
            {{ $t('common.forReferenceOnlyProcurementCanReceiveThisProductFromAnyActiveSupplier') }}
          </p>
        </div>

        <div>
          <label for="product-primary_warehouse_id" class="mb-2 block text-sm font-semibold text-gray-700">
            {{ $t('dashboard.products.primaryWarehousevalue', { value0: (isSerialized ? ' *' : '') }) }}
          </label>
          <select
            v-model="primaryWarehouseId"
            id="product-primary_warehouse_id"
            :aria-invalid="Boolean(fieldErrors.primary_warehouse_id || saveField === 'primary_warehouse_id')"
            :aria-describedby="fieldErrors.primary_warehouse_id || saveField === 'primary_warehouse_id' ? 'product-primary_warehouse_id-error' : undefined"
            :disabled="externalErp || isSerialized && !canAssignPrimaryWarehouse"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">
              {{ isSerialized ? $t('dashboard.products.selectPrimaryWarehouse') : $t('common.noPrimaryWarehouse') }}
            </option>

            <option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.warehouses && !warehouses.length" class="mt-2 text-xs text-amber-700">
            {{ $t(externalErp ? 'productEditor.daftraWarehouse' : (hasPermission('products.add') || hasPermission('products.edit')) ? 'productEditor.noWarehouse' : 'productEditor.warehouseAccess') }}
            <NuxtLinkLocale v-if="!externalErp && (hasPermission('products.add') || hasPermission('products.edit'))" to="/dashboard/commerce?tab=warehouses" @click.prevent="openPrerequisite('/dashboard/commerce?tab=warehouses')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.createWarehouse') }}</NuxtLinkLocale>
          </p>
          <p v-if="fieldErrors.primary_warehouse_id || saveField === 'primary_warehouse_id'" id="product-primary_warehouse_id-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.primary_warehouse_id ? $t('productEditor.field.warehouse') : saveError }}</p>
          <p v-if="isSerialized && canAssignPrimaryWarehouse" class="mt-2 text-xs text-blue-700">
            {{ $t('dashboard.products.editableUntilTheFirstItemIsReceived') }}
          </p>
          <p v-else-if="isSerialized" class="mt-2 text-xs text-gray-500">
            {{ $t('dashboard.products.thisWarehouseIsLockedBecauseItemsHaveAlreadyBeenReceived') }}
          </p>
        </div>

        <div>
          <label for="product-price" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.price') }}</label>
          <input
            v-model="price"
            id="product-price"
            :aria-invalid="Boolean(fieldErrors.price || saveField === 'price')"
            :aria-describedby="fieldErrors.price || saveField === 'price' ? 'product-price-error' : undefined"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('common.price')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.price || saveField === 'price'" id="product-price-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.price ? $t('productEditor.field.price') : saveError }}</p>
        </div>

        <div>
          <label for="product-old_price" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.oldPrice') }}</label>
          <input
            v-model="oldPrice"
            id="product-old_price"
            :aria-invalid="Boolean(fieldErrors.old_price || saveField === 'old_price')"
            :aria-describedby="fieldErrors.old_price || saveField === 'old_price' ? 'product-old_price-error' : undefined"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('common.oldPrice')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.old_price || saveField === 'old_price'" id="product-old_price-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.old_price ? $t('productEditor.field.old_price') : saveError }}</p>
        </div>

        <div v-if="!isSerialized">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.legacyAggregateStock') }}</label>
          <input
            v-model="stockQuantity"
            :disabled="externalErp"
            type="number"
            min="0"
            placeholder="0"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            @focus="isStockQuantityFocused = true"
            @blur="isStockQuantityFocused = false"
          />

          <p
            v-if="isStockQuantityFocused"
            class="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {{ $t('dashboard.products.olderStockMustHaveItemIdsBeforeReceivingMoreUnits') }}
          </p>
        </div>

        <div
          v-else
          class="rounded-xl border border-green-200 bg-green-50 p-4"
        >
          <p class="text-sm font-semibold text-green-800">{{ $t('dashboard.products.individuallyTrackedStock') }}</p>
          <p class="mt-1 text-3xl font-bold text-green-700">{{ stockQuantity }}</p>
          <p class="mt-1 text-xs text-green-700">
            {{ $t('dashboard.products.thisTotalIsCalculatedFromItemIdsAndCannotBeEditedManually') }}
          </p>
        </div>

        <div>
          <label for="product-sku" class="mb-2 block text-sm font-semibold text-gray-700">SKU</label>
          <input
            v-model="sku"
            id="product-sku"
            :aria-invalid="Boolean(fieldErrors.sku || saveField === 'sku')"
            :aria-describedby="fieldErrors.sku || saveField === 'sku' ? 'product-sku-error' : undefined"
            type="text"
            :placeholder="$t('common.optionalSku')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.sku || saveField === 'sku'" id="product-sku-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.sku ? $t('productEditor.field.sku') : saveError }}</p>
        </div>

        <div v-if="!isSerialized">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.colorName') }}</label>
          <input
            v-model="colorName"
            type="text"
            :placeholder="$t('common.black')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div v-if="!isSerialized">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.colorHex') }}</label>
          <input
            v-model="colorHex"
            type="text"
            placeholder="#000000"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div
          v-if="isSerialized"
          class="md:col-span-2 space-y-4"
        >
          <div class="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-lg font-bold text-gray-900">{{ $t('common.individualItemIdsQrCodes') }}</h3>
              <p class="mt-1 text-sm text-gray-600">
                {{ $t('dashboard.products.editProductOptionsBelowReceiveAndTrackItemsThroughPurchasing') }}
              </p>
            </div>

            <NuxtLinkLocale
              :to="`/dashboard/commerce?tab=serialized&product=${id}`"
              class="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {{ $t('common.viewItemIdsQrCodes') }}
            </NuxtLinkLocale>
          </div>

        <DashboardProductsSellingModeFields v-model="sellingConfig" />

        <DashboardProductsVariantsEditor
            v-model="productVariants"
            :disabled="pending || formLoading || saving || saveUnconfirmed || refreshRequired || !hasPermission('products.edit')"
            existing-mode
          />
        </div>

        <DashboardProductsWarrantyFields v-model="warrantyConfig" :disabled="pending || formLoading || saving || saveUnconfirmed || refreshRequired || !hasPermission('products.edit')" />
        <NuxtLinkLocale v-if="hasPermission('settings.view')" :to="`/dashboard/settings?tab=after-sales&scope=product&id=${route.params.id}`" class="mt-3 inline-block text-sm font-semibold text-blue-700 underline">{{ $t('afterSales.title') }}</NuxtLinkLocale>

        <div class="md:col-span-2">
          <DashboardMediaUploadField
            v-model="imageUrl"
            @busy="mainUploads.image = $event"
            :disabled="pending || formLoading || saving || saveUnconfirmed || refreshRequired || !hasPermission('products.edit')"
            :label="$t('common.mainImage')"
            section="products"
            :preview-alt="title || 'Product image'"
            :help-text="$t('common.uploadTheMainProductImageStoredOnTheServerHost')"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shortDescription') }}</label>
          <textarea
            v-model="description"
            rows="4"
            :placeholder="$t('common.shortProductDescription')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.longDescription') }}</label>
          <textarea
            v-model="longDescription"
            rows="7"
            :placeholder="$t('common.longProductDescription')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <p v-if="fieldErrors.variants" role="alert" class="md:col-span-2 text-sm text-red-600">{{ $t('productEditor.field.variants') }}</p>
        </fieldset>
        <p v-if="Object.values(lookupFailures).some(Boolean)" role="alert" class="md:col-span-2 text-sm text-red-600">{{ $t('productEditor.lookupFailed') }}</p>
        <p v-if="actionError || saveError" role="alert" class="md:col-span-2 text-sm text-red-600">
          {{ actionError ? $uiMessage(actionError) : saveError }}
        </p>

        <p class="md:col-span-2 text-sm text-gray-500" role="status" data-product-save-state>
          {{ $t('productEditor.details') }}: {{ saving ? $t('common.saving') : actionError || saveError ? $t('productEditor.failed') : mainDirty ? $t('productEditor.unsaved') : mainSaved ? $t('productEditor.saved') : $t('productEditor.ready') }}.
          {{ $t('productEditor.separate') }}
        </p>
        <p v-if="restoredDraft" class="md:col-span-2 text-xs text-gray-500">{{ $t('productEditor.retained') }}</p>
        <div class="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            :disabled="mainUploadsActive || pending || saving || saveConflict || refreshRequired || formLoading || !hasPermission('products.edit')"
            class="disabled:cursor-not-allowed disabled:opacity-50 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            {{ saving ? $t('common.saving') : saveUnconfirmed ? $t('productSave.retry') : $t('common.saveChanges') }}
          </button>
          <button v-if="saveUnconfirmed || saveConflict" type="button" :disabled="saving || mainUploadsActive"
            @click="checkProductSave" class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium">
            {{ $t('productSave.checkSave') }}
          </button>
          <button v-if="(saveConflict || refreshRequired) && !saveUnconfirmed" type="button" :disabled="saving || mainUploadsActive"
            @click="reloadProduct" class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium">
            {{ $t('productSave.reload') }}
          </button>

          <button
            v-if="!isSerialized"
            type="button"
            :disabled="editorBusy || deleting || saveUnconfirmed || !hasPermission('products.edit')"
            @click="deleteProduct"
            class="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
          >
            {{ deleting ? $t('common.deleting') : $t('common.deleteProduct') }}
          </button>

          <NuxtLinkLocale
            :to="returnToProducts"
            class="rounded-lg bg-gray-200 px-5 py-3 font-bold text-gray-800 hover:bg-gray-300"
          >
            {{ $t('common.back') }}
          </NuxtLinkLocale>

          <p
            v-if="isSerialized"
            class="w-full text-sm text-gray-500"
          >
            {{ $t('dashboard.products.productsWithItemHistoryCannotBeDeletedHideThemFromTheStoreInstead') }}
          </p>
        </div>
        <DashboardSeoFields @busy="mainUploads.seo = $event" :disabled="pending || formLoading || saving || saveUnconfirmed || refreshRequired || !hasPermission('products.edit')" v-model="seo" :fallback-title="title" :fallback-description="description || longDescription" :fallback-image="imageUrl" section="products" class="md:col-span-2" />
      </form>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="mb-4">
          <h3 class="text-2xl font-bold">{{ $t('common.extraImages') }}</h3>
          <p class="text-sm text-gray-500">
            {{ $t('dashboard.products.addAnImageForEveryColorIncludingTheMainColorItsFirstImageAppearsInTheSelector') }}
          </p>
        </div>

        <p role="status" class="mb-4 text-sm text-gray-500" data-gallery-save-state>{{ $t('productEditor.gallery') }}: {{ galleryLoading ? $t('common.saving') : galleryStatus === 'refresh_failed' ? $t('productEditor.saved') : gallerySaveError || galleryError ? $t('productEditor.failed') : galleryDirty ? $t('productEditor.unsaved') : galleryStatus === 'saved' ? $t('productEditor.saved') : $t('productEditor.ready') }}. {{ $t('productEditor.separate') }}</p>
        <p v-if="gallerySaveError" role="alert" class="mb-4 text-sm text-red-600">{{ gallerySaveError }}</p>
        <button v-if="galleryStatus === 'unknown' || galleryStatus === 'conflict' || galleryStatus === 'refresh_failed'" type="button" @click="reloadGallery" class="mb-4 rounded-lg border border-gray-300 px-4 py-2 text-sm">{{ $t('productSave.reload') }}</button>
        <fieldset :disabled="galleryLoading || galleryStatus === 'unknown' || !hasPermission('products.edit')" class="contents">
        <div class="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="min-w-0 space-y-3">
            <div>
              <label for="new-image-variant" class="mb-2 block text-sm font-semibold text-gray-700">
                {{ $t('common.variantVariant2') }}
              </label>
              <select
                id="new-image-variant"
                v-model="newImageVariantId"
                :disabled="!savedVariantOptions.length || galleryLoading"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">{{ $t('common.selectVariant') }}</option>
                <option
                  v-for="variant in savedVariantOptions"
                  :key="variant.id"
                  :value="variant.id"
                >
                  {{ formatVariantOption(variant) }}
                </option>
              </select>
              <p v-if="!savedVariantOptions.length" class="mt-2 text-xs text-amber-700">
                {{ $t('dashboard.products.saveAtLeastOneProductVariantBeforeAddingGalleryImages') }}
              </p>
            </div>

            <DashboardMediaUploadField
              v-model="newImageUrl"
              @busy="galleryUploads.new = $event"
              :label="$t('common.extraImage')"
              section="product_gallery"
              :disabled="galleryLoading || galleryStatus === 'unknown' || !hasPermission('products.edit')"
              :preview-alt="newImageAlt || title || 'Extra image'"
              preview-height-class="h-32"
              :help-text="$t('dashboard.products.uploadAnAdditionalImageForTheProductGallery')"
            />

            <input
              v-model="newImageAlt"
              type="text"
              :placeholder="$t('common.altText')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            @click="addProductImage"
            :disabled="galleryLoading || !savedVariantOptions.length"
            class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ galleryLoading ? $t('common.saving') : $t('common.addImage') }}
          </button>
        </div>

        <p v-if="galleryError" class="mb-4 text-sm text-red-600">
          {{ $uiMessage(galleryError) }}
        </p>

        <div v-if="productImages.length" class="space-y-3">
          <div
            v-for="image in productImages"
            :key="image.id"
            class="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div class="min-w-0 space-y-3">
              <div>
                <label
                  :for="`image-variant-${image.id}`"
                  class="mb-2 block text-sm font-semibold text-gray-700"
                >
                  {{ $t('common.variantVariant2') }}
                </label>
                <select
                  :id="`image-variant-${image.id}`"
                  v-model="image.variant_id"
                  :disabled="galleryLoading"
                  class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">{{ $t('dashboard.products.variantAssignmentRequired') }}</option>
                  <option
                    v-for="variant in savedVariantOptions"
                    :key="variant.id"
                    :value="variant.id"
                  >
                    {{ formatVariantOption(variant) }}
                  </option>
                </select>
              </div>

              <DashboardMediaUploadField
                v-model="image.image_url"
                @busy="galleryUploads[image.id] = $event"
                :label="$t('common.image')"
                section="product_gallery"
              :disabled="galleryLoading || galleryStatus === 'unknown' || !hasPermission('products.edit')"
                :preview-alt="image.alt_text || title || 'Extra image'"
                preview-height-class="h-32"
              />

              <input
                v-model="image.alt_text"
                type="text"
                :placeholder="$t('common.altText')"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div class="flex gap-2 self-start">
              <button
                type="button"
                @click="saveProductImage(image)"
                :disabled="!isProductImageDirty(image) || galleryLoading"
                class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                :class="isProductImageDirty(image) && !galleryLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                {{ $t('common.save') }}
              </button>

              <button
                type="button"
                @click="deleteProductImage(image.id)"
                class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
              >
                {{ $t('common.delete') }}
              </button>
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-gray-500">
          {{ $t('dashboard.products.noExtraImagesAddedYet') }}
        </p>
        </fieldset>
      </section>

      <DashboardProductsSpecificationEditor :product-id="id" :product-title="product.title" :category-id="product.category_id || ''" @state="specificationState = $event" />
    </div>

    <div v-else class="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-center shadow">
      {{ $t('common.noProductFound') }}
    </div>
  </div>
</template>

<script setup>
import { useProductListNavigation } from '~/composables/useProductListNavigation'
const { returnToProducts } = useProductListNavigation()
const { data: erpState } = useNuxtData('active-erp')
const externalErp = computed(() => erpState.value?.mode === 'daftra')

const { uiLabel } = useUiLocale()
const { t } = useI18n()

const { uiNavigateTo } = useUiNavigation()

import { matchOriginal, requireSavedRow, mergeSectionRows } from '~/utils/productSection'
import { productEditorErrors } from '~/utils/productEditor'
import { defaultSellingConfig, serializeSellingConfig } from '~/utils/preorder'
import { defaultWarrantyConfig, readWarrantyConfig } from '~/utils/warranty'
definePageMeta({
  layout: 'dashboard',
  key: route => route.path
})

const supabase = useSupabaseClient()
const { hasPermission } = useAdminAccess()
const {
  getSnapshot,
  invalidate,
  setSnapshot
} = useDashboardCache()
const {
  getAdminAuthHeaders,
  recordAdminLog
} = useAdminLogs()
const PRODUCT_FORM_CATEGORIES_CACHE_KEY = 'dashboard:product-form:categories'
const PRODUCT_FORM_BRANDS_CACHE_KEY = 'dashboard:product-form:brands'
const PRODUCT_FORM_SUPPLIERS_CACHE_KEY = 'dashboard:product-form:suppliers'
const PRODUCT_FORM_WAREHOUSES_CACHE_KEY = 'dashboard:product-form:warehouses'

const route = useUiRoute()
const id = route.params.id

const seo = ref({ seo_title: '', seo_description: '', seo_image_url: '' })
const title = ref('')
const slug = ref('')
const description = ref('')
const longDescription = ref('')
const price = ref('')
const oldPrice = ref('')
const imageUrl = ref('')
const categoryId = ref('')
const brandId = ref('')
const defaultSupplierId = ref('')
const primaryWarehouseId = ref('')
const sku = ref('')
const stockQuantity = ref(0)
const isStockQuantityFocused = ref(false)
const colorName = ref('')
const colorHex = ref('')
const isSerialized = ref(false)
const isPublished = ref(true)
const sellingConfig = ref(defaultSellingConfig())
const warrantyConfig = ref(defaultWarrantyConfig())

const categories = ref([])
const brands = ref([])
const suppliers = ref([])
const warehouses = ref([])
const mainUploads = reactive({ image: false, seo: false })
const mainUploadsActive = computed(() => Object.values(mainUploads).some(Boolean))
const lookupFailures = reactive({ categories: false, brands: false, suppliers: false, warehouses: false })
const productImages = ref([])
const productVariants = ref([])

const canAssignPrimaryWarehouse = computed(() => {
  return Boolean(
    !externalErp.value
    && isSerialized.value
    && Number(product.value?.stock_quantity || 0) === 0
  )
})
const savedVariantOptions = computed(() => {
  return (editorSnapshot.value?.variants || []).filter((variant) => {
    return Boolean(String(variant?.id || '').trim())
  })
})

const newImageUrl = ref('')
const newImageAlt = ref('')
const newImageVariantId = ref('')

const { saving, error: saveError, errorField: saveField, conflict: saveConflict, unconfirmed: saveUnconfirmed,
  submit: submitProduct, recover: recoverProductSave, resetConflict: resetSaveConflict } = useProductSave(`/api/admin-products/${id}`, 'PATCH')
const formLoading = ref(true)
const deleting = ref(false)
const productDeleted = ref(false)
const galleryUploads = reactive({})
const galleryUploadsActive = computed(() => Object.values(galleryUploads).some(Boolean))
const galleryReading = ref(false)
const { running: galleryRunning, status: galleryStatus, error: gallerySaveError, run: runGallery, reset: resetGallery, markSaved: markGallerySaved } = useProductSection()
const galleryLoading = computed(() => galleryRunning.value || galleryReading.value || galleryUploadsActive.value)
const saveGallery = operation => galleryUploadsActive.value ? null : runGallery(operation)
const actionError = ref('')
const galleryError = ref('')

const makeSlug = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const useTitleSlug = () => {
  slug.value = makeSlug(title.value)
}

const { data: editorSnapshot, pending, error: fetchError, refresh: refreshProduct } = await useAsyncData(
  `edit-product-${id}`,
  async () => $fetch(`/api/admin-products/${id}`, { headers: await getAdminAuthHeaders(), retry: 0 }),
  { server: false }
)
const product = computed(() => editorSnapshot.value?.product || null)
const editorRevision = ref(null)

const validationAttempted = ref(false)
const mainSaved = ref(false)
const refreshRequired = ref(false)
const restoredDraft = ref(false)
const specificationState = ref({ dirty: false, saving: false })
const galleryDirty = computed(() => Boolean(newImageUrl.value || newImageAlt.value || newImageVariantId.value) || productImages.value.some(image => image.image_url !== image.original_image_url || (image.alt_text || '') !== image.original_alt_text || (image.variant_id || '') !== image.original_variant_id))
const legacyStockQuantity = computed({ get: () => isSerialized.value ? undefined : stockQuantity.value,
  set: value => { if (!isSerialized.value) stockQuantity.value = value } })
const editorBusy = computed(() => mainUploadsActive.value || pending.value || saving.value || galleryLoading.value || specificationState.value.saving || deleting.value)
const { dirty: mainDirty, markSaved: markMainSaved, restore: restoreDraft, visitPrerequisite } = useProductEditor(`edit:${id}`, { seo, title, slug, description, longDescription, price, oldPrice, imageUrl, categoryId, brandId, defaultSupplierId, primaryWarehouseId, sku, sellingConfig, warrantyConfig, isPublished, productVariants, stockQuantity: legacyStockQuantity, colorName, colorHex, isSerialized }, { busy: editorBusy, revision: editorRevision, extraDirty: computed(() => !productDeleted.value && (saveUnconfirmed.value || galleryStatus.value === 'unknown' || galleryDirty.value || specificationState.value.dirty)) })
const fieldErrors = computed(() => validationAttempted.value ? productEditorErrors({
  title: title.value, slug: slug.value.trim() || makeSlug(title.value), price: price.value,
  old_price: oldPrice.value, sku: sku.value, primary_warehouse_id: primaryWarehouseId.value,
  is_serialized: isSerialized.value, variants: productVariants.value, stock_quantity: stockQuantity.value
}) : {})
const openPrerequisite = to => visitPrerequisite(() => uiNavigateTo(to))

const getCategoriesList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_CATEGORIES_CACHE_KEY)

  if (cachedSnapshot) {
    categories.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  if (error) {
    lookupFailures.categories = true
    return
  }

  lookupFailures.categories = false
  categories.value = data || []
  setSnapshot(PRODUCT_FORM_CATEGORIES_CACHE_KEY, categories.value)
}

const getBrandsList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_BRANDS_CACHE_KEY)

  if (cachedSnapshot) {
    brands.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .order('name')

  if (error) {
    lookupFailures.brands = true
    return
  }

  lookupFailures.brands = false
  brands.value = data || []
  setSnapshot(PRODUCT_FORM_BRANDS_CACHE_KEY, brands.value)
}

const getSuppliersList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_SUPPLIERS_CACHE_KEY)

  if (cachedSnapshot) {
    suppliers.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('commerce_crm_accounts')
    .select('id, name')
    .eq('account_type', 'supplier')
    .eq('is_active', true)
    .order('name')

  if (error) {
    lookupFailures.suppliers = true
    return
  }

  lookupFailures.suppliers = false
  suppliers.value = data || []
  setSnapshot(PRODUCT_FORM_SUPPLIERS_CACHE_KEY, suppliers.value)
}

const getWarehousesList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_WAREHOUSES_CACHE_KEY)

  if (cachedSnapshot) {
    warehouses.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('commerce_warehouses')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    lookupFailures.warehouses = true
    return
  }

  lookupFailures.warehouses = false
  warehouses.value = data || []
  setSnapshot(PRODUCT_FORM_WAREHOUSES_CACHE_KEY, warehouses.value)
}

const getProductImages = async (discard = false) => {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('sort_order')
    .order('created_at')

  if (error) {
    galleryError.value = t('productEditor.sectionFailed')
    return false
  }

  productImages.value = mergeSectionRows(data || [], discard ? [] : productImages.value, isProductImageDirty, image => ({
    ...image, variant_id: image.variant_id || '',
    original: { variant_id: image.variant_id, image_url: image.image_url, alt_text: image.alt_text, sort_order: image.sort_order },
    original_image_url: image.image_url || '', original_alt_text: image.alt_text || '', original_variant_id: image.variant_id || ''
  }))
  return true
}

onMounted(async () => {
  await Promise.all([
    getCategoriesList(),
    getBrandsList(),
    getSuppliersList(),
    getWarehousesList(),
    getProductImages()
  ])
  await checkProductSave()
  formLoading.value = false
})

let restoredOnce = false
let replaceCore = false
watch(editorSnapshot, () => {
  if (product.value && (!mainDirty.value || replaceCore)) {
    editorRevision.value = editorSnapshot.value.revision
    productVariants.value = JSON.parse(JSON.stringify(editorSnapshot.value.variants || []))
    title.value = product.value.title || ''
    slug.value = product.value.slug || makeSlug(product.value.title || '')
    description.value = product.value.description || ''
    longDescription.value = product.value.long_description || ''
    price.value = product.value.price ?? ''
    oldPrice.value = product.value.old_price ?? ''
    imageUrl.value = product.value.image_url || ''
    seo.value = { seo_title: product.value.seo_title || '', seo_description: product.value.seo_description || '', seo_image_url: product.value.seo_image_url || '' }
    categoryId.value = product.value.category_id || ''
    brandId.value = product.value.brand_id || ''
    defaultSupplierId.value = product.value.default_supplier_id || ''
    primaryWarehouseId.value = product.value.primary_warehouse_id || ''
    sku.value = product.value.sku || ''
    stockQuantity.value = product.value.stock_quantity ?? 0
    colorName.value = product.value.color_name || ''
    colorHex.value = product.value.color_hex || ''
    isSerialized.value = Boolean(product.value.is_serialized)
    isPublished.value = product.value.is_published ?? true
    warrantyConfig.value = readWarrantyConfig(product.value)
    const localDateTime = value => {
      if (!value) return ''
      const date = new Date(value)
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }
    sellingConfig.value = {
      ...defaultSellingConfig(),
      selling_mode: product.value.selling_mode || 'normal',
      expected_availability_date: product.value.expected_availability_date || '',
      availability_message: product.value.availability_message || '',
      preorder_active: product.value.preorder_active ?? true,
      preorder_starts_at: localDateTime(product.value.preorder_starts_at),
      preorder_ends_at: localDateTime(product.value.preorder_ends_at),
      preorder_payment_mode: product.value.preorder_payment_mode || 'full',
      preorder_deposit_percent: product.value.preorder_deposit_percent ?? '25',
      preorder_total_limit: product.value.preorder_total_limit ?? '',
      preorder_customer_limit: product.value.preorder_customer_limit ?? ''
    }
    markMainSaved({ forgetDraft: false })
    if (!restoredOnce) { restoredDraft.value = restoreDraft(); restoredOnce = true }
  }
}, { immediate: true })

const checkProductSave = async () => {
  if (mainUploadsActive.value) return
  const result = await recoverProductSave()
  if (result) { markMainSaved(); mainSaved.value = true; editorRevision.value = result.revision; await refreshProduct(); refreshRequired.value = Boolean(fetchError.value) }
}
const reloadProduct = async () => {
  if (mainUploadsActive.value || saving.value || !confirm(t('productSave.discard'))) return
  replaceCore = true
  try { await refreshProduct() } finally { replaceCore = false }
  if (!fetchError.value) { actionError.value = ''; refreshRequired.value = false; resetSaveConflict() }
}

const updateProduct = async () => {
  if (mainUploadsActive.value || pending.value || saving.value || saveConflict.value || refreshRequired.value || formLoading.value) return
  actionError.value = ''

  const normalizedSlug = slug.value.trim() || makeSlug(title.value)

  validationAttempted.value = true
  if (!saveUnconfirmed.value && Object.keys(fieldErrors.value).length) return

  const result = await submitProduct({
    expected_revision: editorRevision.value,
    title: title.value,
    slug: normalizedSlug,
    description: description.value,
    long_description: longDescription.value,
    price: price.value,
    old_price: oldPrice.value,
    image_url: imageUrl.value,
    ...seo.value,
    category_id: categoryId.value,
    brand_id: brandId.value,
    default_supplier_id: defaultSupplierId.value,
    primary_warehouse_id: primaryWarehouseId.value,
    sku: sku.value,
    ...(!isSerialized.value ? { stock_quantity: stockQuantity.value } : {}),
    color_name: colorName.value,
    color_hex: colorHex.value,
    is_serialized: isSerialized.value,
    variants: isSerialized.value ? productVariants.value : [],
    ...serializeSellingConfig(sellingConfig.value),
    ...warrantyConfig.value,
    is_published: isPublished.value
  })
  if (!result) return

  slug.value = normalizedSlug
  markMainSaved(); mainSaved.value = true; validationAttempted.value = false
  invalidate('dashboard:products:')
  invalidate('dashboard:home')
  editorRevision.value = result.revision
  await refreshProduct()
  refreshRequired.value = Boolean(fetchError.value)
}

const addProductImage = () => saveGallery(async () => {
  galleryError.value = ''

  if (!newImageVariantId.value) {
    galleryStatus.value = 'failed'; galleryError.value = 'Select a variant for this image'
    return
  }

  if (!savedVariantOptions.value.some((variant) => variant.id === newImageVariantId.value)) {
    galleryStatus.value = 'failed'; galleryError.value = 'Select a saved active variant for this image'
    return
  }

  if (!newImageUrl.value.trim()) {
    galleryStatus.value = 'failed'; galleryError.value = 'Image is required'
    return
  }

  const { error } = await supabase
    .from('product_images')
    .insert({
      product_id: id,
      variant_id: newImageVariantId.value,
      image_url: newImageUrl.value.trim(),
      alt_text: newImageAlt.value.trim() || null
    })

  if (error) {
    throw error
  }

  markGallerySaved()
  await recordAdminLog({
    actionKey: 'products.images.create',
    description: `Added an extra image to product ${title.value.trim()}.`,
    metadata: {
      product_id: id,
      product_title: title.value.trim(),
      variant_id: newImageVariantId.value
    }
  })

  newImageUrl.value = ''
  newImageAlt.value = ''
  newImageVariantId.value = ''
  if (!await getProductImages()) galleryStatus.value = 'refresh_failed'
})

const isProductImageDirty = (image) => {
  return image.image_url !== image.original_image_url ||
    (image.alt_text || '') !== image.original_alt_text ||
    (image.variant_id || '') !== image.original_variant_id
}

const saveProductImage = (image) => saveGallery(async () => {
  galleryError.value = ''

  if (!image.variant_id) {
    galleryStatus.value = 'failed'; galleryError.value = 'Select a variant for this image'
    return
  }

  if (!savedVariantOptions.value.some((variant) => variant.id === image.variant_id)) {
    galleryStatus.value = 'failed'; galleryError.value = 'Select a saved active variant for this image'
    return
  }

  if (!image.image_url?.trim()) {
    galleryStatus.value = 'failed'; galleryError.value = 'Image is required'
    return
  }

  if (!isProductImageDirty(image)) {
    return
  }

  const savedImage = requireSavedRow(await matchOriginal(supabase
    .from('product_images').update({ variant_id: image.variant_id, image_url: image.image_url.trim(), alt_text: image.alt_text?.trim() || null })
    .eq('id', image.id).eq('product_id', id), image.original).select('*'))
  Object.assign(image, { ...savedImage,
    original: { variant_id: savedImage.variant_id, image_url: savedImage.image_url, alt_text: savedImage.alt_text, sort_order: savedImage.sort_order },
    original_image_url: savedImage.image_url || '', original_alt_text: savedImage.alt_text || '', original_variant_id: savedImage.variant_id || '' })

  markGallerySaved()
  await recordAdminLog({
    actionKey: 'products.images.update',
    description: `Updated an extra image for product ${title.value.trim()}.`,
    metadata: {
      product_id: id,
      product_title: title.value.trim(),
      image_id: image.id,
      variant_id: image.variant_id
    }
  })

  if (!await getProductImages()) galleryStatus.value = 'refresh_failed'
})

const formatVariantOption = (variant) => {
  const name = String(variant?.name || 'Unnamed variant').trim()
  const code = String(variant?.code || '').trim()
  return code ? `${name} (${code})` : name
}

const deleteProductImage = (imageId) => saveGallery(async () => {
  galleryError.value = ''

  const confirmDelete = confirm(uiLabel('Delete this extra image?'))
  if (!confirmDelete) {
    return
  }

  const image = productImages.value.find(row => row.id === imageId)
  if (!image) return
  requireSavedRow(await matchOriginal(supabase.from('product_images').delete().eq('id', imageId).eq('product_id', id), image.original).select('id'))
  productImages.value = productImages.value.filter(row => row.id !== imageId)

  markGallerySaved()
  await recordAdminLog({
    actionKey: 'products.images.delete',
    description: `Deleted an extra image from product ${title.value.trim()}.`,
    metadata: {
      product_id: id,
      product_title: title.value.trim(),
      image_id: imageId
    }
  })

  if (!await getProductImages()) galleryStatus.value = 'refresh_failed'
})

const reloadGallery = async () => {
  if (galleryLoading.value || galleryDirty.value && !confirm(t('productEditor.discard'))) return
  galleryReading.value = true
  galleryError.value = ''
  try {
    if (!await getProductImages(true)) return
    newImageUrl.value = ''; newImageAlt.value = ''; newImageVariantId.value = ''
    resetGallery()
  } catch { galleryError.value = t('productEditor.sectionFailed') }
  finally { galleryReading.value = false }
}

const deleteProduct = async () => {
  if (editorBusy.value || !hasPermission('products.edit')) return
  actionError.value = ''

  if (isSerialized.value) {
    actionError.value = 'Serialized products keep permanent item history. Turn Store Visibility off instead.'
    return
  }

  const confirmDelete = confirm(uiLabel('Are you sure you want to delete this product?'))
  if (!confirmDelete) {
    return
  }

  deleting.value = true

  const { data: removedProducts, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id')

  deleting.value = false

  if (error || removedProducts?.length !== 1) {
    actionError.value = t('productEditor.deleteFailed')
    return
  }

  productDeleted.value = true
  markMainSaved()
  await recordAdminLog({
    actionKey: 'products.delete',
    description: `Deleted product ${title.value.trim()}.`,
    metadata: {
      product_id: id,
      product_title: title.value.trim()
    }
  })

  invalidate('dashboard:products:')
  invalidate('dashboard:home')
  await uiNavigateTo(returnToProducts.value)
}
</script>
