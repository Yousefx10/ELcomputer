import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@vue/compiler-sfc'
import { ref, reactive, watch, nextTick, effectScope } from 'vue'
const source = parse(await readFile('app/components/auth/Turnstile.vue', 'utf8')).descriptor.scriptSetup.content.replace(/^import .*\n/gm, '')
const factory = new Function('deps', `const {defineProps,defineEmits,ref,onMounted,onBeforeUnmount,watch,loadTurnstile}=deps;${source};return {render,status};`)
async function fixture(t, loader) {
  const props = reactive({ siteKey: 'synthetic', language: 'en', theme: 'light', resetKey: 0 }), events = [], mounts = [], unmounts = [], renders = [], removed = []
  const api = { render: (_, options) => { renders.push(options); return 'widget-' + renders.length }, remove: id => removed.push(id) }
  const scope = effectScope(), state = scope.run(() => factory({ defineProps: () => props, defineEmits: () => (_, token) => events.push(token), ref, watch,
    onMounted: fn => mounts.push(fn), onBeforeUnmount: fn => unmounts.push(fn), loadTurnstile: loader || (() => Promise.resolve(api)) }))
  const unmount = () => { unmounts.forEach(fn => fn()); scope.stop() }; t.after(unmount)
  mounts.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve))
  return { props, state, events, renders, removed, unmount }
}
test('widget invalidates expired, timed-out and failed challenges; reset rejects old callbacks', async t => {
  const f = await fixture(t), first = f.renders[0]
  first.callback('token-one'); assert.equal(f.events.at(-1), 'token-one')
  for (const name of ['expired-callback', 'timeout-callback', 'error-callback']) { first[name](); assert.equal(f.events.at(-1), ''); assert.equal(f.state.status.value, 'error') }
  f.props.resetKey++; await nextTick(); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(f.removed, ['widget-1']); first.callback('late-old-token'); assert.equal(f.events.at(-1), '')
  f.renders[1].callback('token-two'); assert.equal(f.events.at(-1), 'token-two')
  f.unmount(); f.renders[1].callback('late-unmounted-token'); assert.equal(f.events.at(-1), '')
})
test('widget follows EN/AR and resolved theme without persisting a token or hidden field', async t => {
  const f = await fixture(t); assert.equal(f.renders[0].language, 'en'); assert.equal(f.renders[0]['response-field'], false)
  f.props.language = 'ar'; f.props.theme = 'dark'; await nextTick(); await new Promise(resolve => setImmediate(resolve))
  const options = f.renders.at(-1); assert.equal(options.language, 'ar'); assert.equal(options.theme, 'dark'); assert.equal(options.size, 'flexible')
  assert.equal(options.retry, 'never'); assert.equal(options['refresh-expired'], 'manual')
  options.callback('x'.repeat(2049)); assert.equal(f.events.at(-1), '')
})
test('script failure stays closed and a late loader cannot mount after navigation', async t => {
  const failed = await fixture(t, () => Promise.reject(Error('Synthetic network denial')))
  assert.equal(failed.state.status.value, 'error'); assert.equal(failed.events.at(-1), '')
  let release; const pending = new Promise(resolve => { release = resolve }), late = await fixture(t, () => pending)
  late.unmount(); let renders = 0; release({ render: () => { renders++ } }); await new Promise(resolve => setImmediate(resolve)); assert.equal(renders, 0)
})
