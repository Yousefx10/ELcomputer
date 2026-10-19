import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, chmod, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const tool = new URL('../docs/operations/backup-envelope.mjs', import.meta.url).pathname
test('backup envelopes authenticate before decrypting and reject unsafe custody', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'backup-envelope-'))
  await chmod(dir, 0o700)
  const key = join(dir, 'key'), archive = join(dir, 'backup.enc')
  const run = (mode, file = archive, keyFile = key, input) => spawnSync(process.execPath, [tool, mode, keyFile, file], { input, maxBuffer: 4 * 1024 * 1024 })
  try {
    await writeFile(key, randomBytes(32), { mode: 0o600 })
    const input = randomBytes(1024 * 1024 + 13)
    const encrypted = run('encrypt', archive, key, input)
    assert.equal(encrypted.status, 0)
    const receipt = JSON.parse(encrypted.stdout)
    assert.equal(receipt.plaintextBytes, input.length)
    assert.equal(JSON.parse(run('verify').stdout).plaintextSha256, receipt.plaintextSha256)
    assert.deepEqual(run('decrypt').stdout, input)
    assert.notEqual(run('encrypt', archive, key, input).status, 0)
    const original = await readFile(archive)
    for (const position of [0, 9, 21, original.length - 1]) {
      const changed = Buffer.from(original); changed[position] ^= 1
      const file = join(dir, 'tampered-' + position)
      await writeFile(file, changed, { mode: 0o600 })
      const result = run('decrypt', file)
      assert.notEqual(result.status, 0)
      assert.equal(result.stdout.length, 0)
    }
    const truncated = join(dir, 'truncated')
    await writeFile(truncated, original.subarray(0, -1), { mode: 0o600 })
    assert.equal(run('decrypt', truncated).stdout.length, 0)
    assert.notEqual(run('decrypt', truncated).status, 0)
    const other = join(dir, 'other-key')
    await writeFile(other, randomBytes(32), { mode: 0o600 })
    assert.equal(run('decrypt', archive, other).stdout.length, 0)
    assert.notEqual(run('verify', archive, other).status, 0)
    await chmod(key, 0o644)
    assert.notEqual(run('verify').status, 0)
    await chmod(key, 0o600)
    const linked = join(dir, 'linked-key'); await symlink(key, linked)
    assert.notEqual(run('verify', archive, linked).status, 0)
    const empty = join(dir, 'empty.enc')
    assert.equal(run('encrypt', empty, key, Buffer.alloc(0)).status, 0)
    assert.equal(run('verify', empty).status, 0)
    assert.equal(run('decrypt', empty).stdout.length, 0)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
