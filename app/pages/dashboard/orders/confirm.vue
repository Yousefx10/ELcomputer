<template>
  <div>
    <div class="mx-auto max-w-[1400px] space-y-6">
      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
              Packaging table
            </p>
            <h1 class="mt-2 text-4xl font-bold text-gray-900">
              Confirm Orders
            </h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Claim an order, scan every requested item, then print its customer bill and shipping paper.
            </p>
          </div>

          <NuxtLink
            to="/dashboard/orders"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <Icon name="lucide:arrow-left" size="17" />
            Orders
          </NuxtLink>
        </div>
      </section>

      <DashboardSecondaryNav :items="secondaryNavItems" />

      <div
        v-if="pageError"
        class="flex items-start justify-between gap-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 shadow"
        role="alert"
      >
        <p>{{ pageError }}</p>
        <button
          type="button"
          aria-label="Dismiss error"
          class="shrink-0 rounded-lg p-1 hover:bg-red-100"
          @click="pageError = ''"
        >
          <Icon name="lucide:x" size="17" />
        </button>
      </div>

      <div class="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside class="rounded-2xl bg-white p-5 shadow xl:sticky xl:top-6">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-gray-900">Confirmation queue</h2>
              <p class="mt-1 text-xs text-gray-500">Oldest request first</p>
            </div>

            <button
              type="button"
              :disabled="queueLoading"
              aria-label="Refresh confirmation queue"
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
              @click="loadQueue({ preserveSelection: true })"
            >
              <Icon
                name="lucide:refresh-cw"
                size="17"
                :class="queueLoading ? 'animate-spin' : ''"
              />
            </button>
          </div>

          <div class="mt-4 rounded-xl bg-gray-950 px-4 py-3 text-white">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Waiting</p>
            <p class="mt-1 text-3xl font-bold">{{ queueTotal }}</p>
            <p v-if="queueTotal > queueOrders.length" class="mt-1 text-xs text-gray-400">
              Showing the oldest {{ queueOrders.length }}
            </p>
          </div>

          <div v-if="queueLoading && !queueOrders.length" class="py-12 text-center text-sm text-gray-500">
            Loading orders...
          </div>

          <div v-else-if="!queueOrders.length" class="py-12 text-center">
            <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-green-50 text-green-700">
              <Icon name="lucide:package-check" size="24" />
            </span>
            <p class="mt-4 font-bold text-gray-900">Queue is clear</p>
            <p class="mt-1 text-sm text-gray-500">There are no orders waiting for confirmation.</p>
          </div>

          <div v-else class="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pe-1">
            <button
              v-for="queueOrder in queueOrders"
              :key="queueOrder.id"
              type="button"
              :disabled="isQueueOrderLocked(queueOrder) || claimLoading"
              class="w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed"
              :class="[
                selectedOrderId === queueOrder.id
                  ? 'border-black bg-gray-950 text-white'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50',
                isQueueOrderLocked(queueOrder) ? 'opacity-65' : ''
              ]"
              @click="openQueueOrder(queueOrder)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-bold">
                    {{ getOrderNumber(queueOrder) }}
                  </p>
                  <p
                    class="mt-1 truncate text-sm"
                    :class="selectedOrderId === queueOrder.id ? 'text-gray-300' : 'text-gray-500'"
                  >
                    {{ getCustomerName(queueOrder) }}
                  </p>
                </div>
                <Icon
                  :name="getQueueSession(queueOrder) ? 'lucide:package-open' : 'lucide:chevron-right'"
                  size="18"
                  class="mt-1 shrink-0"
                />
              </div>

              <div
                class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                :class="selectedOrderId === queueOrder.id ? 'text-gray-300' : 'text-gray-500'"
              >
                <span>{{ formatDate(queueOrder.created_at, false) }}</span>
                <span>{{ Number(queueOrder.item_quantity || queueOrder.total_quantity || 0) }} items</span>
              </div>

              <p
                v-if="getQueueSession(queueOrder)"
                class="mt-3 rounded-lg px-3 py-2 text-xs font-semibold"
                :class="isQueueOrderLocked(queueOrder)
                  ? 'bg-amber-100 text-amber-800'
                  : selectedOrderId === queueOrder.id
                    ? 'bg-white/10 text-white'
                    : 'bg-blue-50 text-blue-700'"
              >
                {{ isQueueOrderLocked(queueOrder)
                  ? `Being packed by ${getQueueProcessorName(queueOrder)}`
                  : 'Resume your packing session' }}
              </p>
            </button>
          </div>
        </aside>

        <main class="min-w-0">
          <section
            v-if="detailLoading"
            class="rounded-2xl bg-white p-12 text-center text-gray-500 shadow"
          >
            <Icon name="lucide:loader-circle" size="30" class="mx-auto animate-spin" />
            <p class="mt-4">Opening the packaging table...</p>
          </section>

          <section
            v-else-if="!packingDetail"
            class="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow"
          >
            <span class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gray-100 text-gray-500">
              <Icon name="lucide:scan-barcode" size="32" />
            </span>
            <h2 class="mt-5 text-2xl font-bold text-gray-900">Choose an order to begin</h2>
            <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Claiming an order records who is preparing it and prevents another administrator from packing it at the same time.
            </p>
          </section>

          <div v-else class="space-y-6">
            <section class="overflow-hidden rounded-2xl bg-white shadow">
              <div class="bg-gray-950 p-6 text-white">
                <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p class="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
                      {{ sessionCompleted ? 'Confirmation complete' : 'Active packaging session' }}
                    </p>
                    <h2 class="mt-2 text-3xl font-bold">{{ getOrderNumber(orderDetail) }}</h2>
                    <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                      <span>{{ getCustomerName(orderDetail) }}</span>
                      <span>Started {{ formatDate(sessionDetail.started_at) }}</span>
                      <span>by {{ sessionDetail.processor_name || sessionDetail.admin_name || 'Admin' }}</span>
                    </div>
                  </div>

                  <div class="w-full rounded-2xl bg-white/10 p-4 lg:max-w-xs">
                    <div class="flex items-end justify-between gap-4">
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Scanned</p>
                        <p class="mt-1 text-3xl font-bold">
                          {{ progress.scanned }} / {{ progress.required }}
                        </p>
                      </div>
                      <p class="text-lg font-bold">{{ progress.percentage }}%</p>
                    </div>
                    <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        :class="allItemsPacked ? 'bg-green-400' : 'bg-blue-400'"
                        :style="{ width: `${progress.percentage}%` }"
                      />
                    </div>
                    <button
                      v-if="!sessionCompleted"
                      type="button"
                      :disabled="releaseLoading"
                      class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
                      @click="releasePackingSession"
                    >
                      <Icon
                        :name="releaseLoading ? 'lucide:loader-circle' : 'lucide:lock-open'"
                        size="14"
                        :class="releaseLoading ? 'animate-spin' : ''"
                      />
                      {{ releaseLoading ? 'Releasing...' : 'Release order' }}
                    </button>
                  </div>
                </div>
              </div>

              <div
                v-if="sessionCompleted"
                class="border-b border-green-200 bg-green-50 p-5 text-green-800"
              >
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex items-start gap-3">
                    <Icon name="lucide:circle-check-big" size="24" class="mt-0.5 shrink-0" />
                    <div>
                      <p class="font-bold">Order confirmed and ready for its next step.</p>
                      <p class="mt-1 text-sm">
                        Status: {{ formatCustomerOrderStatus(orderDetail.status) }}
                        <span v-if="sessionDetail.completed_at">
                          · {{ formatDate(sessionDetail.completed_at) }}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center gap-2 rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-100"
                      @click="printDocuments()"
                    >
                      <Icon name="lucide:printer" size="17" />
                      Print again
                    </button>
                    <button
                      type="button"
                      :disabled="claimLoading"
                      class="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50"
                      @click="continueToNextOrder"
                    >
                      Next order
                      <Icon name="lucide:arrow-right" size="17" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="grid gap-px bg-gray-200 md:grid-cols-3">
                <div class="bg-white p-5">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Purchaser</p>
                  <p class="mt-3 font-bold text-gray-900">{{ getCustomerName(orderDetail) }}</p>
                  <p class="mt-1 break-all text-sm text-gray-500">
                    {{ orderDetail.email || customerDetail.email || 'No email saved' }}
                  </p>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ orderDetail.phone || customerDetail.phone || 'No phone saved' }}
                  </p>
                </div>

                <div class="bg-white p-5">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Delivery address</p>
                  <p class="mt-3 text-sm font-semibold leading-6 text-gray-900">
                    {{ orderDetail.street_address || customerDetail.address_line_1 || 'No address saved' }}
                  </p>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ [orderDetail.city || customerDetail.city, orderDetail.governorate || customerDetail.state].filter(Boolean).join(', ') || 'City not saved' }}
                  </p>
                  <p v-if="customerDetail.country || orderDetail.governorate" class="mt-1 text-sm text-gray-500">
                    {{ customerDetail.country || 'Egypt' }}
                  </p>
                </div>

                <div class="bg-white p-5">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Order details</p>
                  <dl class="mt-3 space-y-2 text-sm">
                    <div class="flex justify-between gap-3">
                      <dt class="text-gray-500">Placed</dt>
                      <dd class="text-right font-semibold text-gray-900">{{ formatDate(orderDetail.created_at, false) }}</dd>
                    </div>
                    <div class="flex justify-between gap-3">
                      <dt class="text-gray-500">Payment</dt>
                      <dd class="text-right font-semibold text-gray-900">{{ orderDetail.payment_method || 'Not selected' }}</dd>
                    </div>
                    <div class="flex justify-between gap-3">
                      <dt class="text-gray-500">Shipping</dt>
                      <dd class="text-right font-semibold text-gray-900">{{ orderDetail.shipping_method || 'Not selected' }}</dd>
                    </div>
                    <div class="flex justify-between gap-3">
                      <dt class="text-gray-500">Total</dt>
                      <dd class="text-right font-bold text-gray-900">{{ formatCurrency(orderDetail.total_amount) }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>

            <section
              v-if="!sessionCompleted"
              class="rounded-2xl bg-white p-6 shadow"
            >
              <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <Icon name="lucide:scan-line" size="25" class="text-blue-600" />
                    Scan prepared item
                  </h3>
                  <p class="mt-2 max-w-2xl text-sm text-gray-500">
                    Scan an assigned unit QR/code, variant SKU, or product SKU. The field is re-focused after every attempt.
                  </p>
                </div>
                <p
                  class="rounded-full px-3 py-1 text-xs font-bold"
                  :class="allItemsPacked ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'"
                >
                  {{ allItemsPacked ? 'All items prepared' : `${progress.remaining} remaining` }}
                </p>
              </div>

              <form class="mt-5" @submit.prevent="scanItem">
                <label for="packing-scan-code" class="mb-2 block text-sm font-bold text-gray-700">
                  Item code
                </label>
                <div class="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="packing-scan-code"
                    ref="scanInputElement"
                    v-model="scanCode"
                    type="text"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    autofocus
                    placeholder="Scan SKU, unit code, or QR"
                    class="min-w-0 flex-1 rounded-xl border border-gray-300 p-4 font-mono text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    @focus="$event.currentTarget.select()"
                  >
                  <button
                    type="submit"
                    :disabled="scanLoading || !scanCode.trim() || allItemsPacked"
                    class="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon
                      :name="scanLoading ? 'lucide:loader-circle' : 'lucide:scan-barcode'"
                      size="19"
                      :class="scanLoading ? 'animate-spin' : ''"
                    />
                    {{ scanLoading ? 'Checking...' : 'Confirm scan' }}
                  </button>
                </div>
              </form>

              <div
                v-if="scanFeedback.message"
                class="mt-4 flex items-start gap-3 rounded-xl p-4 text-sm"
                :class="scanFeedback.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-700'"
                :role="scanFeedback.type === 'success' ? 'status' : 'alert'"
              >
                <Icon
                  :name="scanFeedback.type === 'success' ? 'lucide:circle-check' : 'lucide:circle-x'"
                  size="19"
                  class="mt-0.5 shrink-0"
                />
                <p>{{ scanFeedback.message }}</p>
              </div>
            </section>

            <section class="rounded-2xl bg-white p-6 shadow">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 class="text-2xl font-bold text-gray-900">Requested items</h3>
                  <p class="mt-1 text-sm text-gray-500">
                    Every unit must be selected before this order can be completed.
                  </p>
                </div>
                <p class="text-sm font-bold text-gray-600">
                  {{ completedLineCount }} / {{ orderItems.length }} lines complete
                </p>
              </div>

              <div v-if="!orderItems.length" class="py-10 text-center text-sm text-gray-500">
                This order has no saved items and cannot be confirmed.
              </div>

              <div v-else class="mt-5 space-y-4">
                <article
                  v-for="item in orderItems"
                  :key="item.id"
                  class="rounded-2xl border p-4 transition"
                  :class="isItemPacked(item)
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white'"
                >
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white p-2">
                      <img
                        v-if="item.image_url"
                        :src="item.image_url"
                        :alt="item.product_title || 'Product'"
                        class="h-full w-full object-contain"
                      >
                      <Icon v-else name="lucide:package" size="28" class="text-gray-300" />
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="font-bold text-gray-900">{{ item.product_title || 'Product' }}</p>
                          <p v-if="item.variant_name || item.variant_color_name" class="mt-1 text-sm text-gray-600">
                            {{ item.variant_name || item.variant_color_name }}
                          </p>
                          <p class="mt-2 break-all font-mono text-xs font-semibold text-gray-500">
                            SKU: {{ getItemSku(item) }}
                          </p>
                        </div>

                        <span
                          class="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
                          :class="isItemPacked(item)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700'"
                        >
                          <Icon
                            :name="isItemPacked(item) ? 'lucide:check' : 'lucide:scan-line'"
                            size="14"
                          />
                          {{ getScannedQuantity(item) }} / {{ Number(item.quantity || 0) }}
                        </span>
                      </div>

                      <div
                        v-if="item.serialized_units?.length"
                        class="mt-3 flex flex-wrap gap-2"
                      >
                        <span
                          v-for="unit in item.serialized_units"
                          :key="unit.id"
                          class="rounded-lg border px-2.5 py-1 font-mono text-xs"
                          :class="isSerializedUnitScanned(item, unit)
                            ? 'border-green-300 bg-green-100 text-green-800'
                            : 'border-gray-200 bg-white text-gray-500'"
                        >
                          <Icon
                            :name="isSerializedUnitScanned(item, unit) ? 'lucide:check' : 'lucide:box'"
                            size="12"
                            class="me-1 inline"
                          />
                          {{ unit.unit_code }}
                        </span>
                      </div>

                      <div v-else-if="item.scans?.length" class="mt-3 flex flex-wrap gap-2">
                        <span
                          v-for="scan in item.scans"
                          :key="scan.id"
                          class="rounded-lg bg-green-100 px-2.5 py-1 font-mono text-xs text-green-800"
                        >
                          <Icon name="lucide:check" size="12" class="me-1 inline" />
                          {{ scan.scanned_code || scan.scan_code || getItemSku(item) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section
              v-if="!sessionCompleted"
              class="rounded-2xl bg-white p-6 shadow"
            >
              <div class="flex items-start gap-3">
                <span
                  class="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  :class="allItemsPacked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  <Icon name="lucide:clipboard-check" size="22" />
                </span>
                <div>
                  <h3 class="text-2xl font-bold text-gray-900">Complete order</h3>
                  <p class="mt-1 text-sm text-gray-500">
                    Completion updates the order, records you as its processor, and opens both print documents.
                  </p>
                </div>
              </div>

              <div class="mt-6 grid gap-5 lg:grid-cols-2">
                <div>
                  <label for="completed-order-status" class="mb-2 block text-sm font-bold text-gray-700">
                    New order status
                  </label>
                  <select
                    id="completed-order-status"
                    v-model="completionStatus"
                    class="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-blue-500"
                  >
                    <option
                      v-for="statusOption in completionStatusOptions"
                      :key="statusOption.value"
                      :value="statusOption.value"
                    >
                      {{ statusOption.label }}
                    </option>
                  </select>
                  <p class="mt-2 text-xs text-gray-500">
                    Ready to Deliver is selected by default.
                  </p>
                </div>

                <div>
                  <label for="purchaser-message" class="mb-2 block text-sm font-bold text-gray-700">
                    Message to purchaser <span class="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    id="purchaser-message"
                    v-model="purchaserMessage"
                    rows="4"
                    maxlength="2000"
                    :disabled="!orderDetail.user_id"
                    :placeholder="orderDetail.user_id
                      ? 'Your order has been prepared and is ready for delivery.'
                      : 'Guest order — no customer account inbox'"
                    class="w-full rounded-xl border border-gray-300 p-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <div class="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span>
                      {{ orderDetail.user_id
                        ? 'The message will appear in the customer account inbox.'
                        : 'This purchaser does not have a linked account.' }}
                    </span>
                    <span>{{ purchaserMessage.length }} / 2000</span>
                  </div>
                </div>
              </div>

              <div class="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p
                  class="text-sm font-semibold"
                  :class="allItemsPacked ? 'text-green-700' : 'text-amber-700'"
                >
                  {{ allItemsPacked
                    ? 'All requested quantities are confirmed.'
                    : `Scan ${progress.remaining} more ${progress.remaining === 1 ? 'item' : 'items'} to continue.` }}
                </p>

                <button
                  type="button"
                  :disabled="completionLoading || !allItemsPacked || !orderItems.length"
                  class="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="completePacking"
                >
                  <Icon
                    :name="completionLoading ? 'lucide:loader-circle' : 'lucide:printer-check'"
                    size="19"
                    :class="completionLoading ? 'animate-spin' : ''"
                  />
                  {{ completionLoading ? 'Completing...' : 'Complete & Print' }}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { buildDashboardOverviewLinks } from '~/utils/dashboardOverviewLinks'
import { buildOrderPackingDocumentsHtml } from '~/utils/orderPackingPrint'
import { formatCustomerOrderStatus } from '~/utils/orderStatus'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()
const { hasPermission } = useAdminAccess()

const queueOrders = ref([])
const queueTotal = ref(0)
const queueLoading = ref(false)
const claimLoading = ref(false)
const detailLoading = ref(false)
const scanLoading = ref(false)
const completionLoading = ref(false)
const releaseLoading = ref(false)
const pageError = ref('')
const packingDetail = ref(null)
const selectedOrderId = ref('')
const scanCode = ref('')
const scanInputElement = ref(null)
const scanFeedback = reactive({
  type: '',
  message: ''
})
const completionStatus = ref('ready_to_deliver')
const purchaserMessage = ref('')

const canSeeAnalysis = computed(() => hasPermission('dashboard.analysis'))
const canSeeOrders = computed(() => hasPermission('dashboard.orders'))
const secondaryNavItems = computed(() => buildDashboardOverviewLinks('orders', {
  canSeeAnalysis: canSeeAnalysis.value,
  canSeeOrders: canSeeOrders.value
}))

const completionStatusOptions = [
  { value: 'ready_to_deliver', label: 'Ready to Deliver' },
  { value: 'being_shipped', label: 'Being Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'on_hold', label: 'On Hold' }
]

const sessionDetail = computed(() => packingDetail.value?.session || {})
const orderDetail = computed(() => packingDetail.value?.order || {})
const customerDetail = computed(() => packingDetail.value?.customer || {})
const orderItems = computed(() => packingDetail.value?.items || [])
const sessionCompleted = computed(() => sessionDetail.value.status === 'completed')

const getScannedQuantity = (item) => {
  if (Number.isFinite(Number(item?.scanned_quantity))) {
    return Number(item.scanned_quantity)
  }

  return Array.isArray(item?.scans) ? item.scans.length : 0
}

const isItemPacked = (item) => {
  return getScannedQuantity(item) === Number(item?.quantity || 0)
}

const completedLineCount = computed(() => {
  return orderItems.value.filter(isItemPacked).length
})

const allItemsPacked = computed(() => {
  return Boolean(orderItems.value.length)
    && orderItems.value.every(isItemPacked)
})

const progress = computed(() => {
  const required = orderItems.value.reduce((total, item) => {
    return total + Number(item.quantity || 0)
  }, 0)
  const scanned = orderItems.value.reduce((total, item) => {
    return total + getScannedQuantity(item)
  }, 0)

  return {
    required,
    scanned,
    remaining: Math.max(0, required - scanned),
    percentage: required ? Math.min(100, Math.round((scanned / required) * 100)) : 0
  }
})

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const getOrderNumber = (order = {}) => {
  return order.order_number || `Order #${String(order.id || '').slice(0, 8)}`
}

const getCustomerName = (order = {}) => {
  return `${order.first_name || 'Customer'} ${order.last_name || ''}`.trim()
}

const getQueueSession = (order = {}) => {
  return order.active_session || order.activeSession || order.session || null
}

const getQueueProcessorName = (order = {}) => {
  const session = getQueueSession(order)
  return session?.processor_name
    || session?.admin_name
    || session?.processor?.name
    || 'another administrator'
}

const canResumeQueueOrder = (order = {}) => {
  const session = getQueueSession(order)

  if (!session) {
    return false
  }

  return Boolean(
    order.can_resume
    || session.can_resume
    || session.is_current_admin
    || session.isCurrentAdmin
  )
}

const isQueueOrderLocked = (order = {}) => {
  return Boolean(getQueueSession(order)) && !canResumeQueueOrder(order)
}

const getItemSku = (item = {}) => {
  return item.variant_sku
    || item.product_sku
    || item.variant_code
    || 'No scannable SKU'
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(orderDetail.value.currency || 'EGP').toUpperCase(),
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value, includeTime = true) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }
  ).format(new Date(value))
}

const setSessionRouteQuery = async (sessionId = '') => {
  const nextQuery = { ...route.query }

  if (sessionId) {
    nextQuery.session = sessionId
  } else {
    delete nextQuery.session
  }

  await router.replace({
    path: route.path,
    query: nextQuery
  })
}

const normalizePackingResponse = (response) => {
  if (response?.detail && typeof response.detail === 'object') {
    return response.detail
  }

  if (response?.data && typeof response.data === 'object') {
    return response.data
  }

  return response || null
}

const applyPackingDetail = (response) => {
  const detail = normalizePackingResponse(response)

  if (!detail?.session?.id) {
    throw new Error('The packing session returned an incomplete record.')
  }

  packingDetail.value = detail
  selectedOrderId.value = detail.order?.id || ''
}

const focusScanner = async () => {
  if (sessionCompleted.value) {
    return
  }

  await nextTick()
  scanInputElement.value?.focus()
  scanInputElement.value?.select()
}

const loadQueue = async ({
  preserveSelection = false,
  preserveError = false
} = {}) => {
  queueLoading.value = true

  if (!preserveError) {
    pageError.value = ''
  }

  try {
    const response = await $fetch('/api/admin-orders/packing', {
      query: {
        pageSize: 50
      },
      headers: await getAuthHeaders()
    })
    queueOrders.value = response.orders || response.items || []
    queueTotal.value = Number(response.total || queueOrders.value.length)

    if (!preserveSelection && response.currentSessionId && !route.query.session) {
      await loadPackingSession(response.currentSessionId)
    }

    return response
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not load the confirmation queue.'
    return null
  } finally {
    queueLoading.value = false
  }
}

const loadPackingSession = async (sessionId, { updateRoute = true } = {}) => {
  if (!sessionId) {
    return
  }

  detailLoading.value = true
  pageError.value = ''
  scanFeedback.type = ''
  scanFeedback.message = ''

  let sessionLoaded = false

  try {
    const response = await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionId)}`, {
      headers: await getAuthHeaders()
    })
    applyPackingDetail(response)
    completionStatus.value = sessionCompleted.value
      ? orderDetail.value.status || 'ready_to_deliver'
      : 'ready_to_deliver'
    purchaserMessage.value = ''
    sessionLoaded = true

    if (updateRoute) {
      await setSessionRouteQuery(sessionId)
    }
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not open this packing session.'
  } finally {
    detailLoading.value = false
  }

  if (sessionLoaded) {
    await focusScanner()
  }
}

const openQueueOrder = async (queueOrder) => {
  if (!queueOrder?.id || isQueueOrderLocked(queueOrder)) {
    return
  }

  const existingSession = getQueueSession(queueOrder)

  if (existingSession?.id) {
    await loadPackingSession(existingSession.id)
    return
  }

  claimLoading.value = true
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-orders/packing', {
      method: 'POST',
      body: {
        orderId: queueOrder.id
      },
      headers: await getAuthHeaders()
    })
    const sessionId = response?.session?.id
      || response?.detail?.session?.id
      || response?.sessionId

    if (response?.detail?.session?.id || response?.data?.session?.id) {
      applyPackingDetail(response)
      await setSessionRouteQuery(sessionDetail.value.id)
      await focusScanner()
    } else if (sessionId) {
      await loadPackingSession(sessionId)
    } else {
      throw new Error('The order was claimed without returning a packing session.')
    }

    await loadQueue({ preserveSelection: true })
  } catch (error) {
    const claimError = error?.data?.statusMessage || error?.message || 'Could not start packing this order.'
    await loadQueue({ preserveSelection: true })
    pageError.value = claimError
  } finally {
    claimLoading.value = false
  }
}

const scanItem = async () => {
  const code = scanCode.value.trim()

  if (!code || !sessionDetail.value.id || scanLoading.value || allItemsPacked.value) {
    return
  }

  scanLoading.value = true
  pageError.value = ''
  scanFeedback.type = ''
  scanFeedback.message = ''

  try {
    const response = await $fetch(
      `/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/scan`,
      {
        method: 'POST',
        body: { code },
        headers: await getAuthHeaders()
      }
    )
    applyPackingDetail(response)
    const lastScan = response?.lastScan || response?.data?.lastScan
    scanFeedback.type = 'success'
    scanFeedback.message = lastScan?.message
      || `${lastScan?.product_title || 'Item'} scanned successfully.`
    scanCode.value = ''
  } catch (error) {
    scanFeedback.type = 'error'
    scanFeedback.message = error?.data?.statusMessage || error?.message || 'This item could not be confirmed.'
  } finally {
    scanLoading.value = false
    await focusScanner()
  }
}

const isSerializedUnitScanned = (item, unit) => {
  return (item?.scans || []).some((scan) => {
    return String(scan.serialized_unit_id || '') === String(unit.id || '')
      || String(scan.scanned_code || scan.scan_code || '').toLowerCase() === String(unit.unit_code || '').toLowerCase()
  })
}

const getPrintableSiteName = () => {
  return String(siteContent.value?.settings?.site_name || 'Store').trim() || 'Store'
}

const getPrintableSiteLogoUrl = () => {
  return String(siteContent.value?.settings?.site_logo_url || '').trim()
}

const createPrintWindow = () => {
  if (!import.meta.client) {
    return null
  }

  return window.open('', '_blank', 'width=1000,height=900')
}

const writePrintDocuments = (printWindow) => {
  if (!printWindow || !packingDetail.value) {
    return false
  }

  const printableHtml = buildOrderPackingDocumentsHtml({
    order: orderDetail.value,
    customer: customerDetail.value,
    items: orderItems.value,
    siteName: getPrintableSiteName(),
    siteLogoUrl: getPrintableSiteLogoUrl()
  })

  printWindow.document.open()
  printWindow.addEventListener('load', () => {
    printWindow.focus()
    printWindow.print()
  }, { once: true })
  printWindow.document.write(printableHtml)
  printWindow.document.close()
  return true
}

const printDocuments = () => {
  const printWindow = createPrintWindow()

  if (!printWindow) {
    pageError.value = 'Please allow pop-ups to print the bill and shipping paper.'
    return
  }

  try {
    writePrintDocuments(printWindow)
  } catch {
    if (!printWindow.closed) {
      printWindow.close()
    }

    pageError.value = 'The print window could not be prepared. Please try again.'
  }
}

const completePacking = async () => {
  if (
    !sessionDetail.value.id
    || !allItemsPacked.value
    || completionLoading.value
  ) {
    return
  }

  const printWindow = createPrintWindow()

  if (printWindow) {
    printWindow.document.write('<p style="font-family:Arial,sans-serif;padding:32px">Preparing order documents...</p>')
  }

  completionLoading.value = true
  pageError.value = ''

  try {
    const response = await $fetch(
      `/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/complete`,
      {
        method: 'POST',
        body: {
          status: completionStatus.value,
          message: purchaserMessage.value.trim() || undefined
        },
        headers: await getAuthHeaders()
      }
    )
    applyPackingDetail(response)
    purchaserMessage.value = ''
    scanFeedback.type = ''
    scanFeedback.message = ''
    await loadQueue({ preserveSelection: true })

    if (printWindow) {
      try {
        writePrintDocuments(printWindow)
      } catch {
        if (!printWindow.closed) {
          printWindow.close()
        }

        pageError.value = 'Order completed, but its print window could not be prepared. Use “Print again” to retry.'
      }
    } else {
      pageError.value = 'Order completed, but the print window was blocked. Use “Print again” after allowing pop-ups.'
    }
  } catch (error) {
    if (printWindow && !printWindow.closed) {
      printWindow.close()
    }

    pageError.value = error?.data?.statusMessage || error?.message || 'Could not complete this order.'
  } finally {
    completionLoading.value = false
  }
}

const releasePackingSession = async () => {
  if (!sessionDetail.value.id || sessionCompleted.value || releaseLoading.value) {
    return
  }

  if (
    import.meta.client
    && !window.confirm('Release this order back to the queue? Its current scan history will remain in the audit record, and a new session will start from zero.')
  ) {
    return
  }

  releaseLoading.value = true
  pageError.value = ''

  try {
    await $fetch(
      `/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/release`,
      {
        method: 'POST',
        headers: await getAuthHeaders()
      }
    )
    packingDetail.value = null
    selectedOrderId.value = ''
    scanCode.value = ''
    scanFeedback.type = ''
    scanFeedback.message = ''
    await setSessionRouteQuery('')
    await loadQueue({ preserveSelection: true })
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not release this order.'
  } finally {
    releaseLoading.value = false
  }
}

const continueToNextOrder = async () => {
  claimLoading.value = true
  pageError.value = ''

  try {
    packingDetail.value = null
    selectedOrderId.value = ''
    scanFeedback.type = ''
    scanFeedback.message = ''
    completionStatus.value = 'ready_to_deliver'
    purchaserMessage.value = ''
    await setSessionRouteQuery('')
    await loadQueue({ preserveSelection: true })

    const nextOrder = queueOrders.value.find((order) => !isQueueOrderLocked(order))

    if (nextOrder) {
      await openQueueOrder(nextOrder)
    }
  } finally {
    claimLoading.value = false
  }
}

onMounted(async () => {
  const queueResponse = await loadQueue({ preserveSelection: true })
  const routeSessionId = Array.isArray(route.query.session)
    ? route.query.session[0]
    : route.query.session
  const initialSessionId = String(routeSessionId || queueResponse?.currentSessionId || '').trim()

  if (initialSessionId) {
    await loadPackingSession(initialSessionId, {
      updateRoute: Boolean(!routeSessionId)
    })
  }
})

watch(
  () => route.query.session,
  async (nextSessionQuery) => {
    const nextSessionId = String(
      Array.isArray(nextSessionQuery) ? nextSessionQuery[0] : nextSessionQuery || ''
    ).trim()

    if (nextSessionId === String(sessionDetail.value.id || '')) {
      return
    }

    if (!nextSessionId) {
      packingDetail.value = null
      selectedOrderId.value = ''
      return
    }

    await loadPackingSession(nextSessionId, {
      updateRoute: false
    })
  }
)
</script>
