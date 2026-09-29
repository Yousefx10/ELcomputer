<template>
  <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6" aria-labelledby="product-specification-editor-heading">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="product-specification-editor-heading" class="text-2xl font-bold text-gray-900">{{ $t('common.specifications') }}</h3>
        <p class="mt-1 text-sm text-gray-600">{{ $t('dashboard.products.chooseSharedNamesAddOnlyTheValuesYouKnow') }}</p>
      </div>
      <button type="button" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" @click="showLibraryTools = !showLibraryTools">{{ showLibraryTools ? $t('common.hideLibraryTools') : $t('dashboard.products.manageNamesSuggestions') }}</button>
    </div>

    <p v-if="error" class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{{ $uiMessage(error) }}</p>
    <p v-if="notice" class="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">{{ $uiMessage(notice) }}</p>

    <div v-if="libraryReady" class="mt-6 space-y-8">
      <div v-if="categoryId" class="rounded-md bg-blue-50 p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h4 class="font-bold text-blue-950">{{ $t('dashboard.products.suggestedSpecifications') }}</h4>
          <span class="text-xs text-blue-800">{{ $t('dashboard.products.suggestionsAreOptional') }}</span>
        </div>
        <div v-if="suggestedDefinitions.length" class="mt-3 flex flex-wrap gap-2">
          <button v-for="item in suggestedDefinitions" :key="item.definition_id" type="button" class="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" @click="chooseDefinition(item.definition_id)">+ {{ definitionById(item.definition_id)?.name }}</button>
        </div>
        <p v-else class="mt-2 text-sm text-blue-800">{{ $t('dashboard.products.allSuggestedFieldsAreAddedOrThisCategoryHasNoTemplateYet') }}</p>
      </div>

      <div class="grid gap-4 rounded-md border border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div class="min-w-0">
          <label for="spec-search" class="block text-sm font-bold text-gray-900">{{ $t('common.addSpecification') }}</label>
          <input id="spec-search" v-model="search" type="search" autocomplete="off" :placeholder="$t('dashboard.products.searchNameOrAliasEGColour')" class="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none focus:border-blue-600" @keydown.enter.prevent="chooseFirstMatch">
          <div v-if="search.trim()" class="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200" role="listbox" :aria-label="$t('common.matchingSpecifications')">
            <button v-for="match in searchMatches" :key="match.definition.id" type="button" role="option" :aria-selected="selectedDefinitionId === match.definition.id" class="block w-full border-b border-gray-100 px-3 py-2 text-start text-sm hover:bg-blue-50 last:border-0" @click="chooseDefinition(match.definition.id)">{{ match.definition.name }}<span v-if="match.definition.group_name" class="ms-2 text-xs text-gray-500">{{ match.definition.group_name }}</span></button>
            <p v-if="!searchMatches.length" class="px-3 py-2 text-sm text-gray-500">{{ $t('dashboard.products.noMatchingNameCreateANewOneBelow') }}</p>
          </div>
          <button v-if="search.trim()" type="button" class="mt-2 text-sm font-semibold text-blue-700 hover:underline" @click="openCreateDefinition">{{ $t('dashboard.products.createNewSpecificationName') }}</button>
        </div>
        <form class="min-w-0" @submit.prevent="addSpecification">
          <label for="spec-value" class="block text-sm font-bold text-gray-900">{{ $t('common.valueValue', { value0: (selectedDefinition?.name || $t('dashboard.products.selectNameFirst')) }) }}</label>
          <input id="spec-value" ref="draftValueInput" v-model="draftValue" type="text" :disabled="!selectedDefinitionId || saving" maxlength="500" :placeholder="$t('common.enterTheProductValue')" class="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none focus:border-blue-600 disabled:bg-gray-50">
          <div class="mt-3 flex flex-wrap items-center gap-4">
            <label v-if="selectedDefinitionId" class="inline-flex items-center gap-2 text-sm text-gray-700"><input v-model="draftHighlight" type="checkbox"> {{ $t('common.showAsHighlight') }}</label>
            <button type="submit" :disabled="!selectedDefinitionId || !draftValue.trim() || saving" class="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300">{{ $t('common.addSpecification') }}</button>
          </div>
        </form>
      </div>

      <div v-if="creatingDefinition" class="rounded-md border border-blue-200 bg-blue-50 p-4">
        <h4 class="font-bold text-blue-950">{{ $t('dashboard.products.createASharedSpecificationName') }}</h4>
        <p class="mt-1 text-sm text-blue-900">{{ $t('dashboard.products.checkTheFinalNameEveryProductCanReuseIt') }}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="text-sm font-semibold">{{ $t('common.canonicalName') }}<input v-model="newName" maxlength="100" class="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5"></label>
          <label class="text-sm font-semibold">{{ $t('common.groupOptional') }}<input v-model="newGroup" maxlength="80" :placeholder="$t('common.performance')" class="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5"></label>
          <label class="text-sm font-semibold">{{ $t('dashboard.products.searchAliasesOptional') }}<input v-model="newAliases" :placeholder="$t('common.colourProductColor')" class="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5"></label>
          <label class="text-sm font-semibold">{{ $t('common.helpTextOptional') }}<input v-model="newHelp" maxlength="300" class="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5"></label>
        </div>
        <p v-if="duplicateCandidates.length" class="mt-3 text-sm text-amber-900">{{ $t('dashboard.products.similarNameValueChooseItAboveIfItMeansTheSameThing', { value0: (duplicateCandidates.map((match) => match.definition.name).join(', ')) }) }}</p>
        <label v-if="categoryId" class="mt-3 inline-flex items-center gap-2 text-sm"><input v-model="suggestNewForCategory" type="checkbox"> {{ $t('dashboard.products.suggestThisNameForThisCategory') }}</label>
        <label class="mt-3 flex items-start gap-2 text-sm"><input v-model="confirmNewName" type="checkbox" class="mt-1"> {{ $t('dashboard.products.iCheckedValueAsAReusableName', { value0: (newName.trim() || $t('dashboard.products.newName')) }) }}</label>
        <div class="mt-3 flex gap-2"><button type="button" :disabled="saving || !confirmNewName || !newName.trim() || duplicateCandidates.some((match) => match.exact)" class="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300" @click="createDefinition">{{ $t('common.createName') }}</button><button type="button" class="rounded-md border px-4 py-2 text-sm" @click="creatingDefinition = false">{{ $t('common.cancel') }}</button></div>
      </div>

      <div v-if="showLibraryTools" class="space-y-5 rounded-md border border-gray-200 bg-gray-50 p-4">
        <div v-if="categoryId">
          <h4 class="font-bold">{{ $t('common.categorySuggestions') }}</h4>
          <p class="mt-1 text-sm text-gray-600">{{ $t('dashboard.products.chooseReusableFieldsStaffShouldSeeForThisCategory') }}</p>
          <div class="mt-3 flex flex-wrap gap-2"><select v-model="templateDefinitionId" :aria-label="$t('common.nameToSuggest')" class="min-w-48 rounded-md border p-2.5"><option value="">{{ $t('common.chooseAName') }}</option><option v-for="definition in availableTemplateDefinitions" :key="definition.id" :value="definition.id">{{ definition.name }}</option></select><button type="button" :disabled="!templateDefinitionId || saving" class="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300" @click="addTemplateSuggestion">{{ $t('common.addSuggestion') }}</button></div>
          <div v-if="templates.length" class="mt-3 space-y-2"><div v-for="(item, index) in templates" :key="item.definition_id" class="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"><span class="min-w-32 flex-1 font-semibold">{{ definitionById(item.definition_id)?.name || $t('common.unknownName') }}</span><label class="inline-flex items-center gap-1"><input :checked="item.highlight_default" type="checkbox" :disabled="saving" @change="setTemplateHighlight(item, $event.target.checked)"> {{ $t('common.highlightByDefault') }}</label><button type="button" :disabled="saving || index === 0" :aria-label="$t('dashboard.products.moveValueSuggestionUp', { value0: (definitionById(item.definition_id)?.name) })" class="px-2 disabled:opacity-40" @click="moveTemplate(index, -1)">↑</button><button type="button" :disabled="saving || index === templates.length - 1" :aria-label="$t('dashboard.products.moveValueSuggestionDown', { value0: (definitionById(item.definition_id)?.name) })" class="px-2 disabled:opacity-40" @click="moveTemplate(index, 1)">↓</button><button type="button" :disabled="saving" class="font-semibold text-red-700" @click="removeTemplateSuggestion(item)">{{ $t('common.remove') }}</button></div></div>
        </div>
        <div v-if="selectedDefinition" class="border-t border-gray-200 pt-4">
          <h4 class="font-bold">{{ $t('common.editValue', { value0: (selectedDefinition.name) }) }}</h4>
          <p class="mt-1 text-xs text-gray-600">{{ $t('dashboard.products.changesToThisSharedNameAppearOnLinkedProducts') }}</p>
          <div class="mt-3 grid gap-2 sm:grid-cols-2"><label class="text-sm">{{ $t('common.displayName') }}<input v-model="definitionDraft.name" maxlength="100" class="mt-1 w-full rounded-md border bg-white p-2"></label><label class="text-sm">{{ $t('common.group') }}<input v-model="definitionDraft.group_name" maxlength="80" class="mt-1 w-full rounded-md border bg-white p-2"></label><label class="text-sm">{{ $t('dashboard.products.aliasesCommaSeparated') }}<input v-model="definitionDraft.aliases" class="mt-1 w-full rounded-md border bg-white p-2"></label><label class="text-sm">{{ $t('common.helpText') }}<input v-model="definitionDraft.help_text" maxlength="300" class="mt-1 w-full rounded-md border bg-white p-2"></label></div>
          <label class="mt-2 inline-flex items-center gap-2 text-sm"><input v-model="definitionDraft.is_active" type="checkbox"> {{ $t('dashboard.products.availableForNewProducts') }}</label>
          <button type="button" :disabled="saving" class="mt-3 block rounded-md border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800" @click="saveDefinition">{{ $t('common.saveSharedName') }}</button>
        </div>
      </div>

      <div>
        <h4 class="font-bold text-gray-900">{{ $t('dashboard.products.thisProductSSpecifications') }}</h4>
        <div v-if="rows.length" class="mt-3 space-y-2">
          <div v-for="(row, index) in rows" :key="row.id" class="grid gap-2 rounded-md border border-gray-200 p-3 md:grid-cols-[minmax(160px,0.8fr)_minmax(0,1.5fr)_auto]">
            <label class="min-w-0 text-xs font-semibold text-gray-600">{{ $t('common.name') }}<select v-model="row.definition_id" :aria-label="$t('dashboard.products.specificationValueName', { value0: (index + 1) })" class="mt-1 w-full rounded-md border p-2.5 text-sm"><option v-if="!row.original.definition_id" value="">{{ $t('common.legacyValue', { value0: (row.label) }) }}</option><option v-for="definition in definitions" :key="definition.id" :value="definition.id">{{ definition.name }}</option></select></label>
            <label class="min-w-0 text-xs font-semibold text-gray-600">{{ $t('common.value') }}<input v-model="row.value" :aria-label="$t('dashboard.products.specificationValueValue', { value0: (index + 1) })" maxlength="500" class="mt-1 w-full rounded-md border p-2.5 text-sm" @keydown.enter.prevent="saveRow(row)"></label>
            <div class="flex flex-wrap items-end gap-2"><label class="me-1 inline-flex items-center gap-1 text-xs"><input v-model="row.is_highlight" type="checkbox"> {{ $t('common.highlight') }}</label><button type="button" :disabled="saving || index === 0" :aria-label="$t('dashboard.products.moveSpecificationValueUp', { value0: (index + 1) })" class="rounded-md border px-2 py-2 disabled:opacity-40" @click="moveRow(index, -1)">↑</button><button type="button" :disabled="saving || index === rows.length - 1" :aria-label="$t('dashboard.products.moveSpecificationValueDown', { value0: (index + 1) })" class="rounded-md border px-2 py-2 disabled:opacity-40" @click="moveRow(index, 1)">↓</button><button type="button" :disabled="saving || !rowDirty(row)" class="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-gray-300" @click="saveRow(row)">{{ $t('common.save') }}</button><button type="button" :disabled="saving" class="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" @click="deleteRow(row)">{{ $t('common.delete') }}</button></div>
          </div>
        </div>
        <p v-else class="mt-2 text-sm text-gray-500">{{ $t('dashboard.products.noStructuredSpecificationsYetTheDescriptionStillAppearsOnTheProductPage') }}</p>
      </div>

      <div class="border-t border-gray-200 pt-6">
        <button type="button" class="text-sm font-bold text-blue-700 hover:underline" @click="showPaste = !showPaste">{{ showPaste ? $t('common.hidePasteHelper') : $t('common.pasteSpecifications') }}</button>
        <div v-if="showPaste" class="mt-3 space-y-3"><p class="text-sm text-gray-600">{{ $t('dashboard.products.pasteOneNameValueOrNameValuePerLineReviewEveryMatchBeforeImporting') }}</p><textarea v-model="pasteText" rows="7" maxlength="10000" :aria-label="$t('dashboard.products.pasteSpecificationLines')" class="w-full rounded-md border p-3 font-mono text-sm" :placeholder="$t('dashboard.products.sensorOpticalDpi3600')" /><button type="button" class="rounded-md border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800" @click="reviewPaste">{{ $t('common.reviewLines') }}</button>
          <div v-if="pasteRows.length" class="space-y-2"><div v-for="(item, index) in pasteRows" :key="index" class="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(100px,0.8fr)_minmax(160px,1fr)_minmax(160px,1.2fr)]"><div><label class="inline-flex items-center gap-2 text-sm font-semibold"><input v-model="item.include" type="checkbox"> {{ item.label }}</label><p v-if="item.suggestion && !item.definition_id" class="mt-1 text-xs text-amber-800">{{ $t('common.maybeValue', { value0: (item.suggestion) }) }}</p></div><select v-model="item.definition_id" :aria-label="$t('dashboard.products.canonicalNameForPastedLineValue', { value0: (index + 1) })" class="min-w-0 rounded-md border p-2 text-sm"><option value="">{{ $t('common.chooseCanonicalName') }}</option><option v-for="definition in definitions.filter((entry) => entry.is_active)" :key="definition.id" :value="definition.id">{{ definition.name }}</option></select><input v-model="item.value" :aria-label="$t('dashboard.products.valueForPastedLineValue', { value0: (index + 1) })" maxlength="500" class="min-w-0 rounded-md border p-2 text-sm"></div><button type="button" :disabled="saving" class="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300" @click="importPaste">{{ $t('common.importReviewedRows') }}</button></div>
        </div>
      </div>

      <div class="border-t border-gray-200 pt-6">
        <h4 class="font-bold text-gray-900">{{ $t('common.productFeatures') }}</h4><p class="mt-1 text-sm text-gray-600">{{ $t('dashboard.products.optionalSellingPointsKeepFactualSpecsAbove') }}</p>
        <form class="mt-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="addFeature"><input v-model="newFeature" maxlength="500" :aria-label="$t('common.newProductFeature')" :placeholder="$t('dashboard.products.aShortBenefitForCustomers')" class="min-w-0 flex-1 rounded-md border p-3 text-sm"><button type="submit" :disabled="saving || !newFeature.trim()" class="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300">{{ $t('common.addFeature') }}</button></form>
        <div v-if="features.length" class="mt-3 space-y-2"><div v-for="feature in features" :key="feature.id" class="flex flex-wrap gap-2"><input v-model="feature.body" maxlength="500" :aria-label="$t('common.featureValue', { value0: (feature.id) })" class="min-w-0 flex-1 rounded-md border p-2.5 text-sm"><button type="button" :disabled="saving || feature.body === feature.originalBody" class="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-40" @click="saveFeature(feature)">{{ $t('common.save') }}</button><button type="button" :disabled="saving" class="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" @click="deleteFeature(feature)">{{ $t('common.delete') }}</button></div></div>
      </div>
    </div>
  </section>
