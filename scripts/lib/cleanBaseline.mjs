import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

export const baselineDirectory = new URL('../../supabase/bootstrap/clean-v1/', import.meta.url)
const migrationsDirectory = new URL('../../supabase/migrations/', import.meta.url)
export const sourceCommit = 'ae3a58d7a6e81a00b720bed49d8953aabd3bb160'
export const inventoryHash = '0bebb93ecc0a4a7cc3d73d587aed0df5e752eca769410b38e12ae08208e1e7db'
export const backupHash = 'c45588387105d146ba4c3824ea56d01e5a3f207e7840d6955720f28e5b6126a8'
export const hash = data => createHash('sha256').update(data).digest('hex')
export const json = data => JSON.stringify(data, null, 2) + '\n'
const ident = value => '"' + value.replaceAll('"', '""') + '"'
const literal = value => "'" + value.replaceAll("'", "''") + "'"
export const roles = ['anon', 'authenticated', 'service_role']

export async function migrationInventory(directory = migrationsDirectory) {
  const names = (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()
  const entries = await Promise.all(names.map(async filename => ({ filename, version: filename.split('_')[0], name: filename.replace(/^\d+_/, '').replace(/\.sql$/, ''), sha256: hash(await readFile(new URL(filename, directory))) })))
  assert.equal(entries.length, 70, 'Frozen baseline requires exactly 70 historical migrations.')
  assert.equal(new Set(entries.map(e => e.version)).size, 70, 'Duplicate migration version.')
  assert.equal(hash(entries.map(e => e.filename + '\t' + e.sha256 + '\n').join('')), inventoryHash, 'Historical migration hash mismatch.')
  assert.equal(hash(await readFile(new URL('../../supabase/backups/schema.sql', import.meta.url))), backupHash, 'Source schema hash mismatch.')
  return entries
}

export async function catalog(db) {
  await db.query("set search_path=pg_catalog")
  const queries = {
    relations: `select n.nspname schema,c.relname name,c.relkind kind,pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.reloptions options,c.relpersistence persistence from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S','f') order by 1,2`,
    columns: `select c.relname relation,a.attnum number,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,pg_get_expr(d.adbin,d.adrelid) default_expression,a.attidentity identity,a.attgenerated generated,a.attstorage storage,a.attcompression compression,case when a.attcollation=0 then null else a.attcollation::regcollation::text end collation from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v','m','f') and a.attnum>0 and not a.attisdropped order by 1,2`,
    constraints: `select c.conname name,c.conrelid::regclass::text relation,c.contype type,c.convalidated validated,c.condeferrable deferrable,c.condeferred deferred,c.connoinherit no_inherit,pg_get_constraintdef(c.oid) definition from pg_constraint c where c.connamespace='public'::regnamespace order by 2,1`,
    indexes: `select i.indexrelid::regclass::text name,i.indrelid::regclass::text relation,i.indisvalid valid,i.indisready ready,i.indisunique unique,i.indisprimary primary_key,i.indnullsnotdistinct nulls_not_distinct,pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_class c on c.oid=i.indrelid where c.relnamespace='public'::regnamespace order by 1`,
    views: `select c.relname name,pg_get_viewdef(c.oid) definition,c.reloptions options from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('v','m') order by 1`,
    functions: `select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,l.lanname language,p.prosecdef security_definer,p.proleakproof leakproof,p.proisstrict strict,p.provolatile volatility,p.proparallel parallel,p.proconfig configuration,p.procost cost,p.prorows rows,pg_get_functiondef(p.oid) definition from pg_proc p join pg_language l on l.oid=p.prolang where p.pronamespace='public'::regnamespace order by 1`,
    triggers: `select t.tgrelid::regclass::text relation,t.tgname name,t.tgenabled enabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and p.pronamespace='public'::regnamespace order by 1,2`,
    policies: `select schemaname schema,tablename relation,policyname name,permissive,roles::text[] roles,cmd,qual,with_check from pg_policies where schemaname='public' or (schemaname='storage' and policyname in ('after_sales_evidence_server_boundary','reverse_label_server_boundary')) or (schemaname='realtime' and policyname='chat_receive_broadcast') order by 1,2,3`,
    sequences: `select schemaname schema,sequencename name,sequenceowner owner,data_type::text type,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by 2`,
    sequence_dependencies: `select s.relname sequence,t.relname relation,a.attname column_name,d.deptype dependency from pg_class s join pg_depend d on d.objid=s.oid and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass join pg_class t on t.oid=d.refobjid join pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid where s.relnamespace='public'::regnamespace and s.relkind='S' and d.deptype in ('a','i') order by 1`,
    types: `select t.typname name,t.typtype kind,pg_get_userbyid(t.typowner) owner,t.typnotnull not_null,t.typdefault default_expression from pg_type t where t.typnamespace='public'::regnamespace order by 1`,
    extensions: `select e.extname name,e.extversion version,n.nspname schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by 1`
  }
  const result = {}
  for (const [name, sql] of Object.entries(queries)) result[name] = (await db.query(sql)).rows
  return result
}

// pg_dump expands BETWEEN to comparisons. PostgreSQL's parser flattens the
// left nested AND when restoring it. Permit only these reviewed associative
// rewrites; all operators, operands, OR grouping and other catalog fields match.
const restoredRanges = {
  chat_conversations_email_check: ['char_length(contact_email)',3,320],
  chat_conversations_mobile_check: ['char_length(contact_mobile)',7,30],
  chat_settings_allowed_mimes_check: ['cardinality(allowed_attachment_mimes)',1,4],
  document_folders_name_check: ['char_length(btrim(name))',1,120],
  documents_name_check: ['char_length(btrim(name))',1,240],
  email_templates_check: ['char_length(subject_en)',1,200],
  email_templates_check1: ['char_length(body_en)',1,20000],
  site_pages_path_check: ['char_length(path)',1,160]
}
export function assertCatalogEquivalent(actual, expected) {
  const normalized = structuredClone(expected), differences = []
  for (const c of normalized.constraints) {
    const range = restoredRanges[c.name]
    if (!range) continue
    const [expression,min,max] = range
    const nested = `((${expression} >= ${min}) AND (${expression} <= ${max}))`
    const flat = `(${expression} >= ${min}) AND (${expression} <= ${max})`
    const restored = actual.constraints.find(a => a.name===c.name && a.relation===c.relation)
    if (c.definition!==restored?.definition) {
      const after = c.definition.replace(nested,flat)
      assert.notEqual(c.definition,after,'Reviewed constraint rewrite missing.')
      assert.equal(restored.definition,after,'Unexpected constraint change: '+c.name)
      differences.push({ relation:c.relation,name:c.name,before:c.definition,after,reason:'pg_dump BETWEEN expansion; associative left AND flattening only' })
      c.definition=after
    }
  }
  assert.deepEqual(actual,normalized,'Unexpected schema/security catalog difference.')
  return differences
}

// These public base tables lack explicit service grants in the reference
// backup. Every entry has an existing server .from() contract. No command-only
// queue, setup state, reset-attempt or physical-unit table is added here.
const serviceContracts = {
  admin_activity_logs: ['SELECT', 'INSERT'], admin_users: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  brands: ['SELECT'], categories: ['SELECT'], products: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  product_images: ['SELECT'], product_specifications: ['SELECT'], product_reviews: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  customer_profiles: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'], customer_orders: ['SELECT', 'UPDATE'], customer_order_items: ['SELECT'],
  site_settings: ['SELECT'], site_hero_banners: ['SELECT'], site_top_bar_messages: ['SELECT'], site_links: ['SELECT'],
  site_offer_cards: ['SELECT'], site_coupons: ['SELECT'], hr_employees: ['SELECT'], treasury_transactions: ['SELECT'],
  commerce_crm_accounts: ['SELECT'], commerce_shipping_companies: ['SELECT'], commerce_warehouses: ['SELECT'],
  commerce_warehouse_inventory: ['SELECT'], commerce_inventory_movements: ['SELECT'], commerce_sales_orders: ['SELECT'],
  commerce_sales_items: ['SELECT'], commerce_procurement_orders: ['SELECT'], commerce_procurement_items: ['SELECT'],
  commerce_warehouse_transfers: ['SELECT'], commerce_warehouse_transfer_items: ['SELECT'], commerce_order_returns: ['SELECT'], commerce_order_return_items: ['SELECT']
}
const dml = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
const tablePrivileges = [...dml, 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
const sensitiveColumns = { products: ['cost_price', 'default_supplier_id', 'primary_warehouse_id'], product_variants: ['cost_price'] }

export async function permissions(db, schema) {
  const matrix = { relations: [], columns: [], functions: [], sequences: [], differences: [] }
  const lines = ['-- Explicit per-object permissions. No role creation or default grants.', 'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;']
  for (const r of schema.relations.filter(r => r.kind !== 'S')) {
    const grants = {}, before = {}
    for (const role of roles) {
      const actual = []
      for (const privilege of tablePrivileges) if ((await db.query('select has_table_privilege($1,$2,$3) allowed', [role, 'public.' + r.name, privilege])).rows[0].allowed) actual.push(privilege)
      before[role] = actual
      grants[role] = [...actual]
      if (role !== 'service_role' && r.kind === 'r') {
        // RLS policies define intended browser access where older implicit
        // table grants are absent. Restrictive/false policies confer nothing.
        const policies = schema.policies.filter(p => p.schema === 'public' && p.relation === r.name && p.permissive === 'PERMISSIVE' && p.roles.some(v => v === role || v === 'public'))
        for (const p of policies) {
          if (p.qual === 'false' || p.with_check === 'false') continue
          for (const privilege of (p.cmd === 'ALL' ? dml : [p.cmd])) if (!grants[role].includes(privilege)) grants[role].push(privilege)
        }
        // SELECT remains column-scoped for catalog confidentiality.
        if (sensitiveColumns[r.name]) grants[role] = grants[role].filter(p => p !== 'SELECT')
      }
      if (role === 'service_role' && serviceContracts[r.name]) grants[role] = [...new Set([...grants[role], ...serviceContracts[r.name]])]
      grants[role].sort()
      if (JSON.stringify([...actual].sort()) !== JSON.stringify(grants[role])) matrix.differences.push({ kind: 'table', object: r.name, role, before: actual, after: grants[role], reason: role === 'service_role' ? 'Existing server read/write contract; missing base grant' : 'Existing permissive RLS policy; missing base grant' })
    }
    lines.push(`REVOKE ALL ON TABLE public.${ident(r.name)} FROM PUBLIC, anon, authenticated, service_role;`)
    for (const role of roles) if (grants[role].length) lines.push(`GRANT ${grants[role].join(', ')} ON TABLE public.${ident(r.name)} TO ${role};`)
    matrix.relations.push({ name: r.name, grants })
  }
  const columnRows = (await db.query(`select c.relname relation,a.attname name,a.attacl::text acl from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace and a.attnum>0 and not a.attisdropped and a.attacl is not null order by 1,a.attnum`)).rows
  for (const c of columnRows) {
    const grants = {}
    for (const role of roles) {
      grants[role] = []
      for (const p of ['SELECT','INSERT','UPDATE','REFERENCES']) if ((await db.query('select has_column_privilege($1,$2,$3,$4) allowed', [role,'public.'+c.relation,c.name,p])).rows[0].allowed) grants[role].push(p)
    }
    matrix.columns.push({ relation: c.relation, name: c.name, grants })
    lines.push(`REVOKE ALL (${ident(c.name)}) ON TABLE public.${ident(c.relation)} FROM PUBLIC, anon, authenticated, service_role;`)
    for (const role of roles) if (grants[role].length) lines.push(`GRANT ${grants[role].map(p => `${p} (${ident(c.name)})`).join(', ')} ON TABLE public.${ident(c.relation)} TO ${role};`)
  }
  for (const f of schema.functions) {
    const grants = []
    for (const role of roles) if ((await db.query('select has_function_privilege($1,$2,$3) allowed', [role,f.signature,'EXECUTE'])).rows[0].allowed) grants.push(role)
    lines.push(`REVOKE ALL ON FUNCTION ${f.signature} FROM PUBLIC, anon, authenticated, service_role;`)
    if (grants.length) lines.push(`GRANT EXECUTE ON FUNCTION ${f.signature} TO ${grants.join(', ')};`)
    matrix.functions.push({ signature: f.signature, grants })
  }
  for (const s of schema.sequences) {
    const grants = {}
    for (const role of roles) {
      grants[role] = []
      for (const p of ['SELECT','USAGE','UPDATE']) if ((await db.query('select has_sequence_privilege($1,$2,$3) allowed', [role,'public.'+s.name,p])).rows[0].allowed) grants[role].push(p)
      // Policy-derived inserts need their own owned serial/identity sequence.
      const dep = schema.sequence_dependencies.find(d => d.sequence === s.name)
      if (dep && matrix.relations.find(r => r.name === dep.relation)?.grants[role].includes('INSERT') && !grants[role].includes('USAGE')) grants[role].push('USAGE')
    }
    lines.push(`REVOKE ALL ON SEQUENCE public.${ident(s.name)} FROM PUBLIC, anon, authenticated, service_role;`)
    for (const role of roles) if (grants[role].length) lines.push(`GRANT ${grants[role].join(', ')} ON SEQUENCE public.${ident(s.name)} TO ${role};`)
    matrix.sequences.push({ name: s.name, grants })
  }
  return { sql: lines.join('\n') + '\n', matrix }
}

const seedTables = ['after_sales_communication_settings','after_sales_policies','after_sales_return_reasons','chat_settings','email_provider_settings','help_categories','shipping_city_mappings','shipping_status_mappings','sms_provider_settings','sms_templates','sms_order_event_settings','specification_definitions']
export async function cleanSeeds(db) {
  const rows = {}
  for (const table of seedTables) rows[table] = (await db.query(`select to_jsonb(t) row from public.${ident(table)} t order by to_jsonb(t)::text`)).rows.map(r => r.row)
  // Stable generic reference IDs are generated from natural system keys, never
  // a production row or Auth identity. Bindings follow these remapped IDs.
  const ids = new Map()
  for (const table of ['help_categories','shipping_city_mappings','sms_templates','specification_definitions']) for (const r of rows[table]) {
    const value = hash(table + ':' + (r.key ?? r.code ?? r.slug ?? r.provider_city_id)).slice(0,32)
    ids.set(r.id, value.slice(0,8)+'-'+value.slice(8,12)+'-5'+value.slice(13,16)+'-a'+value.slice(17,20)+'-'+value.slice(20))
  }
  const lines = ['-- Allowlisted neutral references and disabled settings only. No historical data.', "SELECT set_config('app.claim_communication_write','on',true),set_config('app.email_write','on',true);"]
  const manifest = {}
  for (const table of seedTables) {
    const cleaned = rows[table].map(row => Object.fromEntries(Object.entries(row).filter(([k]) => !['created_at','updated_at','capture_started_at'].includes(k)).map(([k,v]) => [k, ids.get(v) ?? v])))
    cleaned.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'))
    manifest[table] = cleaned
    const data = literal(JSON.stringify(cleaned))
    const fields = Object.keys(cleaned[0]).sort()
    lines.push(`INSERT INTO public.${ident(table)} (${fields.map(ident).join(', ')}) SELECT ${fields.map(ident).join(', ')} FROM jsonb_populate_recordset(NULL::public.${ident(table)}, ${data}::jsonb);`)
  }
  const site = { key: 'default', site_name: '', landing_page_title: '', hero_enabled: false, banner_ad_1_enabled: false, banner_ad_2_enabled: false, homepage_reviews_enabled: false, homepage_reviews_view_all_enabled: false, payment_cash_enabled: false, payment_card_enabled: false, payment_bank_transfer_enabled: false, payment_instapay_enabled: false, payment_paypal_enabled: false, footer_cta_title: '', footer_cta_subtitle: '', footer_cta_button_label: '', footer_cta_button_url: '', footer_email: '', footer_phone: '', footer_address: '', copyright_text: '' }
  for (const field of ['footer_modern_card_title','footer_modern_card_text','footer_modern_card_button_label','footer_modern_card_button_url','footer_modern_community_text','footer_modern_bottom_left_text','footer_modern_bottom_center_text']) site[field]=''
  site.auth_show_visual_text=false
  const fields = Object.keys(site)
  lines.push(`INSERT INTO public.site_settings (${fields.map(ident).join(', ')}) SELECT ${fields.map(ident).join(', ')} FROM jsonb_populate_record(NULL::public.site_settings, ${literal(JSON.stringify(site))}::jsonb);`)
  manifest.site_settings = [site]
  // Seed configuration before setup metadata, so dependency insert triggers
  // see no generations yet. Explicit guard capability only in this transaction.
  lines.push("SELECT set_config('app.quick_setup_write','on',true);", 'INSERT INTO public.quick_setup_state(singleton) VALUES(true);', `INSERT INTO public.quick_setup_revisions(domain) SELECT unnest(ARRAY['application','infrastructure','branding','contact','policies','payment_methods','paymob','paypal','express_payments','shipping','daftra','vodafone','brevo','automation','authentication','oauth','live_chat']);`, "SELECT set_config('app.quick_setup_write','',true),set_config('app.claim_communication_write','',true),set_config('app.email_write','',true);")
  manifest.quick_setup_state = [{ singleton: true, revision: 0, selections: {}, installation_id: 'generated-per-installation' }]
  manifest.quick_setup_revisions = { count: 17, revision: 0 }
  return { sql: lines.join('\n') + '\n', manifest }
}

export async function managedHooks(db, schema) {
  const triggers = schema.triggers.filter(t => !t.relation.startsWith('public.'))
  const policies = schema.policies.filter(p => p.schema !== 'public')
  return triggers.map(t => t.definition + ';').concat(policies.map(p => `CREATE POLICY ${ident(p.name)} ON ${ident(p.schema)}.${ident(p.relation)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(ident).join(', ')}${p.qual ? ' USING ('+p.qual+')' : ''}${p.with_check ? ' WITH CHECK ('+p.with_check+')' : ''};`)).join('\n') + '\n'
}

export const freshGuard = `-- Requires a verified empty new project; not an upgrade migration.
DO $fresh_target$
BEGIN
 IF current_user <> 'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'Expected non-superuser postgres migration role.'; END IF;
 IF EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace) OR EXISTS(SELECT FROM pg_proc WHERE pronamespace='public'::regnamespace) OR EXISTS(SELECT FROM pg_type WHERE typnamespace='public'::regnamespace) THEN RAISE EXCEPTION 'Application schema is occupied.'; END IF;
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN RAISE EXCEPTION 'Migration history is occupied or unverified.'; END IF;
 IF EXISTS(SELECT FROM auth.users) OR EXISTS(SELECT FROM storage.buckets) OR EXISTS(SELECT FROM storage.objects) THEN RAISE EXCEPTION 'Auth or Storage target is occupied.'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Browser roles must not bypass RLS.'; END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN RAISE EXCEPTION 'Browser roles must not create public objects.'; END IF;
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'PostgreSQL 17 capability profile required.'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='storage.objects'::regclass AND relkind='r' AND relrowsecurity) OR NOT EXISTS(SELECT FROM pg_class WHERE oid='realtime.messages'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Managed RLS capability missing.'; END IF;
 IF NOT EXISTS(SELECT FROM pg_settings WHERE name='supautils.policy_grants' AND context='sighup') THEN RAISE EXCEPTION 'Actual Supautils policy delegation required.'; END IF;
END $fresh_target$;
`

export async function bucketManifest(db) {
  return (await db.query('select id,public,file_size_limit::bigint::text,allowed_mime_types from storage.buckets order by id')).rows.map(r => ({ ...r, file_size_limit: Number(r.file_size_limit) }))
}

export async function verifyBundle(directory = baselineDirectory) {
  const inventory = await migrationInventory()
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory)))
  assert.equal(manifest.source_commit, sourceCommit)
  assert.equal(manifest.migration_inventory_sha256, inventoryHash)
  assert.deepEqual(JSON.parse(await readFile(new URL('covered-migrations.json', directory))), inventory)
  for (const [name,digest] of Object.entries(manifest.artifacts)) {
    assert.match(name, /^[a-z][a-z0-9-]*\.(sql|json)$/)
    assert.equal(hash(await readFile(new URL(name, directory))), digest, 'Bootstrap artifact hash mismatch: ' + name)
  }
  return { manifest, inventory }
}

