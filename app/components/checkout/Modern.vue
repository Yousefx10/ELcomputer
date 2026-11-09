<template>
  <div class="checkout-modern">
    <div class="store-container cm-shell">
      <header class="cm-head">
        <NuxtLinkLocale to="/cart" class="cm-back"><Icon name="lucide:arrow-left" size="16" class="directional-icon" aria-hidden="true" />{{ $t('checkoutModern.backToCart') }}</NuxtLinkLocale>
        <div class="cm-head-row">
          <h1>{{ $t('checkoutModern.title') }}</h1>
          <span class="cm-secure"><Icon name="lucide:lock" size="14" aria-hidden="true" />{{ $t('common.secureCheckout') }}</span>
        </div>
      </header>

      <section v-if="pendingCheckout && recoveryVisible && !savedCheckout" class="cm-notice" aria-live="polite">
        <Icon name="lucide:clock" size="18" aria-hidden="true" />
        <div><p>{{ $t('embeddedCheckout.pending') }}</p><button type="button" :disabled="placingOrder" class="cm-link" @click="recoverCheckout">{{ $t('paymentFirst.checkStatus') }}</button></div>
      </section>
      <p v-if="affectedPayment && !savedCheckout && (affectedPayment.blocking || !(merchantRiskRetry && affectedPayment.method !== 'instapay'))" class="cm-notice">
        <Icon name="lucide:info" size="18" aria-hidden="true" />
        <NuxtLinkLocale :to="`/checkout/session/${affectedPayment.id}`" class="cm-link">{{ $t('paymentInterface.affectedStatus') }}<template v-if="affectedPayment.reference"> · {{ affectedPayment.reference }}</template></NuxtLinkLocale>
      </p>
      <section v-if="reviewRequired" class="cm-notice cm-notice-warn">
        <Icon name="lucide:triangle-alert" size="18" aria-hidden="true" />
        <div>
          <p role="alert">{{ $uiMessage(orderError) }}</p>
          <div class="cm-inline-actions"><NuxtLinkLocale to="/account/orders" class="cm-link">{{ $t('checkoutRecovery.history') }}</NuxtLinkLocale><button type="button" class="cm-button-sm" @click="reviewCart">{{ $t('checkoutRecovery.review') }}</button></div>
        </div>
      </section>

      <section v-if="savedCheckout" class="cm-card cm-payment-live" aria-labelledby="cm-secure-payment">
        <h2 id="cm-secure-payment" class="cm-card-title">{{ $t('embeddedCheckout.secureTitle') }}</h2>
        <p v-if="paymentSummary" class="cm-amount">{{ formatCurrency(paymentSummary.paymentAmount ?? paymentSummary.totalAmount) }}</p>
        <p v-if="paymentFormError || orderError" role="alert" class="cm-error">{{ paymentFormError || $uiMessage(orderError) }}</p>
        <ClientOnly><PaymentPaymobPixel v-if="embeddedPayment" :key="savedCheckout" :session="embeddedPayment" :authorize="authorizeEmbeddedPayment" class="mt-4" @complete="checkEmbeddedPayment" @cancel="dismissPayment" @unavailable="embeddedUnavailable" /></ClientOnly>
        <div class="cm-inline-actions">
          <button v-if="hostedFallback" type="button" :disabled="placingOrder" class="cm-button-sm" @click="openHostedFallback">{{ $t('embeddedCheckout.hosted') }}</button>
          <button v-else-if="!embeddedPayment" type="button" class="cm-button-sm" @click="checkEmbeddedPayment">{{ $t('paymentFirst.checkStatus') }}</button>
          <button type="button" class="cm-link" @click="dismissPayment">{{ $t('paymentInterface.back') }}</button>
        </div>
      </section>

      <div v-if="isEmpty && !savedCheckout" class="cm-card cm-empty">
        <Icon name="lucide:shopping-bag" size="34" aria-hidden="true" />
        <p class="cm-card-title">{{ $t('common.yourCartIsEmpty') }}</p>
        <p class="cm-muted">{{ $t('checkout.addProductsFirstThenReturnHereToCheckout') }}</p>
        <NuxtLinkLocale to="/cart" class="cm-primary cm-primary-inline">{{ $t('common.goToCart') }}</NuxtLinkLocale>
      </div>

      <div v-else-if="!savedCheckout" class="cm-grid">
        <main class="cm-main">
          <button type="button" class="cm-summary-toggle" :aria-expanded="summaryOpen" aria-controls="cm-mobile-summary" @click="summaryOpen = !summaryOpen">
            <span class="cm-summary-toggle-label"><Icon name="lucide:shopping-bag" size="17" aria-hidden="true" />{{ summaryOpen ? $t('checkoutModern.hideSummary') : $t('checkoutModern.showSummary') }}<Icon name="lucide:chevron-down" size="16" aria-hidden="true" class="cm-chevron" :class="{ 'cm-chevron-open': summaryOpen }" /></span>
            <span class="cm-summary-toggle-total" :class="{ 'cm-dim': quoteLoading }">{{ totalLabel }}</span>
          </button>
          <Transition name="cm-expand">
            <div v-show="summaryOpen" id="cm-mobile-summary" class="cm-card cm-mobile-summary">
              <ul class="cm-lines"><li v-for="item in items" :key="item.cart_key" class="cm-line">
                <span class="cm-thumb"><img v-if="item.image_url" :src="item.image_url" :alt="item.title" loading="lazy"></span>
                <span class="cm-line-text"><span class="cm-line-title">{{ quoteLine(item)?.title || item.title }}</span><span class="cm-muted cm-line-meta">{{ lineMeta(item) }}</span></span>
                <span class="cm-line-price">{{ formatCurrency(quoteLine(item)?.total ?? item.price * item.quantity) }}</span>
              </li></ul>
            </div>
          </Transition>

          <p v-if="orderError && !reviewRequired" id="cm-order-error" role="alert" class="cm-notice cm-notice-error"><Icon name="lucide:circle-alert" size="18" aria-hidden="true" />{{ $uiMessage(orderError) }}</p>
          <p v-if="isPreorderCart && !availablePaymentMethods.length" role="status" class="cm-notice cm-notice-warn">{{ $t('commerceReliability.preorderUnavailable') }}</p>

          <!-- 1. Address -->
          <section id="cm-address" class="cm-card" aria-labelledby="cm-address-title">
            <div class="cm-card-head">
              <h2 id="cm-address-title" class="cm-card-title"><span class="cm-step" :class="{ 'cm-step-done': addressComplete && !addressExpanded }"><Icon v-if="addressComplete && !addressExpanded" name="lucide:check" size="14" aria-hidden="true" /><template v-else>1</template></span>{{ $t('checkoutModern.deliverTo') }}</h2>
              <button v-if="!loadingProfile && !addressExpanded && !picker" type="button" class="cm-link" :disabled="busyAddress" @click="picker = true">{{ $t('common.change') }}</button>
              <button v-else-if="picker" type="button" class="cm-link" @click="picker = false">{{ $t('checkoutModern.done') }}</button>
            </div>

            <div v-if="loadingProfile" class="cm-skeleton-stack" aria-hidden="true"><span class="cm-skeleton w-1/3" /><span class="cm-skeleton w-2/3" /><span class="cm-skeleton w-1/4" /></div>

            <template v-else>
              <button v-if="!addressExpanded && !picker" type="button" class="cm-address-summary" data-testid="saved-address-summary" @click="picker = true">
                <Icon name="lucide:map-pin" size="18" aria-hidden="true" />
                <span class="min-w-0"><strong>{{ [address.first_name, address.last_name].filter(Boolean).join(' ') }}</strong>
                  <span class="cm-muted block">{{ [address.street_address, address.address_line_2, address.city, $uiLabel(address.governorate)].filter(Boolean).join(', ') }}</span>
                  <span class="cm-muted block" dir="ltr">{{ address.phone }}</span></span>
              </button>

              <Transition name="cm-expand">
                <div v-if="picker && !addressExpanded" class="cm-picker">
                  <p v-if="savedAddresses.length" class="cm-label">{{ $t('checkoutAddressBook.savedAddresses') }}</p>
                  <div class="cm-options" role="radiogroup" :aria-label="$t('checkoutAddressBook.savedAddresses')">
                    <button v-for="saved in savedAddresses" :key="saved.id" type="button" role="radio" :aria-checked="selectedAddressKey === saved.id" :disabled="busyAddress" :data-address-id="saved.id" class="cm-option" @click="chooseSaved(saved.id)">
                      <span class="cm-radio" aria-hidden="true" />
                      <span class="cm-option-body"><strong>{{ saved.label || [saved.first_name, saved.last_name].filter(Boolean).join(' ') }}<span v-if="saved.is_default" class="cm-pill">{{ $t('commerceReliability.defaultAddress') }}</span></strong>
                        <span class="cm-muted block">{{ [saved.street_address, saved.city, $uiLabel(saved.governorate)].filter(Boolean).join(', ') }}</span></span>
                    </button>
                  </div>
                  <span v-if="loadingAddresses" role="status" class="cm-muted">{{ $t('checkoutAddressBook.loading') }}</span>
                  <div class="cm-inline-actions">
                    <button type="button" class="cm-button-sm" :disabled="busyAddress" @click="picker = false; editAddress()"><Icon name="lucide:pencil" size="15" aria-hidden="true" />{{ $t('checkoutModern.editAddress') }}</button>
                    <button type="button" class="cm-button-sm" :disabled="busyAddress" @click="picker = false; selectCheckoutAddress('new')"><Icon name="lucide:plus" size="15" aria-hidden="true" />{{ $t('checkoutAddressBook.newAddress') }}</button>
                  </div>
                </div>
              </Transition>

              <div v-if="addressLoadError" class="cm-error"><p role="alert">{{ addressLoadError }}</p><button type="button" :disabled="busyAddress" class="cm-link" @click="loadSavedAddresses">{{ $t('checkoutAddressBook.reload') }}</button></div>
              <p v-if="addressBookError" role="alert" class="cm-error">{{ addressBookError }}</p>
              <p v-if="addressBookNotice" role="status" class="cm-success">{{ addressBookNotice }}</p>
              <div v-if="addressConflict" class="cm-inline-actions">
                <button type="button" :disabled="busyAddress" class="cm-link" @click="loadSavedAddresses">{{ $t('checkoutAddressBook.reload') }}</button>
                <button v-if="selectedSavedAddress" type="button" :disabled="busyAddress" class="cm-link" @click="useSavedVersion">{{ $t('checkoutAddressBook.useSavedVersion') }}</button>
                <button type="button" :disabled="busyAddress" class="cm-link" @click="keepAsNewAddress">{{ $t('checkoutAddressBook.keepAsNew') }}</button>
              </div>

              <Transition name="cm-expand">
                <fieldset v-show="addressExpanded" id="checkout-address-fields" :disabled="busyAddress" class="cm-form">
                  <p v-if="!hasSavedAddress" class="cm-muted cm-span">{{ $t('checkout.enterYourDeliveryAddress') }}</p>
                  <label><span>{{ $t('common.firstNameVariant2') }}</span><input v-model="address.first_name" required maxlength="100" autocomplete="given-name" type="text"></label>
                  <label><span>{{ $t('common.lastName') }}</span><input v-model="address.last_name" maxlength="100" autocomplete="family-name" type="text"></label>
                  <label class="cm-span"><span>{{ $t('common.streetAddress') }}</span><input v-model="address.street_address" required maxlength="200" autocomplete="address-line1" type="text"></label>
                  <label class="cm-span"><span>{{ $t('common.addressLine2') }}</span><input v-model="address.address_line_2" maxlength="200" autocomplete="address-line2" type="text"></label>
                  <AddressLocationFields :key="customerId" :model-value="address" :disabled="loadingProfile || busyAddress || placingOrder" @update:model-value="value => Object.assign(address, value)" />
                  <label><span>{{ $t('common.phoneVariant2') }}</span><input v-model="address.phone" dir="ltr" required maxlength="40" pattern="01[0-9]{9}" autocomplete="tel" inputmode="tel" type="tel" :placeholder="$t('common.01xxxxxxxxx')"><small>{{ $t('checkout.11DigitsStartingWith01') }}</small></label>
                  <label><span>{{ $t('common.email') }}</span><input v-model="address.email" dir="ltr" autocomplete="email" type="email"></label>
                  <label class="cm-span"><span>{{ $t('checkoutAddressBook.label') }}</span><input v-model="addressLabel" maxlength="60" type="text" data-testid="saved-address-label"></label>
                  <div class="cm-inline-actions cm-span">
                    <button type="button" :disabled="Boolean(addressLoadError)" class="cm-button-sm" @click="saveAddress">{{ savingAddress ? $t('common.saving') : $t('checkoutAddressBook.save') }}</button>
                    <button v-if="selectedSavedAddress && !confirmAddressRemoval" type="button" class="cm-link cm-link-danger" @click="confirmAddressRemoval = true">{{ $t('checkoutAddressBook.remove') }}</button>
                    <button v-if="addressComplete" type="button" class="cm-link" @click="addressExpanded = false">{{ $t('checkoutModern.done') }}</button>
                  </div>
                  <div v-if="confirmAddressRemoval && selectedSavedAddress" class="cm-span">
                    <p>{{ $t('checkoutAddressBook.confirmRemove') }}</p>
                    <div class="cm-inline-actions"><button type="button" class="cm-button-sm cm-button-danger" @click="removeAddress">{{ removingAddress ? $t('common.saving') : $t('checkoutAddressBook.confirmRemoveButton') }}</button><button type="button" class="cm-link" @click="confirmAddressRemoval = false">{{ $t('common.cancel') }}</button></div>
                  </div>
                </fieldset>
              </Transition>
            </template>
          </section>

          <!-- 2. Delivery -->
          <section v-if="requiresDelivery" class="cm-card" aria-labelledby="cm-delivery-title">
            <div class="cm-card-head"><h2 id="cm-delivery-title" class="cm-card-title"><span class="cm-step" :class="{ 'cm-step-done': Boolean(shippingCompanyId) }"><Icon v-if="shippingCompanyId" name="lucide:check" size="14" aria-hidden="true" /><template v-else>2</template></span>{{ $t('checkoutModern.delivery') }}</h2></div>
            <div v-if="loadingDelivery" class="cm-skeleton-stack" aria-hidden="true"><span class="cm-skeleton h-14" /><span class="cm-skeleton h-14" /></div>
            <div v-else-if="availableDeliveryOptions.length" class="cm-options" role="radiogroup" :aria-label="$t('codCheckout.deliveryOption')">
              <label v-for="option in availableDeliveryOptions" :key="option.id" class="cm-option" :class="{ 'cm-option-active': shippingCompanyId === option.id }">
                <input v-model="shippingCompanyId" type="radio" name="delivery-method" :value="option.id" class="sr-only">
                <span class="cm-radio" aria-hidden="true" />
                <span class="cm-option-body"><strong>{{ option.name }}</strong><span class="cm-muted block">{{ $t('commerceReliability.deliveryCoverage', { city: address.city }) }}</span></span>
                <span class="cm-option-price">{{ Number(option.price) === 0 ? $t('checkoutModern.free') : formatCurrency(option.price) }}</span>
              </label>
            </div>
            <p v-else-if="deliveryError" role="alert" class="cm-error">{{ $uiMessage(deliveryError) }} <button type="button" class="cm-link" @click="loadDeliveryOptions">{{ $t('codCheckout.reloadDelivery') }}</button></p>
            <p v-else-if="address.governorate" class="cm-muted">{{ $t('codCheckout.noDelivery') }}</p>
            <p v-else class="cm-muted">{{ $t('checkoutModern.chooseGovernorate') }}</p>
          </section>

          <!-- 3. Payment -->
          <section class="cm-card" aria-labelledby="cm-payment-title">
            <div class="cm-card-head"><h2 id="cm-payment-title" class="cm-card-title"><span class="cm-step">{{ requiresDelivery ? 3 : 2 }}</span>{{ $t('checkoutModern.payment') }}</h2></div>
            <p v-if="isPreorderCart" class="cm-muted">{{ $t('preorderCard.explanation') }}</p>
            <div v-if="availablePaymentMethods.length" class="cm-options" role="radiogroup" :aria-label="$t('common.chooseAPaymentMethod')">
              <label v-for="method in availablePaymentMethods" :key="method.value" class="cm-option cm-method" :class="{ 'cm-option-active': paymentChoice === method.value, 'cm-method-branded': ['card', 'apple_pay', 'instapay'].includes(method.value) }">
                <input v-model="paymentChoice" type="radio" name="payment-method" :value="method.value" class="sr-only" @change="methodTouched = true">
                <span class="cm-radio" aria-hidden="true" />
                <span class="cm-option-body">
                  <strong>{{ $uiLabel(method.label) }}</strong>
                  <span class="cm-muted block">{{ methodHint(method) }}</span>
                  <span v-if="getMethodFee(method.value === 'apple_pay' ? 'card' : method.value)" class="cm-fee">{{ $t('checkoutModern.fee', { amount: formatCurrency(getMethodFee(method.value === 'apple_pay' ? 'card' : method.value)) }) }}</span>
                  <span v-if="paymentChoice === method.value && methodDetail(method)" class="cm-method-note"><Icon name="lucide:shield-check" size="15" aria-hidden="true" />{{ methodDetail(method) }}</span>
                </span>
                <span class="cm-marks">
                  <template v-if="method.value === 'card'"><span class="cm-chip"><CheckoutPaymentMark name="visa" label="Visa" size="sm" /></span><span class="cm-chip"><CheckoutPaymentMark name="mastercard" label="Mastercard" /></span><span class="cm-chip cm-chip-text">Meeza</span></template>
                  <span v-else-if="method.value === 'apple_pay'" class="cm-chip"><CheckoutPaymentMark name="apple-pay" label="Apple Pay" /></span>
                  <span v-else-if="method.value === 'instapay'" class="cm-chip cm-chip-text">InstaPay</span>
                  <span v-else class="cm-method-icon"><Icon :name="method.icon" size="20" aria-hidden="true" /></span>
                </span>
              </label>
            </div>
            <p v-else class="cm-notice cm-notice-warn">{{ $t('checkout.noPaymentMethodIsAvailablePleaseContactTheStore') }}</p>

            <Transition name="cm-expand" mode="out-in">
              <div :key="paymentChoice" class="cm-method-detail">
                <p v-if="selectedPaymentMethod === 'card' && paymentCapabilities?.card?.mode === 'test'" class="cm-warn">{{ $t('paymob.testOnly') }}</p>
                <p v-if="prepaidFlow && selectedPaymentMethod === 'instapay'" class="cm-muted">{{ $t('transfer.afterConfirm') }}</p>
                <div v-else-if="paymentMethodNeedsProof(selectedPaymentMethod)" class="cm-proof">
                  <h3>{{ $t('common.transferInstructions') }}</h3><p class="whitespace-pre-line">{{ paymentInstructions || $t('checkout.contactTheStoreForTransferDetailsBeforeSendingPayment') }}</p>
                  <template v-if="isPreorderCart"><p class="cm-muted">{{ $t('checkout.afterConfirmingUseYourOrderNumberWhenContactingTheStoreAboutYourTransferStaffWillRecordTheAmountOnlyAfterVerifyingItYourOrderRemainsUnpaidUntilThen') }}</p></template>
                  <template v-else><PaymentProofUpload v-model="proofFile" backend-notice="Proof selection is available now. Secure submission will be activated with the payment backend; you can also return from My Account → Orders." /><p class="cm-muted">{{ $t('checkout.youCanConfirmTheOrderWithoutProofAndReturnLaterTheOrderWillStayAtPaymentPendingUntilProofIsSubmittedAndReviewed') }}</p></template>
                </div>
              </div>
            </Transition>

            <label v-if="isPreorderCart && selectedPaymentMethod === 'card'" class="cm-check cm-divider"><input v-model="preorderAccepted" type="checkbox">{{ $t('preorderCard.consent') }}</label>
            <p v-if="quote?.stockFulfillmentState === 'untracked' && quote.fulfillmentMessage" class="cm-muted cm-divider">{{ quote.fulfillmentMessage }}</p>
            <div v-if="quote?.stockFulfillmentState === 'awaiting_stock'" class="cm-divider cm-backorder">
              <p class="font-semibold">{{ $t('beta.specialOrder') }}</p><p>{{ quote.fulfillmentMessage }}</p><p>{{ $t('beta.wholeOrderWaits') }}</p>
              <label class="cm-check"><input v-model="backorderAccepted" type="checkbox">{{ $t('beta.acceptTerms') }}</label>
            </div>
          </section>
        </main>

        <aside class="cm-card cm-summary" aria-labelledby="cm-summary-title">
          <h2 id="cm-summary-title" class="cm-card-title">{{ $t('common.orderSummary') }} <span class="cm-muted cm-count">{{ $t('checkoutModern.items', { count: itemCount }, itemCount) }}</span></h2>
          <ul class="cm-lines cm-lines-scroll"><li v-for="item in items" :key="item.cart_key" class="cm-line">
            <span class="cm-thumb"><img v-if="item.image_url" :src="item.image_url" :alt="item.title" loading="lazy"></span>
            <span class="cm-line-text"><span class="cm-line-title">{{ quoteLine(item)?.title || item.title }}</span>
              <span class="cm-muted cm-line-meta">{{ lineMeta(item) }}</span>
              <ProductOptionSummary :values="quoteLine(item)?.variantOptions || item.variant_options" />
              <span v-if="item.selling_mode === 'preorder'" class="cm-warn">{{ $t('common.preOrderValue', { value0: ((quoteLine(item)?.paymentMode || item.preorder_payment_mode) === 'deposit' ? $t('preorder.depositPercent', { value0: (quoteLine(item)?.depositPercent ?? item.preorder_deposit_percent) }) : $t('common.fullPayment')) }) }}</span>
              <span v-if="quoteLine(item)?.expectedAvailabilityDate || item.expected_availability_date" class="cm-muted">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(quoteLine(item)?.expectedAvailabilityDate || item.expected_availability_date)) }) }}</span></span>
            <span class="cm-line-price">{{ formatCurrency(quoteLine(item)?.total ?? item.price * item.quantity) }}</span>
          </li></ul>

          <div v-if="!isPreorderCart" class="cm-coupon">
            <button v-if="!couponOpen && !appliedCoupon" type="button" class="cm-link" @click="couponOpen = true"><Icon name="lucide:tag" size="15" aria-hidden="true" />{{ $t('checkoutModern.haveCode') }}</button>
            <Transition name="cm-expand">
              <div v-if="couponOpen || appliedCoupon">
                <p v-if="paymentCapabilities?.purchase?.beta && !paymentCapabilities.purchase.couponsEnabled" class="cm-muted">{{ $t('commerceReliability.couponDisabled') }}</p>
                <div v-if="appliedCoupon" class="cm-coupon-applied"><span><Icon name="lucide:tag" size="15" aria-hidden="true" />{{ appliedCoupon.code }}</span><button type="button" class="cm-link cm-link-danger" @click="removeCoupon">{{ $t('common.remove') }}</button></div>
                <form v-else class="cm-coupon-form" @submit.prevent="applyCoupon">
                  <input v-model="couponCode" type="text" :placeholder="$t('checkoutModern.discountCode')" :aria-label="$t('checkoutModern.discountCode')" autocomplete="off">
                  <button type="submit" :disabled="applyingCoupon || !couponCode.trim()" class="cm-button-sm">{{ applyingCoupon ? $t('common.applying') : $t('common.apply') }}</button>
                </form>
                <p v-if="couponError" class="cm-error">{{ $uiMessage(couponError) }}</p><p v-if="couponSuccess" class="cm-success">{{ $uiLabel(couponSuccess) }}</p>
              </div>
            </Transition>
          </div>

          <dl class="cm-totals" :class="{ 'cm-dim': quoteLoading }">
            <div><dt>{{ isPreorderCart ? $t('common.preorderMerchandise') : $t('common.subtotal') }}</dt><dd>{{ formatCurrency(quote?.orderValue ?? subtotal) }}</dd></div>
            <div v-if="appliedCoupon && !isPreorderCart" class="cm-saving"><dt>{{ $t('common.coupon') }} · {{ appliedCoupon.code }}</dt><dd>− {{ formatCurrency(discountAmount - deliveryDiscountAmount) }}</dd></div>
            <div v-if="deliveryDiscountAmount" class="cm-saving"><dt>{{ $t('common.deliveryDiscount') }}</dt><dd>− {{ formatCurrency(deliveryDiscountAmount) }}</dd></div>
            <div><dt>{{ $t('common.shipping') }}</dt><dd>{{ quote?.shipping ? (Number(quote.shippingFee) === 0 ? $t('checkoutModern.free') : formatCurrency(quote.shippingFee)) : requiresDelivery ? '—' : $t('common.calculatedLater') }}</dd></div>
            <div v-if="paymentFee"><dt>{{ $t('common.paymentFee') }}</dt><dd>+ {{ formatCurrency(paymentFee) }}</dd></div>
            <div class="cm-total"><dt>{{ $t('checkoutModern.total') }}</dt><dd>{{ totalLabel }}</dd></div>
            <template v-if="isPreorderCart"><div class="cm-total-sub"><dt>{{ $t('common.requiredNow') }}</dt><dd>{{ formatCurrency(quote?.requiredNow || 0) }}</dd></div><div><dt>{{ $t('common.remainingAfterPayment') }}</dt><dd>{{ formatCurrency(quote?.remainingAfterPayment || 0) }}</dd></div></template>
          </dl>
          <p v-if="quoteLoading" class="cm-updating" role="status"><span class="cm-spinner" aria-hidden="true" />{{ $t('checkoutModern.updating') }}</p>
          <div v-if="quoteError" class="cm-notice cm-notice-error cm-summary-alert" role="alert">
            <Icon name="lucide:circle-alert" size="18" aria-hidden="true" />
            <div><p>{{ $uiMessage(quoteError) }}</p><p class="cm-summary-alert-actions"><button v-if="!quoteLoading" type="button" class="cm-link" @click="refreshQuote">{{ $t('checkoutModern.retry') }}</button><NuxtLinkLocale to="/cart" class="cm-link">{{ $t('checkoutModern.backToCart') }}</NuxtLinkLocale></p></div>
          </div>

          <button type="button" class="cm-primary cm-primary-desktop" :disabled="primaryDisabled" @click="submit"><span v-if="placingOrder" class="cm-spinner cm-spinner-light" aria-hidden="true" /><Icon v-else-if="paymentChoice === 'apple_pay'" name="lucide:smartphone" size="18" aria-hidden="true" /><Icon v-else name="lucide:lock" size="16" aria-hidden="true" />{{ primaryLabel }}</button>
          <p class="cm-trust"><Icon name="lucide:shield-check" size="15" aria-hidden="true" />{{ $t('checkoutModern.trust') }}</p>
        </aside>
      </div>
    </div>

    <div v-if="!isEmpty && !savedCheckout" class="cm-paybar">
      <div class="cm-paybar-total" :class="{ 'cm-dim': quoteLoading }"><span>{{ $t('checkoutModern.total') }}</span><strong>{{ totalLabel }}</strong></div>
      <button type="button" class="cm-primary" :disabled="primaryDisabled" @click="submit"><span v-if="placingOrder" class="cm-spinner cm-spinner-light" aria-hidden="true" />{{ primaryLabel }}</button>
    </div>
  </div>
