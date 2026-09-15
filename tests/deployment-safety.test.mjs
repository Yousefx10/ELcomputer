import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const localScript = readProjectFile('scripts/deploy.sh')
const remoteScript = readProjectFile('scripts/deploy-remote.sh')
const deploymentExample = readProjectFile('.deploy.env.example')
const gitignore = readProjectFile('.gitignore')
const packageJson = JSON.parse(readProjectFile('package.json'))

const remoteCommandBody = (name) => {
  const match = remoteScript.match(new RegExp(`\\n  ${name}\\)\\n([\\s\\S]*?)\\n    ;;`))
  assert.ok(match, `remote command ${name} should exist`)
  return match[1]
}

test('deployment is locked to the new.elcomputer.net site', () => {
  assert.match(localScript, /readonly DEPLOY_USER="newelcomputer"/)
  assert.match(localScript, /readonly DEPLOY_PATH="\/home\/newelcomputer\/htdocs\/new\.elcomputer\.net"/)
  assert.match(localScript, /readonly PM2_APP="new-elcomputer"/)
  assert.match(localScript, /readonly REMOTE_HEALTHCHECK_URL="http:\/\/127\.0\.0\.1:3001\/"/)
  assert.match(localScript, /readonly PUBLIC_HEALTHCHECK_URL="https:\/\/new\.elcomputer\.net\/"/)

  assert.match(remoteScript, /readonly REQUIRED_USER="newelcomputer"/)
  assert.match(remoteScript, /readonly SITE_PATH="\/home\/newelcomputer\/htdocs\/new\.elcomputer\.net"/)
  assert.match(remoteScript, /readonly PM2_APP="new-elcomputer"/)
  assert.match(remoteScript, /readonly PM2_MODE="fork_mode"/)
  assert.match(remoteScript, /readonly PM2_ENTRY="\$SITE_PATH\/\.output\/server\/index\.mjs"/)
  assert.match(remoteScript, /readonly HEALTHCHECK_URL="http:\/\/127\.0\.0\.1:3001\/"/)
  assert.match(remoteScript, /readonly NODE_BIN_DIR="\/home\/newelcomputer\/\.nvm\/versions\/node\/v22\.23\.1\/bin"/)
  assert.match(remoteScript, /readonly NODE_VERSION="v22\.23\.1"/)
})

test('deployment configuration cannot override protected targets', () => {
  const protectedAssignment = /^\s*(DEPLOY_USER|DEPLOY_PATH|PM2_APP|REMOTE_HEALTHCHECK_URL|PUBLIC_HEALTHCHECK_URL)\s*=/m

  assert.doesNotMatch(deploymentExample, protectedAssignment)
  assert.match(localScript, /\.deploy\.env cannot override the locked deployment target/)
  assert.match(gitignore, /^\.deploy\.env$/m)
})

test('every remote action verifies the exact user and resolved directory', () => {
  assert.match(remoteScript, /actual_user="\$\(whoami\)"/)
  assert.match(remoteScript, /actual_path="\$\(pwd -P\)"/)
  assert.match(remoteScript, /\[\[ "\$actual_user" == "\$REQUIRED_USER" \]\]/)
  assert.match(remoteScript, /\[\[ "\$actual_path" == "\$SITE_PATH" \]\]/)

  for (const command of ['check', 'prepare', 'cleanup', 'deploy', 'rollback']) {
    assert.match(remoteCommandBody(command), /assert_target_context/)
  }

  assert.match(remoteCommandBody('check'), /validate_pm2_app/)
  assert.match(remoteCommandBody('deploy'), /validate_pm2_app/)
  assert.match(remoteCommandBody('rollback'), /validate_pm2_app/)
})

test('deployment scripts contain no shared-service or global PM2 operations', () => {
  const scripts = `${localScript}\n${remoteScript}`

  for (const forbidden of [
    /\/home\/elcomputer(?:\/|\b)/,
    /\berp\.elcomputer\.net\b/,
    /\bn8n\.elcomputer\.net\b/,
    /\bos\.elcomputer\.net\b/,
    /\bpm2\s+(?:restart|delete|stop)\s+all\b/i,
    /\bsudo\b/,
    /\bsystemctl\b/,
    /\bnginx\b/i,
    /\bcloudpanel\b/i,
    /\b(?:ufw|firewall-cmd)\b/i
  ]) {
    assert.doesNotMatch(scripts, forbidden)
  }

  for (const line of remoteScript.split('\n').filter((line) => /pm2 restart/.test(line))) {
    assert.match(line, /pm2 restart "\$PM2_APP"/)
  }
})

test('package scripts expose deploy and preflight commands', () => {
  assert.equal(packageJson.scripts.deploy, 'bash scripts/deploy.sh')
  assert.equal(packageJson.scripts['deploy:check'], 'bash scripts/deploy.sh --check')
})

test('release archive excludes macOS metadata and contains only .output', () => {
  assert.match(localScript, /COPYFILE_DISABLE=1 tar --no-xattrs -czf/)
  assert.match(localScript, /entry != "\.output" && entry !~ \/\^\\\.output\\\//)
  assert.match(remoteScript, /Archive contains a path outside \.output/)
})

test('preflight requires the server-only Nuxt service-role runtime variable', () => {
  const runtimeValidation = remoteScript.match(/validate_pm2_runtime_environment\(\) \{([\s\S]*?)\n\}/)?.[1] || ''

  assert.match(runtimeValidation, /\["NUXT_SUPABASE_SERVICE_ROLE_KEY"\]/)
  assert.doesNotMatch(runtimeValidation, /\["SUPABASE_SERVICE_ROLE_KEY"/)
})
