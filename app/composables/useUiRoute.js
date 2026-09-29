import { stripLocalePrefix } from '~/utils/appearance'

// Existing route comparisons keep their meaning on both localized routes.
// The real router still owns the prefixed URL, params, query and history.
export const useUiRoute = () => {
  const route = useRoute()
  return new Proxy(route, {
    get(target, key) {
      if (key === 'path') return stripLocalePrefix(target.path)
      return Reflect.get(target, key)
    }
  })
}
