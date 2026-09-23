<template>
  <div class="min-h-[60vh] bg-slate-50 py-7 sm:py-10">
    <div class="store-container">
      <header class="mx-auto max-w-5xl">
        <button v-if="checkoutStep === 'payment'" type="button" class="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="checkoutStep = 'shipping'">
          <Icon name="lucide:arrow-left" size="17" aria-hidden="true" /> Back to delivery
        </button>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Secure checkout</p>
        <h1 class="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{{ checkoutStep === 'shipping' ? 'Delivery details' : 'Payment method' }}</h1>
        <p class="mt-2 text-sm text-slate-600">{{ checkoutStep === 'shipping' ? 'Tell us where to deliver your order.' : 'Choose how you would like to pay.' }}</p>

        <ol class="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Checkout progress">
          <li class="flex min-h-16 items-center gap-3 px-4 sm:px-6" :class="checkoutStep === 'shipping' ? 'bg-blue-50 text-blue-800' : 'text-emerald-700'">
            <span class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="checkoutStep === 'shipping' ? 'bg-blue-600 text-white' : 'bg-emerald-100'"><Icon v-if="checkoutStep === 'payment'" name="lucide:check" size="17" aria-hidden="true" /><span v-else>1</span></span>
            <span class="font-semibold">Delivery</span>
          </li>
          <li class="flex min-h-16 items-center gap-3 border-l border-slate-200 px-4 text-slate-500 sm:px-6" :class="checkoutStep === 'payment' ? 'bg-blue-50 !text-blue-800' : ''">
            <span class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="checkoutStep === 'payment' ? 'bg-blue-600 text-white' : 'bg-slate-100'">2</span>
            <span class="font-semibold">Payment</span>
          </li>
        </ol>
      </header>

      <div v-if="isEmpty" class="mx-auto mt-6 max-w-5xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p class="text-lg font-semibold text-slate-900">Your cart is empty.</p>
        <p class="mt-2 text-sm text-slate-600">Add products first, then return here to checkout.</p>
        <NuxtLink to="/cart" class="mt-5 inline-flex rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">Go to cart</NuxtLink>
      </div>

      <div v-else class="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <main class="min-w-0 space-y-5">
          <p v-if="orderError" role="alert" class="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{{ orderError }}</p>

          <template v-if="checkoutStep === 'shipping'">
            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="delivery-address-title">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><h2 id="delivery-address-title" class="text-xl font-bold text-slate-950">Shipping address</h2><p class="mt-1 text-sm text-slate-600">{{ hasSavedAddress ? 'Check your saved address.' : 'Enter your delivery address.' }}</p></div>
                <span v-if="loadingProfile" class="text-sm text-slate-500">Loading account…</span>
              </div>

              <div class="mt-5 grid gap-5 md:grid-cols-2">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">First name*</span><input v-model="address.first_name" autocomplete="given-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Last name</span><input v-model="address.last_name" autocomplete="family-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Street address*</span><input v-model="address.street_address" autocomplete="street-address" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">City*</span><input v-model="address.city" autocomplete="address-level2" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Governorate*</span><select v-model="address.governorate" autocomplete="address-level1" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"><option value="">Select governorate</option><option v-for="governorate in egyptGovernorates" :key="governorate" :value="governorate">{{ governorate }}</option></select></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Phone*</span><input v-model="address.phone" autocomplete="tel" inputmode="tel" type="tel" placeholder="01XXXXXXXXX" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"><span class="mt-2 block text-xs text-slate-500">11 digits, starting with 01.</span></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Email</span><input v-model="address.email" autocomplete="email" type="email" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
              </div>
            </section>

            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="coupon-title">
              <h2 id="coupon-title" class="text-xl font-bold text-slate-950">Coupon</h2>
              <p class="mt-1 text-sm text-slate-600">Apply a code before choosing payment.</p>
              <div class="mt-4 flex flex-col gap-3 sm:flex-row"><input v-model="couponCode" type="text" placeholder="Coupon code" class="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 uppercase outline-none focus:border-blue-600"><button type="button" :disabled="applyingCoupon" class="min-h-12 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" @click="applyCoupon">{{ applyingCoupon ? 'Applying…' : 'Apply' }}</button><button v-if="appliedCoupon" type="button" class="min-h-12 rounded-xl px-4 text-sm font-semibold text-red-700 hover:bg-red-50" @click="removeCoupon">Remove</button></div>
              <p v-if="couponError" class="mt-3 text-sm text-red-700">{{ couponError }}</p><p v-if="couponSuccess" class="mt-3 text-sm text-emerald-700">{{ couponSuccess }}</p>
            </section>
          </template>

          <template v-else>
            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-wide text-emerald-700">Delivery ready</p><h2 class="mt-1 text-lg font-bold text-slate-950">{{ address.first_name }} {{ address.last_name }}</h2><p class="mt-1 text-sm text-slate-600">{{ address.street_address }}, {{ address.city }}, {{ address.governorate }}</p></div><button type="button" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="checkoutStep = 'shipping'">Edit</button></div>
            </section>

            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="payment-method-title">
              <h2 id="payment-method-title" class="text-xl font-bold text-slate-950">Choose a payment method</h2>
              <p class="mt-1 text-sm text-slate-600">Only methods enabled by the store are shown.</p>

              <div v-if="availablePaymentMethods.length" class="mt-5 grid gap-3 sm:grid-cols-2">
                <label v-for="method in availablePaymentMethods" :key="method.value" class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition" :class="selectedPaymentMethod === method.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-blue-300'">
                  <input v-model="selectedPaymentMethod" type="radio" name="payment-method" :value="method.value" class="mt-1">
                  <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon :name="method.icon" size="21" aria-hidden="true" /></span>
                  <span class="min-w-0"><strong class="block text-sm text-slate-900">{{ method.label }}</strong><span class="mt-1 block text-xs leading-5 text-slate-600">{{ method.description }}</span><span v-if="getMethodFee(method.value)" class="mt-2 block text-xs font-semibold text-amber-700">+ {{ formatCurrency(getMethodFee(method.value)) }} fee</span></span>
                </label>
              </div>
              <p v-else class="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No payment method is available. Please contact the store.</p>

              <div v-if="selectedPaymentMethod === 'card'" class="mt-6 border-t border-slate-200 pt-6">
                <div class="flex flex-wrap items-end justify-between gap-3"><div><h3 class="font-bold text-slate-950">Saved cards</h3><p class="mt-1 text-sm text-slate-600">Illustrative previews until secure card vaulting is connected.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Preview only</span></div>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div v-for="savedCard in savedCardPreviews" :key="savedCard.lastFour" class="relative overflow-hidden rounded-2xl p-4 text-white shadow-sm" :class="savedCard.className"><div class="flex items-center justify-between"><Icon name="lucide:credit-card" size="22" aria-hidden="true" /><span class="text-xs font-bold uppercase tracking-wider">{{ savedCard.brand }}</span></div><p class="mt-8 font-mono text-lg tracking-[0.18em]">•••• {{ savedCard.lastFour }}</p><p class="mt-2 text-xs text-white/80">Illustrative saved card</p></div>
                </div>

                <h3 class="mt-6 font-bold text-slate-950">Use another card</h3>
                <div class="mt-4 grid gap-4 sm:grid-cols-2">
                  <label class="block sm:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Name on card</span><input v-model="card.cardholder" autocomplete="cc-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                  <label class="block sm:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Card number</span><div class="relative"><Icon name="lucide:credit-card" size="19" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input :value="card.number" autocomplete="cc-number" inputmode="numeric" type="text" placeholder="0000 0000 0000 0000" class="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-3 outline-none focus:border-blue-600" @input="updateCardNumber"></div></label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Expiry</span><input :value="card.expiry" autocomplete="cc-exp" inputmode="numeric" type="text" placeholder="MM/YY" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600" @input="updateCardExpiry"></label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Security code</span><input v-model="card.securityCode" autocomplete="cc-csc" inputmode="numeric" type="password" maxlength="4" placeholder="CVV" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                </div>
                <p class="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><Icon name="lucide:shield-check" size="16" class="mt-0.5 shrink-0" aria-hidden="true" /> Card values stay in this page only and are never sent to the current order API.</p>
              </div>

              <div v-else-if="paymentMethodNeedsProof(selectedPaymentMethod)" class="mt-6 space-y-4 border-t border-slate-200 pt-6">
                <div class="rounded-2xl bg-slate-50 p-5"><h3 class="font-bold text-slate-950">Transfer instructions</h3><p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{{ paymentInstructions || 'Contact the store for transfer details before sending payment.' }}</p></div>
                <PaymentProofUpload v-model="proofFile" backend-notice="Proof selection is available now. Secure submission will be activated with the payment backend; you can also return from My Account → Orders." />
                <p class="text-sm text-slate-600">You can confirm the order without proof and return later. The order will stay at payment pending until proof is submitted and reviewed.</p>
              </div>

              <div v-else-if="selectedPaymentMethod === 'paypal'" class="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 class="font-bold text-blue-950">PayPal</h3><p class="mt-2 text-sm leading-6 text-blue-900">Your order will remain payment pending until the PayPal connection confirms payment.</p></div>
              <div v-else-if="selectedPaymentMethod === 'cash'" class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 class="font-bold text-emerald-950">Pay with cash</h3><p class="mt-2 text-sm leading-6 text-emerald-900">Prepare the order total for the courier. The order remains payment pending until collection.</p></div>
            </section>
          </template>
        </main>

        <aside class="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-40">
          <h2 class="text-xl font-bold text-slate-950">Order summary</h2>
          <div class="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            <article v-for="item in items" :key="item.cart_key" class="flex items-center gap-3"><div class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-2"><img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="size-full object-contain"></div><div class="min-w-0 flex-1"><p class="line-clamp-2 text-sm font-semibold text-slate-900">{{ item.title }}</p><p class="mt-1 text-xs text-slate-500">Qty {{ item.quantity }}</p></div><p class="text-sm font-semibold text-slate-900">{{ formatCurrency(item.price * item.quantity) }}</p></article>
          </div>
          <dl class="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm"><div class="flex justify-between gap-3 text-slate-600"><dt>Subtotal</dt><dd>{{ formatCurrency(subtotal) }}</dd></div><div class="flex justify-between gap-3 text-slate-600"><dt>Coupon</dt><dd>{{ appliedCoupon ? `- ${formatCurrency(discountAmount)}` : '—' }}</dd></div><div class="flex justify-between gap-3 text-slate-600"><dt>Shipping</dt><dd>Calculated later</dd></div><div v-if="paymentFee" class="flex justify-between gap-3 text-amber-700"><dt>Payment fee</dt><dd>+ {{ formatCurrency(paymentFee) }}</dd></div><div class="flex justify-between gap-3 border-t border-slate-200 pt-3 text-lg font-bold text-slate-950"><dt>Estimated total</dt><dd>{{ formatCurrency(totalAmount) }}</dd></div></dl>
          <button v-if="checkoutStep === 'shipping'" type="button" class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700" @click="continueToPayment">Continue to payment</button>
          <button v-else type="button" :disabled="placingOrder || !availablePaymentMethods.length" class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" @click="placeOrder">{{ placingOrder ? 'Confirming…' : 'Confirm checkout' }}</button>
          <p class="mt-3 text-center text-xs leading-5 text-slate-500">No card number or security code is stored by this checkout.</p>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { egyptGovernorates } from '~/utils/egyptGovernorates'