</template>

<script setup>
const { uiLabel } = useUiLocale()

import { duplicateSpecificationCandidates, matchSpecificationDefinitions, parsePastedSpecifications, parseSpecificationAliases, specificationKey } from '~/utils/specificationLibrary'

const props = defineProps({
  productId: { type: String, required: true },
  productTitle: { type: String, default: '' },
  categoryId: { type: String, default: '' }
})
const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()
const definitions = ref([])
const templates = ref([])
const rows = ref([])
const features = ref([])
const libraryReady = ref(false)
const error = ref('')
const notice = ref('')
const saving = ref(false)
const search = ref('')
const selectedDefinitionId = ref('')
const draftValue = ref('')
const draftHighlight = ref(false)
const draftValueInput = ref(null)
const showLibraryTools = ref(false)
const creatingDefinition = ref(false)
const newName = ref('')
const newGroup = ref('')
const newAliases = ref('')
const newHelp = ref('')
const confirmNewName = ref(false)
const suggestNewForCategory = ref(true)
const definitionDraft = reactive({ name: '', group_name: '', aliases: '', help_text: '', is_active: true })
const templateDefinitionId = ref('')
const showPaste = ref(false)
const pasteText = ref('')
const pasteRows = ref([])
const newFeature = ref('')

const selectedDefinition = computed(() => definitionById(selectedDefinitionId.value))
const usedDefinitionIds = computed(() => new Set(rows.value.map((row) => row.definition_id
  || matchSpecificationDefinitions(definitions.value, row.label, { limit: 1 }).find((match) => match.exact)?.definition.id).filter(Boolean)))
