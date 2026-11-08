// Shared checkout state and commands. Classic and Modern layouts render the
// same flow, so ordering, payment, recovery and retry contracts stay identical.
import {applePayDeviceEligible} from '~/utils/paymobPixel'
import {emitMetaEvent} from '~/utils/metaTracking'
import {hostedPaymentUrl} from '~/utils/hostedPayment'
import { readPendingCheckoutForCart, savePendingCheckout, removePendingCheckout, checkoutLock } from '~/utils/checkoutRecovery'
import { egyptGovernorates } from '~/utils/egyptGovernorates'
import { getPaymentMethodFee, getPaymentMethodLabel, paymentMethodNeedsProof } from '~/utils/paymentMethods'
import { checkoutPaymentMethods, checkoutDeliveryOptions } from '~/utils/codCheckout'
import { expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'
import { checkoutAddressFromProfile, hasDeliveryTestMarker } from '~/utils/checkoutAddress'
import { useCheckoutAddresses } from '~/composables/useCheckoutAddresses'

export function useCheckoutFlow(options) {
  const { locale, t } = useI18n()
  const { uiLabel } = useUiLocale()

  const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

  const { intlLocale } = useUiLocale()

  const { uiNavigateTo } = useUiNavigation()



  const PHONE_PATTERN = /^01\d{9}$/
  const supabase = useSupabaseClient()
  const customerScope = useCustomerScope()
  const user = useCustomerIdentity().user
  const siteContent = options.siteContent
  const { capabilities: paymentCapabilities, scope: purchaseScope, purchasingEnabled, refresh: refreshPurchaseAccess } = usePurchaseAccess()
  const { waitForSync, syncState, items, owner: cartOwner, cartId, itemCount, subtotal, isEmpty, appliedCoupon, revision, syncCart, renewCart, completeCart, ensurePurchaseLineIdentities, setAppliedCoupon, resetCoupon, loadCart } = useCart()
  const { trackEvent } = useStoreAnalytics()

  const paymentFirstRuntime=useRuntimeConfig()
  const merchantRiskRetry=computed(()=>paymentCapabilities.value?.purchase?.merchantRiskRetries===true)
  const prepaidFlow=computed(()=>[true,'true'].includes(paymentFirstRuntime.public.paymentFirstEnabled))
  const savedCheckout=ref(''),hostedFallback=ref(''),embeddedPayment=shallowRef(null),paymentSummary=shallowRef(null),recoveryVisible=ref(false)
  const activeInterface=shallowRef(null),affectedPayment=shallowRef(null)
  const paymentFormError=ref('')
  const appleDevice=ref(false),selectedPaymobMethod=ref('card')
  let embeddedFallback='',paymentEpoch=0,submissionStarted=false
  const paymentChoice=computed({get:()=>selectedPaymentMethod.value==='card'&&selectedPaymobMethod.value==='apple_pay'?'apple_pay':selectedPaymentMethod.value,set:value=>{selectedPaymobMethod.value=value==='apple_pay'?'apple_pay':'card';selectedPaymentMethod.value=value==='apple_pay'?'card':value}})
  const embeddedUnavailable=({beforeSubmit})=>{embeddedPayment.value=null;paymentFormError.value=t('paymentInterface.formUnavailable');if(beforeSubmit&&selectedPaymobMethod.value==='card')hostedFallback.value=embeddedFallback}
  const checkEmbeddedPayment=()=>savedCheckout.value&&uiNavigateTo(`/checkout/session/${savedCheckout.value}`)
  const authorizeEmbeddedPayment=async()=>{
   const id=savedCheckout.value,payment=activeInterface.value,epoch=paymentEpoch
   if(!id||!payment?.interfaceToken||!customerScope.isCurrent())return false
   submissionStarted=true
   try{
    const result=await customerScope.request(`/api/account/payment-checkouts/${id}/interface`,{method:'POST',body:{version:2,action:'submit',token:payment.interfaceToken},retry:0,timeout:10000})
    if(epoch!==paymentEpoch||!customerScope.isCurrent())return false
    paymentSummary.value=result.checkout
    return result.allowed===true
   }catch{return false}
  }
  const dismissPayment=()=>{
   if(merchantRiskRetry.value&&savedCheckout.value){void customerScope.request(`/api/account/payment-checkouts/${savedCheckout.value}/retire`,{method:'POST',body:{},retry:0,timeout:10000}).catch(()=>{})}
   else if(submissionStarted&&paymentSummary.value)affectedPayment.value=paymentSummary.value
   paymentEpoch++;savedCheckout.value='';embeddedPayment.value=null;activeInterface.value=null;hostedFallback.value='';embeddedFallback='';submissionStarted=false
   orderError.value='';paymentFormError.value='';recoveryVisible.value=false
  }
  const openHostedFallback=async()=>{
   const id=savedCheckout.value,payment=activeInterface.value,epoch=paymentEpoch
   if(placingOrder.value||!id||!payment?.interfaceToken||!hostedFallback.value)return
   placingOrder.value=true;submissionStarted=true;hostedFallback.value=''
   try{
    const result=await customerScope.request(`/api/account/payment-checkouts/${id}/interface`,{method:'POST',body:{version:2,action:'hosted',token:payment.interfaceToken},retry:0,timeout:10000})
    if(epoch!==paymentEpoch||!customerScope.isCurrent())return
    paymentSummary.value=result.checkout
    if(result.allowed===true)window.location.assign(hostedPaymentUrl(payment))
    else await checkEmbeddedPayment()
   }catch{if(epoch===paymentEpoch)orderError.value=t('paymentInterface.unavailable')}
   finally{placingOrder.value=false}
  }
  const checkoutStep = ref('shipping')
  const loadingProfile = ref(false)
  const addressExpanded = ref(true)
  const applyingCoupon = ref(false)
  const placingOrder = ref(false)
  const couponCode = ref('')
  const couponError = ref('')
  const couponSuccess = ref('')
  const orderError = ref('')
  const selectedPaymentMethod = ref('')
  const shippingCompanyId = ref('')
  const requiresDelivery = computed(() => ['cash','card','instapay'].includes(selectedPaymentMethod.value))
  const deliveryOptions = ref([])
  const loadingDelivery = ref(false)
  const deliveryError = ref('')
  const proofFile = ref(null)
  const quote = ref(null)
  const quoteError = ref('')
  // Modern layout keeps the last totals visible while a refresh runs.
  const quoteRequests = ref(0)
  const quoteLoading = computed(() => quoteRequests.value > 0)
  const backorderAccepted = ref(false)
  const pendingCheckout = ref(null)
  const reviewRequired = ref('')
  const customerId = ref(customerScope.accountId)
  let quoteSequence = 0
  let quoteTimer
  const scheduleQuote = () => {clearTimeout(quoteTimer);quoteTimer=setTimeout(() => {if(addressComplete.value && availablePaymentMethods.value.length) void refreshQuote()},180)}
  const readPending = () => { const retained=readPendingCheckoutForCart(window.localStorage, customerId.value, { id: cartId.value, revision: revision.value });pendingCheckout.value=merchantRiskRetry.value&&retained?.body?.payment_method==='card'?null:retained }
  let checkoutStartedTracked = false

  const address = reactive({ first_name: '', last_name: '', street_address: '', address_line_2: '', city: '', phone: '', email: '', governorate: '' })

  const settings = computed(() => siteContent.value?.settings || {})
  const availableDeliveryOptions = computed(() => checkoutDeliveryOptions(deliveryOptions.value, address.governorate, selectedPaymentMethod.value))
  const isPreorderCart = computed(() => items.value.length > 0 && items.value.every(item => item.selling_mode === 'preorder'))
  const availablePaymentMethods = computed(() => {
   const methods=purchasingEnabled.value?checkoutPaymentMethods(settings.value,paymentCapabilities.value,{restricted:Boolean(purchaseScope.value),preorder:isPreorderCart.value}):[]
   return methods.flatMap(method=>method.value==='card'&&appleDevice.value&&paymentCapabilities.value?.express?.some(item=>item.method==='apple_pay'&&item.available)?[method,{...method,value:'apple_pay',label:'Apple Pay',descriptionKey:'embeddedCheckout.apple',icon:'lucide:smartphone'}]:[method])
  })
  const discountAmount = computed(() => Number(quote.value?.discountAmount ?? appliedCoupon.value?.discountAmount ?? 0))
  const deliveryDiscountAmount = computed(() => Number(quote.value?.deliveryDiscountAmount ?? appliedCoupon.value?.deliveryDiscountAmount ?? 0))
  // Order value before any payment fee: the quote's when present, else the cart estimate.
  const feeBase = computed(() => quote.value ? Number(quote.value.totalAmount || 0) - Number(quote.value.paymentFee || 0) : Number(subtotal.value || 0) - (isPreorderCart.value ? 0 : discountAmount.value))
  const paymentFee = computed(() => quote.value ? Number(quote.value.paymentFee || 0) : getPaymentMethodFee(settings.value, selectedPaymentMethod.value, feeBase.value))
  const totalAmount = computed(() => quote.value?.totalAmount ?? Math.max(0, Number(quote.value?.orderValue ?? subtotal.value) - (isPreorderCart.value ? 0 : discountAmount.value) + paymentFee.value))
  const quoteLine = item => quote.value?.lines?.find(line => line.productId === item.id && line.variantId === (item.variant_id || null))

  const checkoutBody = () => ({
    items: items.value.map(item => ({ id: item.id, variant_id: item.variant_id || null, quantity: item.quantity })),
    cart_id: cartId.value || null, coupon_code: isPreorderCart.value ? '' : appliedCoupon.value?.code || '',
    address: { ...address, email: address.email.trim() || user.value?.email || '' },
    shipping_method: 'shipping', payment_method: selectedPaymentMethod.value, locale: locale.value,
    ...(requiresDelivery.value && shippingCompanyId.value ? { shipping_company_id: shippingCompanyId.value } : {}),
    backorder_accepted: backorderAccepted.value
  })
  const loadDeliveryOptions = async () => {
    loadingDelivery.value = true
    deliveryError.value = ''
    try {
      const result = await customerScope.request('/api/checkout/shipping')
      deliveryOptions.value = result.options
    } catch (error) {
      deliveryOptions.value = []
      deliveryError.value = error?.data?.statusMessage || 'Delivery options are unavailable.'
    } finally { loadingDelivery.value = false }
  }

  const refreshQuote = async () => {
    if (!customerScope.isCurrent()) return false
    syncCart()
    if (!items.value.length) { quote.value = null; return false }
    if (!await waitForSync()) {quote.value=null;return false}
    if (requiresDelivery.value && !shippingCompanyId.value) { quote.value = null; quoteError.value = ''; return false }
    const sequence = ++quoteSequence, body = checkoutBody(), identity = JSON.stringify(body)
    const previous = quote.value
    quoteRequests.value++
    try {
      const next = await customerScope.request('/api/checkout/quote', { method: 'POST', body })
      syncCart()
      if (sequence !== quoteSequence || identity !== JSON.stringify(checkoutBody())) return false
      quote.value = next
      if (previous && JSON.stringify([previous.totalAmount, previous.requiredNow, previous.lines, previous.shipping, previous.stockFulfillmentState, previous.fulfillmentMessage]) !== JSON.stringify([next.totalAmount, next.requiredNow, next.lines, next.shipping, next.stockFulfillmentState, next.fulfillmentMessage])) {
        backorderAccepted.value = false
        quoteError.value = 'Checkout changed. Review the updated summary, then continue.'
        return false
      }
      quoteError.value = ''
      return true
    } catch (error) {
      if (sequence === quoteSequence) {
        quote.value = null
        quoteError.value = error?.data?.statusMessage || 'Could not refresh current prices and availability.'
      }
      return false
    } finally {
      quoteRequests.value--
    }
  }
  watch([revision, address, locale, shippingCompanyId], () => {
    backorderAccepted.value = false
    ++quoteSequence
    quote.value = null
    if (checkoutStep.value === 'payment') {
      checkoutStep.value = 'shipping'
      quoteError.value = 'Checkout changed. Review your cart and delivery details.'
    }
    scheduleQuote()
  }, { deep: true, flush: 'sync' })
  watch(selectedPaymentMethod, () => {
    ++quoteSequence
    quote.value = null
    scheduleQuote()
  }, { flush: 'sync' })
  const hasSavedAddress = computed(() => Boolean(address.street_address && address.city && address.governorate))
  const addressComplete = computed(() => Boolean(address.first_name.trim() && address.street_address.trim() && address.city.trim()
    && egyptGovernorates.includes(address.governorate.trim()) && PHONE_PATTERN.test(address.phone.trim())
    && (!address.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim())) && !hasDeliveryTestMarker(address)))
  watch([availableDeliveryOptions, addressComplete, () => address.city, revision], ([options, complete]) => {
    shippingCompanyId.value = complete && !loadingDelivery.value
      ? [...options].filter(option => Number.isFinite(option.price) && option.price >= 0).sort((a,b) => a.price-b.price || a.id.localeCompare(b.id))[0]?.id || '' : ''
  })
  const { savedAddresses, profileDraftSummary, selectedAddressKey, selectedSavedAddress, addressLabel, busyAddress, loadingAddresses, savingAddress, removingAddress,
    addressLoadError, addressBookError, addressBookNotice, addressConflict, confirmAddressRemoval,
    setProfileAddress, chooseAddress, loadSavedAddresses, saveAddress, keepAsNewAddress, useSavedVersion, removeAddress
  } = useCheckoutAddresses(address, addressExpanded, addressComplete, customerScope)
  const selectCheckoutAddress = key => chooseAddress(key)
  const paymentInstructions = computed(() => selectedPaymentMethod.value === 'bank_transfer' ? settings.value.payment_bank_transfer_instructions : settings.value.payment_instapay_instructions)

  watch(availablePaymentMethods, methods => {
    if (!methods.some(method => method.value === paymentChoice.value)) paymentChoice.value = methods[0]?.value || ''
  }, { immediate: true })


  const formatCurrency = value => new Intl.NumberFormat(intlLocale.value, { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
  const getMethodFee = method => quote.value && method === selectedPaymentMethod.value ? Number(quote.value.paymentFee || 0) : getPaymentMethodFee(settings.value, method, feeBase.value)

  const fillAddressFromProfile = profile => {
    Object.assign(address, checkoutAddressFromProfile(profile, user.value?.email))
    addressExpanded.value = !addressComplete.value
    setProfileAddress()
  }
  const editAddress = async () => {
    addressExpanded.value = true
    await nextTick()
    document.getElementById('checkout-address-fields')?.querySelector('input')?.focus()
  }

  const loadCustomerProfile = async () => {
    loadingProfile.value = true
    const customerUserId = customerScope.accountId
    if (!customerUserId) { loadingProfile.value = false; orderError.value = 'Could not load the authenticated customer account.'; return }
    const { data, error } = await supabase.from('customer_profiles').select('*').eq('id', customerUserId).maybeSingle()
    if (!customerScope.isCurrent()) return
    loadingProfile.value = false
    if (error) { addressExpanded.value = true; orderError.value = error.message; return }
    fillAddressFromProfile(data || {})
    await loadSavedAddresses()
  }

  const validateAddress = () => {
    if (!address.first_name.trim()) return (orderError.value = 'First name is required.', false)
    if (!address.street_address.trim()) return (orderError.value = 'Street address is required.', false)
    if (!address.city.trim()) return (orderError.value = 'City is required.', false)
    if (!address.governorate.trim()) return (orderError.value = 'Governorate is required.', false)
    if (!PHONE_PATTERN.test(address.phone.trim())) return (orderError.value = 'Phone number must start with 01 and contain 11 digits.', false)
    if (requiresDelivery.value && !availableDeliveryOptions.value.some(option => option.id === shippingCompanyId.value)) return (orderError.value = 'Choose delivery for your governorate.', false)
    return true
  }

  const continueToPayment = async () => {
    if (savingAddress.value || removingAddress.value) return
    orderError.value = ''
    if (!validateAddress()) { addressExpanded.value = true; return }
    if (!await refreshQuote()) return
    if (!availablePaymentMethods.value.length) { orderError.value = 'No payment method is available. Please contact the store.'; return }
    checkoutStep.value = 'payment'
    nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  const validatePayment = () => {
    if (quote.value?.stockFulfillmentState === 'awaiting_stock' && !backorderAccepted.value) return t('beta.acceptTerms')
    if (!availablePaymentMethods.value.some(method => method.value === paymentChoice.value)) return 'Choose an available payment method.'
    return ''
  }

  const applyCoupon = async () => {
    couponError.value = ''; couponSuccess.value = ''
    if (!couponCode.value.trim()) { couponError.value = 'Enter a coupon code first.'; return }
    if(paymentCapabilities.value?.purchase?.beta && !paymentCapabilities.value.purchase.couponsEnabled){couponError.value=t('commerceReliability.couponDisabled');return}
    applyingCoupon.value = true
    try {
      const response = await customerScope.request('/api/checkout/coupon', { method: 'POST', body: { ...checkoutBody(), coupon_code: couponCode.value } })
      setAppliedCoupon(response.coupon); await waitForSync(); await refreshQuote(); couponCode.value = response.coupon?.code || couponCode.value.trim().toUpperCase(); couponSuccess.value = 'Coupon applied.'
    } catch (error) { if (customerScope.isCurrent()) { resetCoupon(); couponError.value = error?.data?.statusMessage || error?.message || 'Could not apply the coupon.' } } finally { applyingCoupon.value = false }
  }

  const removeCoupon = () => { resetCoupon(); couponSuccess.value = ''; couponError.value = ''; couponCode.value = ''; scheduleQuote() }

  const newCheckoutCommand=()=>JSON.parse(JSON.stringify({version:1,userId:customerId.value,
   body:{...checkoutBody(),...(prepaidFlow.value&&selectedPaymentMethod.value==='card'?{paymob_method:selectedPaymobMethod.value,payment_ui_version:2}:{}),...(prepaidFlow.value&&selectedPaymentMethod.value!=='cash'?{cart_revision:revision.value,cart_lines:items.value.map(({cart_key,cart_line_id,quantity})=>({cart_key,cart_line_id,quantity}))}:{}),quote_id:quote.value.quoteId,...(quote.value.reviewToken?{review_token:quote.value.reviewToken}:{})},
   cart:{id:cartId.value,revision:revision.value,owner:cartOwner.value},review:quote.value}))
  const sendCommand = async (command,explicit=false,restarted=false) => {
    pendingCheckout.value = command
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.access_token || data.session.user.id !== command.userId) throw new Error('Your session expired. Please log in again.')
      customerScope.assertCurrent()
      const response = await customerScope.request('/api/checkout', {
        method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}` }, body: {...command.body,...(prepaidFlow.value&&command.body.payment_method==='card'?{payment_ui_version:2}:{})}, retry: 0
      })
      if(response.checkout){
        customerScope.assertCurrent()
        if(response.blocked || response.allowed === false){
          removePendingCheckout(window.localStorage,command);readPending()
          affectedPayment.value=response.checkout
          orderError.value=t('paymentInterface.affectedStatus')
          recoveryVisible.value=false
          return
        }
        customerScope.assertCurrent();savedCheckout.value=response.checkout.id;paymentSummary.value=response.checkout;recoveryVisible.value=false
        // The private server session is a durable acknowledgement, including an
        // uncertain payment. A global browser command must not lock future carts.
        removePendingCheckout(window.localStorage,command);readPending()
        affectedPayment.value=null;submissionStarted=false;paymentFormError.value='';paymentEpoch++
        if(explicit&&response.payment){
         if(response.payment.experience==='embedded'&&response.payment.paymentMethods?.length===1&&response.payment.paymentMethods[0]==='apple-pay'){
          await uiNavigateTo(`/checkout/apple/${response.checkout.id}`,{external:true});return
         }
         if(response.payment.experience==='embedded'){
          hostedFallback.value='';embeddedFallback=response.payment.redirectFallback?hostedPaymentUrl(response.payment):''
          activeInterface.value=response.payment
          if(paymentCapabilities.value?.card?.experience==='embedded')embeddedPayment.value={...response.payment,expiresAt:response.checkout.expiresAt}
          else orderError.value=t('paymentFirst.openSaved')
         }else{
          const url=hostedPaymentUrl(response.payment);hostedFallback.value='';submissionStarted=true
          try{window.location.assign(url)}catch{orderError.value=t('paymentFirst.openSaved')}
         }
        }else await uiNavigateTo(response.checkout.method==='instapay'?`/checkout/transfer/${response.checkout.id}`:`/checkout/session/${response.checkout.id}`)
        return
      }
      const current = (await supabase.auth.getSession()).data.session
      customerScope.assertCurrent()
      if (current?.user.id === command.userId) completeCart({ ...command.cart, owner: 'account:' + command.userId })
      removePendingCheckout(window.localStorage, command)
      readPending()
      if (current?.user.id !== command.userId) {
        orderError.value = 'Your session expired. Please log in again.'
        return
      }
      await uiNavigateTo(response.order.paymentMethod === 'card' ? `/checkout/payment/${response.order.id}` : `/checkout/summary/${response.order.id}`)
    } catch (error) {
      orderError.value = error?.data?.statusMessage || error?.message || 'Could not confirm checkout. Recover the same request.'
      const code = error?.data?.data?.code
      if(code==='checkout:restart'&&!restarted&&explicit){
        removePendingCheckout(window.localStorage,command);readPending();renewCart();syncCart();ensurePurchaseLineIdentities()
        if(!await refreshQuote())return
        const terms=review=>JSON.stringify([review.totalAmount,review.requiredNow,review.lines,review.shipping,review.stockFulfillmentState,review.fulfillmentMessage])
        if(terms(command.review)!==terms(quote.value)){orderError.value=t('paymentInterface.review');return}
        customerScope.assertCurrent();checkoutStep.value='payment';orderError.value=''
        const next=newCheckoutCommand();savePendingCheckout(window.localStorage,next)
        await sendCommand(next,true,true);return
      }
      if(code==='payment_first:existing'){
        const id=error?.data?.data?.checkoutId
        if(id){removePendingCheckout(window.localStorage,command);readPending();affectedPayment.value={id,reference:''};orderError.value=t('paymentInterface.affectedStatus');return}
        orderError.value=t('embeddedCheckout.pending');recoveryVisible.value=true;return
      }
      if(code==='payment_first:refresh'){orderError.value=t('paymentInterface.reload');return}
      if (code?.startsWith('coupon:') || ['checkout:conflict', 'checkout:legacy', 'checkout:retired', 'checkout:quote', 'checkout:unavailable', 'checkout:coupon', 'checkout:delivery', 'checkout:stock'].includes(code)) {
        removePendingCheckout(window.localStorage, command)
        readPending()
        reviewRequired.value = code
        quote.value = null
      }
    }
  }
  const placeOrder = async () => {
    if (placingOrder.value || reviewRequired.value) return
    if (!await waitForSync()) {orderError.value=t('cartSync.error');return}
    readPending()
    if(pendingCheckout.value&&!(merchantRiskRetry.value&&selectedPaymentMethod.value==='card')){recoveryVisible.value=true;await recoverCheckout();return}
    placingOrder.value = true
    orderError.value = ''
    try {
      const reviewed = quote.value
      if(prepaidFlow.value)ensurePurchaseLineIdentities()
      syncCart()
      if (!validateAddress()) { checkoutStep.value = 'shipping'; return }
      const paymentError = validatePayment()
      if (paymentError) { orderError.value = paymentError; return }
      if (!reviewed || quote.value !== reviewed || new Date(reviewed.expiresAt) <= new Date()) {
        await refreshQuote()
        quoteError.value = 'Review checkout before confirming.'
        return
      }
      if (!await refreshQuote()) return
      await checkoutLock(customerId.value, async () => {
        customerScope.assertCurrent()
        if(merchantRiskRetry.value&&selectedPaymentMethod.value==='card'){
         const previous=readPendingCheckoutForCart(window.localStorage,customerId.value,{id:cartId.value,revision:revision.value})
         if(previous?.body?.payment_method==='card')removePendingCheckout(window.localStorage,previous)
         const acceptedTerms=JSON.stringify([quote.value?.totalAmount,quote.value?.lines,quote.value?.shipping,quote.value?.stockFulfillmentState])
         renewCart();ensurePurchaseLineIdentities();syncCart()
         const syncDeadline=Date.now()+10000
         while(syncState.value==='saving'&&Date.now()<syncDeadline)await new Promise(resolve=>setTimeout(resolve,20))
         if(!await waitForSync()){orderError.value=t('cartSync.error');return}
         await nextTick();clearTimeout(quoteTimer)
         if(!await refreshQuote())return
         if(acceptedTerms!==JSON.stringify([quote.value?.totalAmount,quote.value?.lines,quote.value?.shipping,quote.value?.stockFulfillmentState])){orderError.value=t('paymentInterface.review');return}
         checkoutStep.value='payment'
        }
        readPending()
        if (pendingCheckout.value){recoveryVisible.value=true;await sendCommand(pendingCheckout.value,true);return}
        if (!quote.value || new Date(quote.value.expiresAt) <= new Date()) { quoteError.value = 'Review checkout before confirming.'; return }
        const command = newCheckoutCommand()
        emitMetaEvent('AddPaymentInfo',{path:'/checkout',cartId:cartId.value})
        // Persist before sending; an uncertain acknowledgement keeps this exact request.
        savePendingCheckout(window.localStorage, command)
        await sendCommand(command,true)
      })
    } catch (error) { orderError.value = error?.message || 'Could not retain checkout. Please try again.' }
    finally { placingOrder.value = false }
  }
  const recoverCheckout = async () => {
    if (placingOrder.value) return
    placingOrder.value = true
    try { await checkoutLock(customerId.value, async () => { customerScope.assertCurrent(); readPending(); if (pendingCheckout.value) await sendCommand(pendingCheckout.value,true) }) }
    finally { placingOrder.value = false }
  }
  const reviewCart = () => {
    if (code?.startsWith('coupon:') || ['checkout:conflict', 'checkout:legacy', 'checkout:retired'].includes(reviewRequired.value)) renewCart()
    reviewRequired.value = ''
    orderError.value = ''
    quote.value = null
    checkoutStep.value = 'shipping'
  }
  const restorePaymentPresentation=event=>{if(event.persisted&&merchantRiskRetry.value)dismissPayment()}
  const storageChanged = () => { readPending() }
  onBeforeUnmount(() => {clearTimeout(quoteTimer);paymentEpoch++;window.removeEventListener('storage', storageChanged);window.removeEventListener('pageshow',restorePaymentPresentation)})
  customerScope.onInvalidate(() => {
    savedCheckout.value='';hostedFallback.value='';embeddedPayment.value=null;paymentSummary.value=null;embeddedFallback='';recoveryVisible.value=false;appleDevice.value=false;selectedPaymobMethod.value='card'
    activeInterface.value=null;affectedPayment.value=null;submissionStarted=false;paymentFormError.value='';paymentEpoch++

    backorderAccepted.value = false
    ++quoteSequence
    customerId.value = ''
    pendingCheckout.value = null
    quote.value = null
    Object.keys(address).forEach(field => { address[field] = '' })
    addressExpanded.value = true
    couponCode.value = ''; couponError.value = ''; couponSuccess.value = ''
    selectedPaymentMethod.value = ''; shippingCompanyId.value = ''
    deliveryOptions.value = []; deliveryError.value = ''; proofFile.value = null
    orderError.value = ''; quoteError.value = ''; reviewRequired.value = ''
    checkoutStep.value = 'shipping'
  })

  onMounted(async () => {
    appleDevice.value=applePayDeviceEligible(window)
    loadCart()
    if (!customerScope.isCurrent()) return
    readPending()
    window.addEventListener('storage', storageChanged);window.addEventListener('pageshow',restorePaymentPresentation)
    if(pendingCheckout.value&&prepaidFlow.value&&pendingCheckout.value.body.payment_method==='card'){
      const retained=pendingCheckout.value
      try{
        const result=await customerScope.request('/api/account/payment-checkouts',{retry:0,timeout:10000})
        if(customerScope.isCurrent()&&result.items?.some(checkout=>checkout.cartId===retained.body.cart_id)){removePendingCheckout(window.localStorage,retained);readPending()}
      }catch{ /* Keep an unacknowledged request; never infer a payment outcome. */ }
    }
    if(!customerScope.isCurrent())return
    couponCode.value = appliedCoupon.value?.code || ''
    if (isPreorderCart.value && appliedCoupon.value) resetCoupon()
    await Promise.all([refreshPurchaseAccess(), loadCustomerProfile(), loadDeliveryOptions()])
    if (!customerScope.isCurrent()) return
    await refreshQuote()
    if (!customerScope.isCurrent()) return
    if (!checkoutStartedTracked && !isEmpty.value && cartId.value) { checkoutStartedTracked = true; trackEvent('checkout_started', { cartId: cartId.value, quantity: itemCount.value, source: 'checkout_page' }) }
  })


  return {
    paymentMethodNeedsProof,
    quoteLoading,
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
  }
}
