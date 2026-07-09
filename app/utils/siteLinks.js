export const defaultHeaderLinkDefinitions = [
  {
    key: 'home',
    label: 'Home',
    url: '/',
    description: 'Leads to the home page.',
    isUrlEditable: false,
    type: 'link'
  },
  {
    key: 'shop-category',
    label: 'Shop Category',
    url: null,
    description: 'Dropdown menu that displays all categories.',
    isUrlEditable: false,
    type: 'categories-dropdown'
  },
  {
    key: 'return-policy',
    label: 'Return Policy',
    url: '/return-policy',
    description: 'Default header link. You can disable it.',
    isUrlEditable: true,
    type: 'link'
  },
  {
    key: 'request-refund',
    label: 'Request Refund',
    url: '/request-refund',
    description: 'Default header link. You can disable it.',
    isUrlEditable: true,
    type: 'link'
  }
]

const normalizeLabel = (value = '') => {
  return String(value).trim().toLowerCase()
}

const sortByPosition = (firstLink, secondLink) => {
  const firstSortOrder = Number(firstLink?.sort_order ?? 0)
  const secondSortOrder = Number(secondLink?.sort_order ?? 0)

  if (firstSortOrder !== secondSortOrder) {
    return firstSortOrder - secondSortOrder
  }

  const firstCreatedAt = firstLink?.created_at || ''
  const secondCreatedAt = secondLink?.created_at || ''

  return firstCreatedAt.localeCompare(secondCreatedAt)
}

export const getDefaultHeaderLinkDefinition = (link) => {
  if (!link) {
    return null
  }

  const label = typeof link === 'string' ? link : link.label
  return defaultHeaderLinkDefinitions.find((definition) => {
    return normalizeLabel(definition.label) === normalizeLabel(label)
  }) || null
}

export const isDefaultHeaderLink = (link) => {
  return Boolean(getDefaultHeaderLinkDefinition(link))
}

export const buildOrderedHeaderLinks = (siteLinks = []) => {
  const headerLinks = siteLinks.filter((link) => link.location === 'header')
  const usedIds = new Set()

  const defaultLinks = defaultHeaderLinkDefinitions.map((definition, index) => {
    const existingLink = headerLinks.find((link) => {
      return normalizeLabel(link.label) === normalizeLabel(definition.label)
    })

    if (existingLink?.id) {
      usedIds.add(existingLink.id)
    }

    return {
      ...(existingLink || {}),
      id: existingLink?.id || `default-header-${definition.key}`,
      location: 'header',
      section_title: null,
      label: definition.label,
      url: definition.isUrlEditable ? (existingLink?.url ?? definition.url) : definition.url,
      is_enabled: existingLink?.is_enabled ?? true,
      sort_order: index,
      is_default: true,
      default_key: definition.key,
      default_description: definition.description,
      is_url_editable: definition.isUrlEditable,
      link_type: definition.type
    }
  })

  const customLinks = headerLinks
    .filter((link) => !usedIds.has(link.id))
    .sort(sortByPosition)
    .map((link) => ({
      ...link,
      is_default: false,
      default_key: null,
      default_description: '',
      is_url_editable: true,
      link_type: 'link'
    }))

  return [...defaultLinks, ...customLinks]
}
