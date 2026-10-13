import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { createEmailNativeDatabase, emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createStorageNativeDatabase, storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { createMediaFixture, mediaMigration } from './helpers/mediaFixture.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'

test('native sessions serialize reference changes, deletion, retries and permission revocation', {skip:!emailNativeAvailable,timeout:60000},async t=>{
  const f=await createMediaFixture({database:await createEmailNativeDatabase()})
  try {
    const product=await f.save(f.body()),path='/uploads/products/concurrent.png';await f.addFile('products/concurrent.png')
    // Match the hosted baseline used by existing catalog RLS fixtures.
    await f.db.exec('grant select on public.admin_users to authenticated')
    const writer=await f.db.connect('authenticated'),deleter=await f.db.connect('service_role'),blocker=await f.db.connect(),observer=await f.db.connect()
    await writer.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[f.actors.editor])
    const client=smsDatabaseClient(deleter),command=()=>client.rpc('catalog_media_delete',{p_admin_id:f.actors.owner,p_path:path})
    const blocked=pid=>nativeWaitFor(async()=>!!(await f.db.query("select 1 from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[pid])).rows.length)
    await t.test('a reference committed while deletion waits is seen before reservation',async()=>{
      await writer.query('begin');await writer.query('update public.products set image_url=$1 where id=$2',[path,product.id])
      const pending=command();await blocked(deleter.processID);await writer.query('commit')
      const result=await pending;assert.equal(result.error.message,'MEDIA_REFERENCED');await access(join(f.root,'products/concurrent.png'))
      await writer.query('update public.products set image_url=null where id=$1',[product.id])
    })
    await t.test('a writer waiting behind deletion cannot commit a broken image reference',async()=>{
      await deleter.query('begin');assert.equal((await command()).error,null)
      const pending=writer.query('update public.products set image_url=$1 where id=$2',[path,product.id]).then(()=>({ok:true}),error=>({error}))
      await blocked(writer.processID);await deleter.query('commit');assert.equal((await pending).error.message,'This image is unavailable. Choose another image.')
      const results=await Promise.all([f.call('/api/admin-gallery',{method:'DELETE',body:{path}}),f.call('/api/admin-gallery',{method:'DELETE',body:{path}})])
      assert.ok(results.every(r=>r.response.status===200),JSON.stringify(results.map(r=>r.body)))
      await assert.rejects(()=>access(join(f.root,'products/concurrent.png')))
      assert.equal((await f.snapshot(product.id)).product.image_url,null)
    })
    await t.test('a revoked administrator cannot unlink after an earlier HTTP authorization check',async()=>{
      await f.addFile('products/revoked.png');await blocker.query('begin');await blocker.query('select id from public.admin_users where id=$1 for update',[f.actors.owner])
      const pending=f.call('/api/admin-gallery',{method:'DELETE',body:{path:'/uploads/products/revoked.png'}})
      await nativeWaitFor(async()=>Number((await observer.query("select count(*) n from pg_stat_activity where wait_event_type='Lock' and query like '%catalog_media_delete%'")).rows[0].n)>0)
      await blocker.query('update public.admin_users set is_active=false where id=$1',[f.actors.owner]);await blocker.query('commit')
      assert.equal((await pending).response.status,403);await access(join(f.root,'products/revoked.png'))
      await f.db.query('update public.admin_users set is_active=true where id=$1',[f.actors.owner])
    })
    await t.test('repeatable-read snapshots cannot bypass the fresh reference scan',async()=>{
      await deleter.query('begin isolation level repeatable read');const r=await command();assert.equal(r.error.message,'MEDIA_ISOLATION_REQUIRED');await deleter.query('rollback')
    })
  }finally{await f.close()}
})

test('migration 73 preserves business values, ACL/RLS and reset compatibility under non-superuser ownership', {skip:!storageNativeAvailable,timeout:60000},async()=>{
  const db=await createStorageNativeDatabase({stopBefore:mediaMigration})
  try {
    const f=await createProductSaveFixture({database:db});await f.save(f.body({image_url:'/uploads/products/preserved.png'}))
    const values=async()=>{
      const values=[]
      for(const {tablename}of(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows){
        const row=(await db.query(`select count(*)::int n,
          md5(coalesce(string_agg(to_jsonb(r)::text,chr(10) order by to_jsonb(r)::text),'')) hash
          from public."${tablename}" r`)).rows[0]
        values.push({tablename,...row})
      }
      return values
    }
    const safeguards=async()=>(await db.query("select c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage') and c.relkind='r' order by n.nspname,c.relname")).rows
    const before=await values(),acls=await safeguards()
    await db.exec(await readFile(new URL('../supabase/migrations/'+mediaMigration,import.meta.url),'utf8'))
    assert.deepEqual(await values(),before);assert.deepEqual(await safeguards(),acls)
    assert.equal((await db.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
    assert.equal((await db.query("select count(*)::int n from pg_constraint where conrelid='catalog_private.media_paths'::regclass and contype='f'")).rows[0].n,0)
    for(const role of ['anon','authenticated','service_role']) {
      const c=await db.connect(role);await assert.rejects(()=>c.query('select * from catalog_private.media_paths'),e=>e.code==='42501')
      if(role!=='service_role')await assert.rejects(()=>c.query('select public.catalog_media_delete($1,$2)',[f.actors.owner,'/uploads/products/unused.png']),e=>e.code==='42501')
    }
    const service=await db.connect('service_role');const c=smsDatabaseClient(service)
    for(const actor of ['editor','viewer','disabled','customer']) assert.equal((await c.rpc('catalog_media_delete',{p_admin_id:f.actors[actor],p_path:'/uploads/products/unused.png'})).error.message,'MEDIA_FORBIDDEN')
    assert.equal((await c.rpc('catalog_media_delete',{p_admin_id:f.actors.owner,p_path:'/uploads/products/unused.png'})).error,null)
    for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_column_privilege($1,'public.products','cost_price','SELECT') allowed",[role])).rows[0].allowed,false)
  }finally{await db.close()}
})
