import { getLocalizedCategoryName } from '~/utils/categoryLocale'

export const useCategoryLocale = () => {
  const { locale } = useI18n()
  return { categoryName: category => getLocalizedCategoryName(category, locale.value) }
}
