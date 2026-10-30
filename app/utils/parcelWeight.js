// Explicit measured kilograms, within the existing numeric(8,3) storage format.
// Never substitute the provider's default weight for an actual packed parcel.
export const measuredParcelWeight = value => {
  if (!['string', 'number'].includes(typeof value)) return null
  const text = String(value)
  if (!/^(?:0|[1-9][0-9]{0,4})(?:\.[0-9]{1,3})?$/.test(text)) return null
  const weight = Number(text)
  return Number.isFinite(weight) && weight > 0 && weight <= 99999.999 ? weight : null
}
