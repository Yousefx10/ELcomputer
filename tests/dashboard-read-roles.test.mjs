import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

test('dashboard renderer roles, terminal FastCGI exclusion and complete shadow checks', { timeout: 120000 }, async () => {
  const { stdout, stderr } = await promisify(execFile)('/usr/bin/python3',
    ['-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'dashboard_read_roles_test.py'],
    { env: process.env, maxBuffer: 1000000 })
  assert.match(stdout + stderr, /OK/)
})
