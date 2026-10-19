import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Called by the existing native bulk browser fixture. Every context is fresh;
// transport denials cannot reach the mutation handler. No personal Chrome data.
export async function runBulkDenialBrowser({ browser, url, fixture, labels, directory, origins }) {
  let assertions = 0, screenshots = 0
  const checks = [], external = [], errors = []
  const check = (value, message) => { assert.ok(value, message); assertions++ }
  const before = await fixture.counts()
  const receiptCount = async () => Number((await fixture.db.query('select count(*) n from catalog_private.product_bulk_receipts')).rows[0].n)
  const receiptsBefore = await receiptCount()
  for (const scenario of [
    { name: '405-en', status: 405, locale: 'en', width: 1440, denied: 'methodDenied' },
    { name: '405-ar', status: 405, locale: 'ar', width: 390, denied: 'methodDenied' },
    { name: '401-en', status: 401, locale: 'en', width: 768, denied: 'accessDenied' },
    { name: '403-ar', status: 403, locale: 'ar', width: 390, denied: 'accessDenied' },
    { name: 'timeout-en', timeout: true, locale: 'en', width: 1440 },
    { name: 'malformed-post-ar', malformed: true, locale: 'ar', width: 390 },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 1000 } })
    const requests = []
    let recovery = 'native', expectedNetworkErrors = 0
    const copy = labels[scenario.locale].productBulk
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() !== 'error') return
      if (/server responded with a status of (401|403|405)\b/.test(message.text())) return
      if (/ERR_TIMED_OUT|ERR_FAILED/.test(message.text())) { expectedNetworkErrors++; return }
      errors.push(message.text())
    })
    await context.route('**/*', async route => {
      const request = route.request(), target = new URL(request.url())
      if (!origins.includes(target.origin)) { external.push(target.origin); await route.abort(); return }
      if (target.origin === fixture.url && target.pathname === '/api/admin-products/bulk') {
        if (request.method() === 'POST') {
          requests.push({ method: 'POST', command: request.postDataJSON() })
          if (scenario.timeout) { await route.abort('timedout'); return }
          await route.fulfill({ status: scenario.status || 200, contentType: scenario.status === 405 ? 'text/html' : 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: scenario.status === 405 ? '<p>Method Not Allowed</p>' : JSON.stringify(scenario.malformed ? {} : { statusCode: scenario.status }) })
          return
        }
        if (request.method() === 'GET') {
          requests.push({ method: 'GET', request_id: target.searchParams.get('request_id'), body: request.postData() })
          if (recovery === 'network') { await route.abort('failed'); return }
          if (recovery === 'malformed') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"result":{"request_id":"malformed"}}' })
            return
          }
        }
      }
      await route.continue()
    })
    try {
      await page.goto(url + '/dashboard/products?q=Listing+product')
      await page.waitForFunction(() => Boolean(window.editorTest))
      await page.evaluate(locale => { const state = window.editorTest; state.locale.value = locale; state.appearance() }, scenario.locale)
      await page.locator('table tbody input[type=checkbox]').first().check()
      await page.locator('#product-bulk-action').selectOption('draft')
      const controls = page.locator('[data-bulk-controls]')
      await controls.getByRole('button', { name: copy.review, exact: true }).click()
      await controls.getByRole('button', { name: copy.apply, exact: true }).click()
      await controls.getByRole('alert').filter({ hasText: copy[scenario.denied || 'unknown'] }).waitFor()
      const initial = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
      const commandEntry = Object.entries(initial).find(([key]) => !key.endsWith(':submission'))
      const command = JSON.parse(commandEntry[1])
      check(command.operation === 'draft' && command.items.length === 1, scenario.name + ': exact command saved')
      check(requests.filter(request => request.method === 'POST').length === 1, scenario.name + ': no automatic resubmission')
      check(await controls.getByRole('button', { name: copy.retry, exact: true }).count() === (scenario.denied ? 0 : 1), scenario.name + ': correct retry availability')
      check(await page.locator('#product-search').isDisabled(), scenario.name + ': unresolved command locks replacement')
      check(await page.locator('html').getAttribute('dir') === (scenario.locale === 'ar' ? 'rtl' : 'ltr'), scenario.name + ': direction retained')
      await controls.getByRole('button', { name: copy.check, exact: true }).click()
      await controls.getByRole('alert').filter({ hasText: copy.noReceipt }).waitFor()
      check(await page.evaluate(([key, value]) => sessionStorage.getItem(key) === value, commandEntry), scenario.name + ': null receipt retains original bytes')
      for (const mode of ['malformed', 'network']) {
        recovery = mode
        await controls.getByRole('button', { name: copy.check, exact: true }).click()
        await controls.getByRole('alert').filter({ hasText: copy.unknown }).waitFor()
        if (scenario.denied) check(await controls.getByRole('alert').filter({ hasText: copy[scenario.denied] }).count() === 1, scenario.name + ': denial survives ' + mode + ' recovery')
        check(await page.evaluate(([key, value]) => sessionStorage.getItem(key) === value, commandEntry), scenario.name + ': ' + mode + ' recovery retains evidence')
      }
      recovery = 'native'
      await page.evaluate(() => { window.editorTest.actor.value = 'viewer' })
      await page.waitForFunction(() => !document.querySelector('#product-bulk-action'))
      check(!(await controls.innerText()).includes(copy.saved.replace('{count}', '1')), scenario.name + ': other actor cannot see saved batch')
      check(await page.evaluate(([key, value]) => sessionStorage.getItem(key) === value, commandEntry), scenario.name + ': actor switch preserves owner evidence')
      await page.evaluate(() => { window.editorTest.actor.value = 'owner' })
      await controls.getByRole('button', { name: copy.check, exact: true }).waitFor()
      page.once('dialog', dialog => dialog.accept())
      await page.reload()
      await page.waitForFunction(() => Boolean(window.editorTest))
      await page.evaluate(locale => { const state = window.editorTest; state.locale.value = locale; state.appearance() }, scenario.locale)
      await controls.getByRole('alert').filter({ hasText: copy[scenario.denied || 'unknown'] }).waitFor()
      check(await page.evaluate(([key, value]) => sessionStorage.getItem(key) === value, commandEntry), scenario.name + ': reload restores identical command')
      check(await controls.getByRole('button', { name: copy.retry, exact: true }).count() === (scenario.denied ? 0 : 1), scenario.name + ': reload retains retry restriction')
      check(requests.filter(request => request.method === 'POST').length === 1, scenario.name + ': recovery/reload/actor switch never POST')
      check(requests.filter(request => request.method === 'GET').length === 3, scenario.name + ': only explicit result checks')
      check(requests.filter(request => request.method === 'GET').every(request => request.request_id === command.request_id && request.body === null), scenario.name + ': GET uses original UUID without a body')
      check(expectedNetworkErrors === (scenario.timeout ? 2 : 1), scenario.name + ': only deliberately aborted requests')
      await page.screenshot({ path: join(directory, 'denial-' + scenario.name + '.png'), fullPage: true }); screenshots++
      checks.push({ scenario: scenario.name, result: 'PASS', post_requests: 1, explicit_get_checks: 3 })
    } catch (failure) {
      await page.screenshot({ path: join(directory, 'denial-' + scenario.name + '-failure.png'), fullPage: true })
      throw failure
    } finally { await context.close() }
  }
  check(JSON.stringify(await fixture.counts()) === JSON.stringify(before), 'Denied/aborted submissions did not change business/audit counts')
  check(await receiptCount() === receiptsBefore, 'Denied/aborted submissions created no database bulk receipt')
  check(external.length === 0, 'No external requests')
  check(errors.length === 0, 'No unexpected browser errors: ' + errors.join(';'))
  const result = { result: 'PASS', assertions, screenshots, checks, external, errors,
    scope: 'Real Chrome temporary contexts, Vue Router and sessionStorage; real GET handlers/native actor-owned receipt SQL; synthetic ingress denials and Auth' }
  await writeFile(join(directory, 'denial-report.json'), JSON.stringify(result, null, 2) + '\n')
  return result
}
