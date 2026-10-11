import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const source = name => readFileSync(new URL(`../scripts/${name}`, import.meta.url), 'utf8')
const localSource = source('deploy.sh'), remoteSource = source('deploy-remote.sh')
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

// Only fixture copies have rewritten locked paths. Every external executable is
// replaced before the copies run; neither SSH nor PM2 can reach a real service.
function fixture(t, scenario = 'success', extra = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'elcomputer-deploy-test-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const project = path.join(root, 'project'), site = path.join(root, 'site'), bin = path.join(root, 'bin')
  for (const dir of [project, site, bin, path.join(project, 'scripts'), path.join(site, '.output/server')]) mkdirSync(dir, { recursive: true })
  const replacedRemote = remoteSource.replace('readonly SITE_PATH="/home/newelcomputer/htdocs/new.elcomputer.net"', `readonly SITE_PATH="${site}"`)
    .replace('readonly NODE_BIN_DIR="/home/newelcomputer/.nvm/versions/node/v22.23.1/bin"', `readonly NODE_BIN_DIR="${bin}"`)
  writeFileSync(path.join(project, 'scripts/deploy.sh'), localSource.replace('readonly DEPLOY_PATH="/home/newelcomputer/htdocs/new.elcomputer.net"', `readonly DEPLOY_PATH="${site}"`))
  writeFileSync(path.join(project, 'scripts/deploy-remote.sh'), replacedRemote)
  writeFileSync(path.join(site, '.output/server/index.mjs'), 'old')
  writeFileSync(path.join(project, 'package.json'), JSON.stringify({ scripts: { build: 'nuxt build' }, dependencies: { nuxt: 'fixture' } }))
  writeFileSync(path.join(project, '.env'), '')
  writeFileSync(path.join(project, '.deploy.env'), 'DEPLOY_HOST=fixture.invalid\nDEPLOY_HEALTH_RETRIES=1\nDEPLOY_HEALTH_DELAY=1\nDEPLOY_BACKUP_RETENTION=1\n')
  const prior = '.output-deploy-backup-20261011-121937-33243'
  mkdirSync(path.join(site, prior))
  writeFileSync(path.join(site, prior, 'preserved'), 'pre-SQL artifact')
  const env = { ...process.env, PATH: `${bin}:/usr/bin:/bin`, TMPDIR: root, FIXTURE_ROOT: root,
    FIXTURE_SITE: site, FIXTURE_BIN: bin, SCENARIO: scenario, ...extra }
  delete env.DEPLOY_CONFIG_FILE
  delete env.NODE_OPTIONS
  delete env.DEBUG
  const common = `const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const site=process.env.FIXTURE_SITE,root=process.env.FIXTURE_ROOT,scenario=process.env.SCENARIO;
const args=process.argv.slice(2);const event=(value)=>fs.appendFileSync(path.join(root,'events'),JSON.stringify(value)+'\\n');
const current=()=>{try{return fs.readFileSync(path.join(site,'.output/server/index.mjs'),'utf8')}catch{return 'missing'}};
`
  const tool = (name, body) => writeFileSync(path.join(bin, name), `#!${process.execPath}\n${common}${body}\n`, { mode: 0o700 })
  tool('node', `if(args.join(' ')==='--version'){console.log('v22.23.1');process.exit(0)}if(scenario==='hash-error'&&args.includes('pre-activation'))process.exit(45);const result=cp.spawnSync(${JSON.stringify(process.execPath)},args,{stdio:'inherit',env:process.env});process.exit(result.status??1)`)
  tool('whoami', `console.log(process.env.FIXTURE_WRONG_USER?'other-user':'newelcomputer')`)
  tool('git', `if(args.join(' ')==='ls-files --error-unmatch .env')process.exit(1);throw Error('Unexpected fixture git call')`)
  tool('npm', `event({tool:'npm',args});if(scenario==='build-error')process.exit(4);fs.mkdirSync('.output/server',{recursive:true});fs.writeFileSync('.output/server/index.mjs','new')`)
  tool('ssh', `const target=args.at(-2),command=args.at(-1);if(target!=='newelcomputer@fixture.invalid')throw Error('Forbidden SSH target');event({tool:'ssh',command});
const input=fs.readFileSync(0);if(scenario==='missing-ack'&&command==='bash -s -- check manual'){console.log('legacy helper');process.exit(0)}
const result=cp.spawnSync('/bin/bash',['-c',command],{input,env:process.env,encoding:'utf8'});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exit(result.status??1)`)
  tool('scp', `event({tool:'scp'});if(scenario==='upload-error')process.exit(23);if(scenario==='upload-signal'){process.kill(process.ppid,'SIGTERM');process.exit(0)}const destination=args.at(-1);if(!destination.startsWith('newelcomputer@fixture.invalid:'+site+'/'))throw Error('Forbidden SCP target');fs.copyFileSync(args.at(-2),destination.slice(destination.indexOf(':')+1));if(scenario==='missing-marker')fs.unlinkSync(path.join(path.dirname(destination.slice(destination.indexOf(':')+1)),'manual-recovery'))`)
  tool('pm2', `event({tool:'pm2',args,current:current()});if(args[0]==='jlist'){const bin=process.env.FIXTURE_BIN;console.log(JSON.stringify([{name:'new-elcomputer',pm2_env:{exec_mode:'fork_mode',pm_exec_path:site+'/.output/server/index.mjs',pm_cwd:site,exec_interpreter:bin+'/node',NUXT_PUBLIC_SUPABASE_URL:'fixture',NUXT_PUBLIC_SUPABASE_KEY:'fixture',NUXT_SUPABASE_SERVICE_ROLE_KEY:'fixture'}}]));process.exit(0)}
if(args.join(' ')!=='restart new-elcomputer')throw Error('Forbidden PM2 operation');if(scenario==='restart-error'&&current()==='new'){console.error('fixture restart failure');process.exit(7)}`)
  tool('curl', `const url=args.at(-1);if(!['http://127.0.0.1:3001/','https://new.elcomputer.net/'].includes(url))throw Error('Forbidden curl target');event({tool:'curl',url,current:current()});
const publicCheck=url.startsWith('https:');if(current()==='new'){
if((scenario==='public-error'&&publicCheck)||(scenario==='remote-timeout'&&!publicCheck))process.exit(22);
const prefix=publicCheck?'local-':'remote-';if(scenario.startsWith(prefix)&&scenario.endsWith('-signal')){process.kill(process.ppid,scenario.slice(prefix.length,-7));}}
process.exit(0)`)
  tool('mv', `if(scenario==='activation-error'&&args.some(arg=>arg.endsWith('extracted/.output')))process.exit(9);const result=cp.spawnSync('/bin/mv',args,{stdio:'inherit'});process.exit(result.status??1)`)
  tool('tar', `if(scenario==='extract-error'&&args.includes('-xzf'))process.exit(44);const result=cp.spawnSync('/usr/bin/tar',args,{stdio:'inherit'});process.exit(result.status??1)`)
  return { root, project, site, bin, prior, env, remote: path.join(project, 'scripts/deploy-remote.sh') }
}

