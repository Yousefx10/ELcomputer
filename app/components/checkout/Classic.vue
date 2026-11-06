<template>
  <div class="min-h-[60vh] bg-slate-50 py-7 sm:py-10">
    <div class="store-container">
      <header class="mx-auto max-w-5xl">
        <button v-if="checkoutStep === 'payment' && !savedCheckout" type="button" class="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="checkoutStep = 'shipping'">
          <Icon name="lucide:arrow-left" size="17" aria-hidden="true" class="directional-icon" /> {{ $t('common.backToDelivery') }}
        </button>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{{ $t('common.secureCheckout') }}</p>
        <h1 class="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{{ checkoutStep === 'shipping' ? $t('common.deliveryDetails') : $t('common.paymentMethod') }}</h1>
        <p class="mt-2 text-sm text-slate-600">{{ checkoutStep === 'shipping' ? $t('checkout.tellUsWhereToDeliverYourOrder') : $t('paymentStatus.beforeOrder') }}</p>

        <ol class="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white" :aria-label="$t('common.checkoutProgress')">
          <li class="flex min-h-16 items-center gap-3 px-4 sm:px-6" :class="checkoutStep === 'shipping' ? 'bg-blue-50 text-blue-800' : 'text-slate-600'">
            <span class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="checkoutStep === 'shipping' ? 'bg-blue-600 text-white' : 'bg-slate-100'"><Icon v-if="checkoutStep === 'payment'" name="lucide:check" size="17" aria-hidden="true" /><span v-else>1</span></span>
            <span class="font-semibold">{{ $t('common.delivery') }}</span>
          </li>
          <li class="flex min-h-16 items-center gap-3 border-s border-slate-200 px-4 text-slate-500 sm:px-6" :class="checkoutStep === 'payment' ? 'bg-blue-50 !text-blue-800' : ''">
            <span class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="checkoutStep === 'payment' ? 'bg-blue-600 text-white' : 'bg-slate-100'">2</span>
            <span class="font-semibold">{{ $t('common.payment') }}</span>
          </li>
        </ol>
      </header>

      <section v-if="pendingCheckout && recoveryVisible && !savedCheckout" class="mx-auto mt-4 max-w-5xl rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
        <p class="text-sm text-slate-700">{{ $t('embeddedCheckout.pending') }}</p>
        <button type="button" :disabled="placingOrder" class="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold" @click="recoverCheckout">{{ $t('paymentFirst.checkStatus') }}</button>
      </section>
      <p v-if="affectedPayment && !savedCheckout && !(merchantRiskRetry && affectedPayment.method!=='instapay')" class="mx-auto mt-4 max-w-5xl text-sm text-slate-600">
        <NuxtLinkLocale :to="`/checkout/session/${affectedPayment.id}`" class="font-semibold text-blue-700">{{ $t('paymentInterface.affectedStatus') }} · {{ affectedPayment.reference }}</NuxtLinkLocale>
      </p>
      <section v-if="reviewRequired" class="mx-auto mt-6 max-w-5xl rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <p role="alert" class="text-sm text-slate-800">{{ $uiMessage(orderError) }}</p>
        <NuxtLinkLocale to="/account/orders" class="me-4 mt-3 inline-flex text-sm font-semibold text-blue-700">{{ $t('checkoutRecovery.history') }}</NuxtLinkLocale>
        <button type="button" class="mt-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white" @click="reviewCart">{{ $t('checkoutRecovery.review') }}</button>
      </section>
      <section v-if="savedCheckout" class="mx-auto mt-4 max-w-3xl rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="secure-payment-title">
        <h2 id="secure-payment-title" class="text-lg font-semibold">{{ $t('embeddedCheckout.secureTitle') }}</h2>
        <p v-if="paymentSummary" class="mt-2 text-lg font-semibold">{{ formatCurrency(paymentSummary.totalAmount) }}</p>
        <p v-if="paymentFormError || orderError" role="alert" class="mt-3 text-sm text-red-700">{{ paymentFormError || $uiMessage(orderError) }}</p>
        <ClientOnly><PaymentPaymobPixel v-if="embeddedPayment" :key="savedCheckout" :session="embeddedPayment" :authorize="authorizeEmbeddedPayment" class="mt-4" @complete="checkEmbeddedPayment" @cancel="dismissPayment" @unavailable="embeddedUnavailable" /></ClientOnly>
        <button v-if="hostedFallback" type="button" :disabled="placingOrder" class="mt-3 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold" @click="openHostedFallback">{{ $t('embeddedCheckout.hosted') }}</button>
        <button v-else-if="!embeddedPayment" type="button" class="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold" @click="checkEmbeddedPayment">{{ $t('paymentFirst.checkStatus') }}</button>
        <button type="button" class="ms-3 mt-3 min-h-11 px-2 text-sm font-semibold text-blue-700" @click="dismissPayment">{{ $t('paymentInterface.back') }}</button>
      </section>
      <div v-if="isEmpty && !savedCheckout" class="mx-auto mt-6 max-w-5xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p class="text-lg font-semibold text-slate-900">{{ $t('common.yourCartIsEmpty') }}</p>
        <p class="mt-2 text-sm text-slate-600">{{ $t('checkout.addProductsFirstThenReturnHereToCheckout') }}</p>
        <NuxtLinkLocale to="/cart" class="mt-5 inline-flex rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">{{ $t('common.goToCart') }}</NuxtLinkLocale>
      </div>

      <div v-else-if="!savedCheckout" class="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <main class="min-w-0 space-y-5">
          <p v-if="orderError" role="alert" class="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{{ $uiMessage(orderError) }}</p>

          <p v-if="isPreorderCart && !availablePaymentMethods.length" role="status" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{{ $t('commerceReliability.preorderUnavailable') }}</p>
          <template v-if="checkoutStep === 'shipping'">
            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="delivery-address-title">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><h2 id="delivery-address-title" class="text-xl font-bold text-slate-950">{{ $t('common.shippingAddress') }}</h2><p class="mt-1 text-sm text-slate-600">{{ hasSavedAddress ? $t('checkout.checkYourSavedAddress') : $t('checkout.enterYourDeliveryAddress') }}</p></div>
                <span v-if="loadingProfile" class="text-sm text-slate-500">{{ $t('common.loadingAccount') }}</span>
              </div>

              <div v-if="!loadingProfile" class="mt-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p v-if="savedAddresses.length" class="text-sm font-semibold">{{ $t('checkoutAddressBook.savedAddresses') }}</p>
                  <div class="flex gap-2">
                    <button v-if="!addressExpanded" type="button" :disabled="busyAddress" aria-controls="checkout-address-fields" :aria-expanded="false" class="min-h-11 px-3 text-sm font-semibold text-blue-700" @click="editAddress">{{ $t('common.edit') }}</button>
                    <button type="button" :disabled="busyAddress" class="min-h-11 rounded-lg border px-3 text-sm font-semibold" @click="selectCheckoutAddress('new')">{{ $t('checkoutAddressBook.newAddress') }}</button>
                  </div>
                </div>
                <div id="checkout-saved-addresses" class="mt-2 grid gap-3 sm:grid-cols-2" role="group" :aria-label="$t('checkoutAddressBook.savedAddresses')">
                  <button v-for="saved in savedAddresses" :key="saved.id" type="button" :disabled="busyAddress" :aria-pressed="selectedAddressKey === saved.id" :data-address-id="saved.id" class="min-w-0 rounded-xl border p-4 text-start text-sm [overflow-wrap:anywhere]" :class="selectedAddressKey === saved.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-300'" @click="selectCheckoutAddress(saved.id)">
                    <span class="flex flex-wrap justify-between gap-2"><strong>{{ [saved.first_name, saved.last_name].filter(Boolean).join(' ') }}</strong><span v-if="saved.is_default" class="text-xs">{{ $t('commerceReliability.defaultAddress') }}</span></span>
                    <span v-if="saved.label" class="mt-1 block text-xs text-slate-500">{{ saved.label }}</span>
                    <span class="mt-2 block">{{ [saved.street_address, saved.address_line_2].filter(Boolean).join(', ') }}</span>
                    <span class="mt-1 block text-slate-600">{{ [saved.city, $uiLabel(saved.governorate)].filter(Boolean).join(', ') }}</span>
                    <span v-if="selectedAddressKey === saved.id" class="mt-2 block font-semibold text-blue-700">{{ $t('commerceReliability.selected') }}</span>
                  </button>
                </div>
                <span v-if="loadingAddresses" role="status" class="text-sm text-slate-500">{{ $t('checkoutAddressBook.loading') }}</span>
              </div>
              <div v-if="addressLoadError" class="mt-3 text-sm text-red-700"><p role="alert">{{ addressLoadError }}</p><button type="button" :disabled="busyAddress" class="mt-2 min-h-10 font-semibold text-blue-700" @click="loadSavedAddresses">{{ $t('checkoutAddressBook.reload') }}</button></div>
              <p v-if="addressBookError" role="alert" class="mt-3 text-sm text-red-700">{{ addressBookError }}</p>
              <p v-if="addressBookNotice" role="status" class="mt-3 text-sm text-green-800">{{ addressBookNotice }}</p>
              <div v-if="addressConflict" class="mt-2 flex flex-wrap gap-2">
                <button type="button" :disabled="busyAddress" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="loadSavedAddresses">{{ $t('checkoutAddressBook.reload') }}</button>
                <button v-if="selectedSavedAddress" type="button" :disabled="busyAddress" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="useSavedVersion">{{ $t('checkoutAddressBook.useSavedVersion') }}</button>
                <button type="button" :disabled="busyAddress" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="keepAsNewAddress">{{ $t('checkoutAddressBook.keepAsNew') }}</button>
              </div>
              <div v-if="!loadingProfile && !addressExpanded" class="mt-4 space-y-1 text-sm text-slate-600" data-testid="saved-address-summary">
                <p class="font-semibold text-slate-900">{{ [address.first_name, address.last_name].filter(Boolean).join(' ') }}</p>
                <p>{{ [address.street_address, address.address_line_2, address.city, $uiLabel(address.governorate)].filter(Boolean).join(', ') }}</p>
                <p>{{ address.phone }}</p>
              </div>
              <fieldset v-show="addressExpanded && !loadingProfile" id="checkout-address-fields" :disabled="busyAddress" class="mt-5 grid min-w-0 gap-5 md:grid-cols-2">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.firstNameVariant2') }}</span><input v-model="address.first_name" required maxlength="100" autocomplete="given-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.lastName') }}</span><input v-model="address.last_name" maxlength="100" autocomplete="family-name" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.streetAddress') }}</span><input v-model="address.street_address" required maxlength="200" autocomplete="address-line1" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.addressLine2') }}</span><input v-model="address.address_line_2" maxlength="200" autocomplete="address-line2" type="text" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <AddressLocationFields :key="customerId" :model-value="address" :disabled="loadingProfile || busyAddress || placingOrder" @update:model-value="value => Object.assign(address, value)" />
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.phoneVariant2') }}</span><input v-model="address.phone" required maxlength="40" pattern="01[0-9]{9}" autocomplete="tel" inputmode="tel" type="tel" :placeholder="$t('common.01xxxxxxxxx')" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"><span class="mt-2 block text-xs text-slate-500">{{ $t('checkout.11DigitsStartingWith01') }}</span></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('common.email') }}</span><input v-model="address.email" autocomplete="email" type="email" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">{{ $t('checkoutAddressBook.label') }}</span><input v-model="addressLabel" maxlength="60" type="text" data-testid="saved-address-label" class="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"></label>
                <div class="flex flex-wrap items-center gap-2 md:col-span-2">
                  <button type="button" :disabled="Boolean(addressLoadError)" class="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50" @click="saveAddress">{{ savingAddress ? $t('common.saving') : $t('checkoutAddressBook.save') }}</button>
                  <button v-if="selectedSavedAddress && !confirmAddressRemoval" type="button" class="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50" @click="confirmAddressRemoval = true">{{ $t('checkoutAddressBook.remove') }}</button>
                </div>
                <div v-if="confirmAddressRemoval && selectedSavedAddress" class="text-sm md:col-span-2">
                  <p>{{ $t('checkoutAddressBook.confirmRemove') }}</p>
                  <div class="mt-2 flex flex-wrap gap-2"><button type="button" class="min-h-10 rounded-lg border border-red-200 px-3 font-semibold text-red-700" @click="removeAddress">{{ removingAddress ? $t('common.saving') : $t('checkoutAddressBook.confirmRemoveButton') }}</button><button type="button" class="min-h-10 rounded-lg px-3 font-semibold text-slate-700" @click="confirmAddressRemoval = false">{{ $t('common.cancel') }}</button></div>
                </div>
                <button v-if="addressComplete" type="button" class="min-h-10 justify-self-start rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 md:col-span-2" aria-controls="checkout-address-fields" :aria-expanded="true" @click="addressExpanded = false">{{ $t('common.hideDetails') }}</button>
              </fieldset>
              <div v-if="requiresDelivery" class="mt-5">
                <fieldset class="min-w-0" :disabled="loadingDelivery || placingOrder"><legend class="mb-2 text-sm font-semibold text-slate-700">{{ $t('codCheckout.deliveryOption') }}</legend>
                  <div class="grid gap-3 sm:grid-cols-2"><label v-for="option in availableDeliveryOptions" :key="option.id" class="flex min-h-24 min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm" :class="shippingCompanyId === option.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-300'">
                    <input v-model="shippingCompanyId" type="radio" name="delivery-method" :value="option.id" class="mt-1 shrink-0"><span class="min-w-0 flex-1 [overflow-wrap:anywhere]"><strong class="block">{{ option.name }}</strong><span class="mt-1 block text-slate-600">{{ $t('commerceReliability.deliveryCoverage', {city:address.city}) }}</span><span class="mt-2 block font-semibold">{{ formatCurrency(option.price) }}</span></span>
                  </label></div>
                </fieldset>
                <p v-if="deliveryError" role="alert" class="mt-2 text-sm text-red-700">{{ $uiMessage(deliveryError) }}</p>
                <p v-else-if="address.governorate && !loadingDelivery && !availableDeliveryOptions.length" class="mt-2 text-sm text-slate-600">{{ $t('codCheckout.noDelivery') }}</p>
                <button v-if="deliveryError" type="button" class="mt-2 text-sm font-semibold text-blue-700" @click="loadDeliveryOptions">{{ $t('codCheckout.reloadDelivery') }}</button>
              </div>
            </section>


          </template>

          <template v-else>
            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-semibold text-slate-600">{{ $t('paymentStatus.deliverySelected') }}</p><h2 class="mt-1 text-lg font-bold text-slate-950">{{ address.first_name }} {{ address.last_name }}</h2><p class="mt-1 text-sm text-slate-600">{{ [address.street_address, address.address_line_2, address.city, address.governorate].filter(Boolean).join(', ') }}</p></div><button type="button" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50" @click="checkoutStep = 'shipping'">{{ $t('common.edit') }}</button></div>
            </section>

            <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="payment-method-title">
              <h2 id="payment-method-title" class="text-xl font-bold text-slate-950">{{ $t('common.chooseAPaymentMethod') }}</h2>
              <p class="mt-1 text-sm text-slate-600">{{ isPreorderCart ? $t('checkout.preordersCurrentlyUseBankTransferOrInstapayPaymentRemainsPendingUntilVerified') : $t('checkout.onlyMethodsEnabledByTheStoreAreShown') }}</p>

              <div v-if="availablePaymentMethods.length" class="mt-5 grid gap-3 sm:grid-cols-2">
                <label v-for="method in availablePaymentMethods" :key="method.value" class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition" :class="paymentChoice === method.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-blue-300'">
                  <input v-model="paymentChoice" type="radio" name="payment-method" :value="method.value" class="mt-1">
                  <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon :name="method.icon" size="21" aria-hidden="true" /></span>
                  <span class="min-w-0"><strong class="block text-sm text-slate-900">{{ $uiLabel(method.label) }}</strong><span class="mt-1 block text-xs leading-5 text-slate-600">{{ method.descriptionKey ? $t(method.descriptionKey) : $uiLabel(method.description) }}</span><span v-if="getMethodFee(method.value === 'apple_pay' ? 'card' : method.value)" class="mt-2 block text-xs font-semibold text-amber-700">{{ $t('common.valueFee', { value0: (formatCurrency(getMethodFee(method.value === 'apple_pay' ? 'card' : method.value))) }) }}</span></span>
                </label>
              </div>
              <p v-else class="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ $t('checkout.noPaymentMethodIsAvailablePleaseContactTheStore') }}</p>
              <p v-if="quote?.stockFulfillmentState === 'untracked' && quote.fulfillmentMessage" class="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">{{ quote.fulfillmentMessage }}</p>
              <div v-if="quote?.stockFulfillmentState === 'awaiting_stock'" class="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                <p class="font-semibold">{{ $t('beta.specialOrder') }}</p>
                <p>{{ quote.fulfillmentMessage }}</p>
                <p>{{ $t('beta.wholeOrderWaits') }}</p>
                <label class="flex items-start gap-2"><input v-model="backorderAccepted" type="checkbox" class="mt-1">{{ $t('beta.acceptTerms') }}</label>
              </div>

              <p v-if="selectedPaymentMethod === 'card' && paymentCapabilities?.card?.mode === 'test'" class="mt-2 text-sm font-semibold text-amber-800">{{ $t('paymob.testOnly') }}</p>

              <div v-if="prepaidFlow && selectedPaymentMethod === 'instapay'" class="mt-4 text-sm text-slate-600">{{ $t('transfer.afterConfirm') }}</div>
              <div v-else-if="paymentMethodNeedsProof(selectedPaymentMethod)" class="mt-6 space-y-4 border-t border-slate-200 pt-6">
                <div class="rounded-2xl bg-slate-50 p-5"><h3 class="font-bold text-slate-950">{{ $t('common.transferInstructions') }}</h3><p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{{ paymentInstructions || $t('checkout.contactTheStoreForTransferDetailsBeforeSendingPayment') }}</p></div>
                <template v-if="isPreorderCart"><p class="text-sm text-slate-600">{{ $t('checkout.afterConfirmingUseYourOrderNumberWhenContactingTheStoreAboutYourTransferStaffWillRecordTheAmountOnlyAfterVerifyingItYourOrderRemainsUnpaidUntilThen') }}</p></template>
                <template v-else><PaymentProofUpload v-model="proofFile" backend-notice="Proof selection is available now. Secure submission will be activated with the payment backend; you can also return from My Account → Orders." /><p class="text-sm text-slate-600">{{ $t('checkout.youCanConfirmTheOrderWithoutProofAndReturnLaterTheOrderWillStayAtPaymentPendingUntilProofIsSubmittedAndReviewed') }}</p></template>
              </div>

              <div v-else-if="selectedPaymentMethod === 'paypal'" class="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 class="font-bold text-blue-950">PayPal</h3><p class="mt-2 text-sm leading-6 text-blue-900">{{ $t('checkout.yourOrderWillRemainPaymentPendingUntilThePaypalConnectionConfirmsPayment') }}</p></div>

            </section>
          </template>
        </main>

        <aside class="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-40">
          <h2 class="text-xl font-bold text-slate-950">{{ $t('common.orderSummary') }}</h2>
          <div class="mt-4 max-h-64 space-y-3 overflow-y-auto pe-1">
            <article v-for="item in items" :key="item.cart_key" class="flex items-center gap-3"><div class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-2"><img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="size-full object-contain"></div><div class="min-w-0 flex-1"><p class="line-clamp-2 text-sm font-semibold text-slate-900">{{ quoteLine(item)?.title || item.title }}</p><p v-if="quoteLine(item)?.variantName || item.variant_name" class="text-xs text-slate-600">{{ quoteLine(item)?.variantName || item.variant_name }}</p><ProductOptionSummary :values="quoteLine(item)?.variantOptions || item.variant_options" /><p v-if="item.selling_mode === 'preorder'" class="text-xs font-bold text-amber-800">{{ $t('common.preOrderValue', { value0: ((quoteLine(item)?.paymentMode || item.preorder_payment_mode) === 'deposit' ? $t('preorder.depositPercent', { value0: (quoteLine(item)?.depositPercent ?? item.preorder_deposit_percent) }) : $t('common.fullPayment')) }) }}</p><p v-if="quoteLine(item)?.expectedAvailabilityDate || item.expected_availability_date" class="text-xs text-slate-600">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(quoteLine(item)?.expectedAvailabilityDate || item.expected_availability_date)) }) }}</p><p class="mt-1 text-xs text-slate-500">{{ $t('common.qtyValue', { value0: (item.quantity) }) }}</p></div><p class="text-sm font-semibold text-slate-900">{{ formatCurrency(quoteLine(item)?.total ?? item.price * item.quantity) }}</p></article>
          </div>
          <p v-if="quoteError" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ $uiMessage(quoteError) }}</p>
          <dl class="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm"><div class="flex justify-between gap-3 text-slate-600"><dt>{{ isPreorderCart ? $t('common.preorderMerchandise') : $t('common.subtotal') }}</dt><dd>{{ formatCurrency(quote?.orderValue ?? subtotal) }}</dd></div><div>            <details v-if="!isPreorderCart" class="mt-4 border-t border-slate-200 pt-4" aria-labelledby="coupon-title">
              <summary id="coupon-title" class="min-h-10 cursor-pointer text-sm font-semibold text-slate-950">{{ $t('common.coupon') }}</summary>
              <p v-if="paymentCapabilities?.purchase?.beta && !paymentCapabilities.purchase.couponsEnabled" class="mt-2 text-sm text-slate-600">{{ $t('commerceReliability.couponDisabled') }}</p>
              <div class="mt-4 flex flex-col gap-3 sm:flex-row"><input v-model="couponCode" type="text" :placeholder="$t('common.couponCode')" class="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 uppercase outline-none focus:border-blue-600"><button type="button" :disabled="applyingCoupon" class="min-h-12 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" @click="applyCoupon">{{ applyingCoupon ? $t('common.applying') : $t('common.apply') }}</button><button v-if="appliedCoupon" type="button" class="min-h-12 rounded-xl px-4 text-sm font-semibold text-red-700 hover:bg-red-50" @click="removeCoupon">{{ $t('common.remove') }}</button></div>
              <p v-if="couponError" class="mt-3 text-sm text-red-700">{{ $uiMessage(couponError) }}</p><p v-if="couponSuccess" class="mt-3 text-sm text-emerald-700">{{ $uiLabel(couponSuccess) }}</p>
            </details></div><div v-if="!isPreorderCart" class="flex justify-between gap-3 text-slate-600"><dt>{{ $t('common.coupon') }}<span v-if="appliedCoupon" class="block text-xs font-normal">{{ appliedCoupon.code }}</span></dt><dd>{{ appliedCoupon ? `- ${formatCurrency(discountAmount - deliveryDiscountAmount)}` : '—' }}</dd></div><div v-if="deliveryDiscountAmount" class="flex justify-between gap-3 text-slate-600"><dt>{{ $t('common.deliveryDiscount') }}</dt><dd>− {{ formatCurrency(deliveryDiscountAmount) }}</dd></div><div class="flex justify-between gap-3 text-slate-600"><dt>{{ $t('common.shipping') }}</dt><dd>{{ quote?.shipping ? formatCurrency(quote.shippingFee) : requiresDelivery ? $t('codCheckout.chooseDelivery') : $t('common.calculatedLater') }}</dd></div><div v-if="paymentFee" class="flex justify-between gap-3 text-amber-700"><dt>{{ $t('common.paymentFee') }}</dt><dd>+ {{ formatCurrency(paymentFee) }}</dd></div><div class="flex justify-between gap-3 border-t border-slate-200 pt-3 text-lg font-bold text-slate-950"><dt>{{ $t('common.orderValueVariant4') }}</dt><dd>{{ requiresDelivery && !quote ? '—' : formatCurrency(totalAmount) }}</dd></div><template v-if="isPreorderCart"><div class="flex justify-between gap-3 font-bold text-blue-800"><dt>{{ $t('common.requiredNow') }}</dt><dd>{{ formatCurrency(quote?.requiredNow || 0) }}</dd></div><div class="flex justify-between gap-3 text-slate-700"><dt>{{ $t('common.remainingAfterPayment') }}</dt><dd>{{ formatCurrency(quote?.remainingAfterPayment || 0) }}</dd></div><p class="text-xs text-slate-600">{{ $t('checkout.noPaymentIsRecordedUntilTheStoreVerifiesItDeliveryFollowsAvailability') }}</p></template></dl>
          <button v-if="checkoutStep === 'shipping'" type="button" :disabled="savingAddress || removingAddress" class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50" @click="continueToPayment">{{ $t('common.continueToPayment') }}</button>
          <button v-else type="button" :disabled="placingOrder || !quote || !!reviewRequired || !availablePaymentMethods.length" class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" @click="placeOrder">{{ placingOrder ? $t('common.confirming') : isPreorderCart ? $t('common.confirmPreOrder') : prepaidFlow && selectedPaymentMethod === 'card' ? $t('paymentInterface.pay') : $t('common.confirmCheckout') }}</button>
          <p class="mt-3 text-center text-xs leading-5 text-slate-500">{{ $t('checkout.noCardNumberOrSecurityCodeIsStoredByThisCheckout') }}</p>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
