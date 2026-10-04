import { getQuery, getRouterParam, getRequestURL, setHeader, createError } from 'h3'
import { publicSeoClient } from '../../../utils/publicSeo'
import { readStorefrontBrand } from '../../../utils/storefrontBrands'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const keys = ['category', 'status', 'sort', 'page']
  if ([...getRequestURL(event).searchParams.keys()].some(key => !keys.includes(key))) throw createError({ statusCode: 400, statusMessage: 'Invalid product filters.' })
  const { client } = publicSeoClient(event)
  return readStorefrontBrand(client, getRouterParam(event, 'slug'), getQuery(event))
})
