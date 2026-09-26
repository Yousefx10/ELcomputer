export const useReorder = () => {
  const supabase = useSupabaseClient()
  const { addItem, items } = useCart()
  const { data: siteContent } = useNuxtData('site-content')

  const addOrderToCart = async (orderItems = []) => {
    const requestedItems = orderItems.filter(item => item?.product_id)
    if (!requestedItems.length) {
      return { success: false, message: 'These items are no longer available.' }
    }

    const productIds = [...new Set(requestedItems.map(item => item.product_id))]
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        title,
        slug,
        image_url,
        price,
        old_price,
        stock_quantity,
        is_serialized,
        is_published,
        category:categories (id, name, slug),
        brand:brands (id, name, slug),
        product_variants (id, name, code, sku, color_name, color_hex, price, stock_quantity, is_active)
      `)
      .in('id', productIds)
      .eq('is_published', true)

    if (error) throw error

    const productsById = new Map((data || []).map(product => [String(product.id), product]))
    const allowOutOfStock = Boolean(siteContent.value?.settings?.allow_out_of_stock_purchases)
    let addedLines = 0
    let addedQuantity = 0
    let skippedLines = orderItems.length - requestedItems.length

    for (const orderItem of requestedItems) {
      const product = productsById.get(String(orderItem.product_id))
      if (!product) {
        skippedLines += 1
        continue
      }

      const activeVariants = (product.product_variants || []).filter(variant => variant.is_active !== false)
      const variant = orderItem.variant_id
        ? activeVariants.find(item => String(item.id) === String(orderItem.variant_id))
        : null

      if ((orderItem.variant_id && !variant) || (!orderItem.variant_id && activeVariants.length)) {
        skippedLines += 1
        continue
      }

      const stockQuantity = Number(variant?.stock_quantity ?? product.stock_quantity ?? 0)
      const canBackorder = allowOutOfStock && !product.is_serialized
      if (stockQuantity <= 0 && !canBackorder) {
        skippedLines += 1
        continue
      }

      const requestedQuantity = Math.max(1, Number.parseInt(orderItem.quantity, 10) || 1)
      const quantity = canBackorder ? Math.min(requestedQuantity, 99) : Math.min(requestedQuantity, stockQuantity)
      const cartKey = `${String(product.id)}:${variant?.id || 'default'}`
      const quantityBefore = Number(items.value.find(item => item.cart_key === cartKey)?.quantity || 0)
      const result = addItem({
        ...product,
        price: Number(variant?.price ?? product.price ?? 0),
        stock_quantity: stockQuantity,
        brand_name: product.brand?.name || '',
        category_name: product.category?.name || '',
        allow_out_of_stock_purchases: canBackorder,
        variant_id: variant?.id || null,
        variant_name: variant?.name || '',
        variant_code: variant?.code || '',
        variant_sku: variant?.sku || '',
        variant_color_name: variant?.color_name || '',
        variant_color_hex: variant?.color_hex || ''
      }, quantity, { source: 'order_again' })
      const quantityAfter = Number(items.value.find(item => item.cart_key === cartKey)?.quantity || 0)
      const quantityAdded = Math.max(0, quantityAfter - quantityBefore)

      if (result.success && quantityAdded > 0) {
        addedLines += 1
        addedQuantity += quantityAdded
      } else {
        skippedLines += 1
      }
    }

    if (!addedLines) {
      return { success: false, message: 'These items are unavailable or need new options.' }
    }

    const itemLabel = `${addedQuantity} item${addedQuantity === 1 ? '' : 's'}`
    return {
      success: true,
      message: skippedLines
        ? `${itemLabel} added. ${skippedLines} could not be reordered.`
        : `${itemLabel} added to your cart.`
    }
  }

  return { addOrderToCart }
}