const searchMatches = computed(() => matchSpecificationDefinitions(definitions.value, search.value, { limit: 8 })
  .filter(({ definition }) => !usedDefinitionIds.value.has(definition.id)))
const duplicateCandidates = computed(() => duplicateSpecificationCandidates(definitions.value, newName.value))
const suggestedDefinitions = computed(() => templates.value.filter((item) => definitionById(item.definition_id)?.is_active
  && !usedDefinitionIds.value.has(item.definition_id)))
const availableTemplateDefinitions = computed(() => definitions.value.filter((item) => item.is_active
  && !templates.value.some((entry) => entry.definition_id === item.id)))
const definitionById = (id) => definitions.value.find((item) => item.id === id) || null
const nextOrder = (items) => Math.max(-1, ...items.map((item) => Number(item.sort_order) || 0)) + 1
const setError = (message) => { error.value = message; notice.value = '' }
const setNotice = (message) => { notice.value = message; error.value = '' }
const logChange = (actionKey, description, extra = {}) => recordAdminLog({
  actionKey, description, metadata: { product_id: props.productId, product_title: props.productTitle, ...extra }
})

const loadDefinitions = async () => {
  const { data, error: queryError } = await supabase.from('specification_definitions').select('*').order('sort_order').order('name')
  if (queryError) throw queryError
  definitions.value = data || []
}
const loadRows = async () => {
  const { data, error: queryError } = await supabase.from('product_specifications').select('*')
    .eq('product_id', props.productId).order('sort_order').order('created_at')
  if (queryError) throw queryError
  rows.value = (data || []).map((row) => ({ ...row, definition_id: row.definition_id || '', original: {
    definition_id: row.definition_id || '', value: row.value, is_highlight: Boolean(row.is_highlight)
  } }))
}
const loadFeatures = async () => {
  const { data, error: queryError } = await supabase.from('product_features').select('*')
    .eq('product_id', props.productId).order('sort_order').order('created_at')
  if (queryError) throw queryError
  features.value = (data || []).map((item) => ({ ...item, originalBody: item.body }))
}
const loadTemplates = async (categoryId = props.categoryId) => {
  if (!categoryId || !libraryReady.value) { templates.value = []; return }
  const { data, error: queryError } = await supabase.from('category_specification_templates').select('*')
    .eq('category_id', categoryId).order('sort_order')
  if (queryError) { setError(queryError.message); return }
  if (categoryId === props.categoryId) templates.value = data || []
}
onMounted(async () => {
  try {
    await Promise.all([loadDefinitions(), loadRows(), loadFeatures()])
    libraryReady.value = true
    await loadTemplates()
  } catch (queryError) {
    setError(queryError.message || 'Specification library is unavailable. Apply its migration before editing.')
  }
})
watch(() => props.categoryId, (categoryId) => loadTemplates(categoryId))
watch(selectedDefinitionId, (id) => {
  const item = definitionById(id)
  if (!item) return
  Object.assign(definitionDraft, {
    name: item.name, group_name: item.group_name || '',
    aliases: (item.aliases || []).join(', '), help_text: item.help_text || '', is_active: item.is_active
  })
  draftHighlight.value = templates.value.find((entry) => entry.definition_id === id)?.highlight_default ?? item.default_highlight
})

