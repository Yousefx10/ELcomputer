// Stored catalog translations only; canonical names and slugs are never mutated.
export function getLocalizedCategoryName(category, locale = 'en') {
  const translated = locale === 'ar' ? String(category?.name_ar || '').trim() : ''
  return translated || String(category?.name || '').trim()
}

export function categoryMatchesSearch(category, query) {
  const term = String(query || '').trim().toLocaleLowerCase()
  return [category?.name, category?.name_ar].some(name => String(name || '').toLocaleLowerCase().includes(term))
}

export function categorySlug(name, existingSlug = '') {
  return existingSlug || String(name || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function categoryNameFields(name, nameAr, existingSlug = '') {
  return { name: String(name || '').trim(), name_ar: String(nameAr || '').trim() || null, slug: categorySlug(name, existingSlug) }
}
