<template>
  <div class="cart-page" :data-has-items="cartRestored && !isEmpty">
    <div class="store-container">
      <nav v-if="cartRestored && !isEmpty" class="cart-steps" :aria-label="$t('cart.checkoutSteps')">
        <ol>
          <li aria-current="step"><span>1</span>{{ $t('common.cart') }}</li>
          <li><span>2</span>{{ $t('checkoutModern.delivery') }}</li>
          <li><span>3</span>{{ $t('checkoutModern.payment') }}</li>
        </ol>
      </nav>

      <header class="cart-head">
        <h1>{{ $t('common.cart') }}<span v-if="cartRestored && !isEmpty" class="cart-head-count">{{ itemCount }} {{ itemCount === 1 ? $t('common.item') : $t('common.items') }}</span></h1>
        <NuxtLinkLocale v-if="cartRestored && !isEmpty" to="/search" class="cart-continue">{{ $t('common.continueShopping') }}<Icon name="lucide:arrow-right" size="16" class="directional-icon" aria-hidden="true" /></NuxtLinkLocale>
      </header>

      <div v-if="!cartRestored" role="status" aria-live="polite" class="cart-panel cart-restoring">{{ $t('cart.restoring') }}</div>
      <div v-else-if="isEmpty" class="cart-panel cart-empty">
        <span class="cart-empty-art" aria-hidden="true"><span /><Icon name="lucide:shopping-cart" size="34" /></span>
        <h2>{{ $t('common.yourCartIsEmpty') }}</h2>
        <p>{{ $t('cart.addProductsFromTheStoreToStartYourOrder') }}</p>
        <NuxtLinkLocale to="/search" class="cart-primary">{{ $t('common.startShopping') }}<Icon name="lucide:arrow-right" size="18" class="directional-icon" aria-hidden="true" /></NuxtLinkLocale>
        <nav v-if="categories.length" class="cart-empty-tiles" :aria-label="$t('common.browseCategories')">
          <NuxtLinkLocale v-for="category in categories.slice(0, 8)" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }"><Icon :name="getStoreCategoryIcon(category.name)" size="22" aria-hidden="true" /><span>{{ categoryName(category) }}</span></NuxtLinkLocale>
        </nav>
      </div>

      <div v-else class="cart-layout">
        <main class="cart-main">
          <p v-if="savings > 0" class="cart-saving" role="status"><span class="cart-saving-icon" aria-hidden="true"><Icon name="lucide:badge-percent" size="20" /></span><span>{{ $t('cart.savingBanner', { value0: formatCurrency(savings) }) }}</span></p>
          <div v-if="backorderNotice" class="cart-notice" role="note"><p>{{ backorderNotice }}</p><p>{{ $t('beta.wholeOrderWaits') }}</p></div>
          <p v-if="hasMixedSellingModes" role="status" class="cart-notice">{{ $t('cart.preOrderAndReadyToShipProductsNeedSeparateOrdersRemoveOneTypeBeforeCheckout') }}</p>

          <section class="cart-panel cart-group" aria-labelledby="shipping-group-title">
            <header class="cart-group-head">
              <span class="cart-group-icon"><Icon name="lucide:truck" size="20" aria-hidden="true" /></span>
              <div>
                <h2 id="shipping-group-title">{{ $t('cart.shippingForValueValue', { value0: (itemCount), value1: (itemCount === 1 ? $t('common.item') : $t('common.items')) }) }}</h2>
                <p>{{ $t('cart.soldAndShippedByElcomputer') }} · {{ $t('cart.deliveryTimingAndCostAreConfirmedDuringCheckout') }}</p>
              </div>
            </header>

            <TransitionGroup tag="ul" name="cart-row" class="cart-items">
              <li v-for="item in items" :key="item.cart_key" class="cart-item">
                <NuxtLinkLocale :to="getProductLink(item)" class="cart-thumb" tabindex="-1" aria-hidden="true"><img v-if="item.image_url" :src="item.image_url" alt="" loading="lazy"><Icon v-else name="lucide:image" size="26" /><span v-if="unitSaving(item)" class="cart-thumb-badge">−{{ savingPercent(item) }}%</span></NuxtLinkLocale>
                <div class="cart-info">
                  <p class="cart-brand">{{ item.brand_name || item.category_name || $t('common.storeProduct') }}</p>
                  <NuxtLinkLocale :to="getProductLink(item)" class="cart-title">{{ item.title }}</NuxtLinkLocale>
                  <ul v-if="choices(item).length" class="cart-choices" :aria-label="$t('cart.yourChoice')">
                    <li v-for="choice in choices(item)" :key="choice.key">
                      <span v-if="choice.stem" class="pdp-switch-stem" :data-known="!!choice.color" :style="choice.color ? { '--stem': choice.color } : undefined" aria-hidden="true" />
                      <span v-else-if="choice.color" class="cart-choice-dot" :data-light="lightColor(choice.color)" :style="{ backgroundColor: choice.color }" aria-hidden="true" />
                      <span class="cart-choice-label">{{ choice.label }}:</span> <bdi>{{ choice.value }}</bdi>
                    </li>
                  </ul>
                  <div v-if="item.selling_mode === 'preorder'" class="cart-preorder"><strong>{{ $t('common.preOrder') }}</strong><p v-if="item.expected_availability_date">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(item.expected_availability_date)) }) }}</p><p>{{ item.preorder_payment_mode === 'deposit' ? $t('cart.valueDepositRequired', { value0: (item.preorder_deposit_percent) }) : $t('common.fullPaymentRequired') }}</p><p>{{ $t('common.requiredNowValue', { value0: (formatCurrency(preorderAmounts(item).due)) }) }}</p><p v-if="preorderAmounts(item).balance">{{ $t('cart.remainingAfterPaymentValue', { value0: (formatCurrency(preorderAmounts(item).balance)) }) }}</p></div>
                  <p v-else-if="!usesUnrecordedStockSales(item, siteContent?.settings)" class="cart-stock" :data-ok="item.allow_out_of_stock_purchases || Number(item.stock_quantity) > 0"><span aria-hidden="true" />{{ item.allow_out_of_stock_purchases || Number(item.stock_quantity) > 0 ? $t('common.availableToOrder') : $t('common.currentlyUnavailable') }}</p>
                </div>
                <div class="cart-price">
                  <strong>{{ formatCurrency(item.price * item.quantity) }}</strong>
                  <del v-if="unitSaving(item)">{{ formatCurrency(item.old_price * item.quantity) }}</del>
                  <span v-if="unitSaving(item)" class="cart-save">{{ $t('cart.youSave', { value0: formatCurrency(unitSaving(item) * item.quantity) }) }}</span>
                  <small v-if="item.quantity > 1">{{ $t('common.valueEach', { value0: formatCurrency(item.price) }) }}</small>
                </div>
                <div class="cart-controls">
                  <div class="cart-qty">
                    <button type="button" :aria-label="$t('cart.decreaseValueQuantity', { value0: (item.title) })" :disabled="item.quantity <= 1" @click="decrementItem(item.cart_key)"><Icon name="lucide:minus" size="16" aria-hidden="true" /></button>
                    <output aria-live="polite">{{ item.quantity }}</output>
                    <button type="button" :aria-label="$t('cart.increaseValueQuantity', { value0: (item.title) })" :disabled="item.quantity >= getMaximumQuantity(item)" @click="incrementItem(item.cart_key)"><Icon name="lucide:plus" size="16" aria-hidden="true" /></button>
                  </div>
                  <div class="cart-actions">
                    <ClientOnly><CartMoveToFavorites :product-id="String(item.id)" :title="item.title" @moved="removeLine(item)" /></ClientOnly>
                    <button type="button" class="cart-remove" :aria-label="`${$t('common.remove')}: ${item.title}`" @click="removeLine(item)"><Icon name="lucide:trash-2" size="16" aria-hidden="true" /><span>{{ $t('common.remove') }}</span></button>
                  </div>
                </div>
              </li>
            </TransitionGroup>
          </section>
        </main>

        <aside class="cart-panel cart-summary" aria-labelledby="cart-summary-title">
          <h2 id="cart-summary-title">{{ $t('common.orderSummary') }}</h2>
          <dl>
            <div><dt>{{ $t('cart.subtotalValueValue', { value0: (itemCount), value1: (itemCount === 1 ? $t('common.item') : $t('common.items')) }) }}</dt><dd>{{ formatCurrency(subtotal + savings) }}</dd></div>
            <div v-if="savings > 0" class="cart-summary-saving"><dt>{{ $t('cart.savings') }}</dt><dd>−{{ formatCurrency(savings) }}</dd></div>
            <div v-if="isPreorderCart"><dt>{{ $t('common.requiredNow') }}</dt><dd>{{ formatCurrency(preorderDue) }}</dd></div>
            <div v-if="isPreorderCart"><dt>{{ $t('common.remainingAfterPayment') }}</dt><dd>{{ formatCurrency(subtotal - preorderDue) }}</dd></div>
            <div><dt>{{ $t('common.shipping') }}</dt><dd>{{ $t('common.calculatedLater') }}</dd></div>
            <div class="cart-summary-total"><dt>{{ $t('common.estimatedTotal') }}</dt><dd>{{ formatCurrency(subtotal) }}</dd></div>
          </dl>
          <NuxtLinkLocale to="/checkout" class="cart-primary cart-summary-checkout">{{ $t('common.continueToCheckout') }}<Icon name="lucide:arrow-right" size="18" class="directional-icon" aria-hidden="true" /></NuxtLinkLocale>
          <p v-if="siteContent?.settings?.inventory_tracking_required !== false" class="cart-assure"><Icon name="lucide:shield-check" size="16" aria-hidden="true" />{{ $t('cart.stockIsCheckedAgainWhenYouConfirm') }}</p>
          <div v-if="paymentMarks.length" class="cart-payments">
            <p>{{ $t('common.paymentMethods') }}</p>
            <ul><li v-for="mark in paymentMarks" :key="mark.id"><img :src="footerUrl(mark.image_url)" :alt="mark.label" width="48" height="24" loading="lazy"></li></ul>
          </div>
          <button type="button" class="cart-clear" @click="clearCart">{{ $t('common.clearCart') }}</button>
        </aside>
      </div>

      <section v-if="recommendationsLoading || recommendations.length" class="cart-suggestions" aria-labelledby="cart-suggestions-title">
        <div class="cart-suggestions-head">
          <h2 id="cart-suggestions-title">{{ isEmpty ? $t('common.popularProducts') : $t('common.youMayAlsoLike') }}</h2>
          <NuxtLinkLocale to="/search">{{ $t('common.viewAllProducts') }}</NuxtLinkLocale>
        </div>
        <LayoutPageLoading v-if="recommendationsLoading" :label="$t('common.loadingSuggestions')" />
        <div v-else class="store-search-grid cart-suggestion-row">
          <CardsProductCard v-for="product in recommendations" :key="product.id" :product="product" />
        </div>
      </section>
    </div>

    <Transition name="cart-toast">
      <div v-if="lastRemoved" class="cart-toast" role="status">
        <span>{{ $t('cart.removedValue', { value0: lastRemoved.title }) }}</span>
        <button type="button" @click="undoRemove">{{ $t('cart.undo') }}</button>
      </div>
    </Transition>

    <div v-if="cartRestored && !isEmpty" class="cart-bar">
      <div><span>{{ isPreorderCart ? $t('common.requiredNowBeforeFee') : $t('common.estimatedTotal') }}</span><strong>{{ formatCurrency(isPreorderCart ? preorderDue : subtotal) }}</strong><em v-if="savings > 0">{{ $t('cart.youSave', { value0: formatCurrency(savings) }) }}</em></div>
      <NuxtLinkLocale to="/checkout" class="cart-primary">{{ $t('common.checkout') }}<Icon name="lucide:arrow-right" size="18" class="directional-icon" aria-hidden="true" /></NuxtLinkLocale>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'purchasing' })
