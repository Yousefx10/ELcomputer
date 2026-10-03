import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getErpSettings } from '../../utils/erpOwnership'

export default defineEventHandler(async event => {
  const { adminUser,supabaseAdmin } = await requireAdminRequest(event,{permission:'settings.edit'})
  const settings=await getErpSettings(supabaseAdmin)
  if (settings.erp_mode!=='built_in') throw createError({statusCode:409,statusMessage:'Daftra is already the active provider.'})
  const results=await Promise.all([
    supabaseAdmin.from('product_variants').select('id',{count:'exact',head:true}).eq('is_active',true),
    supabaseAdmin.from('products').select('id',{count:'exact',head:true}).eq('is_serialized',false)
  ])
  if (results.some(result=>result.error)) throw createError({statusCode:503,statusMessage:'Could not prepare the synchronization review.'})
  const manifest={operation:'inventory.import',domains:[
    {key:'inventory',supported:true,direction:'daftra_to_elcomputer',count:results.reduce((total,result)=>total+(result.count||0),0),
      action:'Match unique SKUs and refresh stock and cost.',warning:'Physical item IDs require separate reconciliation.'},
    ...['customers','warehouses','historical_sales','historical_procurement','treasury','hr','serialized_receipts'].map(key=>({key,supported:false,direction:'manual',count:null,
      action:'Existing local records remain archived.',warning:'Not automatically synchronized.'}))
  ]}
  const {data,error}=await supabaseAdmin.from('erp_sync_runs').insert({manifest,state_version:settings.erp_state_version,actor_id:adminUser.id}).select('id,manifest').single()
  if(error) throw createError({statusCode:503,statusMessage:'Could not save the synchronization review.'})
  return {reviewId:data.id,manifest:data.manifest,stateVersion:settings.erp_state_version}
})