// Original layout. Logic lives in useCheckoutFlow; this file only presents it.
const props = defineProps({ flow: { type: Object, required: true } })
const {
  paymentMethodNeedsProof,
  PHONE_PATTERN,
  activeInterface,
  address,
  addressBookError,
  addressBookNotice,
  addressComplete,
  addressConflict,
  addressExpanded,
  addressLabel,
  addressLoadError,
  affectedPayment,
  appleDevice,
  appliedCoupon,
  applyCoupon,
  applyingCoupon,
  authorizeEmbeddedPayment,
  availableDeliveryOptions,
  availablePaymentMethods,
  backorderAccepted,
  busyAddress,
  cartId,
  cartOwner,
  checkEmbeddedPayment,
  checkoutBody,
  checkoutStep,
  chooseAddress,
  completeCart,
  confirmAddressRemoval,
  continueToPayment,
  couponCode,
  couponError,
  couponSuccess,
  customerId,
  customerScope,
  deliveryDiscountAmount,
  deliveryError,
  deliveryOptions,
  discountAmount,
  dismissPayment,
  editAddress,
  embeddedPayment,
  embeddedUnavailable,
  ensurePurchaseLineIdentities,
  expectedAvailabilityLabel,
  fillAddressFromProfile,
  formatCurrency,
  getMethodFee,
  hasSavedAddress,
  hostedFallback,
  intlLocale,
  isEmpty,
  isPreorderCart,
  itemCount,
  items,
  keepAsNewAddress,
  loadCart,
  loadCustomerProfile,
  loadDeliveryOptions,
  loadSavedAddresses,
  loadingAddresses,
  loadingDelivery,
  loadingProfile,
  locale,
  merchantRiskRetry,
  newCheckoutCommand,
  openHostedFallback,
  orderError,
  paymentCapabilities,
  paymentChoice,
  paymentFee,
  paymentFirstRuntime,
  paymentFormError,
  paymentInstructions,
  paymentSummary,
  pendingCheckout,
  placeOrder,
  placingOrder,
  prepaidFlow,
  profileDraftSummary,
  proofFile,
  purchaseScope,
  purchasingEnabled,
  quote,
  quoteError,
  quoteLine,
  readPending,
  recoverCheckout,
  recoveryVisible,
  refreshPurchaseAccess,
  refreshQuote,
  removeAddress,
  removeCoupon,
  removingAddress,
  renewCart,
  requiresDelivery,
  resetCoupon,
  restorePaymentPresentation,
  reviewCart,
  reviewRequired,
  revision,
  saveAddress,
  savedAddresses,
  savedCheckout,
  savingAddress,
  scheduleQuote,
  selectCheckoutAddress,
  selectedAddressKey,
  selectedPaymentMethod,
  selectedPaymobMethod,
  selectedSavedAddress,
  sendCommand,
  setAppliedCoupon,
  setProfileAddress,
  settings,
  shippingCompanyId,
  siteContent,
  storageChanged,
  subtotal,
  supabase,
  syncCart,
  syncState,
  t,
  totalAmount,
  trackEvent,
  uiLabel,
  uiNavigateTo,
  useSavedVersion,
  user,
  validateAddress,
  validatePayment,
  waitForSync
} = props.flow
</script>