</template>

<script setup>
import CheckoutPaymentMark from '~/components/checkout/PaymentMark.vue'

const props = defineProps({ flow: { type: Object, required: true } })
const {
  address, addressComplete, addressConflict, addressExpanded, addressLabel, addressLoadError, addressBookError, addressBookNotice,
  affectedPayment, appliedCoupon, applyCoupon, applyingCoupon, authorizeEmbeddedPayment, availableDeliveryOptions, availablePaymentMethods,
  backorderAccepted, preorderAccepted, busyAddress, checkEmbeddedPayment, confirmAddressRemoval, couponCode, couponError, couponSuccess, customerId,
  deliveryDiscountAmount, deliveryError, discountAmount, dismissPayment, editAddress, embeddedPayment, embeddedUnavailable,
  expectedAvailabilityLabel, formatCurrency, getMethodFee, hasSavedAddress, hostedFallback, isEmpty, isPreorderCart, itemCount, items,
  keepAsNewAddress, loadDeliveryOptions, loadSavedAddresses, loadingAddresses, loadingDelivery, loadingProfile, merchantRiskRetry,
  openHostedFallback, orderError, paymentCapabilities, paymentChoice, paymentFee, paymentFormError, paymentInstructions,
  paymentMethodNeedsProof, paymentSummary, pendingCheckout, placeOrder, placingOrder, prepaidFlow, proofFile, quote, quoteError,
  quoteLine, quoteLoading, recoverCheckout, recoveryVisible, refreshQuote, removeAddress, removeCoupon, removingAddress,
  requiresDelivery, reviewCart, reviewRequired, saveAddress, savedAddresses, savedCheckout, savingAddress, selectCheckoutAddress,
  selectedAddressKey, selectedPaymentMethod, selectedSavedAddress, shippingCompanyId, subtotal, totalAmount, useSavedVersion,
  validateAddress
} = props.flow
const { t } = useI18n()

