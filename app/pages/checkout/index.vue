<template>
  <div class="min-h-[60vh] bg-slate-50 py-7 sm:py-10">
    <div class="store-container">
      <header class="mx-auto max-w-5xl">
        <button v-if="checkoutStep === 'payment'" type="button" class="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="checkoutStep = 'shipping'">
          <Icon name="lucide:arrow-left" size="17" aria-hidden="true" class="directional-icon" /> {{ $t('common.backToDelivery') }}
        </button>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{{ $t('common.secureCheckout') }}</p>
        <h1 class="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{{ checkoutStep === 'shipping' ? $t('common.deliveryDetails') : $t('common.paymentMethod') }}</h1>
        <p class="mt-2 text-sm text-slate-600">{{ checkoutStep === 'shipping' ? $t('checkout.tellUsWhereToDeliverYourOrder') : $t('checkout.chooseHowYouWouldLikeToPay') }}</p>

        <ol class="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white" :aria-label="$t('common.checkoutProgress')">
          <li class="flex min-h-16 items-center gap-3 px-4 sm:px-6" :class="checkoutStep === 'shipping' ? 'bg-blue-50 text-blue-800' : 'text-emerald-700'">
            <span class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="checkoutStep === 'shipping' ? 'bg-blue-600 text-white' : 'bg-emerald-100'"><Icon v-if="checkoutStep === 'payment'" name="lucide:check" size="17" aria-hidden="true" /><span v-else>1</span></span>
            <span class="font-semibold">{{ $t('common.delivery') }}</span>
          </li>
          <li class="flex min-h-16 items-center gap-3 border-s border-slate-200 px-4 text-slate-500 sm:px-6" :class="checkoutStep === 'payment' ? 'bg-blue-50 !text-blue-800' : ''">
            <span class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="checkoutStep === 'payment' ? 'bg-blue-600 text-white' : 'bg-slate-100'">2</span>
            <span class="font-semibold">{{ $t('common.payment') }}</span>
          </li>
        </ol>
      </header>

      <div v-if="isEmpty" class="mx-auto mt-6 max-w-5xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p class="text-lg font-semibold text-slate-900">{{ $t('common.yourCartIsEmpty') }}</p>
        <p class="mt-2 text-sm text-slate-600">{{ $t('checkout.addProductsFirstThenReturnHereToCheckout') }}</p>
        <NuxtLinkLocale to="/cart" class="mt-5 inline-flex rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">{{ $t('common.goToCart') }}</NuxtLinkLocale>
      </div>

      <div v-else class="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <main class="min-w-0 space-y-5">
          <p v-if="orderError" role="alert" class="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{{ $uiMessage(orderError) }}</p>

          <template v-if="checkoutStep === 'shipping'">
            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="delivery-address-title">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><h2 id="delivery-address-title" class="text-xl font-bold text-slate-950">{{ $t('common.shippingAddress') }}</h2><p class="mt-1 text-sm text-slate-600">{{ hasSavedAddress ? $t('checkout.checkYourSavedAddress') : $t('checkout.enterYourDeliveryAddress') }}</p></div>
                <span v-if="loadingProfile" class="text-sm text-slate-500">{{ $t('common.loadingAccount') }}</span>
              </div>

              <div class="mt-5 grid gap-5 md:grid-cols-2">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.firstNameVariant2') }}</span><input v-model="address.first_name" autocomplete="given-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.lastName') }}</span><input v-model="address.last_name" autocomplete="family-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.streetAddress') }}</span><input v-model="address.street_address" autocomplete="street-address" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.cityVariant2') }}</span><input v-model="address.city" autocomplete="address-level2" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.governorate') }}</span><select v-model="address.governorate" autocomplete="address-level1" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"><option value="">{{ $t('common.selectGovernorate') }}</option><option v-for="governorate in egyptGovernorates" :key="governorate" :value="governorate">{{ $uiLabel(governorate) }}</option></select></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.phoneVariant2') }}</span><input v-model="address.phone" autocomplete="tel" inputmode="tel" type="tel" :placeholder="$t('common.01xxxxxxxxx')" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"><span class="mt-2 block text-xs text-slate-500">{{ $t('checkout.11DigitsStartingWith01') }}</span></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.email') }}</span><input v-model="address.email" autocomplete="email" type="email" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
              </div>
            </section>

            <section v-if="!isPreorderCart" class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="coupon-title">
              <h2 id="coupon-title" class="text-xl font-bold text-slate-950">{{ $t('common.coupon') }}</h2>
              <p class="mt-1 text-sm text-slate-600">{{ $t('checkout.applyACodeBeforeChoosingPayment') }}</p>
              <div class="mt-4 flex flex-col gap-3 sm:flex-row"><input v-model="couponCode" type="text" :placeholder="$t('common.couponCode')" class="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 uppercase outline-none focus:border-blue-600"><button type="button" :disabled="applyingCoupon" class="min-h-12 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" @click="applyCoupon">{{ applyingCoupon ? $t('common.applying') : $t('common.apply') }}</button><button v-if="appliedCoupon" type="button" class="min-h-12 rounded-xl px-4 text-sm font-semibold text-red-700 hover:bg-red-50" @click="removeCoupon">{{ $t('common.remove') }}</button></div>
              <p v-if="couponError" class="mt-3 text-sm text-red-700">{{ $uiMessage(couponError) }}</p><p v-if="couponSuccess" class="mt-3 text-sm text-emerald-700">{{ $uiLabel(couponSuccess) }}</p>
            </section>
          </template>

          <template v-else>
            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-wide text-emerald-700">{{ $t('common.addressSaved') }}</p><h2 class="mt-1 text-lg font-bold text-slate-950">{{ address.first_name }} {{ address.last_name }}</h2><p class="mt-1 text-sm text-slate-600">{{ address.street_address }}, {{ address.city }}, {{ address.governorate }}</p></div><button type="button" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="checkoutStep = 'shipping'">{{ $t('common.edit') }}</button></div>
            </section>

            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="payment-method-title">
              <h2 id="payment-method-title" class="text-xl font-bold text-slate-950">{{ $t('common.chooseAPaymentMethod') }}</h2>
              <p class="mt-1 text-sm text-slate-600">{{ isPreorderCart ? $t('checkout.preordersCurrentlyUseBankTransferOrInstapayPaymentRemainsPendingUntilVerified') : $t('checkout.onlyMethodsEnabledByTheStoreAreShown') }}</p>

              <div v-if="availablePaymentMethods.length" class="mt-5 grid gap-3 sm:grid-cols-2">
                <label v-for="method in availablePaymentMethods" :key="method.value" class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition" :class="selectedPaymentMethod === method.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-blue-300'">
                  <input v-model="selectedPaymentMethod" type="radio" name="payment-method" :value="method.value" class="mt-1">
                  <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon :name="method.icon" size="21" aria-hidden="true" /></span>
                  <span class="min-w-0"><strong class="block text-sm text-slate-900">{{ $uiLabel(method.label) }}</strong><span class="mt-1 block text-xs leading-5 text-slate-600">{{ $uiLabel(method.description) }}</span><span v-if="getMethodFee(method.value)" class="mt-2 block text-xs font-semibold text-amber-700">{{ $t('common.valueFee', { value0: (formatCurrency(getMethodFee(method.value))) }) }}</span></span>
                </label>
              </div>
              <p v-else class="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ $t('checkout.noPaymentMethodIsAvailablePleaseContactTheStore') }}</p>

              <div v-if="selectedPaymentMethod === 'card'" class="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <h3 class="font-bold text-slate-950">{{ $t('paymob.secureCard') }}</h3>
                <p class="mt-2 text-sm text-slate-600">{{ $t('paymob.startAfterOrder') }}</p>
                <p v-if="paymentCapabilities?.card?.mode === 'test'" class="mt-2 text-sm font-semibold text-amber-800">{{ $t('paymob.testOnly') }}</p>
              </div>

              <div v-else-if="paymentMethodNeedsProof(selectedPaymentMethod)" class="mt-6 space-y-4 border-t border-slate-200 pt-6">
                <div class="rounded-2xl bg-slate-50 p-5"><h3 class="font-bold text-slate-950">{{ $t('common.transferInstructions') }}</h3><p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{{ paymentInstructions || $t('checkout.contactTheStoreForTransferDetailsBeforeSendingPayment') }}</p></div>
                <template v-if="isPreorderCart"><p class="text-sm text-slate-600">{{ $t('checkout.afterConfirmingUseYourOrderNumberWhenContactingTheStoreAboutYourTransferStaffWillRecordTheAmountOnlyAfterVerifyingItYourOrderRemainsUnpaidUntilThen') }}</p></template>
                <template v-else><PaymentProofUpload v-model="proofFile" backend-notice="Proof selection is available now. Secure submission will be activated with the payment backend; you can also return from My Account → Orders." /><p class="text-sm text-slate-600">{{ $t('checkout.youCanConfirmTheOrderWithoutProofAndReturnLaterTheOrderWillStayAtPaymentPendingUntilProofIsSubmittedAndReviewed') }}</p></template>
              </div>

              <div v-else-if="selectedPaymentMethod === 'paypal'" class="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 class="font-bold text-blue-950">PayPal</h3><p class="mt-2 text-sm leading-6 text-blue-900">{{ $t('checkout.yourOrderWillRemainPaymentPendingUntilThePaypalConnectionConfirmsPayment') }}</p></div>
              <div v-else-if="selectedPaymentMethod === 'cash'" class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 class="font-bold text-emerald-950">{{ $t('common.payWithCash') }}</h3><p class="mt-2 text-sm leading-6 text-emerald-900">{{ $t('checkout.prepareTheOrderTotalForTheCourierTheOrderRemainsPaymentPendingUntilCollection') }}</p></div>
            </section>
          </template>
        </main>

        <aside class="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-40">
          <h2 class="text-xl font-bold text-slate-950">{{ $t('common.orderSummary') }}</h2>
          <div class="mt-4 max-h-64 space-y-3 overflow-y-auto pe-1">
            <article v-for="item in items" :key="item.cart_key" class="flex items-center gap-3"><div class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-2"><img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="size-full object-contain"></div><div class="min-w-0 flex-1"><p class="line-clamp-2 text-sm font-semibold text-slate-900">{{ quoteLine(item)?.title || item.title }}</p><p v-if="item.selling_mode === 'preorder'" class="text-xs font-bold text-amber-800">{{ $t('common.preOrderValue', { value0: ((quoteLine(item)?.paymentMode || item.preorder_payment_mode) === 'deposit' ? $t('preorder.depositPercent', { value0: (quoteLine(item)?.depositPercent ?? item.preorder_deposit_percent) }) : $t('common.fullPayment')) }) }}</p><p v-if="quoteLine(item)?.expectedAvailabilityDate || item.expected_availability_date" class="text-xs text-slate-600">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(quoteLine(item)?.expectedAvailabilityDate || item.expected_availability_date)) }) }}</p><p class="mt-1 text-xs text-slate-500">{{ $t('common.qtyValue', { value0: (item.quantity) }) }}</p></div><p class="text-sm font-semibold text-slate-900">{{ formatCurrency(quoteLine(item)?.total ?? item.price * item.quantity) }}</p></article>
          </div>
          <p v-if="quoteError" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ $uiMessage(quoteError) }}</p>
          <dl class="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm"><div class="flex justify-between gap-3 text-slate-600"><dt>{{ isPreorderCart ? $t('common.preorderMerchandise') : $t('common.subtotal') }}</dt><dd>{{ formatCurrency(quote?.orderValue ?? subtotal) }}</dd></div><div v-if="!isPreorderCart" class="flex justify-between gap-3 text-slate-600"><dt>{{ $t('common.coupon') }}</dt><dd>{{ appliedCoupon ? `- ${formatCurrency(discountAmount)}` : '—' }}</dd></div><div class="flex justify-between gap-3 text-slate-600"><dt>{{ $t('common.shipping') }}</dt><dd>{{ $t('common.calculatedLater') }}</dd></div><div v-if="paymentFee" class="flex justify-between gap-3 text-amber-700"><dt>{{ $t('common.paymentFee') }}</dt><dd>+ {{ formatCurrency(paymentFee) }}</dd></div><div class="flex justify-between gap-3 border-t border-slate-200 pt-3 text-lg font-bold text-slate-950"><dt>{{ $t('common.orderValueVariant4') }}</dt><dd>{{ formatCurrency(totalAmount) }}</dd></div><template v-if="isPreorderCart"><div class="flex justify-between gap-3 font-bold text-blue-800"><dt>{{ $t('common.requiredNow') }}</dt><dd>{{ formatCurrency(quote?.requiredNow || 0) }}</dd></div><div class="flex justify-between gap-3 text-slate-700"><dt>{{ $t('common.remainingAfterPayment') }}</dt><dd>{{ formatCurrency(quote?.remainingAfterPayment || 0) }}</dd></div><p class="text-xs text-slate-600">{{ $t('checkout.noPaymentIsRecordedUntilTheStoreVerifiesItDeliveryFollowsAvailability') }}</p></template></dl>
          <button v-if="checkoutStep === 'shipping'" type="button" class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700" @click="continueToPayment">{{ $t('common.continueToPayment') }}</button>
          <button v-else type="button" :disabled="placingOrder || !availablePaymentMethods.length" class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" @click="placeOrder">{{ placingOrder ? $t('common.confirming') : isPreorderCart ? $t('common.confirmPreOrder') : $t('common.confirmCheckout') }}</button>
          <p class="mt-3 text-center text-xs leading-5 text-slate-500">{{ $t('checkout.noCardNumberOrSecurityCodeIsStoredByThisCheckout') }}</p>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
