// Additive only. This module cannot grant permission or replace legacy guards.
import { createHash } from 'node:crypto'
import { isAbsolute, resolve } from 'node:path'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

export const policyDigest = value => createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex')
const reject = code => { const error=new Error('The additional reservation policy is missing, changed or excludes this target.');error.code=code;throw error }
const requireValue = (value,code='policy_invalid') => { if(!value)reject(code) }
const exact = (value,keys) => requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)))
const fields=['project_refs','domains','domain_suffixes','hosts','addresses','ssh_fingerprints','machine_ids','users','paths','pm2_names','ports']
const name=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value)&&!value.includes('..')
const publicText=value=>typeof value==='string'&&!/sb_(?:secret|publishable)_|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|PRIVATE.KEY/.test(value)
const address=value=>{
  if(isIP(value)!==6)return value
  const normalized=new URL('http://['+value+']/').hostname.slice(1,-1)
  const mapped=/^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(normalized)
  if(!mapped)return normalized
  return[parseInt(mapped[1],16)>>8,parseInt(mapped[1],16)&255,parseInt(mapped[2],16)>>8,parseInt(mapped[2],16)&255].join('.')
}
export function validatePolicy(policy){
  exact(policy,['format','policy_id','revision','scope','reservations','review'])
  requireValue(policy.format===1&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(policy.policy_id)&&Number.isSafeInteger(policy.revision)&&policy.revision>0&&policy.scope==='additional_exclusions_only')
  exact(policy.reservations,fields)
  for(const[key,list]of Object.entries(policy.reservations)){
    requireValue(Array.isArray(list)&&list.length<=10000&&new Set(list).size===list.length)
    for(const value of list){
      if(key==='ports'){requireValue(Number.isInteger(value)&&value>=1&&value<=65535);continue}
      requireValue(publicText(value)&&value.length>0&&value.length<=1024&&!/[\x00-\x20\x7f]/.test(value))
      if(key==='project_refs')requireValue(/^[a-z0-9]{20}$/.test(value))
      if(['domains','domain_suffixes'].includes(key))requireValue(name(value)&&!isIP(value))
      if(key==='hosts')requireValue(name(value)||isIP(value))
      if(key==='addresses')requireValue(isIP(value)&&!value.includes('%'))
      if(key==='ssh_fingerprints')requireValue(/^SHA256:[A-Za-z0-9+/]{43}$/.test(value))
      if(key==='machine_ids')requireValue(/^[a-f0-9]{32}$/.test(value))
      if(key==='paths')requireValue(isAbsolute(value)&&resolve(value)===value&&!/["'`$\\]/.test(value))
    }
  }
  exact(policy.review,['operator','reviewed_at','provenance','reservations_sha256'])
  requireValue(publicText(policy.review.operator)&&publicText(policy.review.provenance)&&/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,119}$/.test(policy.review.operator)&&/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,119}$/.test(policy.review.provenance))
  requireValue(typeof policy.review.reviewed_at==='string'&&/^\d{4}-\d\d-\d\dT/.test(policy.review.reviewed_at)&&Number.isFinite(Date.parse(policy.review.reviewed_at))&&Date.parse(policy.review.reviewed_at)<=Date.now())
  requireValue(policy.review.reservations_sha256===policyDigest(policy.reservations))
  return policy
}
export function validatePolicyBinding(binding){
  exact(binding,['file','sha256','policy'])
  requireValue(typeof binding.file==='string'&&isAbsolute(binding.file)&&resolve(binding.file)===binding.file)
  validatePolicy(binding.policy);requireValue(binding.sha256===policyDigest(binding.policy),'policy_changed')
  return binding
}
export function assertPolicyTarget(target){
  const binding=target.reservation_policy;if(!binding)return
  const r=validatePolicyBinding(binding).policy.reservations,domain=new URL(target.site_origin).hostname
  const hosts=[target.database?.host,target.api_url?new URL(target.api_url).hostname:null,target.ssh?.host,domain].filter(Boolean)
  const excluded=(key,value)=>value!=null&&r[key].includes(value)
  requireValue(!excluded('project_refs',target.project_ref)&&!excluded('domains',domain)&&!r.domain_suffixes.some(suffix=>domain===suffix||domain.endsWith('.'+suffix)),'protected_target')
  requireValue(hosts.every(host=>!excluded('hosts',host)&&![...r.addresses,...r.hosts.filter(isIP)].some(ip=>isIP(host)&&address(ip)===address(host))),'protected_target')
  for(const[key,value]of[['ssh_fingerprints',target.ssh?.host_key_sha256],['machine_ids',target.ssh?.machine_id],['users',target.ssh?.user],['pm2_names',target.site?.pm2_name],['ports',target.site?.port]])requireValue(!excluded(key,value),'protected_target')
  for(const path of[target.site?.app_path,target.site?.uploads_path,target.site?.pm2_home].filter(Boolean))requireValue(!r.paths.some(root=>path===root||path.startsWith(root.endsWith('/')?root:root+'/')),'protected_target')
}
export async function bindPolicy(file){
  const{readProtected,canonicalPath}=await import('../install/files.mjs')
  const{sourceRoot}=await import('../install/contracts.mjs')
  requireValue(!file.startsWith(resolve(sourceRoot)+'/'),'policy_invalid');await canonicalPath(file)
  const policy=validatePolicy(await readProtected(file))
  return{file,sha256:policyDigest(policy),policy}
}
export async function refreshPolicy(target,{resolveAddresses=true}={}){
  if(!target.reservation_policy)return
  const binding=validatePolicyBinding(target.reservation_policy),current=await bindPolicy(binding.file)
  requireValue(current.sha256===binding.sha256,'policy_changed');assertPolicyTarget(target)
  if(resolveAddresses){
    const r=binding.policy.reservations,hosts=[target.database?.host,target.api_url?new URL(target.api_url).hostname:null,target.ssh?.host,new URL(target.site_origin).hostname].filter(Boolean)
    // Installer origins need not resolve before DNS preparation; publication
    // checks the site and VPS address set through its existing identity gate.
    for(const host of new Set(hosts.filter(host=>target.ssh||host!==new URL(target.site_origin).hostname))){
      const addresses=isIP(host)?[host]:(await lookup(host,{all:true})).map(row=>row.address)
      assertPolicyAddresses(target,addresses)
    }
  }
}
export function assertPolicyAddresses(target,addresses){
  if(!target.reservation_policy)return
  const r=validatePolicyBinding(target.reservation_policy).policy.reservations
  const excluded=[...r.addresses,...r.hosts.filter(isIP)].map(address)
  requireValue(addresses.every(ip=>!excluded.includes(address(ip))),'protected_target')
}
