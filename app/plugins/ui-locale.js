export default defineNuxtPlugin(() => {
  const { uiLabel, uiMessage, uiPluralSuffix } = useUiLocale()
  return { provide: { uiLabel, uiMessage, uiPluralSuffix } }
})