async function run(f, args = [], remote = false) {
  return await new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', [remote ? f.remote : path.join(f.project, 'scripts/deploy.sh'), ...args], { cwd: f.project, env: f.env })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`Fixture hung: ${output}`)) }, 20000)
    child.on('error', reject)
    child.on('close', (status, signal) => { clearTimeout(timeout); resolve({ status, signal, output }) })
  })
}
const events = f => existsSync(path.join(f.root, 'events')) ? readFileSync(path.join(f.root, 'events'), 'utf8').trim().split('\n').map(line => JSON.parse(line)) : []
const restarts = f => events(f).filter(event => event.tool === 'pm2' && event.args[0] === 'restart')
const entry = f => existsSync(path.join(f.site, '.output/server/index.mjs')) ? readFileSync(path.join(f.site, '.output/server/index.mjs'), 'utf8') : 'missing'
const stages = f => readdirSync(f.site).filter(name => name.startsWith('.deploy-staging-'))

function retained(f, result, activated = true) {
  assert.match(result.output, /separate human authorization/)
  const localEvidence = readdirSync(f.root).filter(name => name.startsWith('elcomputer-deploy-evidence.'))
  assert.equal(localEvidence.length, 1, result.output)
  const evidenceDir = path.join(f.root, localEvidence[0])
  assert.equal(statSync(evidenceDir).mode & 0o777, 0o700)
  const info = JSON.parse(readFileSync(path.join(evidenceDir, 'deployment.json'), 'utf8'))
  assert.equal(info.recoveryMode, 'manual')
  assert.equal(info.archiveSha256, sha(info.archive))
  assert.equal(statSync(info.archive).mode & 0o777, 0o600)
  assert.ok(existsSync(path.join(f.site, f.prior, 'preserved')))
  assert.equal(stages(f).length, 1)
  const stage = path.join(f.site, stages(f)[0])
  assert.ok(existsSync(path.join(stage, 'release.tar.gz')))
  assert.ok(existsSync(path.join(stage, 'manual-recovery')))
  const before = JSON.parse(readFileSync(path.join(stage, 'evidence-pre-activation.json'), 'utf8'))
  assert.equal(statSync(path.join(stage, 'evidence-pre-activation.json')).mode & 0o777, 0o600)
  assert.equal(statSync(stage).mode & 0o777, 0o700)
  assert.equal(before.archiveSha256, sha(info.archive))
  assert.equal(before.outputs[0].entries[0].sha256, createHash('sha256').update('old').digest('hex'))
  const backup = path.join(f.site, `.output-deploy-backup-${stages(f)[0].slice('.deploy-staging-'.length)}`)
  assert.equal(readFileSync(path.join(backup, 'server/index.mjs'), 'utf8'), 'old')
  assert.equal(entry(f), activated ? 'new' : 'missing')
  assert.ok(!events(f).some(e => e.tool === 'ssh' && / rollback | cleanup /.test(e.command)))
  assert.ok(restarts(f).every(e => e.current === 'new' && e.args.join(' ') === 'restart new-elcomputer'))
}

