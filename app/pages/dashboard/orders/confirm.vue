<template>
  <div class="flex flex-col gap-3 lg:h-[calc(100dvh-7.5rem)] xl:h-[calc(100dvh-8.25rem)]" data-confirm-orders>
    <header class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div class="me-auto flex min-w-0 items-center gap-2.5">
        <NuxtLinkLocale to="/dashboard/orders" :aria-label="$t('common.orders')" class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          <Icon name="lucide:arrow-left" size="16" class="directional-icon" />
        </NuxtLinkLocale>
        <h1 class="truncate text-lg font-bold text-gray-950">{{ $t('common.confirmOrders') }}</h1>
      </div>
      <div v-if="workspaceOpen" role="tablist" class="flex rounded-lg bg-gray-100 p-0.5 text-sm font-semibold">
        <button role="tab" type="button" :aria-selected="tab === 'queue'" class="min-h-9 rounded-md px-3" :class="tab === 'queue' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'" @click="tab = 'queue'">
          {{ $t('confirmOrders.tabQueue') }} <span class="ms-1 text-gray-400">{{ queueTotal }}</span>
        </button>
        <button role="tab" type="button" :aria-selected="tab === 'done'" class="min-h-9 rounded-md px-3" :class="tab === 'done' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'" @click="showConfirmed">
          {{ $t('confirmOrders.tabDone') }}
        </button>
      </div>
      <div v-if="workspaceOpen" class="flex items-center gap-3 text-sm text-gray-500">
        <span class="hidden sm:inline">{{ workSession.operator_name || $t('common.operator') }} · {{ workSessionElapsed }}</span>
        <button type="button" :disabled="workSessionActionLoading" class="min-h-9 rounded-lg border border-gray-300 px-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50" @click="closeWorkSession">
          {{ workSessionActionLoading ? $t('common.closing') : $t('common.closeSession') }}
        </button>
      </div>
    </header>

    <p v-if="signedOut" class="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="alert">{{ $t('confirmOrders.signedOut') }}</p>
    <div v-if="pageError" class="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      <p>{{ $uiMessage(pageError) }}</p>
      <button type="button" :aria-label="$t('common.dismissError')" class="shrink-0" @click="pageError = ''"><Icon name="lucide:x" size="16" /></button>
    </div>
    <div v-if="pageNotice" class="flex items-start justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">
      <p>{{ pageNotice }}</p>
      <button type="button" :aria-label="$t('common.dismissNotice')" class="shrink-0" @click="pageNotice = ''"><Icon name="lucide:x" size="16" /></button>
    </div>

    <section v-if="workSessionLoading" class="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500" role="status">
      <Icon name="lucide:loader-circle" size="24" class="mx-auto animate-spin" />
    </section>

    <section v-else-if="moved" class="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <h2 class="text-lg font-bold text-gray-950">{{ $t('confirmOrders.movedTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-500">{{ $t('confirmOrders.movedHelp') }}</p>
      <button type="button" class="mt-4 min-h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white" @click="reloadPage">{{ $t('confirmOrders.reload') }}</button>
    </section>

    <section v-else-if="elsewhere" class="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <h2 class="text-lg font-bold text-gray-950">{{ $t('confirmOrders.elsewhereTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-500">{{ $t('confirmOrders.elsewhereHelp') }}</p>
      <button type="button" :disabled="workSessionActionLoading" class="mt-4 min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="claimScreen(true)">{{ $t('confirmOrders.useHere') }}</button>
    </section>

    <section v-else-if="!workspaceOpen" class="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <span class="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="lucide:package-check" size="24" /></span>
      <h2 class="mt-3 text-lg font-bold text-gray-950">{{ $t('confirmOrders.startTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-500">{{ $t('confirmOrders.startHelp') }}</p>
      <button type="button" :disabled="workSessionActionLoading" class="mt-4 min-h-11 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white disabled:opacity-50" @click="claimScreen()">
        {{ workSessionActionLoading ? $t('common.starting') : $t('common.startSession') }}
      </button>
    </section>

    <div v-if="workspaceOpen" v-show="tab === 'queue'" class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      <aside class="max-h-72 min-h-0 flex-col rounded-xl border border-gray-200 bg-white lg:flex lg:max-h-none" :class="packingDetail ? 'hidden' : 'flex'">
        <div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
          <h2 class="text-sm font-bold text-gray-900">{{ $t('common.confirmationQueue') }}</h2>
          <button type="button" :disabled="queueLoading" :aria-label="$t('dashboard.orders.refreshConfirmationQueue')" class="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50" @click="loadQueue()">
            <Icon name="lucide:refresh-cw" size="15" :class="queueLoading ? 'animate-spin' : ''" />
          </button>
        </div>
        <p v-if="!queueOrders.length && !queueLoading" class="p-6 text-center text-sm text-gray-500">{{ $t('common.queueIsClear') }}</p>
        <ul class="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
          <li v-for="queueOrder in queueOrders" :key="queueOrder.id">
            <button type="button" :disabled="queueRowDisabled(queueOrder)" class="w-full rounded-lg border px-2.5 py-2 text-start transition disabled:cursor-not-allowed disabled:opacity-60" :class="selectedOrderId === queueOrder.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-400'" @click="openQueueOrder(queueOrder)">
              <span class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-bold text-gray-900">{{ getOrderNumber(queueOrder) }}</span>
                <Icon v-if="openingOrderId === String(queueOrder.id)" name="lucide:loader-circle" size="14" class="shrink-0 animate-spin text-blue-600" />
              </span>
              <span class="mt-0.5 block truncate text-xs text-gray-500">{{ getCustomerName(queueOrder) }} · {{ $t('common.valueItems', { value0: Number(queueOrder.total_quantity || 0) }) }}</span>
              <span v-if="queueOrder.has_customer_reply" class="mt-1 inline-block rounded bg-fuchsia-100 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-800">{{ $t('common.purchaserReplied') }}</span>
              <span v-if="isLockedByOther(queueOrder)" class="mt-1 block truncate text-[11px] font-semibold text-amber-700">{{ queueOrder.active_session.can_take_over ? $t('confirmOrders.disconnected', { value0: processorName(queueOrder) }) : $t('confirmOrders.inProgress', { value0: processorName(queueOrder) }) }}</span>
            </button>
            <button v-if="queueOrder.active_session?.can_take_over" type="button" :disabled="!cameraConnected || Boolean(openingOrderId) || hasOpenOrder" class="mt-1 min-h-8 w-full rounded-lg border border-amber-300 text-xs font-semibold text-amber-800 disabled:opacity-50" @click="takeOverOrder(queueOrder)">{{ $t('confirmOrders.takeover') }}</button>
          </li>
        </ul>
      </aside>

      <main class="flex min-h-0 min-w-0 flex-col rounded-xl border border-gray-200 bg-white">
        <div v-if="detailLoading" class="m-auto p-10 text-gray-400" role="status"><Icon name="lucide:loader-circle" size="24" class="animate-spin" /></div>
        <div v-else-if="!packingDetail" class="m-auto p-10 text-center">
          <Icon name="lucide:package-open" size="30" class="mx-auto text-gray-300" />
          <p class="mt-2 text-sm font-semibold text-gray-700">{{ cameraConnected ? $t('confirmOrders.chooseOrder') : $t('confirmOrders.connectFirst') }}</p>
        </div>

        <template v-else>
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-3">
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-gray-950">{{ getOrderNumber(orderDetail) }}</h2>
              <p class="text-sm text-gray-700">{{ getCustomerName(orderDetail) }} · <bdi dir="ltr">{{ orderDetail.phone || customerDetail.phone || $t('common.noPhoneSaved') }}</bdi></p>
              <p class="text-sm text-gray-500">{{ deliveryLine }}</p>
            </div>
            <div class="text-end">
              <p class="text-lg font-bold text-gray-950">{{ formatCurrency(orderDetail.total_amount) }}</p>
              <p class="text-xs font-semibold text-gray-500">{{ $uiLabel(orderDetail.payment_method || $t('common.notSelected')) }}</p>
            </div>
          </div>

          <template v-if="sessionCompleted">
            <div class="min-h-0 flex-1 overflow-y-auto p-3">
              <p class="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800"><Icon name="lucide:circle-check" size="17" />{{ $t('confirmOrders.doneTitle') }}</p>
              <DashboardOrderCourierPanel :key="courierPanelKey" :order-id="String(orderDetail.id)" :session-id="String(sessionDetail.id)" :notice="courierNotice">
                <button v-if="!externalErp" type="button" class="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold" @click="printDocuments">{{ $t('common.printAgain') }}</button>
              </DashboardOrderCourierPanel>
            </div>
          </template>

          <template v-else-if="problemFormOpen">
            <form class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" @submit.prevent="reportOrderProblem">
              <h3 class="text-sm font-bold text-red-800">{{ $t('common.problemWithOrder') }}</h3>
              <label class="block text-xs font-semibold text-gray-600">{{ $t('common.messageToPurchaserVariant2') }}
                <textarea v-model="problemMessage" rows="4" maxlength="2000" class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal text-gray-900" />
              </label>
              <p v-if="problemFormError" class="text-sm font-semibold text-red-700" role="alert">{{ $uiMessage(problemFormError) }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="submit" :disabled="problemLoading" class="min-h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{{ $t('confirmOrders.problemHold') }}</button>
                <button type="button" :disabled="problemLoading" class="min-h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50" @click="cancelOrder">{{ $t('confirmOrders.cancelOrder') }}</button>
                <button type="button" :disabled="problemLoading" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-gray-600" @click="problemFormOpen = false">{{ $t('common.close') }}</button>
              </div>
            </form>
          </template>

          <template v-else>
            <div class="border-b border-gray-100 p-3">
              <div class="flex items-center justify-between gap-3 text-sm">
                <p class="font-semibold text-gray-800">{{ $t('confirmOrders.progress', { value0: progress.scanned, value1: progress.required }) }}</p>
                <p v-if="scanFeedback.message" class="truncate text-xs font-semibold" :class="scanFeedback.type === 'success' ? 'text-green-700' : 'text-red-700'" :role="scanFeedback.type === 'success' ? 'status' : 'alert'">{{ $uiMessage(scanFeedback.message) }}</p>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100"><div class="h-full bg-green-500 transition-all" :style="{ width: `${progress.percentage}%` }" /></div>
              <form class="mt-2 flex gap-2" @submit.prevent="scanItem">
                <input ref="scanInputElement" v-model="scanCode" :disabled="!recordingActive || allItemsPacked" autocomplete="off" :aria-label="$t('common.itemCode')" :placeholder="$t('confirmOrders.scanPlaceholder')" class="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm disabled:bg-gray-50">
                <button type="submit" :disabled="scanLoading || !scanCode.trim()" class="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-50">{{ $t('confirmOrders.scan') }}</button>
              </form>
            </div>
            <ul class="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
              <li v-for="item in orderItems" :key="item.id" class="flex items-center gap-3 p-3">
                <img v-if="item.image_url" :src="item.image_url" :alt="item.product_title || ''" class="h-12 w-12 shrink-0 rounded-lg border border-gray-100 object-contain">
                <span v-else class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-400"><Icon name="lucide:package" size="18" /></span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-gray-900">{{ item.product_title || $t('common.product') }}</p>
                  <p class="text-xs text-gray-500">{{ [meaningfulOption(item), $t('confirmOrders.quantity', { value0: item.quantity })].filter(Boolean).join(' · ') }}</p>
                </div>
                <span v-if="isItemPacked(item)" class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-green-700"><Icon name="lucide:circle-check" size="17" />{{ $t('confirmOrders.checked') }}</span>
                <button v-else-if="item.can_check" type="button" :disabled="!recordingActive || checkingItemId === String(item.id)" class="min-h-10 shrink-0 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="checkItem(item)">{{ $t('confirmOrders.check') }}</button>
                <span v-else class="shrink-0 text-xs font-semibold text-gray-500">{{ getScannedQuantity(item) }} / {{ item.quantity }}</span>
              </li>
            </ul>
            <details v-if="conversationMessages.length" class="border-t border-gray-100 px-3 py-2 text-sm">
              <summary class="cursor-pointer font-semibold text-gray-700">{{ $t('common.orderConversation') }} ({{ conversationMessages.length }})</summary>
              <ul class="mt-2 max-h-40 space-y-2 overflow-y-auto">
                <li v-for="message in conversationMessages" :key="message.id" class="rounded-lg bg-gray-50 p-2 text-xs"><p dir="auto" class="whitespace-pre-wrap break-words">{{ message.body || message.message }}</p></li>
              </ul>
            </details>
          </template>
        </template>
      </main>

      <aside class="flex min-h-0 flex-col gap-3">
        <section class="rounded-xl bg-gray-950 p-2.5 text-white">
          <div class="relative aspect-video overflow-hidden rounded-lg bg-black">
            <video ref="cameraVideoElement" autoplay muted playsinline class="h-full w-full object-cover" />
            <span class="absolute start-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" :class="recordingActive ? 'bg-red-600 text-white' : cameraConnected ? 'bg-black/60 text-green-300' : 'bg-black/60 text-gray-300'">
              <span v-if="recordingActive" class="h-1.5 w-1.5 rounded-full bg-white" />
              {{ recordingActive ? $t('common.recording') : cameraConnected ? $t('common.connected') : $t('common.required') }}
            </span>
          </div>
          <p v-if="cameraError" class="mt-2 text-xs text-red-300">{{ $uiMessage(cameraError) }}</p>
          <div v-if="!recordingActive" class="mt-2 flex gap-2">
            <select v-if="cameraDevices.length > 1" v-model="selectedCameraId" :disabled="cameraLoading || recordingActive" :aria-label="$t('common.camera')" class="min-h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white" @change="connectCamera">
              <option v-for="device in cameraDevices" :key="device.deviceId" :value="device.deviceId" class="text-gray-950">{{ device.label || $t('common.camera') }}</option>
            </select>
            <button v-if="!cameraConnected || cameraDevices.length < 2" type="button" :disabled="cameraLoading || recordingActive" class="min-h-9 flex-1 rounded-lg bg-white px-3 text-xs font-bold text-gray-950 disabled:opacity-50" @click="connectCamera">{{ cameraLoading ? $t('common.connecting') : cameraConnected ? $t('common.reconnect') : $t('common.connectCamera') }}</button>
          </div>
        </section>

        <section v-if="packingDetail && sessionCompleted" class="rounded-xl border border-gray-200 bg-white p-3">
          <button type="button" class="min-h-12 w-full rounded-lg bg-blue-700 text-sm font-bold text-white" @click="continueToNextOrder">{{ $t('common.nextOrder') }}</button>
        </section>

        <section v-else-if="packingDetail" class="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3">
          <p v-if="recordingInterrupted" class="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700" role="alert">{{ $t('confirmOrders.cameraLost') }}</p>
          <label v-if="courierNeedsBooking" class="block text-xs font-semibold text-gray-600">{{ $t('pdcParcel.weight') }}
            <input v-model="parcelWeight" type="number" min="0.001" max="99999.99" step="0.001" class="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base font-semibold text-gray-900">
          </label>
          <button type="button" :disabled="!canFinish" class="min-h-12 w-full rounded-lg bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-50" @click="finishOrder">{{ finishLabel }}</button>
          <p v-if="!allItemsPacked" class="text-center text-xs text-gray-500">{{ $t('confirmOrders.needChecks', { value0: progress.remaining }) }}</p>
          <p v-if="videoUploadProgress" class="text-center text-xs font-semibold text-blue-700" role="status">{{ videoUploadProgress }}</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" :disabled="releaseLoading || completionLoading" class="min-h-9 rounded-lg border border-gray-300 px-2 text-xs font-semibold text-gray-700 disabled:opacity-50" @click="releasePackingSession">{{ releaseLoading ? $t('common.releasing') : $t('confirmOrders.release') }}</button>
            <button type="button" :disabled="problemLoading || completionLoading" class="min-h-9 rounded-lg border border-red-200 px-2 text-xs font-semibold text-red-700 disabled:opacity-50" @click="toggleProblemForm">{{ $t('confirmOrders.problem') }}</button>
          </div>
        </section>
      </aside>
    </div>

    <div v-if="workspaceOpen" v-show="tab === 'done'" class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section class="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white">
        <p v-if="!confirmedOrders.length && !confirmedLoading" class="p-8 text-center text-sm text-gray-500">{{ $t('confirmOrders.confirmedEmpty') }}</p>
        <ul class="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
          <li v-for="row in confirmedOrders" :key="row.session_id">
            <button type="button" class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-start hover:bg-gray-50" :class="selectedConfirmed?.session_id === row.session_id ? 'bg-blue-50' : ''" @click="selectedConfirmed = row">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-gray-900">{{ row.order_number || row.order_id.slice(0, 8) }}</span>
                <span class="block truncate text-xs text-gray-500">{{ row.customer_name }} · {{ row.processor_name }} · {{ formatDate(row.completed_at) }}</span>
              </span>
              <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="row.awb ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'">{{ row.awb || $t(`liveSales.states.${row.courier_state || 'not_booked'}`) }}</span>
            </button>
          </li>
        </ul>
        <div v-if="confirmedTotal > confirmedPageSize" class="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-sm">
          <button type="button" :disabled="confirmedPage <= 1" class="min-h-9 rounded-lg border border-gray-300 px-3 font-semibold disabled:opacity-50" @click="loadConfirmed(confirmedPage - 1)">{{ $t('common.previous') }}</button>
          <span class="text-gray-500">{{ confirmedPage }} / {{ Math.ceil(confirmedTotal / confirmedPageSize) }}</span>
          <button type="button" :disabled="confirmedPage * confirmedPageSize >= confirmedTotal" class="min-h-9 rounded-lg border border-gray-300 px-3 font-semibold disabled:opacity-50" @click="loadConfirmed(confirmedPage + 1)">{{ $t('common.next') }}</button>
        </div>
      </section>
      <section class="min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
        <template v-if="selectedConfirmed">
          <h2 class="mb-3 text-base font-bold text-gray-950">{{ selectedConfirmed.order_number || selectedConfirmed.order_id.slice(0, 8) }}</h2>
          <DashboardOrderCourierPanel :key="selectedConfirmed.session_id" :order-id="selectedConfirmed.order_id" :session-id="selectedConfirmed.session_id" @updated="loadConfirmed(confirmedPage)" />
        </template>
        <p v-else class="p-6 text-center text-sm text-gray-500">{{ $t('confirmOrders.chooseConfirmed') }}</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { measuredParcelWeight } from '~/utils/parcelWeight'
import { buildOrderPackingDocumentsHtml } from '~/utils/orderPackingPrint'

definePageMeta({ layout: 'dashboard' })

const { uiLabel, intlLocale } = useUiLocale()
const { t } = useI18n()
const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()
const { data: erpState } = useNuxtData('active-erp')
const externalErp = computed(() => erpState.value?.mode === 'daftra')

const tab = ref('queue')
const queueOrders = ref([]), queueTotal = ref(0), queueLoading = ref(false)
const confirmedOrders = ref([]), confirmedTotal = ref(0), confirmedPage = ref(1), confirmedLoading = ref(false), selectedConfirmed = ref(null)
const confirmedPageSize = 20
const claimLoading = ref(false), openingOrderId = ref(''), detailLoading = ref(false), scanLoading = ref(false)
const checkingItemId = ref(''), completionLoading = ref(false), releaseLoading = ref(false), problemLoading = ref(false)
const pageError = ref(''), pageNotice = ref(''), signedOut = ref(false), elsewhere = ref(false), moved = ref(false)
const packingDetail = ref(null), selectedOrderId = ref(''), scanCode = ref(''), scanInputElement = ref(null)
const scanFeedback = reactive({ type: '', message: '' })
const problemFormOpen = ref(false), problemMessage = ref(''), problemFormError = ref('')
const workSession = ref(null), activePackingSessionId = ref(''), workSessionLoading = ref(true), workSessionActionLoading = ref(false), sessionClock = ref(Date.now())
const cameraVideoElement = ref(null), cameraStream = shallowRef(null), cameraDevices = ref([]), selectedCameraId = ref(''), cameraLoading = ref(false), cameraError = ref('')
const recordingState = ref('idle'), recordingStartedAt = ref(''), recordingEndedAt = ref(''), recordingBlob = shallowRef(null), recordingInterrupted = ref(false), videoUploadProgress = ref('')
const courierBefore = ref(null), parcelWeight = ref('1'), courierNotice = ref(''), courierPanelKey = ref(0), finishStage = ref('')
let mediaRecorder = null, recordingChunks = [], stopRecordingPromise = null, resolveStopRecording = null, expectedRecorderStop = false
let sessionClockTimer = null, heartbeatTimer = null, memoryClientId = ''

const workSessionActive = computed(() => workSession.value?.status === 'active')
const workspaceOpen = computed(() => workSessionActive.value && !elsewhere.value && !moved.value && !workSessionLoading.value)
const cameraConnected = computed(() => Boolean(cameraStream.value?.getVideoTracks?.().some(track => track.readyState === 'live')))
const recordingActive = computed(() => recordingState.value === 'recording')
const sessionDetail = computed(() => packingDetail.value?.session || {})
const orderDetail = computed(() => packingDetail.value?.order || {})
const customerDetail = computed(() => packingDetail.value?.customer || {})
const orderItems = computed(() => packingDetail.value?.items || [])
const sessionCompleted = computed(() => sessionDetail.value.status === 'completed')
const hasOpenOrder = computed(() => Boolean(sessionDetail.value.id) && !sessionCompleted.value)
const hasActivePackingOrder = computed(() => Boolean(activePackingSessionId.value) || hasOpenOrder.value)
const courierNeedsBooking = computed(() => ['not_booked', 'queued', 'blocked', 'failed'].includes(courierBefore.value?.state))
const conversationMessages = computed(() => (packingDetail.value?.messages || []).filter(message => message.body || message.message))
const deliveryLine = computed(() => [orderDetail.value.street_address || customerDetail.value.address_line_1, orderDetail.value.city || customerDetail.value.city, orderDetail.value.governorate || customerDetail.value.state].filter(Boolean).join(', ') || t('common.noAddressSaved'))
const getScannedQuantity = item => (item.scans || []).reduce((sum, scan) => sum + Math.max(1, Number(scan.quantity || 1)), 0)
const isItemPacked = item => item.is_complete === true || getScannedQuantity(item) >= Number(item.quantity || 0)
const allItemsPacked = computed(() => orderItems.value.length > 0 && orderItems.value.every(isItemPacked))
const progress = computed(() => {
  const required = orderItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const scanned = orderItems.value.reduce((sum, item) => sum + Math.min(getScannedQuantity(item), Number(item.quantity || 0)), 0)
  return { required, scanned, remaining: Math.max(required - scanned, 0), percentage: required ? Math.round(scanned / required * 100) : 0 }
})
const videoSaved = computed(() => packingDetail.value?.video?.status === 'ready')
const canFinish = computed(() => allItemsPacked.value && !completionLoading.value && !recordingInterrupted.value && (recordingActive.value || videoSaved.value || Boolean(recordingBlob.value?.size)) && (!courierNeedsBooking.value || measuredParcelWeight(parcelWeight.value) !== null))
const finishLabel = computed(() => {
  if (finishStage.value === 'video') return t('confirmOrders.savingVideo')
  if (finishStage.value === 'confirm') return t('confirmOrders.confirming')
  if (finishStage.value === 'courier') return t('confirmOrders.booking')
  return courierNeedsBooking.value ? t('confirmOrders.finishBook') : t('confirmOrders.finish')
})
const workSessionElapsed = computed(() => {
  const startedAt = new Date(workSession.value?.started_at || '').getTime()
  if (!Number.isFinite(startedAt)) return ''
  const total = Math.max(0, Math.floor((sessionClock.value - startedAt) / 60000)), hours = Math.floor(total / 60), minutes = total % 60
  return hours ? t('dashboard.hoursMinutes', { value0: hours, value1: minutes }) : t('dashboard.minutes', { value0: minutes })
})

const readClientId = () => {
  try {
    let value = sessionStorage.getItem('store-packing-client')
    if (!value) { value = crypto.randomUUID(); sessionStorage.setItem('store-packing-client', value) }
    return value
  } catch { return memoryClientId ||= crypto.randomUUID() }
}
const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Please log in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
const failure = (error, fallback) => error?.data?.statusMessage || error?.message || fallback
const getOrderNumber = (order = {}) => order.order_number || `#${String(order.id || '').slice(0, 8)}`
const getCustomerName = (order = {}) => `${order.first_name || ''} ${order.last_name || ''}`.trim() || t('common.customer')
const processorName = order => order.active_session?.processor_name || t('common.operator')
const isLockedByOther = order => Boolean(order.active_session && !order.active_session.is_current_admin)
const queueRowDisabled = order => !cameraConnected.value || isLockedByOther(order) || Boolean(openingOrderId.value) || problemLoading.value || (hasOpenOrder.value && selectedOrderId.value !== String(order.id))
const meaningfulOption = item => { const name = String(item.variant_name || item.variant_color_name || '').trim(); return /^(default|standard|base|product)$/i.test(name) ? '' : name }
const formatCurrency = value => new Intl.NumberFormat(intlLocale.value, { style: 'currency', currency: orderDetail.value.currency || 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
const formatDate = value => value ? new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : ''
const reloadPage = () => window.location.reload()

const stopHeartbeat = () => { if (heartbeatTimer) window.clearInterval(heartbeatTimer); heartbeatTimer = null }
const sessionRequest = async body => $fetch('/api/admin-orders/packing/work-session', { method: 'POST', body: { ...body, clientId: readClientId() }, headers: await getAuthHeaders(), retry: 0 })
const stopEverything = async () => {
  stopHeartbeat()
  await stopOrderRecording({ discard: true })
  stopCamera()
  clearPackingWorkspace()
}
const heartbeat = async () => {
  try { await sessionRequest({ action: 'heartbeat' }); signedOut.value = false }
  catch (error) {
    const code = error?.data?.data?.code
    if (code === 'moved') { await stopEverything(); moved.value = true }
    else if (code === 'session_closed') { await stopEverything(); workSession.value = null }
    else if (Number(error?.statusCode) === 401 || String(error?.message).includes('session expired')) signedOut.value = true
  }
}
const startHeartbeat = () => { stopHeartbeat(); heartbeatTimer = window.setInterval(heartbeat, 20000) }

const loadWorkSession = async () => {
  try {
    const response = await $fetch('/api/admin-orders/packing/work-session', { headers: await getAuthHeaders(), retry: 0 })
    workSession.value = response?.workSession || null
    activePackingSessionId.value = String(response?.activePackingSessionId || '')
  } catch (error) { pageError.value = failure(error, 'Could not load your packing session.') }
}
// Starts or rejoins this person's session on this screen, then brings the camera up.
const claimScreen = async (force = false) => {
  if (workSessionActionLoading.value) return
  workSessionActionLoading.value = true; pageError.value = ''
  try {
    const response = await sessionRequest({ action: 'start', force: force === true })
    workSession.value = response?.workSession || null
    elsewhere.value = false
    startHeartbeat()
    await loadQueue()
    await recoverInterruptedOrder()
    await nextTick()
    await connectCamera()
  } catch (error) {
    if (error?.data?.data?.code === 'open_elsewhere') elsewhere.value = true
    else pageError.value = failure(error, 'Could not start your packing session.')
  } finally { workSessionActionLoading.value = false }
}
// Recordings live in the browser, so a reload loses them. Only a video already saved can continue.
const recoverInterruptedOrder = async () => {
  const sessionId = activePackingSessionId.value
  if (!sessionId) return
  try {
    const response = await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionId)}`, { headers: await getAuthHeaders(), retry: 0 })
    const detail = normalizePackingResponse(response)
    if (detail?.video?.status === 'ready') { applyPackingDetail(detail); recordingState.value = 'saved'; await loadCourier(); return }
    const number = getOrderNumber(detail?.order)
    await postReleasePackingSession(sessionId)
    activePackingSessionId.value = ''
    pageNotice.value = t('confirmOrders.interrupted', { value0: number })
    await loadQueue()
  } catch (error) { pageError.value = failure(error, 'Could not open this packing session.') }
}
const stopCamera = () => {
  for (const track of cameraStream.value?.getTracks?.() || []) track.stop()
  cameraStream.value = null
  if (cameraVideoElement.value) cameraVideoElement.value.srcObject = null
}
const closeWorkSession = async () => {
  if (workSessionActionLoading.value) return
  if (hasActivePackingOrder.value && !window.confirm(uiLabel('Close session? Current packing progress will be cleared.'))) return
  workSessionActionLoading.value = true; pageError.value = ''
  try {
    await sessionRequest({ action: 'close' })
    await stopEverything()
    queueOrders.value = []; queueTotal.value = 0; activePackingSessionId.value = ''; workSession.value = null
  } catch (error) { pageError.value = failure(error, 'Could not close your packing session.') }
  finally { workSessionActionLoading.value = false }
}
const refreshCameraDevices = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) return
  cameraDevices.value = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput')
  if (!selectedCameraId.value && cameraDevices.value.length) selectedCameraId.value = cameraDevices.value[0].deviceId
}
const handleCameraEnded = () => {
  if (recordingActive.value && !expectedRecorderStop) recordingInterrupted.value = true
  cameraStream.value = cameraStream.value ? new MediaStream(cameraStream.value.getTracks()) : null
}
const connectCamera = async () => {
  if (!import.meta.client || cameraLoading.value || recordingActive.value) return
  cameraLoading.value = true; cameraError.value = ''
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost.')
    stopCamera()
    const video = selectedCameraId.value ? { deviceId: { exact: selectedCameraId.value }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } }
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
    const track = stream.getVideoTracks()[0]
    if (!track) { stream.getTracks().forEach(item => item.stop()); throw new Error('No webcam was found.') }
    track.addEventListener('ended', handleCameraEnded)
    cameraStream.value = stream
    if (cameraVideoElement.value) { cameraVideoElement.value.srcObject = stream; await cameraVideoElement.value.play().catch(() => {}) }
    await refreshCameraDevices()
    const settings = track.getSettings?.() || {}
    if (settings.deviceId) selectedCameraId.value = settings.deviceId
  } catch (error) {
    cameraError.value = error?.name === 'NotAllowedError' ? 'Allow camera access in the browser, then retry.' : error?.message || 'Could not connect the camera.'
  } finally { cameraLoading.value = false }
}
const getRecordingMimeType = () => ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => window.MediaRecorder?.isTypeSupported?.(type)) || ''
const startOrderRecording = async () => {
  if (!cameraConnected.value || !window.MediaRecorder) throw new Error('Connect a supported webcam before choosing an order.')
  recordingChunks = []; recordingBlob.value = null; recordingInterrupted.value = false
  recordingStartedAt.value = new Date().toISOString(); recordingEndedAt.value = ''; videoUploadProgress.value = ''; expectedRecorderStop = false
  const mimeType = getRecordingMimeType()
  mediaRecorder = mimeType ? new MediaRecorder(cameraStream.value, { mimeType, videoBitsPerSecond: 2_500_000 }) : new MediaRecorder(cameraStream.value)
  stopRecordingPromise = new Promise(resolve => { resolveStopRecording = resolve })
  mediaRecorder.addEventListener('dataavailable', event => { if (event.data?.size) recordingChunks.push(event.data) })
  mediaRecorder.addEventListener('error', () => { recordingInterrupted.value = true })
  mediaRecorder.addEventListener('stop', () => {
    recordingEndedAt.value = new Date().toISOString()
    recordingBlob.value = new Blob(recordingChunks, { type: String(mediaRecorder?.mimeType || mimeType || 'video/webm').split(';')[0] })
    recordingState.value = 'stopped'
    if (!expectedRecorderStop) recordingInterrupted.value = true
    resolveStopRecording?.(recordingBlob.value); resolveStopRecording = null
  }, { once: true })
  mediaRecorder.start(1000)
  recordingState.value = 'recording'
}
const stopOrderRecording = async ({ discard = false } = {}) => {
  if (recordingActive.value && mediaRecorder?.state !== 'inactive') { expectedRecorderStop = true; recordingState.value = 'stopping'; mediaRecorder.stop() }
  const blob = stopRecordingPromise ? await stopRecordingPromise : recordingBlob.value
  if (discard) { recordingChunks = []; recordingBlob.value = null; recordingStartedAt.value = ''; recordingEndedAt.value = ''; recordingState.value = 'idle'; stopRecordingPromise = null; mediaRecorder = null }
  return blob
}
const finishVideoUpload = async () => $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/video-complete`, { method: 'POST', retry: 0, timeout: 90000, headers: await getAuthHeaders() })
const applySavedPackingVideo = video => {
  packingDetail.value.video = video; recordingState.value = 'saved'; videoUploadProgress.value = ''
  recordingChunks = []; recordingBlob.value = null; stopRecordingPromise = null; mediaRecorder = null
  return video
}
const uploadPackingVideo = async () => {
  if (packingDetail.value?.video?.status === 'ready') return packingDetail.value.video
  if (packingDetail.value?.video?.status === 'uploading') {
    try { return applySavedPackingVideo((await finishVideoUpload()).video) }
    catch (error) { if (Number(error?.statusCode || error?.status) !== 409 || error?.data?.statusMessage !== 'The saved packing video is unavailable.') throw error }
  }
  const blob = recordingBlob.value
  if (!blob?.size || recordingInterrupted.value) throw new Error('A complete packing recording is required.')
  recordingState.value = 'uploading'
  const durationSeconds = Math.max(0, (new Date(recordingEndedAt.value).getTime() - new Date(recordingStartedAt.value).getTime()) / 1000)
  const response = await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/video-upload`, { method: 'POST', body: { mimeType: blob.type || 'video/webm', sizeBytes: blob.size, durationSeconds, recordingStartedAt: recordingStartedAt.value, recordingEndedAt: recordingEndedAt.value }, headers: await getAuthHeaders(), retry: 0, timeout: 30000 })
  packingDetail.value.video = response.video
  if (response.video.status !== 'ready') await $fetch(response.upload.url, { method: 'PUT', body: blob, retry: 0, timeout: 17 * 60 * 1000, headers: { ...await getAuthHeaders(), 'Content-Type': blob.type || 'video/webm' } })
  return applySavedPackingVideo((await finishVideoUpload()).video)
}
const normalizePackingResponse = response => (response?.detail && typeof response.detail === 'object') ? response.detail : (response?.data && typeof response.data === 'object') ? response.data : response || null
const applyPackingDetail = response => {
  const detail = normalizePackingResponse(response)
  if (!detail?.session?.id) throw new Error('The packing session returned an incomplete record.')
  packingDetail.value = detail
  selectedOrderId.value = String(detail.order?.id || '')
  activePackingSessionId.value = detail.session.status === 'active' ? String(detail.session.id) : ''
}
const focusScanner = async () => { await nextTick(); scanInputElement.value?.focus?.() }
const clearPackingWorkspace = () => {
  packingDetail.value = null; selectedOrderId.value = ''; scanCode.value = ''; scanFeedback.type = ''; scanFeedback.message = ''
  problemFormOpen.value = false; problemMessage.value = ''; problemFormError.value = ''
  courierBefore.value = null; courierNotice.value = ''; finishStage.value = ''; activePackingSessionId.value = ''; videoUploadProgress.value = ''
  recordingInterrupted.value = false
}
const postReleasePackingSession = async sessionId => $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionId)}/release`, { method: 'POST', headers: await getAuthHeaders() })
const loadQueue = async () => {
  queueLoading.value = true
  try {
    const response = await $fetch('/api/admin-orders/packing', { query: { pageSize: 50 }, headers: await getAuthHeaders() })
    queueOrders.value = response.orders || response.items || []
    queueTotal.value = Number(response.total || queueOrders.value.length)
    activePackingSessionId.value = String(response.currentSessionId || response.current_session_id || activePackingSessionId.value || '')
  } catch (error) { pageError.value = failure(error, 'Could not load the confirmation queue.') }
  finally { queueLoading.value = false }
}
const loadConfirmed = async (page = 1) => {
  confirmedLoading.value = true
  try {
    const response = await $fetch('/api/admin-orders/packing', { query: { view: 'confirmed', page, pageSize: confirmedPageSize }, headers: await getAuthHeaders() })
    confirmedOrders.value = response.orders || []; confirmedTotal.value = Number(response.total || 0); confirmedPage.value = page
  } catch (error) { pageError.value = failure(error, 'Could not load confirmed orders.') }
  finally { confirmedLoading.value = false }
}
const showConfirmed = () => { tab.value = 'done'; loadConfirmed(1) }
const loadCourier = async () => {
  courierBefore.value = null
  try {
    const response = await $fetch(`/api/admin-orders/${selectedOrderId.value}`, { headers: await getAuthHeaders(), retry: 0 })
    courierBefore.value = response.shipping || null
    parcelWeight.value = String(response.shipping?.default_weight_kg || 1)
  } catch { courierBefore.value = null }
}
const openQueueOrder = async (queueOrder, takeover = false) => {
  if (!queueOrder?.id || !workSessionActive.value || !cameraConnected.value || openingOrderId.value || (isLockedByOther(queueOrder) && !takeover) || (hasOpenOrder.value && selectedOrderId.value !== String(queueOrder.id))) return
  if (hasOpenOrder.value && selectedOrderId.value === String(queueOrder.id)) { await focusScanner(); return }
  if (packingDetail.value && sessionCompleted.value) clearPackingWorkspace()
  openingOrderId.value = String(queueOrder.id); claimLoading.value = true; pageError.value = ''; pageNotice.value = ''
  let recordingStarted = false
  try {
    await startOrderRecording()
    recordingStarted = true
    const label = cameraStream.value?.getVideoTracks?.()[0]?.label || ''
    const response = await $fetch('/api/admin-orders/packing', { method: 'POST', body: { orderId: String(queueOrder.id), workSessionId: workSession.value.id, cameraReady: true, cameraLabel: label, ...(takeover ? { takeover: true } : {}) }, headers: await getAuthHeaders() })
    applyPackingDetail(response)
    await Promise.all([loadCourier(), loadQueue()])
    await focusScanner()
  } catch (error) {
    if (recordingStarted) await stopOrderRecording({ discard: true })
    await loadQueue()
    pageError.value = failure(error, 'Could not start packing this order.')
  } finally { claimLoading.value = false; openingOrderId.value = '' }
}
const takeOverOrder = queueOrder => {
  if (window.confirm(t('confirmOrders.takeoverConfirm', { value0: processorName(queueOrder) }))) openQueueOrder(queueOrder, true)
}
const applyScanResult = (response, fallback) => {
  applyPackingDetail(response)
  scanFeedback.type = 'success'; scanFeedback.message = response?.lastScan?.message || fallback
}
const scanItem = async () => {
  const code = scanCode.value.trim()
  if (!code || !sessionDetail.value.id || scanLoading.value || allItemsPacked.value || !recordingActive.value) return
  scanLoading.value = true; scanFeedback.message = ''
  try {
    applyScanResult(await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/scan`, { method: 'POST', body: { code }, headers: await getAuthHeaders() }), code)
    scanCode.value = ''
  } catch (error) { scanFeedback.type = 'error'; scanFeedback.message = failure(error, 'This item could not be confirmed.') }
  finally { scanLoading.value = false; await focusScanner() }
}
const checkItem = async item => {
  if (!sessionDetail.value.id || checkingItemId.value || !recordingActive.value) return
  checkingItemId.value = String(item.id); scanFeedback.message = ''
  try { applyScanResult(await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/scan`, { method: 'POST', body: { itemId: String(item.id) }, headers: await getAuthHeaders() }), item.product_title || '') }
  catch (error) { scanFeedback.type = 'error'; scanFeedback.message = failure(error, 'This item could not be confirmed.') }
  finally { checkingItemId.value = '' }
}
const printDocuments = () => {
  const printWindow = window.open('', '_blank', 'width=1000,height=900')
  if (!printWindow) { pageError.value = 'Please allow pop-ups to print the bill and shipping paper.'; return }
  printWindow.document.open()
  printWindow.addEventListener('load', () => { printWindow.focus(); printWindow.print() }, { once: true })
  printWindow.document.write(buildOrderPackingDocumentsHtml({ order: orderDetail.value, customer: customerDetail.value, items: orderItems.value, siteName: String(siteContent.value?.settings?.site_name || 'Store').trim() || 'Store', siteLogoUrl: String(siteContent.value?.settings?.site_logo_url || '').trim(), locale: intlLocale.value, translate: uiLabel }))
  printWindow.document.close()
}
// One press: save the video, confirm the order, then book the courier with the entered weight.
const finishOrder = async () => {
  if (!canFinish.value) return
  completionLoading.value = true; pageError.value = ''; courierNotice.value = ''
  const bookWeight = courierNeedsBooking.value ? measuredParcelWeight(parcelWeight.value) : null
  try {
    if (!videoSaved.value) { finishStage.value = 'video'; await stopOrderRecording(); await uploadPackingVideo() }
    finishStage.value = 'confirm'
    applyPackingDetail(await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionDetail.value.id)}/complete`, { method: 'POST', body: { status: 'ready_to_deliver' }, headers: await getAuthHeaders() }))
    scanFeedback.message = ''
    await loadQueue()
    if (bookWeight !== null) {
      finishStage.value = 'courier'
      try { await $fetch(`/api/admin-shipping/orders/${orderDetail.value.id}/booking`, { method: 'POST', body: { action: 'book', actual_weight_kg: bookWeight, weight_confirmed: true }, headers: await getAuthHeaders(), retry: 0 }) }
      catch (error) { courierNotice.value = failure(error, t('confirmOrders.bookingFailed')) }
    }
    courierPanelKey.value++
  } catch (error) { pageError.value = failure(error, 'Could not complete this order.') }
  finally { completionLoading.value = false; finishStage.value = '' }
}
const toggleProblemForm = () => { problemFormOpen.value = !problemFormOpen.value; problemFormError.value = '' }
const afterOrderClosed = async notice => {
  await stopOrderRecording({ discard: true })
  clearPackingWorkspace()
  await loadQueue()
  pageNotice.value = notice
}
const reportOrderProblem = async () => {
  const sessionId = String(sessionDetail.value.id || ''), message = problemMessage.value.trim()
  if (!sessionId || sessionCompleted.value || problemLoading.value) return
  if (!message) { problemFormError.value = 'Explain the problem before sending this report.'; return }
  problemLoading.value = true; problemFormError.value = ''
  const number = getOrderNumber(orderDetail.value)
  try {
    await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionId)}/problem`, { method: 'POST', body: { message }, headers: await getAuthHeaders() })
    await afterOrderClosed(t('confirmOrders.problemSent', { value0: number }))
  } catch (error) { problemFormError.value = failure(error, 'Could not report this order problem.') }
  finally { problemLoading.value = false }
}
const cancelOrder = async () => {
  const sessionId = String(sessionDetail.value.id || '')
  if (!sessionId || problemLoading.value) return
  const number = getOrderNumber(orderDetail.value), paid = orderDetail.value.payment_status === 'paid'
  if (!window.confirm([t('confirmOrders.cancelConfirm', { value0: number }), paid ? t('confirmOrders.cancelPaid') : ''].filter(Boolean).join('\n'))) return
  problemLoading.value = true; problemFormError.value = ''
  try {
    await $fetch(`/api/admin-orders/packing/${encodeURIComponent(sessionId)}/cancel-order`, { method: 'POST', body: { reason: problemMessage.value.trim() }, headers: await getAuthHeaders() })
    await afterOrderClosed(t('confirmOrders.cancelled', { value0: number }))
  } catch (error) { problemFormError.value = failure(error, 'Could not cancel this order.') }
  finally { problemLoading.value = false }
}
const releasePackingSession = async () => {
  if (!sessionDetail.value.id || sessionCompleted.value || releaseLoading.value) return
  if (!window.confirm(t('confirmOrders.releaseConfirm'))) return
  releaseLoading.value = true; pageError.value = ''
  const number = getOrderNumber(orderDetail.value)
  try {
    await postReleasePackingSession(sessionDetail.value.id)
    await afterOrderClosed(t('confirmOrders.released', { value0: number }))
  } catch (error) { pageError.value = failure(error, 'Could not release this order.') }
  finally { releaseLoading.value = false }
}
const continueToNextOrder = async () => { await stopOrderRecording({ discard: true }); clearPackingWorkspace(); await loadQueue() }
const handleBeforeUnload = event => { if (hasActivePackingOrder.value) { event.preventDefault(); event.returnValue = '' } }

watch(cameraVideoElement, element => { if (element && cameraStream.value) { element.srcObject = cameraStream.value; element.play().catch(() => {}) } })
onBeforeRouteLeave(() => !hasActivePackingOrder.value || window.confirm(uiLabel('Leave this active order? The current video will be lost.')))
onMounted(async () => {
  sessionClockTimer = window.setInterval(() => { sessionClock.value = Date.now() }, 30000)
  window.addEventListener('beforeunload', handleBeforeUnload)
  await loadWorkSession()
  workSessionLoading.value = false
  if (workSessionActive.value) await claimScreen()
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (sessionClockTimer) window.clearInterval(sessionClockTimer)
  stopHeartbeat()
  stopCamera()
})
</script>