export async function verifyCleanData(db) {
  const seeds = JSON.parse(await readFile(new URL('seed-manifest.json', baselineDirectory)))
  const names = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows
  const counts = {}
  for (const {tablename} of names) {
    const count = (await db.query(`select count(*)::int n from public.${ident(tablename)}`)).rows[0].n
    counts[tablename] = count
    assert.equal(count, tablename === 'quick_setup_revisions' ? 17 : seeds[tablename]?.length ?? 0, 'Unexpected initial data: ' + tablename)
    if (Array.isArray(seeds[tablename]) && !tablename.startsWith('quick_setup_')) {
      const expected=seeds[tablename]
      const fields=Object.keys(expected[0])
      const actual=(await db.query(`select to_jsonb(t) row from public.${ident(tablename)} t`)).rows.map(({row})=>Object.fromEntries(fields.map(key=>[key,row[key]])))
      const sorted=rows=>rows.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'))
      assert.deepEqual(sorted(actual),sorted(expected),'Initial seed semantics differ: '+tablename)
    }
  }
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from storage.buckets')).rows[0].n, 0, 'Buckets remain API definitions in this milestone.')
  assert.equal((await db.query('select count(*)::int n from public.quick_setup_revisions where revision<>0')).rows[0].n, 0)
  const state = (await db.query('select revision,selections,installation_id from public.quick_setup_state')).rows[0]
  assert.equal(state.revision, '0'); assert.deepEqual(state.selections, {}); assert.match(state.installation_id, /^[0-9a-f-]{36}$/)
  for (const table of ['sms_templates','sms_order_event_settings','sms_provider_settings','chat_settings']) assert.equal((await db.query(`select count(*)::int n from public.${table} where is_enabled`)).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.after_sales_communication_settings where is_enabled or sms_enabled or email_enabled')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.after_sales_policies where warranty_enabled or return_enabled or warranty_configured or return_configured')).rows[0].n, 0)
  assert.equal((await db.query("select count(*)::int n from public.email_provider_settings where (config->>'is_enabled')::boolean or (config->>'marketing_enabled')::boolean or (config->>'webhook_enabled')::boolean or api_key_encrypted is not null or webhook_token_encrypted is not null")).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.sms_provider_settings where account_id_encrypted is not null or password_encrypted is not null or hash_secret_encrypted is not null')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.site_settings where payment_cash_enabled or payment_card_enabled or payment_bank_transfer_enabled or payment_instapay_enabled or payment_paypal_enabled')).rows[0].n, 0)
  return { counts, installation_id: state.installation_id }
}