import '~/assets/css/cart.css'
import '~/assets/css/product-choices.css'
import { getStoreCategoryIcon } from '~/utils/storefront'
import { familyChoiceStyle, familyChoiceColor, familyValue, labelColor, lightColor } from '~/utils/productFamily'
import { resolveModernFooter, visibleFooterPayments, footerUrl } from '~/utils/modernFooter'
const { categoryName } = useCategoryLocale()
const { uiLabel } = useUiLocale()

const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

const { intlLocale } = useUiLocale()

import { specialOrderNotice, usesUnrecordedStockSales } from '~/utils/backorder'
import { calculatePreorderAmounts, expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'
const { items, itemCount, subtotal, isEmpty, isReady: cartReady, incrementItem, decrementItem, removeItem, clearCart, loadCart, addItem } = useCart()
const cartMounted = ref(false)
const cartRestored = computed(() => cartMounted.value && cartReady.value)
const { scope: purchaseScope, capabilities, purchasingEnabled } = usePurchaseAccess()
const { locale, t } = useI18n()
const supabase = useSupabaseClient()
const { data: siteContent } = useSiteContent()
const backorderNotice = computed(() => siteContent.value?.settings?.inventory_tracking_required !== false && siteContent.value?.settings?.allow_out_of_stock_purchases && items.value.some(item => item.selling_mode !== 'preorder' && item.quantity > Number(item.stock_quantity || 0)) ? specialOrderNotice(siteContent.value?.settings, intlLocale.value) : '')
const recommendations = ref([])
const recommendationsLoading = ref(false)
let recommendationVersion = 0

const formatCurrency = value => new Intl.NumberFormat(intlLocale.value, { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
const getProductLink = item => !item?.slug ? '/' : { path: `/products/${item.slug}`, query: item.variant_id ? { variant: item.variant_id } : {} }
// Savings use the product's saved compare-at price, as on the product page.
const unitSaving = item => Number(item.old_price) > Number(item.price) ? Number(item.old_price) - Number(item.price) : 0
const savingPercent = item => Math.round(unitSaving(item) / Number(item.old_price) * 100)
const savings = computed(() => items.value.reduce((sum, item) => sum + unitSaving(item) * item.quantity, 0))
const paymentMarks = computed(() => { const settings = siteContent.value?.settings; return settings && purchasingEnabled.value ? visibleFooterPayments(resolveModernFooter(settings), settings, capabilities.value) : [] })

// The chosen color, model or switch: in-product options first, then the linked-product choice.
const families = ref({})
const loadFamilies = async () => {
  if (!import.meta.client) return
  for (const id of [...new Set(items.value.map(item => String(item.id)))].filter(id => !(id in families.value))) {
    families.value = { ...families.value, [id]: null }
    $fetch(`/api/storefront/products/${encodeURIComponent(id)}/presentation`, { retry: 0, timeout: 8000 })
      .then(data => { families.value = { ...families.value, [id]: data?.family || null } }).catch(() => {})
  }
}
const optionLabel = key => { const label = t(`modernProduct.options.${key}`); return label === `modernProduct.options.${key}` ? key : label }
const choices = item => {
  const rows = []
  for (const [key, value] of Object.entries(item.variant_options || {})) {
    if (!String(value || '').trim()) continue
    rows.push({ key: 'v-' + key, label: optionLabel(key), value: String(value), stem: key === 'switch', color: key === 'color' || key === 'switch' ? labelColor(value) || (key === 'color' ? getVariantColor(item) : '') : '' })
  }
  if (!rows.length && variantLabel(item)) rows.push({ key: 'variant', label: t('common.option').replace(/[:：]\s*$/, ''), value: variantLabel(item), stem: false, color: getVariantColor(item) || labelColor(variantLabel(item)) })
  const family = families.value[String(item.id)], member = family?.members?.find(row => row.product_id === String(item.id))
  if (member && family.members.length > 1) for (const axis of family.axes || []) {
    const style = familyChoiceStyle(axis.key)
    rows.push({ key: 'f-' + axis.key, label: locale.value === 'ar' ? axis.label_ar || axis.label : axis.label, value: familyValue(member, axis.key, locale.value), stem: style === 'switch', color: style === 'text' ? '' : familyChoiceColor(member, axis.key) })
  }
  return rows
}

// Removal can be undone for a few seconds with the same cart rules.
const lastRemoved = ref(null)
let removedTimer
const removeLine = item => {
  const { cart_line_id, ...snapshot } = item
  removeItem(item.cart_key)
  lastRemoved.value = snapshot; clearTimeout(removedTimer); removedTimer = setTimeout(() => { lastRemoved.value = null }, 6000)
}
const undoRemove = () => {
  const snapshot = lastRemoved.value; if (!snapshot) return
  clearTimeout(removedTimer); lastRemoved.value = null
  addItem(snapshot, snapshot.quantity, { source: 'cart_undo' })
}
onBeforeUnmount(() => clearTimeout(removedTimer))

// Hide placeholder option names such as Default; real choices stay visible.
const variantLabel = item => { const name = String(item?.variant_name || item?.variant_color_name || '').trim(); return item?.variant_id && name && !/^(default|standard|base|product)$/i.test(name) ? name : '' }
const categories = computed(() => siteContent.value?.navbarCategories || [])
const getVariantColor = item => /^#[0-9a-f]{6}$/i.test(String(item?.variant_color_hex || '').trim()) ? item.variant_color_hex : ''
const getMaximumQuantity = item => purchaseScope.value ? 1 : item?.selling_mode === 'preorder'
  ? Math.max(1, Math.min(99, Number(item.preorder_customer_limit || 99), Number(item.preorder_remaining ?? 99)))
  : item?.allow_out_of_stock_purchases ? 99 : Math.max(1, Number(item?.stock_quantity || 0))
const isPreorderCart = computed(() => items.value.length > 0 && items.value.every(item => item.selling_mode === 'preorder'))
const hasMixedSellingModes = computed(() => items.value.some(item => item.selling_mode === 'preorder') && items.value.some(item => item.selling_mode !== 'preorder'))
const preorderAmounts = item => calculatePreorderAmounts(item.price, item.quantity, item.preorder_payment_mode, item.preorder_deposit_percent)
const preorderDue = computed(() => items.value.reduce((sum, item) => sum + (item.selling_mode === 'preorder' ? preorderAmounts(item).due : 0), 0))

const loadRecommendations = async () => {
  const version = ++recommendationVersion
  recommendationsLoading.value = true
  try {
    const { data, error } = await supabase
      .from('storefront_products')
      .select(`
        id,
        title,
        slug,
        description,
        price,
        old_price,
        image_url,
        stock_quantity,
        is_serialized,
        selling_mode,
        is_featured,
        is_top_seller,
        popularity_score,
        category:categories (id, name, slug),
        brand:brands (id, name, slug),
        product_variants:storefront_product_variants (id, is_active)
      `)
      .eq('is_published', true)
      .order('is_top_seller', { ascending: false })
      .order('popularity_score', { ascending: false })
      .limit(24)

    if (error) throw error
    if (version !== recommendationVersion) return

    const cartProductIds = new Set(items.value.map(item => String(item.id)))
    const cartCategories = new Set(items.value.map(item => String(item.category_name || '').toLocaleLowerCase()).filter(Boolean))
    const cartBrands = new Set(items.value.map(item => String(item.brand_name || '').toLocaleLowerCase()).filter(Boolean))
    recommendations.value = (data || [])
      .filter(product => !cartProductIds.has(String(product.id)))
      .map(product => ({
        ...product,
        recommendationScore:
          (cartCategories.has(String(product.category?.name || '').toLocaleLowerCase()) ? 4 : 0)
          + (cartBrands.has(String(product.brand?.name || '').toLocaleLowerCase()) ? 3 : 0)
          + (product.is_top_seller ? 2 : 0)
          + (product.is_featured ? 1 : 0)
      }))
      .sort((first, second) => second.recommendationScore - first.recommendationScore
        || Number(second.popularity_score || 0) - Number(first.popularity_score || 0))
      .slice(0, 4)
  } catch {
    if (version === recommendationVersion) recommendations.value = []
  } finally {
    if (version === recommendationVersion) recommendationsLoading.value = false
  }
}

const cartRecommendationKey = computed(() => items.value
  .map(item => `${item.id}:${item.brand_name}:${item.category_name}`)
  .sort()
  .join('|'))

onMounted(() => {
  loadCart()
  cartMounted.value = true
  loadRecommendations()
  loadFamilies()
})
watch(cartRecommendationKey, () => { loadRecommendations(); loadFamilies() })
useHead(() => ({ title: uiLabel('Cart') }))
</script>
