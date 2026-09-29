<script setup>
const { locale, setLocale } = useI18n()
const choice = useCookie('elcomputer-locale', { maxAge: 31536000, path: '/', sameSite: 'lax' })
const { preference, setTheme } = useUiPreferences()
const switchLanguage = async event => {
  const next = event.target.value === 'ar' ? 'ar' : 'en'
  choice.value = next
  await setLocale(next)
}
</script>

<template>
  <div class="ui-preferences">
    <label>
      <span class="sr-only">{{ $t('preferences.language') }}</span>
      <Icon name="lucide:languages" size="16" aria-hidden="true" />
      <select :value="locale" :aria-label="$t('preferences.language')" @change="switchLanguage">
        <option value="en" lang="en">{{ $t('common.en') }}</option>
        <option value="ar" lang="ar">العربية</option>
      </select>
    </label>
    <label>
      <span class="sr-only">{{ $t('preferences.theme') }}</span>
      <Icon name="lucide:monitor" size="16" aria-hidden="true" />
      <select :value="preference" :aria-label="$t('preferences.theme')" @change="setTheme($event.target.value)">
        <option value="system">{{ $t('preferences.system') }}</option>
        <option value="light">{{ $t('preferences.light') }}</option>
        <option value="dark">{{ $t('preferences.dark') }}</option>
      </select>
    </label>
  </div>
</template>
