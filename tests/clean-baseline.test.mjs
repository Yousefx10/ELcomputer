import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { createCleanBaselineLab,startCandidateRest } from './helpers/cleanBaselineLab.mjs'
import { storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { baselineDirectory, migrationInventory, verifyBundle, applyCandidate, verifyCleanData, catalog, assertCatalogEquivalent, assertPermissionMatrix, adoptLaboratoryHistory } from '../scripts/lib/cleanBaseline.mjs'

test('clean-v1 provenance is frozen to all 70 unchanged sources and every artifact', async () => {
  const {manifest,inventory}=await verifyBundle()
  assert.equal(inventory.length,70)
  assert.equal(manifest.cli_version,'2.109.1')
  for(const name of ['schema.sql','permissions.sql','clean-seeds.sql']) {
    const sql=await readFile(new URL(name,baselineDirectory),'utf8')
    assert.doesNotMatch(sql,/\bcreate\s+(?:role|schema\s+(?:auth|storage|realtime)|table\s+(?:auth|storage|realtime)\.)/i)
    assert.doesNotMatch(sql,/\b(?:alter\s+table\s+(?:auth|storage|realtime)\.|owner\s+to\s+supabase_)/i)
  }
  const seeds=await readFile(new URL('clean-seeds.sql',baselineDirectory),'utf8')
  assert.doesNotMatch(seeds,/new\.elcomputer\.net|info@elcomputer|280533|01505121684|placehold\.co/)
  const buckets=JSON.parse(await readFile(new URL('storage.json',baselineDirectory)))
  assert.deepEqual(buckets.map(b=>b.id),['admin-documents','after-sales-evidence','chat-attachments','order-packing-videos','shipping-labels','support-attachments'])
  assert.ok(buckets.every(b=>b.public===false))
})

test('modified historical hashes are rejected before any connection',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'clean-source-hash-'))
  try {
    await cp(new URL('../supabase/migrations/',import.meta.url),directory,{recursive:true})
    const inventory=await migrationInventory()
    await writeFile(join(directory,inventory[0].filename),'select 1;')
    await assert.rejects(()=>migrationInventory(pathToFileURL(directory+'/')),/Historical migration hash mismatch/)
  }finally{await rm(directory,{recursive:true,force:true})}
})

test('modified bootstrap artifacts are rejected before any connection',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'clean-artifact-hash-'))
  try {
    await cp(baselineDirectory,directory,{recursive:true})
    await writeFile(join(directory,'permissions.sql'),'grant all on all tables in schema public to anon;')
    await assert.rejects(()=>verifyBundle(pathToFileURL(directory+'/')),/Bootstrap artifact hash mismatch/)
  }finally{await rm(directory,{recursive:true,force:true})}
})

