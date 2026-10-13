// An RLS-filtered or concurrently changed row must never look like a save.
export function matchOriginal(query, original) {
  for (const [field, value] of Object.entries(original)) {
    const compared = Array.isArray(value) ? '{' + value.map(item =>
      '"' + String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}' : value
    query = value === null ? query.is(field, null) : query.eq(field, compared)
  }
  return query
}

export function requireSavedRow(result) {
  if (result.error) throw result.error
  if (result.data?.length !== 1) throw Object.assign(new Error('Section changed'), { editorConflict: true })
  return result.data[0]
}

// Keep edits in other rows when a separately saved row is refreshed.
export function mergeSectionRows(incoming, existing, dirty, normalize) {
  const result = incoming.map(row => {
    const draft = existing.find(item => item.id === row.id)
    return draft && dirty(draft) ? draft : normalize(row)
  })
  for (const draft of existing) {
    if (dirty(draft) && !incoming.some(row => row.id === draft.id)) result.push(draft)
  }
  return result
}
