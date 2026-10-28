const addressFields = ['first_name', 'last_name', 'street_address', 'address_line_2', 'city', 'governorate', 'phone', 'email']
const storedFields = ['label', ...addressFields.filter(field => field !== 'email')]
const validRow = row => row && uuid.test(row.id) && Number.isInteger(row.revision) && row.revision > 0 && storedFields.every(field => typeof row[field] === 'string')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Private, component-lifetime drafts. Never persist customer addresses in browser storage.
export const useCheckoutAddresses = (address, expanded, complete, scope) => {
  const { t } = useI18n()
  const savedAddresses = ref([])
  const selectedAddressKey = ref('profile')
  const addressLabel = ref('')
  const loadingAddresses = ref(false)
  const savingAddress = ref(false)
  const removingAddress = ref(false)
  const addressLoadError = ref('')
  const addressBookError = ref('')
  const addressBookNotice = ref('')
  const addressConflict = ref(false)
  const confirmAddressRemoval = ref(false)
  const busyAddress = computed(() => loadingAddresses.value || savingAddress.value || removingAddress.value)
  const selectedSavedAddress = computed(() => savedAddresses.value.find(row => row.id === selectedAddressKey.value))
  const drafts = new Map(), createIds = new Map()
  let profileAddress = null, revision = null
  const snapshot = () => ({ address: { ...address }, label: addressLabel.value, revision, expanded: expanded.value })
  const clearMessages = () => { addressBookError.value = ''; addressBookNotice.value = ''; addressConflict.value = false; confirmAddressRemoval.value = false }
  const storeDraft = () => drafts.set(selectedAddressKey.value, snapshot())
  const setProfileAddress = () => { profileAddress = { ...address }; drafts.set('profile', snapshot()) }
  const chooseAddress = key => {
    if (busyAddress.value || !scope.isCurrent()) return
    const saved = savedAddresses.value.find(row => row.id === key)
    if (!['profile', 'new'].includes(key) && !saved) return
    storeDraft(); clearMessages()
    const draft = drafts.get(key)
    let values
    if (draft) { values = draft.address; addressLabel.value = draft.label; revision = draft.revision }
    else if (saved) { values = { ...saved, email: address.email }; addressLabel.value = saved.label; revision = saved.revision }
    else if (key === 'profile') { values = profileAddress || {}; addressLabel.value = ''; revision = null }
    else {
      values = Object.fromEntries(addressFields.map(field => [field, ['first_name', 'last_name', 'phone', 'email'].includes(field) ? profileAddress?.[field] || '' : '']))
      addressLabel.value = ''; revision = null
    }
    selectedAddressKey.value = key
    for (const field of addressFields) address[field] = values[field] || ''
    expanded.value = draft ? draft.expanded || !complete.value : key === 'new' || !complete.value
  }
  const keepAsNewAddress = () => {
    if (busyAddress.value || !scope.isCurrent()) return
    storeDraft(); selectedAddressKey.value = 'new'; revision = null; createIds.delete('new')
    expanded.value = true; clearMessages(); storeDraft()
  }
  const loadSavedAddresses = async () => {
    if (busyAddress.value || !scope.isCurrent()) return
    loadingAddresses.value = true; addressLoadError.value = ''
    try {
      const result = await scope.request('/api/account/addresses', { retry: 0, timeout: 15000 })
      if (!Array.isArray(result.addresses) || result.addresses.length > 20 || result.addresses.some(row => !validRow(row)) || new Set(result.addresses.map(row => row.id)).size !== result.addresses.length) throw Error('Invalid address list')
      savedAddresses.value = result.addresses
      if (!['profile', 'new'].includes(selectedAddressKey.value) && !selectedSavedAddress.value) {
        selectedAddressKey.value = 'new'; revision = null; createIds.delete('new'); expanded.value = true
        addressBookError.value = t('checkoutAddressBook.unavailableKept')
      }
    } catch {
      if (scope.isCurrent()) addressLoadError.value = t('checkoutAddressBook.loadFailed')
    } finally { if (scope.isCurrent()) loadingAddresses.value = false }
  }
  const saveAddress = async () => {
    if (busyAddress.value || !scope.isCurrent()) return
    clearMessages()
    if (!complete.value) {
      expanded.value = true; addressBookError.value = t('checkoutAddressBook.completeAddress')
      await nextTick(); document.getElementById('checkout-address-fields')?.querySelector(':invalid')?.focus(); return
    }
    const key = selectedAddressKey.value, updating = !['profile', 'new'].includes(key)
    if (!updating && !createIds.has(key)) createIds.set(key, crypto.randomUUID())
    const id = updating ? key : createIds.get(key)
    const values = { label: addressLabel.value, ...Object.fromEntries(addressFields.filter(field => field !== 'email').map(field => [field, address[field]])) }
    storeDraft(); savingAddress.value = true
    try {
      const result = await scope.request('/api/account/addresses' + (updating ? '/' + id : ''), {
        method: updating ? 'PUT' : 'POST', retry: 0, timeout: 15000,
        body: { ...(updating ? { revision } : { id }), address: values }
      })
      const row = result.address
      if (!validRow(row) || row.id !== id) throw Error('Invalid address receipt')
      savedAddresses.value = [...savedAddresses.value.filter(item => item.id !== row.id), row]
      selectedAddressKey.value = row.id; revision = row.revision; addressLabel.value = row.label
      for (const field of addressFields) if (field !== 'email') address[field] = row[field] || ''
      expanded.value = !complete.value; createIds.delete(key)
      if (key === 'profile') drafts.set('profile', { address: { ...profileAddress }, label: '', revision: null, expanded: false })
      if (key === 'new') drafts.delete('new')
      storeDraft()
      addressBookNotice.value = t('checkoutAddressBook.saved')
    } catch (error) {
      if (!scope.isCurrent()) return
      const status = error?.statusCode || error?.status || error?.response?.status
      addressConflict.value = status === 409 || status === 404
      addressBookError.value = t(status === 409 && error?.data?.statusMessage === 'You can save up to 20 addresses.' ? 'checkoutAddressBook.limitReached' : addressConflict.value ? 'checkoutAddressBook.conflict' : 'checkoutAddressBook.saveFailed')
      expanded.value = true
    } finally { if (scope.isCurrent()) savingAddress.value = false }
  }
  const useSavedVersion = async () => {
    if (busyAddress.value || !selectedSavedAddress.value) return
    await loadSavedAddresses()
    if (!scope.isCurrent() || addressLoadError.value || !selectedSavedAddress.value) return
    drafts.delete(selectedAddressKey.value)
    const row = selectedSavedAddress.value
    for (const field of addressFields) if (field !== 'email') address[field] = row[field] || ''
    addressLabel.value = row.label; revision = row.revision; expanded.value = true
    clearMessages(); storeDraft()
  }
  const removeAddress = async () => {
    if (busyAddress.value || !scope.isCurrent() || !selectedSavedAddress.value || !confirmAddressRemoval.value) return
    const id = selectedAddressKey.value
    removingAddress.value = true; addressBookError.value = ''; addressBookNotice.value = ''
    try {
      await scope.request('/api/account/addresses/' + id, { method: 'DELETE', retry: 0, timeout: 15000, body: { revision } })
      savedAddresses.value = savedAddresses.value.filter(row => row.id !== id); drafts.delete(id)
      selectedAddressKey.value = 'new'; revision = null; createIds.delete('new'); expanded.value = true
      confirmAddressRemoval.value = false; addressConflict.value = false; storeDraft()
      addressBookNotice.value = t('checkoutAddressBook.removedKept')
    } catch {
      if (scope.isCurrent()) { addressBookError.value = t('checkoutAddressBook.removeFailed'); addressConflict.value = true }
    } finally { if (scope.isCurrent()) removingAddress.value = false }
  }
  scope.onInvalidate(() => {
    savedAddresses.value = []; selectedAddressKey.value = 'profile'; addressLabel.value = ''; revision = null; profileAddress = null
    drafts.clear(); createIds.clear(); loadingAddresses.value = false; savingAddress.value = false; removingAddress.value = false
    addressLoadError.value = ''; clearMessages()
  })
  return { savedAddresses, selectedAddressKey, selectedSavedAddress, addressLabel, busyAddress, loadingAddresses, savingAddress, removingAddress,
    addressLoadError, addressBookError, addressBookNotice, addressConflict, confirmAddressRemoval,
    setProfileAddress, chooseAddress, loadSavedAddresses, saveAddress, keepAsNewAddress, useSavedVersion, removeAddress }
}