for (const scenario of ['restart-error', 'remote-timeout', 'public-error', 'activation-error',
  'remote-SIGTERM-signal', 'remote-SIGINT-signal', 'remote-SIGHUP-signal']) {
  test(`compatible default restores output after ${scenario}`, async t => {
    const f = fixture(t, scenario)
    const result = await run(f)
    assert.notEqual(result.status, 0, result.output)
    assert.equal(entry(f), 'old', result.output)
    assert.equal(restarts(f).at(-1).current, 'old', result.output)
    assert.equal(stages(f).length, 0)
    assert.equal(readdirSync(f.root).filter(n => n.startsWith('elcomputer-deploy.')).length, 0)
  })
  test(`manual mode preserves artifacts without restoration after ${scenario}`, async t => {
    const f = fixture(t, scenario)
    const result = await run(f, ['--manual-recovery'])
    assert.notEqual(result.status, 0, result.output)
    retained(f, result, scenario !== 'activation-error')
    assert.equal(restarts(f).length, scenario === 'activation-error' ? 0 : 1)
  })
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  test(`manual local ${signal} cleanup never restores output`, async t => {
    const f = fixture(t, `local-${signal}-signal`)
    const result = await run(f, ['--manual-recovery'])
    assert.notEqual(result.status, 0, result.output)
    retained(f, result)
    assert.equal(restarts(f).length, 1)
  })
}

test('manual successful release retains hashes, diagnostic log, archive and pre-SQL backup', async t => {
  const f = fixture(t)
  const result = await run(f, ['--manual-recovery'])
  assert.equal(result.status, 0, result.output)
  // Success also preserves evidence; the human-authorization warning is failure-only.
  retained(f, { ...result, output: result.output + 'separate human authorization' })
  assert.ok(existsSync(path.join(f.site, stages(f)[0], 'pm2-restart.log')))
  assert.equal(restarts(f).length, 1)
})

test('compatible success preserves normal cleanup and retention', async t => {
  const f = fixture(t)
  const result = await run(f)
  assert.equal(result.status, 0, result.output)
  assert.equal(entry(f), 'new')
  assert.equal(stages(f).length, 0)
  assert.equal(existsSync(path.join(f.site, f.prior)), false)
  assert.equal(restarts(f).length, 1)
})

test('later compatible release cannot prune manual-recovery backups', async t => {
  const f = fixture(t)
  mkdirSync(path.join(f.site, '.deploy-staging-20261011-121937-33243'))
  writeFileSync(path.join(f.site, '.deploy-staging-20261011-121937-33243/manual-recovery'), 'manual:v1\n')
  const result = await run(f)
  assert.equal(result.status, 0, result.output)
  assert.ok(existsSync(path.join(f.site, f.prior, 'preserved')))
})

test('manual upload error keeps staging and local archive without restarting anything', async t => {
  const f = fixture(t, 'upload-error')
  const result = await run(f, ['--manual-recovery'])
  assert.notEqual(result.status, 0)
  assert.equal(entry(f), 'old')
  assert.equal(stages(f).length, 1)
  assert.equal(restarts(f).length, 0)
  assert.ok(!events(f).some(e => e.tool === 'ssh' && / cleanup /.test(e.command)))
  const info = JSON.parse(readFileSync(path.join(f.root, readdirSync(f.root).find(n => n.startsWith('elcomputer-deploy-evidence.')), 'deployment.json'), 'utf8'))
  assert.equal(info.archiveSha256, sha(info.archive))
})

