// Apply a committed purchase once through the existing immutable cart marker.
export const subtractPurchasedLines = (items, purchased) => {
  if (!Array.isArray(items) || !Array.isArray(purchased)) return items || []
  const rows = new Map(purchased.map(line => [line.cart_key + ':' + line.cart_line_id, line]))
  return items.flatMap(item => {
    const line = rows.get(item.cart_key + ':' + item.cart_line_id)
    if (!line || !item.cart_line_id) return [item]
    const quantity = Math.max(0, Number(item.quantity) - Number(line.quantity))
    return quantity ? [{...item, quantity}] : []
  })
}
