<script setup>
const { locale, setLocale } = useI18n()
const choice = useCookie('elcomputer-locale', { maxAge: 31536000, path: '/', sameSite: 'lax' })
const { setTheme } = useUiPreferences()
const colorMode = useColorMode()
const toggleTheme = () => setTheme(colorMode.value === 'dark' ? 'light' : 'dark')
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
    <button
      type="button"
      class="ui-theme-toggle"
      :aria-label="$t('preferences.toggleTheme')"
      :title="$t('preferences.toggleTheme')"
      @click="toggleTheme"
    >
      <Icon class="ui-theme-light-icon" name="lucide:sun" size="20" aria-hidden="true" />
      <Icon class="ui-theme-dark-icon" name="lucide:moon" size="20" aria-hidden="true" />
    </button>
  </div>
</template>
