import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createResetPlatform, resetPlatformAvailable } from './helpers/systemResetPlatform.mjs'

// Real PostgreSQL/Auth/Storage/PostgREST. The HTTP Nuxt shell is an explicit
// esbuild fixture; separate acceptance runs the actual production bundle/UI.
test('native salary commands preserve atomic accounting, authorization and reset tombstones', { skip: !resetPlatformAvailable }, async t => {
  const f = await createResetPlatform()
  try {
    const employee = (await f.db.query("insert into public.hr_employees(first_name,position,salary_amount) values('Native employee','Acceptance',100) returning id")).rows[0].id
    const input = { command_id: randomUUID(), employee_id: employee, amount: 10, salary_period: '2026-10-01', paid_at: '2026-10-14', reference_number: 'Native salary', notes: 'Disposable accounting' }
    const send = (body = input, actor = 'owner') => f.call('/api/admin-treasury/salary-payment', { method: 'POST', actor, body })
    const args = body => ({ p_actor_id: f.actors.owner, p_command_id: body.command_id, p_employee_id: body.employee_id, p_amount: body.amount, p_salary_period: body.salary_period, p_paid_at: body.paid_at, p_reference_number: body.reference_number, p_notes: body.notes })
    const counts = async () => (await f.db.query("select (select count(*)::int from public.treasury_transactions) ledger,(select count(*)::int from private.salary_payment_commands) receipts,(select count(*)::int from public.admin_activity_logs where action_key='treasury.salary_payment.created') audits")).rows[0]
    let committed
    await t.test('one authorized command posts one ledger, audit and receipt', async () => {
      const r = await send(); assert.equal(r.response.status, 200, JSON.stringify(r.body)); committed = r.body
      assert.equal(r.response.headers.get('cache-control'), 'private, no-store')
      assert.deepEqual(await counts(), { ledger: 1, receipts: 1, audits: 1 })
      const ledger = (await f.db.query('select amount,salary_period::text,party_name,created_by from public.treasury_transactions where id=$1', [committed.transaction_id])).rows[0]
      assert.deepEqual(ledger, { amount: '10.00', salary_period: '2026-10-01', party_name: 'Native employee', created_by: f.actors.owner })
    })
    await t.test('replay returns the original outcome without another audit or outflow', async () => {
      assert.deepEqual((await send()).body, committed); assert.deepEqual(await counts(), { ledger: 1, receipts: 1, audits: 1 })
    })
    await t.test('every material field is bound and actor/receipt spoofing fails', async () => {
      for (const change of [{ employee_id: randomUUID() }, { amount: 11 }, { salary_period: '2026-11-01' }, { paid_at: '2026-10-15' }, { reference_number: 'changed' }, { notes: 'changed' }]) {
        const r = await send({ ...input, ...change }); assert.equal(r.response.status, 409); assert.equal(r.body.data.salaryPaymentError, 'reused')
      }
      for (const change of [{ actor_id: f.actors.owner }, { transaction_id: committed.transaction_id }, { status: 'committed' }]) assert.equal((await send({ ...input, ...change })).response.status, 400)
      assert.deepEqual(await counts(), { ledger: 1, receipts: 1, audits: 1 })
    })
    await t.test('anonymous/customer/viewer/inactive and revoked staff cannot create or replay', async () => {
      await f.createActor('viewer', { 'treasury.view': true }); await f.createActor('payer', { 'treasury.view': true, 'treasury.edit': true })
      for (const [actor, status] of [[null, 401], ['customer', 403], ['viewer', 403], ['editor', 403]]) {
        for (const body of [input, { ...input, command_id: randomUUID() }]) assert.equal((await send(body, actor)).response.status, status)
      }
      assert.equal((await send(input, 'payer')).response.status, 403)
      await f.db.query('update public.admin_users set is_active=false where id=$1', [f.actors.payer])
      assert.equal((await send({ ...input, command_id: randomUUID() }, 'payer')).response.status, 403)
      await f.db.query("update public.admin_users set is_active=true,permissions='{}' where id=$1", [f.actors.payer])
      const r = await f.service.rpc('treasury_record_salary_payment_command', { ...args(input), p_actor_id: f.actors.payer }); assert.equal(r.error.code, '42501')
    })
    await t.test('browser roles cannot call either salary write RPC or read/forge receipts', async () => {
      for (const c of [f.browser, f.authClient()]) {
        assert.ok((await c.rpc('treasury_record_salary_payment_command', args(input))).error)
        assert.ok((await c.rpc('treasury_record_salary_payment', { p_employee_id: employee, p_amount: 10, p_salary_period: input.salary_period, p_paid_at: input.paid_at, p_reference_number: '', p_notes: '' })).error)
      }
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const r = (await f.db.query("select has_table_privilege($1,'private.salary_payment_commands','SELECT') read,has_table_privilege($1,'private.salary_payment_commands','INSERT') write", [role])).rows[0]
        assert.deepEqual(r, { read: false, write: false })
      }
    })
    await t.test('generic logging and direct browser inserts cannot forge salary audits', async () => {
      for (const actionKey of ['treasury.salary_payment.created', ' treasury.salary_payment.created ']) {
        assert.equal((await f.call('/api/admin-logs', { method: 'POST', body: { actionKey, description: 'Forged salary audit' } })).response.status, 400)
      }
      assert.ok((await f.browser.from('admin_activity_logs').insert({ admin_user_id: f.actors.owner, author_name: 'Forged', author_email: f.lab.owner.email, author_role: 'owner', action_key: 'treasury.salary_payment.created', description: 'Forged' })).error)
    })
    await t.test('a correctly signed expired laboratory JWT fails native Auth and the server', async () => {
      const config = await readFile(f.lab.directory + '/postgrest.conf', 'utf8')
      const secret = config.match(/jwt-secret = "([^"]+)"/)[1]
      const [header, payload] = f.tokens.owner.split('.')
      const claims = { ...JSON.parse(Buffer.from(payload, 'base64url')), exp: Math.floor(Date.now() / 1000) - 600 }
      const signed = header + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url')
      const expired = signed + '.' + createHmac('sha256', secret).update(signed).digest('base64url')
      assert.ok((await f.service.auth.getUser(expired)).error)
      assert.equal((await f.call('/api/admin-treasury/salary-payment', { method: 'POST', body: input, headers: { authorization: 'Bearer ' + expired } })).response.status, 401)
    })
    await t.test('lost native PostgREST acknowledgement recovers exactly one commit', async () => {
      const body = { ...input, command_id: randomUUID(), reference_number: 'Lost acknowledgement' }, before = await counts()
      f.lab.loseResponse('POST', '/rest/v1/rpc/treasury_record_salary_payment_command')
      assert.equal((await send(body)).response.status, 503)
      const r = await send(body); assert.equal(r.response.status, 200); assert.deepEqual((await send(body)).body, r.body)
      assert.deepEqual(await counts(), Object.fromEntries(Object.entries(before).map(([k, n]) => [k, n + 1])))
    })
    await t.test('concurrent identical submissions have one committed outcome', async () => {
      const body = { ...input, command_id: randomUUID() }, before = await counts()
      const rs = await Promise.all(Array.from({ length: 8 }, () => send(body)))
      for (const r of rs) { assert.equal(r.response.status, 200); assert.deepEqual(r.body, rs[0].body) }
      assert.deepEqual(await counts(), Object.fromEntries(Object.entries(before).map(([k, n]) => [k, n + 1])))
    })
    await t.test('a distinct explicit command may post the same employee/period/amount', async () => {
      const before = await counts(), r = await send({ ...input, command_id: randomUUID() })
      assert.equal(r.response.status, 200); assert.notEqual(r.body.transaction_id, committed.transaction_id)
      assert.deepEqual(await counts(), Object.fromEntries(Object.entries(before).map(([k, n]) => [k, n + 1])))
    })
    await t.test('audit or receipt failure rolls back the entire ledger transaction', async () => {
      const before = await counts()
      await f.db.query("create function private.fail_salary_acceptance() returns trigger language plpgsql as $$begin raise exception 'Owned injected write failure';end$$")
      for (const table of ['public.admin_activity_logs', 'private.salary_payment_commands']) {
        await f.db.query('create trigger fail_salary_acceptance before insert on ' + table + ' for each row execute function private.fail_salary_acceptance()')
        assert.equal((await send({ ...input, command_id: randomUUID() })).response.status, 503)
        assert.deepEqual(await counts(), before)
        await f.db.query('drop trigger fail_salary_acceptance on ' + table)
      }
      await f.db.query('drop function private.fail_salary_acceptance()')
    })
    await t.test('revocation between server authentication and the locked transaction fails safely', async () => {
      const before = await counts(), connection = await f.lab.connect('postgres')
      await f.db.query('update public.admin_users set permissions=$2 where id=$1', [f.actors.payer, JSON.stringify({ 'treasury.view': true, 'treasury.edit': true })])
      await connection.query('begin')
      try {
        await connection.query("update public.admin_users set permissions='{}' where id=$1", [f.actors.payer])
        const request = send({ ...input, command_id: randomUUID() }, 'payer')
        let waiting = false
        for (let i = 0; i < 100 && !waiting; i++) {
          waiting = (await f.lab.root.query("select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%treasury_record_salary_payment_command%') value")).rows[0].value
          if (!waiting) await new Promise(resolve => setTimeout(resolve, 20))
        }
        assert.equal(waiting, true, 'native payment transaction waited on current administrator authority')
        await connection.query('commit')
        assert.equal((await request).response.status, 403)
        assert.deepEqual(await counts(), before)
      } finally { await connection.query('rollback'); await connection.end() }
    })
    await t.test('an in-flight salary transaction holds the established reset exclusion', async () => {
      const connection = await f.lab.connect('postgres'), before = await counts()
      await connection.query('begin')
      try {
        await connection.query("select set_config('request.jwt.claim.role','service_role',true)")
        const a = args(input)
        const result = (await connection.query('select public.treasury_record_salary_payment_command($1,$2,$3,$4,$5,$6,$7,$8) result', Object.values(a))).rows[0].result
        assert.deepEqual(result, committed)
        const reset = await f.reset('commerce')
        assert.notEqual(reset.response.status, 200)
        assert.match(JSON.stringify(reset.body), /Another reset or catalog operation is running/)
        assert.deepEqual(await counts(), before)
      } finally { await connection.query('rollback'); await connection.end() }
      // The denied request still consumed one password attempt. Age only this
      // fixture's window before the independent eight-scope retention checks.
      await f.db.query("update public.system_reset_attempts set window_started_at=clock_timestamp()-interval '16 minutes'")
    })
    await t.test('treasury outflow and audit metadata match all committed receipts', async () => {
      assert.deepEqual(await counts(), { ledger: 4, receipts: 4, audits: 4 })
      assert.equal((await f.db.query("select sum(amount)::text value from public.treasury_transactions where transaction_type='salary_payment'")).rows[0].value, '40.00')
      assert.equal((await f.db.query("select count(*)::int n from private.salary_payment_commands r join public.admin_activity_logs a on a.id=r.audit_id join public.treasury_transactions l on l.id=r.transaction_id where a.metadata->>'command_id'=r.command_id::text and a.metadata->>'treasury_transaction_id'=l.id::text")).rows[0].n, 4)
    })
    await t.test('the six non-financial reset scopes preserve salary history and live receipts', async () => {
      const before = (await f.db.query('select * from private.salary_payment_commands order by command_id')).rows
      for (const scope of ['products', 'orders', 'documents', 'media', 'content', 'analytics']) {
        if (scope === 'analytics') {
          assert.equal((await f.reset(scope)).response.status, 429)
          // Age only this owned fixture's attempt window; production throttling
          // remains enabled and was verified above. Avoid a 15-minute sleep.
          await f.db.query("update public.system_reset_attempts set window_started_at=clock_timestamp()-interval '16 minutes'")
        }
        assert.equal((await f.reset(scope)).response.status, 200, scope)
        assert.deepEqual((await f.db.query('select * from private.salary_payment_commands order by command_id')).rows, before)
        assert.deepEqual((await send()).body, committed)
      }
      assert.deepEqual(await counts(), { ledger: 4, receipts: 4, audits: 4 })
    })
    await t.test('Commerce Reset clears accounting and retains non-reposting tombstones', async () => {
      assert.equal((await f.reset('commerce')).response.status, 200)
      assert.deepEqual(await counts(), { ledger: 0, receipts: 4, audits: 4 })
      const r = await send(); assert.equal(r.response.status, 409); assert.equal(r.body.data.salaryPaymentError, 'reset')
      assert.equal((await send({ ...input, command_id: randomUUID() })).response.status, 200)
    })
    await t.test('Full Reset retains minimal receipts, clears payroll/history and preserves owner', async () => {
      const before = (await f.db.query('select * from private.salary_payment_commands order by command_id')).rows
      assert.equal((await f.reset('full')).response.status, 200)
      assert.deepEqual(await counts(), { ledger: 0, receipts: 5, audits: 0 })
      assert.equal((await f.db.query('select count(*)::int n from public.hr_employees')).rows[0].n, 0)
      const after = (await f.db.query('select * from private.salary_payment_commands order by command_id')).rows
      assert.deepEqual(after, before.map(r => ({ ...r, retired_by_reset: true })))
      assert.equal((await send()).response.status, 409)
      const login = await f.authClient().auth.signInWithPassword(f.lab.owner); assert.ifError(login.error)
    })
  } finally { await f.close() }
})
