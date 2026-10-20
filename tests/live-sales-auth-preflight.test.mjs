import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {authActivityColumns,authSecurityFingerprint} from '../scripts/live-sales-release/auth.mjs'
import {approvalState} from '../scripts/live-sales-release/operator.mjs'
import {snapshot,compareOriginal} from '../scripts/live-sales-release/database.mjs'

test('Auth preflight permits activity only and preserves every security/default-deny boundary',async t=>{
  const db=new PGlite()
  try{
    await db.exec(`create schema auth;
      create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,
        email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz,confirmed_at timestamptz,
        confirmation_token text,recovery_token text,recovery_sent_at timestamptz,
        email_change text,email_change_token_new text,email_change_token_current text,email_change_confirm_status int,
        phone_change text,phone_change_token text,reauthentication_token text,
        raw_app_meta_data jsonb,raw_user_meta_data jsonb,is_super_admin boolean,is_sso_user boolean,
        is_anonymous boolean,banned_until timestamptz,deleted_at timestamptz,created_at timestamptz,
        last_sign_in_at timestamptz,updated_at timestamptz,future_security_state text);
      create table auth.identities(id uuid primary key,user_id uuid,provider text);
      create table public.products(id int primary key,name text);
      insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_sso_user,is_anonymous,created_at,last_sign_in_at,updated_at,future_security_state)
        values('11111111-1111-4111-8111-111111111111','authenticated','authenticated','synthetic@example.invalid','synthetic-password-hash','{}','{}',false,false,false,'2026-01-01Z','2026-01-01Z','2026-01-01Z','protected');
      insert into auth.identities values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','email');
      insert into public.products values(1,'synthetic product');`)
    const state=async()=>({protected_tables:await snapshot(db),auth_security:await authSecurityFingerprint(db)})
    const original=await state()
    const isolated=async fn=>{await db.exec('begin');try{await fn()}finally{await db.exec('rollback')}}
    await t.test('both allowed timestamps can advance without altering approval or preservation',()=>isolated(async()=>{
      assert.deepEqual(authActivityColumns,['last_sign_in_at','updated_at'])
      await db.exec("update auth.users set updated_at='2026-01-02Z',last_sign_in_at='2026-01-02Z'")
      const changed=await state();assert.notDeepEqual(changed.protected_tables,original.protected_tables)
      assert.deepEqual(approvalState(changed),approvalState(original))
      assert.deepEqual(await compareOriginal(db,original.protected_tables,{authSecurity:original.auth_security}),{auth_activity_metadata_changed:true})
      await assert.rejects(()=>compareOriginal(db,original.protected_tables),/Existing row changed/)
    }))
    const cases=[['id',"'33333333-3333-4333-8333-333333333333'"],['role',"'service_role'"],['aud',"'other'"],['email',"'other@example.invalid'"],['encrypted_password',"'changed-hash'"],['phone',"'synthetic phone'"],['email_confirmed_at',"'2026-01-02Z'"],['phone_confirmed_at',"'2026-01-02Z'"],['confirmed_at',"'2026-01-02Z'"],['confirmation_token',"'synthetic-token'"],['recovery_token',"'synthetic-token'"],['recovery_sent_at',"'2026-01-02Z'"],['email_change',"'new@example.invalid'"],['email_change_token_new',"'synthetic-token'"],['email_change_token_current',"'synthetic-token'"],['email_change_confirm_status','1'],['phone_change',"'synthetic phone'"],['phone_change_token',"'synthetic-token'"],['reauthentication_token',"'synthetic-token'"],['raw_app_meta_data',"'{\"role\":\"admin\"}'::jsonb"],['raw_user_meta_data',"'{\"name\":\"changed\"}'::jsonb"],['is_super_admin','true'],['is_sso_user','true'],['is_anonymous','true'],['banned_until',"'2026-01-02Z'"],['deleted_at',"'2026-01-02Z'"],['created_at',"'2026-01-02Z'"],['future_security_state',"'changed'"]]
    for(const [field,value]of cases)await t.test(field+' drift still blocks even with changed activity timestamps',()=>isolated(async()=>{
      await db.exec(`update auth.users set "${field}"=${value},updated_at='2026-01-02Z'`)
      assert.notDeepEqual(approvalState(await state()),approvalState(original))
      await assert.rejects(()=>compareOriginal(db,original.protected_tables,{authSecurity:original.auth_security}),/Protected Auth/)
    }))
    for(const command of ['delete from auth.users',"insert into auth.users(id) values('44444444-4444-4444-8444-444444444444')",'alter table auth.users add column unreviewed_security_state text',"alter table auth.users alter column last_sign_in_at type text",'alter table auth.users drop column future_security_state'])await t.test('membership/schema drift: '+command.split(' ').slice(0,4).join(' '),()=>isolated(async()=>{
      await db.exec(command)
      try{assert.notDeepEqual(approvalState(await state()),approvalState(original))}catch(error){if(error.code!=='ERR_ASSERTION')throw error;assert.match(error.message,/Auth activity column type changed/)}
      await assert.rejects(()=>compareOriginal(db,original.protected_tables,{authSecurity:original.auth_security}))
    }))
    for(const command of ["update auth.identities set user_id='33333333-3333-4333-8333-333333333333'","update auth.identities set provider='other'","update public.products set name='changed'"])await t.test('Auth relationships and business data remain exact: '+command.split(' ')[1],()=>isolated(async()=>{
      await db.exec(command);await assert.rejects(()=>compareOriginal(db,original.protected_tables,{authSecurity:original.auth_security}),/Existing row changed/)
    }))
    await t.test('missing Auth security evidence cannot downgrade to count/schema-only protection',async()=>{
      assert.throws(()=>approvalState({...original,auth_security:null}),/explicit Auth security fingerprint/)
    })
  }finally{await db.close()}
})
