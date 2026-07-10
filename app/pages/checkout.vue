<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          Checkout
        </p>

        <h1 class="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">
          Complete Your Order
        </h1>

        <p class="mt-2 text-sm text-gray-500">
          Confirm your address, apply a coupon if you have one, and review the final summary.
        </p>
      </div>

      <div
        v-if="isEmpty"
        class="mt-6 rounded-2xl bg-white p-8 text-center shadow"
      >
        <p class="text-lg font-semibold text-gray-900">
          Your cart is empty.
        </p>

        <p class="mt-2 text-sm text-gray-500">
          Add products first, then return here to complete checkout.
        </p>

        <NuxtLink
          to="/cart"
          class="mt-5 inline-flex rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Go to Cart
        </NuxtLink>
      </div>

      <div v-else class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section class="space-y-6">
          <div v-if="orderError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow">
            {{ orderError }}
          </div>

          <div v-if="orderSuccess" class="rounded-2xl bg-green-50 p-4 text-green-700 shadow">
            {{ orderSuccess }}
          </div>

          <section class="rounded-2xl bg-white p-6 shadow">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-2xl font-bold text-gray-900">
                  Delivery Address
                </h2>

                <p class="mt-1 text-sm text-gray-500">
                  {{ hasSavedAddress
                    ? 'Update the saved customer address before placing the order.'
                    : 'No saved address found. Fill in the address details below.' }}
                </p>
              </div>

              <div v-if="loadingProfile" class="text-sm text-gray-500">
                Loading account data...
              </div>
            </div>

            <div class="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">First Name*</label>
                <input
                  v-model="address.first_name"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Last Name</label>
                <input
                  v-model="address.last_name"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div class="md:col-span-2">
                <label class="mb-2 block text-sm font-semibold text-gray-700">Street Address*</label>
                <input
                  v-model="address.street_address"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">City*</label>
                <input
                  v-model="address.city"
                  type="text"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Governorate*</label>
                <select
                  v-model="address.governorate"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
                  <option value="">Select governorate</option>

                  <option
                    v-for="governorate in egyptGovernorates"
                    :key="governorate"
                    :value="governorate"
                  >
                    {{ governorate }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Phone*</label>
                <input
                  v-model="address.phone"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
                <p class="mt-2 text-xs text-gray-500">
                  Must start with `01` and contain exactly 11 numbers.
                </p>
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-700">Email</label>
                <input
                  v-model="address.email"
                  type="email"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                >
              </div>
            </div>
          </section>

          <section class="rounded-2xl bg-white p-6 shadow">
            <h2 class="text-2xl font-bold text-gray-900">
              Have a Coupon?
            </h2>

            <p class="mt-1 text-sm text-gray-500">
              Enter the code exactly as provided, then apply it before placing the order.
            </p>

            <div class="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                v-model="couponCode"
                type="text"
                placeholder="Coupon code"
                class="rounded-lg border p-3 uppercase outline-none focus:border-blue-500"
              >

              <button
                type="button"
                :disabled="applyingCoupon"
                class="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                @click="applyCoupon"
              >
                {{ applyingCoupon ? 'Applying...' : 'Apply Coupon' }}
              </button>

              <button
                v-if="appliedCoupon"
                type="button"
                class="rounded-lg bg-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                @click="removeCoupon"
              >
                Remove
              </button>
            </div>

            <p v-if="couponError" class="mt-3 text-sm text-red-600">
              {{ couponError }}
            </p>

            <p v-if="couponSuccess" class="mt-3 text-sm text-green-700">
              {{ couponSuccess }}
            </p>

            <div v-if="appliedCoupon" class="mt-4 rounded-2xl bg-gray-50 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="font-semibold text-gray-900">
                    {{ appliedCoupon.code }}
                  </p>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ appliedCoupon.description || 'Coupon applied successfully.' }}
                  </p>
                </div>

                <p class="text-lg font-bold text-green-700">
                  -{{ formatCurrency(appliedCoupon.discountAmount) }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-2xl bg-white p-6 shadow">
            <h2 class="text-2xl font-bold text-gray-900">
              Payment & Shipping Method
            </h2>

            <p class="mt-3 text-sm text-gray-500">
              This section is intentionally left blank for now and can be connected later.
            </p>
          </section>
        </section>

        <aside class="space-y-6">
          <section class="rounded-2xl bg-white p-5 shadow">
            <h2 class="text-2xl font-bold text-gray-900">
              Summary
            </h2>

            <div class="mt-5 space-y-4">
              <article
                v-for="item in items"
                :key="item.id"
                class="flex items-center gap-3 rounded-2xl border p-3"
              >
                <div class="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-50 p-2">
                  <img
                    v-if="item.image_url"
                    :src="item.image_url"
                    :alt="item.title"
                    class="h-full w-full object-contain"
                  >
                </div>

                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 font-semibold text-gray-900">
                    {{ item.title }}
                  </p>

                  <p class="mt-1 text-sm text-gray-500">
                    Qty {{ item.quantity }}
                  </p>
                </div>

                <p class="text-sm font-semibold text-gray-900">
                  {{ formatCurrency(item.price * item.quantity) }}
                </p>
              </article>
            </div>

            <div class="mt-6 space-y-3 border-t pt-4">
              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{{ formatCurrency(subtotal) }}</span>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>Coupon</span>
                <span>{{ appliedCoupon ? `- ${formatCurrency(discountAmount)}` : 'No coupon' }}</span>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>Shipping</span>
                <span>To be added</span>
              </div>

              <div class="flex items-center justify-between border-t pt-3 text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{{ formatCurrency(totalAmount) }}</span>
              </div>
            </div>

            <button
              type="button"
              :disabled="placingOrder"
              class="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              @click="placeOrder"
            >
              {{ placingOrder ? 'Placing Order...' : 'Place Order' }}
            </button>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { egyptGovernorates } from '~/utils/egyptGovernorates'

definePageMeta({
  middleware: 'customer-auth'
})

const PHONE_PATTERN = /^01\d{9}$/

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const {
  items,
  subtotal,
  isEmpty,
  appliedCoupon,
  clearCart,
  setAppliedCoupon,
  resetCoupon,
  loadCart
} = useCart()

const loadingProfile = ref(false)
const applyingCoupon = ref(false)
const placingOrder = ref(false)
const couponCode = ref('')
const couponError = ref('')
const couponSuccess = ref('')
const orderError = ref('')
const orderSuccess = ref('')
const address = reactive({
  first_name: '',
  last_name: '',
  street_address: '',
  city: '',
  phone: '',
  email: '',
  governorate: ''
})

const splitFullName = (value = '') => {
  const nameParts = String(value || '').trim().split(/\s+/).filter(Boolean)

  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ')
  }
}

