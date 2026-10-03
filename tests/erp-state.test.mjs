import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveErpState, isDaftraErp, isBuiltInErpRoute, getErpOwnershipRedirect } from '../app/utils/erpState.js'

test('ERP mode, credentials, test health and activation are independent', () => {
  const saved={configured:true,credentialsSaved:true,revision:2}
  const tested={erp_mode:'built_in',daftra_connection_status:'connected',daftra_last_checked_at:'2026-10-03',daftra_tested_revision:2}
  assert.deepEqual(resolveErpState(tested,{configured:false,credentialsSaved:false}),{
    mode:'built_in',credentialState:'not_configured',connectionHealth:'not_tested',activationState:'inactive',canActivateDaftra:false
  })
  assert.equal(resolveErpState({erp_mode:'built_in'},saved).connectionHealth,'not_tested')
  assert.equal(resolveErpState(tested,saved).activationState,'connected_inactive')
  assert.equal(resolveErpState(tested,saved).mode,'built_in')
  assert.equal(resolveErpState({...tested,erp_mode:'daftra'},saved).activationState,'active')
  assert.equal(resolveErpState({...tested,erp_mode:'daftra',daftra_connection_status:'error'},saved).connectionHealth,'failed')
  assert.equal(resolveErpState({...tested,erp_mode:'daftra',daftra_connection_status:'error'},saved).mode,'daftra')
  assert.equal(isDaftraErp({erp_mode:'daftra',daftra_connection_status:'disconnected'}),true)
})

test('blocked routes use permitted destinations and unavailable settings cannot create redirect loops',()=>{
  const route={path:'/dashboard/treasury'}
  assert.deepEqual(getErpOwnershipRedirect(route,{mode:'daftra'},true),{path:'/dashboard/erp',query:{blocked:'built_in'}})
  assert.deepEqual(getErpOwnershipRedirect(route,{mode:'daftra'},false),{path:'/dashboard',query:{blocked:'built_in'}})
  assert.deepEqual(getErpOwnershipRedirect(route,null),{path:'/dashboard',query:{erpUnavailable:'1'}})
  assert.equal(getErpOwnershipRedirect({path:'/dashboard',query:{erpUnavailable:'1'}},null),null)
  assert.equal(getErpOwnershipRedirect({path:'/dashboard/erp'},null),null)
  assert.equal(getErpOwnershipRedirect(route,{mode:'built_in'}),null)
})

test('changed or unverified credential revisions cannot reuse a successful test', () => {
  const state={erp_mode:'built_in',daftra_connection_status:'connected',daftra_last_checked_at:'2026-10-03',daftra_tested_revision:1}
  for(const revision of [2,3]) assert.equal(resolveErpState(state,{configured:true,revision}).canActivateDaftra,false)
  assert.equal(resolveErpState({...state,daftra_tested_revision:null},{configured:true,revision:0}).connectionHealth,'not_tested')
})

test('external route ownership blocks local ERP and preserves platform workflows', () => {
  for(const route of [{path:'/dashboard/treasury'},{path:'/dashboard/commerce'},{path:'/dashboard/commerce',query:{tab:'procurement'}},{path:'/dashboard/commerce',query:{tab:'warehouses'}},{path:'/dashboard/hr',query:{tab:'employees'}},{path:'/dashboard',query:{view:'stock'}}]) assert.equal(isBuiltInErpRoute(route),true)
  for(const route of [{path:'/dashboard'},{path:'/dashboard/products'},{path:'/dashboard/commerce',query:{tab:'returns'}},{path:'/dashboard/commerce',query:{tab:'scan'}},{path:'/dashboard/commerce',query:{tab:'serialized'}},{path:'/dashboard/commerce',query:{tab:'shipping'}},{path:'/dashboard/hr',query:{tab:'users'}},{path:'/dashboard/crm'},{path:'/dashboard/chat'}]) assert.equal(isBuiltInErpRoute(route),false)
})
