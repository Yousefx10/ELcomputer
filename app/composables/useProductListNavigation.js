import { productListReturnPath } from '~/utils/productList'

// Only a validated local listing URL can survive editor navigation.
export const useProductListNavigation = () => {
  const route = useUiRoute()
  const returnToProducts = computed(() => productListReturnPath(route.query.returnTo))
  const productEditorLink = id => ({ path: `/dashboard/products/edit/${id}`, query: returnToProducts.value === '/dashboard/products' ? {} : { returnTo: returnToProducts.value } })
  return { returnToProducts, productEditorLink }
}