export async function applyCandidate(db) {
  await verifyBundle()
  try {
    await db.query('BEGIN')
    for (const name of ['schema.sql','permissions.sql','clean-seeds.sql']) await db.query(await readFile(new URL(name, baselineDirectory), 'utf8'))
    await verifyCleanData(db)
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error }
}

export async function assertPermissionMatrix(db, matrix) {
  for (const r of matrix.relations) for (const role of roles) for (const p of tablePrivileges) assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,'public.'+r.name,p])).rows[0].allowed, r.grants[role].includes(p), `${role} ${r.name} ${p}`)
  for (const c of matrix.columns) for (const role of roles) for (const p of ['SELECT','INSERT','UPDATE','REFERENCES']) {
    const table = matrix.relations.find(r => r.name === c.relation)
    assert.equal((await db.query('select has_column_privilege($1,$2,$3,$4) allowed',[role,'public.'+c.relation,c.name,p])).rows[0].allowed, c.grants[role].includes(p) || table.grants[role].includes(p), `${role} ${c.relation}.${c.name} ${p}`)
  }
  for (const f of matrix.functions) for (const role of roles) assert.equal((await db.query('select has_function_privilege($1,$2,$3) allowed',[role,f.signature,'EXECUTE'])).rows[0].allowed, f.grants.includes(role), `${role} ${f.signature}`)
  for (const s of matrix.sequences) for (const role of roles) for (const p of ['SELECT','USAGE','UPDATE']) assert.equal((await db.query('select has_sequence_privilege($1,$2,$3) allowed',[role,'public.'+s.name,p])).rows[0].allowed, s.grants[role].includes(p), `${role} ${s.name} ${p}`)
  for (const [table,columns] of Object.entries(sensitiveColumns)) for (const role of ['anon','authenticated']) for (const column of columns) assert.equal((await db.query("select has_column_privilege($1,$2,$3,'SELECT') allowed",[role,'public.'+table,column])).rows[0].allowed,false)
}

