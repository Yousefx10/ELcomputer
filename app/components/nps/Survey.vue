<template>
  <section
    v-if="isReady && audienceEligible && (submitted || !cooldownActive)"
    class="nps-survey shadow-sm"
    aria-labelledby="nps-survey-title"
  >
    <div class="nps-survey-content">
      <div>
        <p class="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
          {{ $t('common.helpUsImprove') }}
        </p>
        <h2 id="nps-survey-title" class="nps-survey-question font-black tracking-tight text-gray-950">
          {{ $t('nps.Survey.howLikelyAreYouToRecommendValue', { value0: (storeName) }) }}
        </h2>
        <p class="mt-2 max-w-xl text-sm leading-6 text-gray-600">
          {{ $t('common.tellUsHowWeDid') }}
        </p>
      </div>

      <div
        v-if="submitted"
        class="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-start gap-3">
          <Icon name="lucide:circle-check-big" size="24" class="mt-0.5 flex-shrink-0" />
          <div>
            <p class="text-lg font-bold">{{ $t('common.thankYouForYourFeedback') }}</p>
            <p class="mt-1 text-sm text-emerald-700">
              {{ $t('nps.Survey.yourResponseHasBeenRecorded') }}
            </p>
          </div>
        </div>
      </div>

      <form v-else class="nps-survey-form" @submit.prevent="submitSurvey">
        <fieldset aria-describedby="nps-scale-help">
          <legend class="text-base font-bold text-gray-900">
            {{ $t('nps.Survey.selectAScoreFrom0To10') }}
          </legend>

          <div class="nps-score-grid" aria-describedby="nps-scale-help">
            <label
              v-for="rating in ratings"
              :key="rating"
              class="flex cursor-pointer items-center justify-center nps-score rounded-xl border text-sm font-bold transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
              :class="score === rating
                ? 'nps-score-selected border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'"
            >
              <input
                v-model="score"
                class="sr-only"
                type="radio"
                name="nps-score"
                :value="rating"
                :aria-label="$t('common.valueOutOf10', { value0: (rating) })"
                required
              >
              <span aria-hidden="true">{{ rating }}</span>
            </label>
          </div>

          <div id="nps-scale-help" class="mt-2 flex justify-between gap-4 text-xs font-medium text-gray-500">
            <span>{{ $t('common.0NotAtAllLikely') }}</span>
            <span class="text-end">{{ $t('common.10ExtremelyLikely') }}</span>
          </div>
        </fieldset>

        <div v-if="isDetractor" class="mt-6">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <label for="nps-feedback" class="font-bold text-gray-900">
              {{ $t('nps.Survey.whatCouldWeDoBetter') }}
            </label>
            <span class="text-xs font-medium text-gray-400">{{ $t('common.optionalVariant2') }}</span>
          </div>

          <textarea
            id="nps-feedback"
            v-model="feedback"
            dir="auto"
            rows="3"
            maxlength="999"
            aria-describedby="nps-feedback-count"
            class="mt-3 w-full resize-y rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            :placeholder="$t('nps.Survey.tellUsWhatWentWrongOrWhatWasMissing')"
          />
          <p id="nps-feedback-count" class="mt-2 text-end text-xs text-gray-400">
            {{ feedback.length }}/999
          </p>
        </div>

        <p
          v-if="errorMessage"
          class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {{ $uiMessage(errorMessage) }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
        >
          <Icon
            v-if="submitting"
            name="lucide:loader-circle"
            size="18"
            class="me-2 animate-spin"
          />
          {{ submitting ? $t('common.sendingFeedback') : $t('common.submitFeedback') }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { createStoreAnalyticsId } from '~/composables/useStoreAnalytics'
import {
  STOREFRONT_AUDIENCE_ELIGIBLE,
  useStorefrontAudience
} from '~/composables/useStorefrontAudience'

const props = defineProps({
  source: {
    type: String,
    default: 'homepage'
  },
  storeName: {
    type: String,
    default: 'our store'
  }
})

const storeName = computed(() => {
  return String(props.storeName || '').trim() || 'our store'
})

const NPS_COOLDOWN_STORAGE_KEY = 'elcomputer-nps-submitted-at'
const NPS_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000

const {
  status: audienceStatus,
  accessToken: audienceAccessToken
} = useStorefrontAudience()
const ratings = Array.from({ length: 11 }, (_, index) => index)
const score = ref(null)
const feedback = ref('')
const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')
const isReady = ref(false)
const cooldownActive = ref(false)
const responseId = ref(createStoreAnalyticsId())
let submissionController

const audienceEligible = computed(() => {
  return audienceStatus.value === STOREFRONT_AUDIENCE_ELIGIBLE
})

const isDetractor = computed(() => {
  return Number.isInteger(score.value) && score.value >= 0 && score.value <= 6
})

watch(score, (nextScore) => {
  errorMessage.value = ''

  if (Number(nextScore) > 6) {
    feedback.value = ''
  }
})

watch(audienceStatus, (status) => {
  if (status === STOREFRONT_AUDIENCE_ELIGIBLE) {
    return
  }

  submissionController?.abort()
  submissionController = undefined
  submitting.value = false
  errorMessage.value = ''
})

const loadCooldown = () => {
  try {
    const submittedAt = Number(window.localStorage.getItem(NPS_COOLDOWN_STORAGE_KEY) || 0)
    cooldownActive.value = Number.isFinite(submittedAt)
      && submittedAt > 0
      && (Date.now() - submittedAt) < NPS_COOLDOWN_MS
  } catch {
    cooldownActive.value = false
  }
}

const saveCooldown = () => {
  try {
    window.localStorage.setItem(NPS_COOLDOWN_STORAGE_KEY, String(Date.now()))
  } catch {
    // The successful response is still valid when storage is unavailable.
  }
}

const normalizeSource = (value) => {
  const normalizedValue = String(value || '').trim().slice(0, 50)
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(normalizedValue)
    ? normalizedValue
    : 'homepage'
}

const submitSurvey = async () => {
  errorMessage.value = ''

  if (!audienceEligible.value) {
    return
  }

  if (!Number.isInteger(score.value) || score.value < 0 || score.value > 10) {
    errorMessage.value = 'Please select a score from 0 to 10.'
    return
  }

  submitting.value = true
  const currentController = new AbortController()
  submissionController = currentController

  try {
    const headers = audienceAccessToken.value
      ? { authorization: `Bearer ${audienceAccessToken.value}` }
      : undefined

    await $fetch('/api/nps', {
      method: 'POST',
      headers,
      signal: currentController.signal,
      body: {
        responseId: responseId.value,
        score: score.value,
        feedback: isDetractor.value && feedback.value.trim()
          ? feedback.value.trim()
          : null,
        source: normalizeSource(props.source)
      }
    })

    if (!audienceEligible.value || currentController.signal.aborted) {
      return
    }

    saveCooldown()
    cooldownActive.value = true
    submitted.value = true
  } catch (error) {
    if (currentController.signal.aborted || !audienceEligible.value) {
      return
    }

    errorMessage.value = error?.data?.statusMessage
      || error?.message
      || 'We could not save your feedback. Please try again.'
  } finally {
    if (submissionController === currentController) {
      submissionController = undefined
      submitting.value = false
    }
  }
}

onMounted(() => {
  loadCooldown()
  isReady.value = true
})

onBeforeUnmount(() => {
  submissionController?.abort()
})
</script>

<style scoped>
.nps-survey { background: var(--store-pale, var(--brand-soft)); border: 1px solid var(--border); width: min(100%, 1200px); margin: 32px auto; border-radius: 20px; }
.nps-survey-content { display: grid; gap: 20px; padding: 16px; min-width: 0; }
.nps-survey-question { margin-top: 8px; font-size: 22px; line-height: 1.3; overflow-wrap: anywhere; }
.nps-survey-form { min-width: 0; container-type: inline-size; }
.nps-survey-form fieldset { min-width: 0; }
.nps-score-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
.nps-score { min-height: 44px; min-width: 0; background: var(--surface); color: var(--text-primary); border-color: var(--border); }
.nps-score-selected { background: #0654e9; color: #fff; border-color: #0654e9; }
.nps-survey-question, .nps-survey-form legend { color: var(--text-primary); }
.nps-survey-content > div > p, #nps-scale-help { color: var(--text-secondary); }
.nps-survey-content > div > p:first-child { color: var(--brand-text); }
@container (min-width: 544px) {
  .nps-score-grid { grid-template-columns: repeat(11, minmax(0, 1fr)); }
}
@media (min-width: 640px) {
  .nps-survey-content { padding: 24px; gap: 24px; }
  .nps-survey-question { font-size: 28px; }
  .nps-survey-form { background: var(--surface); padding: 16px; border-radius: 16px; }
}
@media (min-width: 1100px) {
  .nps-survey-content { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); align-items: center; }
}
</style>