const picker = ref(false), summaryOpen = ref(false), couponOpen = ref(false)
// Option and quantity share one quiet line. Placeholder option names stay hidden.
const lineMeta = item => {
  const name = String(quoteLine(item)?.variantName || item.variant_name || '').trim()
  return [/^(default|standard|base|product)$/i.test(name) ? '' : name, t('checkoutModern.quantity', { value0: item.quantity })].filter(Boolean).join(' · ')
}
// Card is the default until the customer chooses; methods can arrive after mount.
const methodTouched = ref(false)
watch(availablePaymentMethods, methods => {
  if (methodTouched.value) return
  const preferred = methods.find(method => method.value === 'card') || methods[0]
  if (preferred && paymentChoice.value !== preferred.value) paymentChoice.value = preferred.value
}, { immediate: true })
const totalLabel = computed(() => requiresDelivery.value && !quote.value ? '—' : formatCurrency(totalAmount.value))
const hints = { card: 'checkoutModern.cardHint', apple_pay: 'checkoutModern.appleHint', cash: 'checkoutModern.cashHint', instapay: 'checkoutModern.instapayHint', bank_transfer: 'checkoutModern.bankHint' }
const methodHint = method => hints[method.value] ? t(hints[method.value]) : method.description
const methodDetail = method => method.value === 'card' && prepaidFlow.value ? t('checkoutModern.cardDetail') : method.value === 'apple_pay' ? t('checkoutModern.appleDetail') : ''
const chooseSaved = id => { selectCheckoutAddress(id); picker.value = false }

