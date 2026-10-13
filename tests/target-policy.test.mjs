import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, realpath, writeFile, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { validatePolicy, policyDigest, bindPolicy, refreshPolicy, assertPolicyAddresses } from '../scripts/lib/targetPolicy.mjs'
import { validateTarget as install } from '../scripts/install/contracts.mjs'
import { validateTarget as publish, validateRegistry } from '../scripts/publish/contracts.mjs'
import { fixturePolicy, fixtureRegistry } from './helpers/reservationPolicy.mjs'

const database=()=>({format:1,profile:'supabase-direct',installation_id:randomUUID(),project_ref:'abcdefghijklmnopqrst',api_url:'https://abcdefghijklmnopqrst.supabase.co',site_origin:'https://fresh.example.invalid',database:{host:'db.abcdefghijklmnopqrst.supabase.co',port:5432,name:'postgres',user:'postgres',ca_file:'/private/ca.pem'},excluded_project_refs:[]})
const publication=()=>({format:1,installation_id:randomUUID(),publication_id:randomUUID(),project_ref:'abcdefghijklmnopqrst',site_origin:'https://fresh.example.invalid',release_sha256:'a'.repeat(64),ssh:{host:'fresh.example.invalid',port:22,user:'freshsite',host_key_sha256:'SHA256:'+'B'.repeat(43),known_hosts_file:'/private/known',identity_file:'/private/key',machine_id:'1'.repeat(32)},site:{app_path:'/home/freshsite/htdocs/fresh.example.invalid',uploads_path:'/home/freshsite/data/fresh.example.invalid/uploads',pm2_home:'/home/freshsite/.elcomputer-pm2',pm2_name:'fresh-site',port:3042},runtime:{node_path:'/opt/node/bin/node',pm2_package:'/opt/tool/node_modules/pm2'},ingress:{nginx_file:'/etc/nginx/site',certificate_file:'/etc/cert.pem',certificate_key_file:'/etc/key.pem',operator_ipv4:'192.0.2.1',startup_unit:'pm2-freshsite.service'}})
const binding=policy=>({file:'/private/operator/policy.json',policy,sha256:policyDigest(policy)})
test('policy is an explicit, typed additional-only inventory, never a production approval',()=>{
  assert.ok(validatePolicy(fixturePolicy()))
  for(const change of[p=>p.scope='replacement',p=>p.approved=true,p=>delete p.reservations.hosts,p=>p.review.provenance=null,p=>p.review.reservations_sha256='0'.repeat(64),p=>p.reservations.ports=['3001'],p=>p.reservations.addresses=['unknown'],p=>p.review.reviewed_at='9999-01-01T00:00:00Z']){const p=fixturePolicy();change(p);assert.throws(()=>validatePolicy(p))}
  assert.throws(()=>validatePolicy({format:'elcomputer-reservation-inventory-proposal-v1',approved:false}))
})
test('legacy protected projects, all merchant subdomains and publisher targets remain blocked with an empty added policy',()=>{
  const p=fixturePolicy(),registry=validateRegistry(fixtureRegistry())
  for(const change of[t=>t.project_ref='zsqhuwgoasrexdnamlks',t=>t.site_origin='https://elcomputer.net',t=>t.site_origin='https://arbitrary.elcomputer.net']){const t=database();change(t);t.reservation_policy=binding(p);assert.throws(()=>install(t))}
  for(const change of[t=>t.ssh.user='newelcomputer',t=>t.site.pm2_name='new-elcomputer',t=>t.site.port=3001,t=>t.ssh.host='reserved.example.invalid',t=>t.ssh.host_key_sha256='SHA256:'+'A'.repeat(43)]){const t=publication();change(t);t.reservation_policy=binding(p);assert.throws(()=>publish(t,registry))}
  assert.throws(()=>validateRegistry({...registry,production:{...registry.production,ssh_fingerprints:[]}}))
})
test('both engines reject additional projects, domain families and infrastructure aliases',()=>{
  for(const[key,value]of[['project_refs','abcdefghijklmnopqrst'],['domains','fresh.example.invalid'],['domain_suffixes','example.invalid'],['hosts','fresh.example.invalid']]){
    const p=fixturePolicy();p.reservations[key].push(value);p.review.reservations_sha256=policyDigest(p.reservations)
    assert.throws(()=>install({...database(),reservation_policy:binding(p)}))
    assert.throws(()=>publish({...publication(),reservation_policy:binding(p)},fixtureRegistry()))
  }
  for(const[key,value]of[['ssh_fingerprints','SHA256:'+'B'.repeat(43)],['machine_ids','1'.repeat(32)],['users','freshsite'],['paths','/home/freshsite/data'],['pm2_names','fresh-site'],['ports',3042]]){
    const p=fixturePolicy();p.reservations[key].push(value);p.review.reservations_sha256=policyDigest(p.reservations)
    assert.throws(()=>publish({...publication(),reservation_policy:binding(p)},fixtureRegistry()))
  }
  const p=fixturePolicy();p.reservations.addresses=['192.0.2.11'];p.review.reservations_sha256=policyDigest(p.reservations)
  assert.throws(()=>assertPolicyAddresses({...publication(),reservation_policy:binding(p)},['192.0.2.11']))
  assert.throws(()=>assertPolicyAddresses({...publication(),reservation_policy:binding(p)},['::ffff:192.0.2.11']))
})
test('protected policy transport rejects disappearance, permission changes and digest drift',async()=>{
  const root=await realpath(await mkdtemp('/tmp/elcomputer-policy-test-')),file=join(root,'policy.json');await chmod(root,0o700)
  try{
    const p=fixturePolicy();await writeFile(file,JSON.stringify(p),{mode:0o600});const t={...publication(),reservation_policy:await bindPolicy(file)}
    await refreshPolicy(t,{resolveAddresses:false})
    p.revision++;await writeFile(file,JSON.stringify(p));await assert.rejects(()=>refreshPolicy(t,{resolveAddresses:false}),error=>error.code==='policy_changed')
    await chmod(file,0o644);await assert.rejects(()=>bindPolicy(file));await rm(file);await assert.rejects(()=>refreshPolicy(t,{resolveAddresses:false}))
  }finally{await rm(root,{recursive:true,force:true})}
})
