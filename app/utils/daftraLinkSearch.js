// Search words for the Product links screen (English, Arabic and model numbers).
export const nameTokens = value => String(value ?? '').toLowerCase().replace(/[–—]/g, '-')
  .replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim().split(/\s+/).filter(Boolean)