const waitingForTotal = computed(() => addressComplete.value && (quoteLoading.value || (!quote.value && !quoteError.value)))
const primaryDisabled = computed(() => placingOrder.value || Boolean(reviewRequired.value) || !availablePaymentMethods.value.length
  || savingAddress.value || removingAddress.value || (addressComplete.value && (quoteLoading.value || !quote.value)))
const primaryLabel = computed(() => {
  if (placingOrder.value) return t('common.confirming')
  if (!addressComplete.value) return t('checkoutModern.completeDetails')
  if (waitingForTotal.value) return t('checkoutModern.updating')
  if (prepaidFlow.value && selectedPaymentMethod.value === 'card') return paymentChoice.value === 'apple_pay' ? t('checkoutModern.payApple') : t('checkoutModern.payAmount', { amount: formatCurrency(isPreorderCart.value ? (quote.value?.requiredNow ?? totalAmount.value) : totalAmount.value) })
  if (isPreorderCart.value) return t('common.confirmPreOrder')
  return t('checkoutModern.placeOrder')
})
// One action: incomplete details open the form; otherwise the shared flow pays.
const submit = async () => {
  if (!addressComplete.value) {
    picker.value = false; addressExpanded.value = true; validateAddress()
    await nextTick(); document.getElementById('cm-address')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  await placeOrder()
  if (orderError.value) { await nextTick(); document.getElementById('cm-order-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
}
</script>