import { formatCardNumber, getAvailablePaymentMethods, getPaymentMethodFee, paymentMethodNeedsProof, validatePaymentCard } from '~/utils/paymentMethods'

definePageMeta({ middleware: 'customer-auth' })

const PHONE_PATTERN = /^01\d{9}$/
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { data: siteContent } = await useSiteContent()
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
let checkoutStartedTracked = false

const address = reactive({ first_name: '', last_name: '', street_address: '', city: '', phone: '', email: '', governorate: '' })
const card = reactive({ cardholder: '', number: '', expiry: '', securityCode: '' })
const savedCardPreviews = [
  { brand: 'Visa', lastFour: '4242', className: 'bg-gradient-to-br from-blue-950 to-blue-600' },
  { brand: 'Mastercard', lastFour: '1881', className: 'bg-gradient-to-br from-slate-900 to-rose-700' }
]

const settings = computed(() => siteContent.value?.settings || {})
const availablePaymentMethods = computed(() => getAvailablePaymentMethods(settings.value))
const discountAmount = computed(() => Number(appliedCoupon.value?.discountAmount || 0))
const paymentFee = computed(() => getPaymentMethodFee(settings.value, selectedPaymentMethod.value))
const totalAmount = computed(() => Math.max(0, Number(subtotal.value || 0) - discountAmount.value + paymentFee.value))
const hasSavedAddress = computed(() => Boolean(address.street_address && address.city && address.governorate))
const paymentInstructions = computed(() => selectedPaymentMethod.value === 'bank_transfer' ? settings.value.payment_bank_transfer_instructions : settings.value.payment_instapay_instructions)