const { uiLabel } = useUiLocale()

const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

const { intlLocale } = useUiLocale()

const { uiNavigateTo } = useUiNavigation()

import { egyptGovernorates } from '~/utils/egyptGovernorates'
import { getAvailablePaymentMethods, getPaymentMethodFee, paymentMethodNeedsProof } from '~/utils/paymentMethods'
import { expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'

definePageMeta({ middleware: 'customer-auth' })

const PHONE_PATTERN = /^01\d{9}$/
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { data: siteContent } = await useSiteContent()
const { data: paymentCapabilities } = await useFetch('/api/payments/capabilities')
const { items, cartId, itemCount, subtotal, isEmpty, appliedCoupon, clearCart, setAppliedCoupon, resetCoupon, loadCart } = useCart()
const { trackEvent } = useStoreAnalytics()

const checkoutStep = ref('shipping')
const loadingProfile = ref(false)
const applyingCoupon = ref(false)
const placingOrder = ref(false)
const couponCode = ref('')
const couponError = ref('')
const couponSuccess = ref('')
const orderError = ref('')
const selectedPaymentMethod = ref('')
const proofFile = ref(null)
const quote = ref(null)
const quoteError = ref('')
let checkoutStartedTracked = false

const address = reactive({ first_name: '', last_name: '', street_address: '', city: '', phone: '', email: '', governorate: '' })

const settings = computed(() => siteContent.value?.settings || {})
const isPreorderCart = computed(() => items.value.length > 0 && items.value.every(item => item.selling_mode === 'preorder'))
const availablePaymentMethods = computed(() => getAvailablePaymentMethods(settings.value).filter(method => (method.value !== 'card' || paymentCapabilities.value?.card?.available === true) && (!isPreorderCart.value || ['bank_transfer', 'instapay'].includes(method.value))))
const discountAmount = computed(() => Number(appliedCoupon.value?.discountAmount || 0))
const paymentFee = computed(() => isPreorderCart.value && quote.value ? Number(quote.value.paymentFee || 0) : getPaymentMethodFee(settings.value, selectedPaymentMethod.value))
const totalAmount = computed(() => Math.max(0, Number(quote.value?.orderValue ?? subtotal.value) - (isPreorderCart.value ? 0 : discountAmount.value) + paymentFee.value))
const quoteLine = item => quote.value?.lines?.find(line => line.productId === item.id && line.variantId === (item.variant_id || null))

const refreshQuote = async () => {
  if (!items.value.length) { quote.value = null; return false }
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) return false
    const previousQuote = quote.value
    const nextQuote = await $fetch('/api/checkout/quote', { method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}` }, body: {
      items: items.value.map(item => ({ id: item.id, variant_id: item.variant_id || null, quantity: item.quantity })),
      coupon_code: isPreorderCart.value ? '' : appliedCoupon.value?.code || '',
      payment_method: selectedPaymentMethod.value
    } })
    quote.value = nextQuote
    if (previousQuote && (previousQuote.orderValue !== nextQuote.orderValue || previousQuote.requiredNow !== nextQuote.requiredNow || JSON.stringify(previousQuote.lines) !== JSON.stringify(nextQuote.lines))) {
      quoteError.value = 'The current price or required payment changed. Review the updated summary, then continue.'
      return false
    }
    quoteError.value = ''
    return true
  } catch (error) {
    quoteError.value = error?.data?.statusMessage || 'Could not refresh current prices and availability.'
    return false
  }
}
const hasSavedAddress = computed(() => Boolean(address.street_address && address.city && address.governorate))
const paymentInstructions = computed(() => selectedPaymentMethod.value === 'bank_transfer' ? settings.value.payment_bank_transfer_instructions : settings.value.payment_instapay_instructions)

watch(availablePaymentMethods, methods => {
  if (!methods.some(method => method.value === selectedPaymentMethod.value)) selectedPaymentMethod.value = methods[0]?.value || ''
}, { immediate: true })
watch(selectedPaymentMethod, () => { if (checkoutStep.value === 'payment') refreshQuote() })

const formatCurrency = value => new Intl.NumberFormat(intlLocale.value, { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
const getMethodFee = method => getPaymentMethodFee(settings.value, method)

const splitFullName = (value = '') => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

const fillAddressFromProfile = profile => {
  const { firstName, lastName } = splitFullName(profile?.full_name)
  Object.assign(address, { first_name: firstName, last_name: lastName, street_address: profile?.address_line_1 || '', city: profile?.city || '', phone: profile?.phone || '', email: profile?.email || user.value?.email || '', governorate: profile?.state || '' })
}

const loadCustomerProfile = async () => {
  loadingProfile.value = true
  const customerUserId = user.value?.id || (await supabase.auth.getUser()).data.user?.id
  if (!customerUserId) { loadingProfile.value = false; orderError.value = 'Could not load the authenticated customer account.'; return }
  const { data, error } = await supabase.from('customer_profiles').select('*').eq('id', customerUserId).maybeSingle()
  loadingProfile.value = false
  if (error) { orderError.value = error.message; return }
  fillAddressFromProfile(data || {})
}

const validateAddress = () => {
  if (!address.first_name.trim()) return (orderError.value = 'First name is required.', false)
  if (!address.street_address.trim()) return (orderError.value = 'Street address is required.', false)
  if (!address.city.trim()) return (orderError.value = 'City is required.', false)
  if (!address.governorate.trim()) return (orderError.value = 'Governorate is required.', false)
  if (!PHONE_PATTERN.test(address.phone.trim())) return (orderError.value = 'Phone number must start with 01 and contain 11 digits.', false)
  return true
}

const continueToPayment = async () => {
  orderError.value = ''
  if (!validateAddress()) return
  if (!await refreshQuote()) return
  if (!availablePaymentMethods.value.length) { orderError.value = 'No payment method is available. Please contact the store.'; return }
  checkoutStep.value = 'payment'
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

const validatePayment = () => {
  if (!availablePaymentMethods.value.some(method => method.value === selectedPaymentMethod.value)) return 'Choose an available payment method.'
  return ''
}

const applyCoupon = async () => {
  couponError.value = ''; couponSuccess.value = ''
  if (!couponCode.value.trim()) { couponError.value = 'Enter a coupon code first.'; return }
  applyingCoupon.value = true
  try {
    const response = await $fetch('/api/checkout/coupon', { method: 'POST', body: { code: couponCode.value, subtotal: subtotal.value } })
    setAppliedCoupon(response.coupon); couponCode.value = response.coupon?.code || couponCode.value.trim().toUpperCase(); couponSuccess.value = 'Coupon applied.'
  } catch (error) { resetCoupon(); couponError.value = error?.data?.statusMessage || error?.message || 'Could not apply the coupon.' } finally { applyingCoupon.value = false }
}

const removeCoupon = () => { resetCoupon(); couponSuccess.value = ''; couponError.value = ''; couponCode.value = '' }

const placeOrder = async () => {
  orderError.value = ''
  if (!validateAddress()) { checkoutStep.value = 'shipping'; return }
  const paymentError = validatePayment()
  if (paymentError) { orderError.value = paymentError; return }
  if (!await refreshQuote()) return
  placingOrder.value = true
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session?.access_token) throw new Error('Your session expired. Please log in again.')
    const response = await $fetch('/api/checkout', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionData.session.access_token}` },
      body: {
        items: items.value.map(item => ({ id: item.id, variant_id: item.variant_id || null, quantity: item.quantity })),
        cart_id: cartId.value || null,
        coupon_code: appliedCoupon.value?.code || '',
        address: { ...address, email: address.email.trim() || user.value?.email || '' },
        shipping_method: 'shipping',
        payment_method: selectedPaymentMethod.value
      }
    })
    clearCart({ reason: 'converted', track: false })
    await uiNavigateTo(response.order.paymentMethod === 'card' ? `/checkout/payment/${response.order.id}` : `/checkout/summary/${response.order.id}`)
  } catch (error) { orderError.value = error?.data?.statusMessage || error?.message || 'Could not place the order.' } finally { placingOrder.value = false }
}

onMounted(async () => {
  loadCart(); couponCode.value = appliedCoupon.value?.code || ''
  if (isPreorderCart.value && appliedCoupon.value) resetCoupon()
  await refreshQuote()
  if (!checkoutStartedTracked && !isEmpty.value && cartId.value) { checkoutStartedTracked = true; trackEvent('checkout_started', { cartId: cartId.value, quantity: itemCount.value, source: 'checkout_page' }) }
  await loadCustomerProfile()
})

useHead(() => ({ title: uiLabel('Checkout') }))
</script>