const chooseDefinition = async (id) => {
  selectedDefinitionId.value = id
  search.value = ''
  creatingDefinition.value = false
  await nextTick()
  draftValueInput.value?.focus()
}
const chooseFirstMatch = () => { if (searchMatches.value[0]) chooseDefinition(searchMatches.value[0].definition.id) }
const openCreateDefinition = () => {
  newName.value = search.value.trim()
  newGroup.value = ''
  newAliases.value = ''
  newHelp.value = ''
  confirmNewName.value = false
  creatingDefinition.value = true
}
const createDefinition = async () => {
  const name = newName.value.trim()
  const key = specificationKey(name)
  if (!name || !key || !confirmNewName.value) return
  if (duplicateCandidates.value.some((match) => match.exact)) { setError('This name already exists. Choose the existing name.'); return }
  const aliases = parseSpecificationAliases(newAliases.value)
  if (aliases.some((alias) => duplicateSpecificationCandidates(definitions.value, alias).some((match) => match.exact))) {
    setError('An alias already belongs to another shared name.'); return
  }
  saving.value = true
  const { data, error: queryError } = await supabase.from('specification_definitions').insert({
    key, name, group_name: newGroup.value.trim(), aliases, help_text: newHelp.value.trim(),
    sort_order: nextOrder(definitions.value)
  }).select('*').single()
  if (queryError) { saving.value = false; setError(queryError.message); return }
  await loadDefinitions()
  if (props.categoryId && suggestNewForCategory.value) {
    const { error: templateError } = await supabase.from('category_specification_templates').insert({
      category_id: props.categoryId, definition_id: data.id, sort_order: nextOrder(templates.value)
    })
    if (templateError) setError(`Name created, but category suggestion failed: ${templateError.message}`)
    else await loadTemplates()
  }
  await logChange('products.specifications.create', `Created shared specification name ${name}.`, { definition_id: data.id })
  saving.value = false
  creatingDefinition.value = false
  await chooseDefinition(data.id)
  if (!error.value) setNotice(`Created ${name}. Enter its value for this product.`)
}
const saveDefinition = async () => {
  if (!selectedDefinition.value) return
  const name = definitionDraft.name.trim()
  if (!name) { setError('Enter a shared display name.'); return }
  if (duplicateSpecificationCandidates(definitions.value.filter((item) => item.id !== selectedDefinitionId.value), name).some((match) => match.exact)) {
    setError('Another shared name already matches this name or alias.'); return
  }
  const aliases = parseSpecificationAliases(definitionDraft.aliases)
  if (aliases.some((alias) => duplicateSpecificationCandidates(definitions.value.filter((item) => item.id !== selectedDefinitionId.value), alias).some((match) => match.exact))) {
    setError('An alias already belongs to another shared name.'); return
  }
  saving.value = true
  const { error: queryError } = await supabase.from('specification_definitions').update({
    name, group_name: definitionDraft.group_name.trim(),
    aliases,
    help_text: definitionDraft.help_text.trim(), is_active: definitionDraft.is_active
  }).eq('id', selectedDefinitionId.value)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadDefinitions()
  await logChange('products.specifications.update', `Updated shared specification name ${name}.`, { definition_id: selectedDefinitionId.value })
  setNotice('Shared name saved.')
}
const addSpecification = async () => {
  const definition = selectedDefinition.value
  const value = draftValue.value.trim()
  if (!definition || !value || saving.value) return
  if (usedDefinitionIds.value.has(definition.id)) { setError('This product already has that specification. Edit its value below.'); return }
  saving.value = true
  const { error: queryError } = await supabase.from('product_specifications').insert({
    product_id: props.productId, definition_id: definition.id, label: definition.name, value,
    is_highlight: draftHighlight.value, sort_order: nextOrder(rows.value)
  })
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadRows()
  await logChange('products.specifications.create', `Added ${definition.name} to product ${props.productTitle}.`, { definition_id: definition.id })
  draftValue.value = ''
  selectedDefinitionId.value = ''
  setNotice(`${definition.name} added.`)
}
const rowDirty = (row) => row.definition_id !== row.original.definition_id || row.value !== row.original.value
  || Boolean(row.is_highlight) !== row.original.is_highlight
