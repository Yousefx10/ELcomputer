// Auth activity timestamps are not an identity/security-state fingerprint.
// Every other present/future column, schema shape and row membership stays bound.
import assert from 'node:assert/strict'
export const authActivityColumns=Object.freeze(['last_sign_in_at','updated_at'])
const quote=name=>'"'+name.replaceAll('"','""')+'"'
export async function authSecurityFingerprint(db){
  const schema=(await db.query(`select a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attgenerated generated
    from pg_attribute a where a.attrelid='auth.users'::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`)).rows
  assert.ok(schema.some(c=>c.name==='id'),'Auth identity column is required')
  for(const column of schema.filter(c=>authActivityColumns.includes(c.name)))assert.equal(column.type,'timestamp with time zone','Auth activity column type changed')
  const columns=schema.map(c=>c.name).filter(name=>!authActivityColumns.includes(name))
  const value=(await db.query(`select count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(row_data order by row_data::text collate "C")::text,'[]'),'UTF8')),'hex') sha256
    from (select to_jsonb(t) row_data from (select ${columns.map(quote).join(',')} from auth.users) t) rows`)).rows[0]
  return {format:1,table:'auth.users',activity_columns:[...authActivityColumns],schema,columns,...value}
}
export function assertAuthSecurityShape(value,table){
  assert.equal(value?.format,1,'An explicit Auth security fingerprint is required')
  assert.equal(value.table,'auth.users');assert.deepEqual(value.activity_columns,[...authActivityColumns])
  assert.deepEqual(value.schema.map(c=>c.name),table.columns,'Auth schema changed')
  assert.deepEqual(value.columns,table.columns.filter(name=>!authActivityColumns.includes(name)))
  assert.equal(value.count,table.count);assert.match(value.sha256,/^[a-f0-9]{64}$/)
}