export async function adoptLaboratoryHistory(lab) {
  const { inventory } = await verifyBundle()
  const expected = JSON.parse(await readFile(new URL('expected-schema.json',baselineDirectory)))
  const acl = JSON.parse(await readFile(new URL('permissions-manifest.json',baselineDirectory)))
  // This helper has no external connection parameter. Only a laboratory object
  // that owns its generated loopback cluster can run the pinned CLI.
  assert.equal((await lab.candidate.query('select current_database() name')).rows[0].name,'clean_candidate')
  assert.equal((await lab.candidate.query("select host(inet_server_addr()) host,inet_server_port() port")).rows[0].host,'127.0.0.1')
  assert.equal((await lab.candidate.query('select inet_server_port() port')).rows[0].port,lab.source.port,'Mismatched laboratory target.')
  assert.equal((await lab.candidate.query("select to_regnamespace('supabase_migrations') name")).rows[0].name,null,'History target already occupied.')
  assertCatalogEquivalent(await catalog(lab.candidate),expected)
  await assertPermissionMatrix(lab.candidate,acl)
  const clean = await verifyCleanData(lab.candidate)
  await lab.candidate.query("select pg_advisory_lock(hashtextextended('clean-baseline-lab-history',0))")
  try {
    await lab.cli(['migration','repair',...inventory.map(e=>e.version),'--status','applied'],inventory.map(e=>e.filename))
    const history=(await lab.candidate.query('select version,name,cardinality(statements) statement_count from supabase_migrations.schema_migrations order by version')).rows
    assert.deepEqual(history.map(({version,name})=>({version,name})),inventory.map(({version,name})=>({version,name})))
    assert.ok(history.every(e=>e.statement_count>0),'CLI must retain the matching local source statements.')
    const after=await verifyCleanData(lab.candidate)
    assert.deepEqual(after,clean,'History adoption must not execute historical seeds or change installation identity.')
    return { method:'Supabase CLI 2.109.1 explicit-version migration repair --status applied', baseline_covered:history.map(({version,name})=>({version,name})), historical_sql_files_executed_on_candidate:0, installation_id:clean.installation_id }
  } finally { await lab.candidate.query("select pg_advisory_unlock(hashtextextended('clean-baseline-lab-history',0))") }
}

export async function writeArtifacts(artifacts) {
  await mkdir(baselineDirectory, { recursive: true })
  for (const [name,content] of Object.entries(artifacts)) await writeFile(new URL(name,baselineDirectory),content)
}
