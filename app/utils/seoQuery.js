// Compatibility reads before the additive migration is installed. Never hide other errors.
export async function selectWithSeo(makeQuery, fields, optional = 'seo_title,seo_description,seo_image_url') {
  const result = await makeQuery(`${fields},${optional}`)
  if (['42703', 'PGRST204'].includes(result.error?.code)) return makeQuery(fields)
  return result
}
