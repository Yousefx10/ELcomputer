import { inject, provide } from 'vue'

// One route owns data, price, stock, cart, SEO and review state for both styles.
const productDetailKey = Symbol('product-detail')

export const provideProductDetailContext = detail => provide(productDetailKey, detail)

export const useProductDetailContext = () => {
  const detail = inject(productDetailKey)
  if (!detail) throw new Error('Product detail presentation requires its route context.')
  return detail
}