const hasSavedAddress = computed(() => {
  return Boolean(address.street_address && address.city && address.governorate)
})

const discountAmount = computed(() => {
  return Number(appliedCoupon.value?.discountAmount || 0)
})

const totalAmount = computed(() => {
  return Math.max(0, Number(subtotal.value || 0) - discountAmount.value)
})

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const fillAddressFromProfile = (profile) => {
  const { firstName, lastName } = splitFullName(profile?.full_name || '')

  address.first_name = firstName
  address.last_name = lastName
  address.street_address = profile?.address_line_1 || ''
  address.city = profile?.city || ''
  address.phone = profile?.phone || ''
  address.email = profile?.email || user.value?.email || ''
  address.governorate = profile?.state || ''
}

const loadCustomerProfile = async () => {
  loadingProfile.value = true

  const customerUserId = user.value?.id || (await supabase.auth.getUser()).data.user?.id

  if (!customerUserId) {
    loadingProfile.value = false
    orderError.value = 'Could not load the authenticated customer account.'
    return
  }

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', customerUserId)
    .maybeSingle()

  loadingProfile.value = false

  if (error) {
    orderError.value = error.message
    return
  }

  fillAddressFromProfile(data || {})
}

const validateAddress = () => {
  if (!address.first_name.trim()) {
    orderError.value = 'First name is required.'
    return false
  }

  if (!address.street_address.trim()) {
    orderError.value = 'Street address is required.'
    return false
  }

  if (!address.city.trim()) {
    orderError.value = 'City is required.'
    return false
  }

  if (!address.governorate.trim()) {
    orderError.value = 'Governorate is required.'
    return false
  }

  if (!PHONE_PATTERN.test(address.phone.trim())) {
    orderError.value = 'Phone number must start with 01 and contain 11 digits.'
    return false
  }

  return true
}

const applyCoupon = async () => {
  couponError.value = ''
  couponSuccess.value = ''

  if (!couponCode.value.trim()) {
    couponError.value = 'Enter a coupon code first.'
    return
  }

  applyingCoupon.value = true

  try {
    const response = await $fetch('/api/checkout/coupon', {
      method: 'POST',
      body: {
        code: couponCode.value,
        subtotal: subtotal.value
      }
    })

    setAppliedCoupon(response.coupon)
    couponCode.value = response.coupon?.code || couponCode.value.trim().toUpperCase()
    couponSuccess.value = 'Coupon applied successfully.'
  } catch (error) {
    resetCoupon()
    couponError.value = error?.data?.statusMessage || error?.message || 'Could not apply the coupon.'
  } finally {
    applyingCoupon.value = false
  }
}

const removeCoupon = () => {
  resetCoupon()
  couponSuccess.value = ''
  couponError.value = ''
  couponCode.value = ''
}

const placeOrder = async () => {
  orderError.value = ''
  orderSuccess.value = ''

  if (!validateAddress()) {
    return
  }

  placingOrder.value = true

  try {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session?.access_token) {
      throw new Error('Your session expired. Please log in again.')
    }

    const response = await $fetch('/api/checkout', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: {
        items: items.value.map((item) => ({
          id: item.id,
          quantity: item.quantity
        })),
        coupon_code: appliedCoupon.value?.code || '',
        address: {
          ...address,
          email: address.email.trim() || user.value?.email || ''
        },
        shipping_method: null,
        payment_method: null
      }
    })

    orderSuccess.value = `Order ${response.order.orderNumber} created successfully.`
    clearCart()
    await navigateTo(`/checkout/summary/${response.order.id}`)
  } catch (error) {
    orderError.value = error?.data?.statusMessage || error?.message || 'Could not place the order.'
  } finally {
    placingOrder.value = false
  }
}

onMounted(async () => {
  loadCart()
  couponCode.value = appliedCoupon.value?.code || ''
  await loadCustomerProfile()
})

useHead({
  title: 'Checkout'
})
</script>