const saveRow = async (row) => {
  const value = row.value.trim()
  const definition = definitionById(row.definition_id)
  if (!value || (row.definition_id && !definition)) { setError('Choose a name and enter a value.'); return }
  saving.value = true
  const { error: queryError } = await supabase.from('product_specifications').update({
    definition_id: definition?.id || null, label: definition?.name || row.label,
    value, is_highlight: Boolean(row.is_highlight)
  }).eq('id', row.id).eq('product_id', props.productId)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadRows()
  await logChange('products.specifications.update', `Updated a specification for product ${props.productTitle}.`, { specification_id: row.id })
  setNotice('Specification saved.')
}
const deleteRow = async (row) => {
  if (!confirm(`Delete ${definitionById(row.definition_id)?.name || row.label}?`)) return
  saving.value = true
  const { error: queryError } = await supabase.from('product_specifications').delete().eq('id', row.id).eq('product_id', props.productId)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadRows()
  await logChange('products.specifications.delete', `Deleted a specification from product ${props.productTitle}.`, { specification_id: row.id })
  setNotice('Specification removed.')
}
const moveRow = async (index, direction) => {
  if (rows.value.some(rowDirty)) { setError('Save edited values before changing the order.'); return }
  const target = index + direction
  if (target < 0 || target >= rows.value.length) return
  const reordered = [...rows.value]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  saving.value = true
  try {
    for (const [position, item] of reordered.entries()) {
      const { error: queryError } = await supabase.from('product_specifications').update({ sort_order: position }).eq('id', item.id).eq('product_id', props.productId)
      if (queryError) throw queryError
    }
    await logChange('products.specifications.update', `Reordered specifications for product ${props.productTitle}.`)
    setNotice('Order saved.')
  } catch (queryError) { setError(queryError.message) }
  finally { saving.value = false; await loadRows() }
}
const addTemplateSuggestion = async () => {
  if (!props.categoryId || !templateDefinitionId.value) return
  saving.value = true
  const { error: queryError } = await supabase.from('category_specification_templates').insert({
    category_id: props.categoryId, definition_id: templateDefinitionId.value, sort_order: nextOrder(templates.value)
  })
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  templateDefinitionId.value = ''
  await loadTemplates()
  await logChange('products.specifications.update', 'Added a category specification suggestion.', { category_id: props.categoryId })
  setNotice('Category suggestion added.')
}
const removeTemplateSuggestion = async (item) => {
  saving.value = true
  const { error: queryError } = await supabase.from('category_specification_templates').delete()
    .eq('category_id', props.categoryId).eq('definition_id', item.definition_id)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadTemplates()
  await logChange('products.specifications.update', 'Removed a category specification suggestion.', { category_id: props.categoryId, definition_id: item.definition_id })
  setNotice('Category suggestion removed.')
}
const setTemplateHighlight = async (item, checked) => {
  saving.value = true
  const { error: queryError } = await supabase.from('category_specification_templates').update({ highlight_default: checked })
    .eq('category_id', props.categoryId).eq('definition_id', item.definition_id)
  saving.value = false
  if (queryError) setError(queryError.message)
  else await logChange('products.specifications.update', 'Changed a category highlight suggestion.', { category_id: props.categoryId, definition_id: item.definition_id, highlight_default: checked })
  await loadTemplates()
}
const moveTemplate = async (index, direction) => {
  const target = index + direction
  if (target < 0 || target >= templates.value.length) return
  const reordered = [...templates.value]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  saving.value = true
  try {
    for (const [position, item] of reordered.entries()) {
      const { error: queryError } = await supabase.from('category_specification_templates').update({ sort_order: position })
        .eq('category_id', props.categoryId).eq('definition_id', item.definition_id)
      if (queryError) throw queryError
    }
    await logChange('products.specifications.update', 'Reordered category specification suggestions.', { category_id: props.categoryId })
    setNotice('Suggestion order saved.')
  } catch (queryError) { setError(queryError.message) }
  finally { saving.value = false; await loadTemplates() }
}
const reviewPaste = () => {
  pasteRows.value = parsePastedSpecifications(pasteText.value).map((item) => {
    const match = matchSpecificationDefinitions(definitions.value, item.label, { limit: 1 })[0]
    return { ...item, definition_id: match?.exact ? match.definition.id : '', suggestion: match?.definition.name || '', include: true }
  })
  if (!pasteRows.value.length) setError('No Name: Value lines found. Check the separators and try again.')
  else setNotice(`Review ${pasteRows.value.length} line${pasteRows.value.length === 1 ? '' : 's'} before importing.`)
}
const importPaste = async () => {
  const selected = pasteRows.value.filter((item) => item.include)
  if (!selected.length) { setError('Choose at least one line to import.'); return }
  if (selected.some((item) => !item.definition_id || !item.value.trim())) { setError('Choose a canonical name and value for each selected line.'); return }
  const ids = selected.map((item) => item.definition_id)
  if (new Set(ids).size !== ids.length || ids.some((id) => usedDefinitionIds.value.has(id))) {
    setError('A selected name appears twice or already exists on this product. Deselect the duplicate.'); return
  }
  const start = nextOrder(rows.value)
  const inserts = selected.map((item, index) => {
    const definition = definitionById(item.definition_id)
    return { product_id: props.productId, definition_id: definition.id, label: definition.name,
      value: item.value.trim(), sort_order: start + index,
      is_highlight: templates.value.find((entry) => entry.definition_id === definition.id)?.highlight_default ?? definition.default_highlight }
  })
  saving.value = true
  const { error: queryError } = await supabase.from('product_specifications').insert(inserts)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadRows()
  await logChange('products.specifications.create', `Imported ${inserts.length} specifications for product ${props.productTitle}.`)
  pasteRows.value = []
  pasteText.value = ''
  setNotice(`${inserts.length} specifications imported.`)
}
const addFeature = async () => {
  const body = newFeature.value.trim()
  if (!body) return
  saving.value = true
  const { error: queryError } = await supabase.from('product_features').insert({ product_id: props.productId, body, sort_order: nextOrder(features.value) })
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadFeatures()
  await logChange('products.specifications.create', `Added a feature for product ${props.productTitle}.`)
  newFeature.value = ''
  setNotice('Feature added.')
}
const saveFeature = async (feature) => {
  const body = feature.body.trim()
  if (!body) { setError('Feature text cannot be empty.'); return }
  saving.value = true
  const { error: queryError } = await supabase.from('product_features').update({ body })
    .eq('id', feature.id).eq('product_id', props.productId)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadFeatures()
  await logChange('products.specifications.update', `Updated a feature for product ${props.productTitle}.`)
  setNotice('Feature saved.')
}
const deleteFeature = async (feature) => {
  if (!confirm(uiLabel('Delete this product feature?'))) return
  saving.value = true
  const { error: queryError } = await supabase.from('product_features').delete().eq('id', feature.id).eq('product_id', props.productId)
  saving.value = false
  if (queryError) { setError(queryError.message); return }
  await loadFeatures()
  await logChange('products.specifications.delete', `Deleted a feature from product ${props.productTitle}.`)
  setNotice('Feature removed.')
}
</script>
