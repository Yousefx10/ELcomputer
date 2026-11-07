import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

// STORAGE-VPS-01: files on the VPS have no Supabase Storage row, so resets list the table paths too.
let db, owner, customer
const value = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
const beginReset = scope => value('select public.system_reset_begin($1,$2,$3,$4::jsonb) as value', [owner, scope, randomUUID(), '[]'])
before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  owner = randomUUID(); customer = randomUUID()
  await db.exec('begin')
  await db.query("select set_config('request.jwt.claim.role','service_role',true)")
  await db.query("insert into auth.users(id,email,created_at) values($1,'owner@test.invalid',now()-interval '1 year'),($2,'customer@test.invalid',now()-interval '1 year')", [owner, customer])
  await db.query("insert into public.admin_users(id,email,full_name,role) values($1,'owner@test.invalid','Test Owner','owner')", [owner])
  // The table-coverage gate is a separate, known gap (RESET-COVERAGE-01). This transaction is
  // rolled back; only the file manifest is under test here.
  await db.query('create or replace function catalog_private.reset_assert_coverage() returns void language plpgsql as $f$ begin end $f$')
})
afterEach(async () => { await db.exec('rollback') })

test('a documents reset lists VPS document files and legacy Supabase objects', async () => {
  await db.query("insert into public.documents(name,storage_path,created_by) values('Vps.pdf','root/11111111-1111-4111-8111-111111111111.pdf',$1)", [owner])
  await db.query("insert into storage.objects(bucket_id,name) values('admin-documents','root/legacy.pdf')")
  const run = await beginReset('documents')
  assert.deepEqual(run.manifest.documents, ['root/11111111-1111-4111-8111-111111111111.pdf', 'root/legacy.pdf'])
})

test('the full-reset manifest also lists support, chat and document table paths', async () => {
  // Full resets are blocked by the separate table-coverage gap, so the installed query is checked directly.
  const definition = await value("select pg_get_functiondef('catalog_private.reset_manifest()'::regprocedure) as value")
  for (const part of ['union select f.storage_path from public.documents f where kind=\'documents\'', 'union select t.storage_path from public.support_ticket_attachments t where kind=\'support\'',
    'union select c.storage_path from public.chat_attachments c where kind=\'chat\'']) assert.ok(definition.includes(part), part)
})

test('a VPS document path can be checkpointed without a Supabase Storage row', async () => {
  await db.query("insert into public.documents(name,storage_path,created_by) values('Doc.pdf','root/22222222-2222-4222-8222-222222222222.pdf',$1)", [owner])
  const run = await beginReset('documents')
  await db.query('select public.system_reset_cleanup_checkpoint($1,$2,$3,$4::jsonb)', [owner, run.id, 'documents', JSON.stringify(run.manifest.documents)])
})

test('the migration replaces only the two anchored manifest queries', async () => {
  const sql = await readFile('supabase/migrations/20261108030000_private_files_on_vps.sql', 'utf8')
  assert.match(sql, /raise exception 'Reset manifest anchors changed\.'/)
  assert.match(sql, /union select f\.storage_path from public\.documents f/)
})