test('native clean baseline: equivalence, fresh grants, security and exact CLI history', {skip:!storageNativeAvailable,timeout:240000},async t=>{
  const lab=await createCleanBaselineLab()
  try {
    const expected=JSON.parse(await readFile(new URL('expected-schema.json',baselineDirectory)))
    const matrix=JSON.parse(await readFile(new URL('permissions-manifest.json',baselineDirectory)))
    await t.test('all 70 reconstruct under a non-superuser; managed owners and actual delegation are retained',async()=>{
      assert.deepEqual(lab.executed,(await migrationInventory()).map(e=>e.filename))
      assert.deepEqual(await catalog(lab.source),expected)
      const executor=(await lab.candidate.query("select current_user,session_user,(select rolsuper from pg_roles where rolname=current_user) superuser,pg_has_role(current_user,'fixture_storage_owner','MEMBER') managed_member")).rows[0]
      assert.deepEqual(executor,{current_user:'postgres',session_user:'postgres',superuser:false,managed_member:false})
      assert.equal((await lab.candidate.query("select count(*)::int n from pg_default_acl where defaclnamespace='public'::regnamespace")).rows[0].n,0,'No implicit legacy grants')
      await assert.rejects(()=>lab.candidate.query('alter table storage.objects disable row level security'),e=>e.code==='42501')
    })
    await t.test('occupied Auth target is rejected atomically',async()=>{
      const id=randomUUID()
      await lab.candidate.query('insert into auth.users(id,email) values($1,$2)',[id,'occupied@baseline.example.invalid'])
      await assert.rejects(()=>applyCandidate(lab.candidate),/Auth or Storage target is occupied/)
      assert.equal((await lab.candidate.query("select to_regclass('public.products') name")).rows[0].name,null)
      await lab.candidate.query('delete from auth.users where id=$1',[id])
    })
    await t.test('occupied public schema is rejected atomically',async()=>{
      await lab.candidate.query('create table public.unexpected(id int)')
      await assert.rejects(()=>applyCandidate(lab.candidate),/Application schema is occupied/)
      await lab.candidate.query('drop table public.unexpected')
    })
    await t.test('independent baseline equals the source catalog, with only reviewed pg_dump AND normalization',async()=>{
      await applyCandidate(lab.candidate)
      const differences=assertCatalogEquivalent(await catalog(lab.candidate),expected)
      assert.equal(differences.length,8)
      await assertPermissionMatrix(lab.candidate,matrix)
      const clean=await verifyCleanData(lab.candidate)
      assert.notEqual(clean.installation_id,(await lab.source.query('select installation_id from public.quick_setup_state')).rows[0].installation_id)
      assert.equal(clean.counts.products,0);assert.equal(clean.counts.categories,0);assert.equal(clean.counts.brands,0)
      assert.equal(clean.counts.customer_profiles,0);assert.equal(clean.counts.customer_orders,0)
      await assert.rejects(()=>applyCandidate(lab.candidate),/Application schema is occupied/)
    })
    await t.test('wrong-target history binding is rejected without creating a ledger',async()=>{
      await assert.rejects(()=>adoptLaboratoryHistory({...lab,source:{...lab.source,port:lab.source.port+1}}),/Mismatched laboratory target/)
      assert.equal((await lab.candidate.query("select to_regnamespace('supabase_migrations') name")).rows[0].name,null)
    })
    await t.test('schema, ACL and clean-seed drift stop adoption before any history write',async()=>{
      for(const sql of ["alter table public.products add column unexpected text", "grant select(cost_price) on public.products to anon", "update public.site_settings set site_name='Unexpected merchant'"]){
        await lab.candidate.query('begin')
        try {
          await lab.candidate.query(sql)
          await assert.rejects(()=>adoptLaboratoryHistory(lab))
          assert.equal((await lab.candidate.query("select to_regnamespace('supabase_migrations') name")).rows[0].name,null)
        }finally{await lab.candidate.query('rollback')}
      }
    })
    await t.test('actual pinned CLI adopts exact covered versions without replaying any historical data',async()=>{
      const receipt=await adoptLaboratoryHistory(lab)
      assert.equal(receipt.baseline_covered.length,70)
      assert.equal(receipt.historical_sql_files_executed_on_candidate,0)
      await assert.rejects(()=>adoptLaboratoryHistory(lab),/History target already occupied/)
    })
    await t.test('later migration is the only pending version and executes once across two pushes',async()=>{
      const name='20261013120000_clean_baseline_upgrade_rehearsal.sql'
      const path=join(lab.source.directory,'baseline-runner/supabase/migrations',name)
      await writeFile(path,'create table public.clean_baseline_upgrade_rehearsal(id integer primary key); insert into public.clean_baseline_upgrade_rehearsal values(1);\n')
      const dry=await lab.cli(['db','push','--dry-run'],[])
      assert.match(dry.stdout+dry.stderr,/20261013120000_clean_baseline_upgrade_rehearsal.sql/)
      assert.doesNotMatch(dry.stdout+dry.stderr,/20261012120000_quick_setup_progress.sql/)
      await lab.cli(['db','push','--yes'],[])
      await lab.cli(['db','push','--yes'],[])
      assert.equal((await lab.candidate.query('select count(*)::int n from public.clean_baseline_upgrade_rehearsal')).rows[0].n,1)
      assert.equal((await lab.candidate.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,71)
      await lab.candidate.query('drop table public.clean_baseline_upgrade_rehearsal')
    })
    await t.test('browser and service roles preserve private setup and command boundaries',async()=>{
      for(const role of ['anon','authenticated','service_role']){
        const c=await lab.connect('clean_candidate',role)
        if(role!=='service_role'){
          await assert.rejects(()=>c.query('select * from public.quick_setup_snapshot'),e=>e.code==='42501')
          await assert.rejects(()=>c.query('select public.quick_setup_mutate($1,$2)',[randomUUID(),{}]),e=>e.code==='42501')
          for(const table of ['email_messages','sms_messages','shipping_claim_jobs','after_sales_claims'])await assert.rejects(()=>c.query('select * from public.'+table),e=>e.code==='42501')
        }else{
          assert.equal((await c.query('select * from public.quick_setup_snapshot')).rowCount,1)
          await assert.rejects(()=>c.query("update public.quick_setup_state set selections='{}'"),e=>e.code==='42501')
          await assert.rejects(()=>c.query("delete from public.email_messages"),e=>e.code==='42501')
        }
      }
    })
    await t.test('real roles enforce catalog confidentiality, public visibility and active staff reads',async()=>{
      const owner=randomUUID(),customer=randomUUID(),published=randomUUID(),draft=randomUUID()
      for(const [id,email]of[[owner,'owner@baseline.example.invalid'],[customer,'customer@baseline.example.invalid']])await lab.candidate.query('insert into auth.users(id,email) values($1,$2)',[id,email])
      await lab.candidate.query("insert into public.admin_users(id,email,role) values($1,'owner@baseline.example.invalid','owner')",[owner])
      await lab.candidate.query("select set_config('app.serialized_inventory_write','on',false)")
      for(const [id,visible]of[[published,true],[draft,false]])await lab.candidate.query("insert into public.products(id,title,slug,price,cost_price,is_published) values($1::uuid,'Synthetic lab product',$1::uuid::text,100,50,$2)",[id,visible])
      await lab.candidate.query('update public.product_variants set cost_price=50,stock_quantity=8 where product_id=any($1)',[[published,draft]])
      await lab.candidate.query("select set_config('app.serialized_inventory_write','',false)")
      for(const role of ['anon','authenticated']){
        const c=await lab.connect('clean_candidate',role)
        await c.query("select set_config('request.jwt.claim.sub',$1,false)",[role==='authenticated'?customer:''])
        assert.deepEqual((await c.query('select id from public.storefront_products')).rows,[{id:published}])
        await assert.rejects(()=>c.query('select cost_price from public.products'),e=>e.code==='42501')
        await assert.rejects(()=>c.query('select * from public.products'),e=>e.code==='42501')
        await assert.rejects(()=>c.query("insert into public.categories(name,slug) values('Forgery','forgery')"),e=>e.code==='42501')
      }
      const staff=await lab.connect('clean_candidate','authenticated')
      await staff.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
      const rpc=(await staff.query('select id,cost_price from public.catalog_staff_products() order by id')).rows
      assert.equal(rpc.length,2);assert.ok(rpc.every(r=>Number(r.cost_price)===50),JSON.stringify(rpc))
      const rest=await startCandidateRest(lab)
      try{
        assert.deepEqual(await rest.request('/storefront_products?select=id'),{status:200,body:[{id:published}]})
        for(const path of ['/products?select=cost_price','/products?select=id&cost_price=gt.0','/quick_setup_state?select=*'])assert.ok([401,403].includes((await rest.request(path)).status),path)
        assert.equal((await rest.request('/rpc/catalog_staff_products',{method:'POST',body:{},role:'authenticated',subject:customer})).status,403)
        const staffRead=await rest.request('/rpc/catalog_staff_products',{method:'POST',body:{},role:'authenticated',subject:owner})
        assert.equal(staffRead.status,200);assert.equal(staffRead.body.length,2)
      }finally{await rest.close()}
      await lab.candidate.query('update public.admin_users set is_active=false where id=$1',[owner])
      await assert.rejects(()=>staff.query('select * from public.catalog_staff_products()'),e=>e.code==='42501')
    })
    await t.test('actual delegated restrictive Storage policies defeat a broad permissive policy',async()=>{
      await lab.storage.query("create policy lab_broad on storage.objects for all to anon,authenticated using(true) with check(true); insert into storage.objects(bucket_id,name) values('after-sales-evidence','private.png'),('shipping-labels','claims/private.pdf'),('other','allowed.png')")
      for(const role of ['anon','authenticated']){
        const c=await lab.connect('clean_candidate',role)
        assert.deepEqual((await c.query('select name from storage.objects')).rows,[{name:'allowed.png'}])
        await assert.rejects(()=>c.query("insert into storage.objects(bucket_id,name) values('after-sales-evidence','forged.png')"),e=>e.code==='42501')
      }
    })
    t.diagnostic('PostgreSQL '+lab.source.version+'; actual Supautils; no hosted service claim. Business/Auth/Storage fixtures were introduced only after initial empty assertions.')
  }finally{await lab.close()}
})