for (const scenario of ['missing-ack', 'missing-marker', 'build-error', 'hash-error', 'extract-error', 'upload-signal']) {
  test(`manual mode fails closed at ${scenario}`, async t => {
    const f = fixture(t, scenario)
    const result = await run(f, ['--manual-recovery'])
    assert.notEqual(result.status, 0, result.output)
    assert.equal(entry(f), 'old')
    assert.equal(restarts(f).length, 0)
    if (scenario === 'missing-ack') assert.equal(events(f).filter(e => ['npm', 'scp'].includes(e.tool)).length, 0)
    if (['hash-error', 'extract-error', 'upload-signal'].includes(scenario)) assert.equal(stages(f).length, 1)
  })
}

test('mode is CLI-only, arguments are strict and checks are non-mutating', async t => {
  const f = fixture(t, 'success', { RECOVERY_MODE: 'manual' })
  const normal = await run(f, ['--check'])
  assert.equal(normal.status, 0, normal.output)
  assert.ok(events(f).some(e => e.command === 'bash -s -- check'))
  const manual = await run(f, ['--manual-recovery', '--check'])
  assert.equal(manual.status, 0, manual.output)
  assert.match(manual.output, /ELCOMPUTER_RECOVERY_MODE=manual:v1/)
  const invalid = await run(f, ['--check', '--unknown'])
  assert.notEqual(invalid.status, 0)
  const invalidRemote = await run(f, ['check', 'unknown'], true)
  assert.notEqual(invalidRemote.status, 0)
  assert.equal(restarts(f).length, 0)
  assert.equal(stages(f).length, 0)
})

test('compatible upload error cleans staging without any restart', async t => {
  const f = fixture(t, 'upload-error')
  const result = await run(f)
  assert.notEqual(result.status, 0)
  assert.equal(entry(f), 'old')
  assert.equal(stages(f).length, 0)
  assert.equal(restarts(f).length, 0)
})

test('configuration cannot silently select manual recovery', async t => {
  const f = fixture(t)
  writeFileSync(path.join(f.project, '.deploy.env'), 'DEPLOY_HOST=fixture.invalid\nRECOVERY_MODE=manual\n')
  const result = await run(f, ['--check'])
  assert.notEqual(result.status, 0)
  assert.equal(events(f).length, 0)
})

test('manual local unexpected zero exit fails before unverified mode can report success', async t => {
  const f = fixture(t)
  writeFileSync(path.join(f.project, '.deploy.env'), 'DEPLOY_HOST=fixture.invalid\nexit 0\n')
  const result = await run(f, ['--check', '--manual-recovery'])
  assert.notEqual(result.status, 0, result.output)
  assert.match(result.output, /exited before verified completion/)
  assert.equal(events(f).length, 0)
  assert.equal(entry(f), 'old')
})

test('manual remote unexpected zero exit after activation fails without recovery or restart', async t => {
  const f = fixture(t)
  writeFileSync(f.remote, readFileSync(f.remote, 'utf8').replace('phase="restart"', 'exit 0\n    phase="restart"'))
  const result = await run(f, ['--manual-recovery'])
  assert.notEqual(result.status, 0, result.output)
  assert.match(result.output, /exited before verified completion/)
  retained(f, result)
  assert.equal(restarts(f).length, 0)
})

test('manual check refuses unrelated SSH user before any PM2 operation', async t => {
  const f = fixture(t, 'success', { FIXTURE_WRONG_USER: '1' })
  const result = await run(f, ['--check', '--manual-recovery'])
  assert.notEqual(result.status, 0)
  assert.equal(events(f).filter(e => e.tool === 'pm2').length, 0)
  assert.equal(entry(f), 'old')
})

test('manual check rejects an unexpected PM2 identity without restarting it', async t => {
  const f = fixture(t)
  const pm2 = path.join(f.bin, 'pm2')
  writeFileSync(pm2, readFileSync(pm2, 'utf8').replace("name:'new-elcomputer'", "name:'unrelated-fixture-app'"))
  const result = await run(f, ['--check', '--manual-recovery'])
  assert.notEqual(result.status, 0, result.output)
  assert.equal(restarts(f).length, 0)
  assert.equal(entry(f), 'old')
  assert.equal(stages(f).length, 0)
})

test('manual marker blocks cleanup, automatic deploy and rollback entry points', async t => {
  const f = fixture(t)
  const id = '20261011-121937-33243', stage = `.deploy-staging-${id}`
  const prepare = await run(f, ['prepare', stage, 'manual'], true)
  assert.equal(prepare.status, 0, prepare.output)
  for (const args of [['cleanup', stage], ['deploy', stage, id, '1', '1', '1', 'automatic'], ['rollback', f.prior, id, '1', '1']]) {
    const result = await run(f, args, true)
    assert.notEqual(result.status, 0, result.output)
  }
  assert.equal(restarts(f).length, 0)
  assert.ok(existsSync(path.join(f.site, stage, 'manual-recovery')))
  assert.equal(entry(f), 'old')
})