watch(availablePaymentMethods, methods => {
  if (!methods.some(method => method.value === selectedPaymentMethod.value)) selectedPaymentMethod.value = methods[0]?.value || ''
}, { immediate: true })

const formatCurrency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
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

const continueToPayment = () => {
  orderError.value = ''
  if (!validateAddress()) return
  if (!availablePaymentMethods.value.length) { orderError.value = 'No payment method is available. Please contact the store.'; return }
  checkoutStep.value = 'payment'
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

const updateCardNumber = event => { card.number = formatCardNumber(event.target.value) }
const updateCardExpiry = event => {
  const digits = String(event.target.value || '').replace(/\D/g, '').slice(0, 4)
  card.expiry = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

const validatePayment = () => {
  if (!availablePaymentMethods.value.some(method => method.value === selectedPaymentMethod.value)) return 'Choose an available payment method.'
  if (selectedPaymentMethod.value === 'card') return validatePaymentCard(card)
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
    await navigateTo(`/checkout/summary/${response.order.id}`)
  } catch (error) { orderError.value = error?.data?.statusMessage || error?.message || 'Could not place the order.' } finally { placingOrder.value = false }
}

onMounted(async () => {
  loadCart(); couponCode.value = appliedCoupon.value?.code || ''
  if (!checkoutStartedTracked && !isEmpty.value && cartId.value) { checkoutStartedTracked = true; trackEvent('checkout_started', { cartId: cartId.value, quantity: itemCount.value, source: 'checkout_page' }) }
  await loadCustomerProfile()
})

useHead({ title: 'Checkout' })
</script>
