import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'

const previousRuntimeConfig = globalThis.useRuntimeConfig

before(() => {
  globalThis.useRuntimeConfig = () => ({
    credentialsEncryptionKey: 'test-only-credential-encryption-key-1234567890'
  })
})

after(() => {
  globalThis.useRuntimeConfig = previousRuntimeConfig
})

test('credential secrets are encrypted and can be opened', async () => {
  const {
    decryptCredentialSecret,
    encryptCredentialSecret,
    isCredentialEncryptionReady
  } = await import('../server/utils/credentialSecrets.js')
  const plainText = 'private-api-key'
  const encrypted = encryptCredentialSecret(plainText, 'Daftra')

  assert.equal(isCredentialEncryptionReady(), true)
  assert.notEqual(encrypted, plainText)
  assert.match(encrypted, /^v1\./)
  assert.equal(decryptCredentialSecret(encrypted, 'Daftra'), plainText)
})

test('credential secrets reject modified ciphertext', async () => {
  const {
    decryptCredentialSecret,
    encryptCredentialSecret
  } = await import('../server/utils/credentialSecrets.js')
  const encrypted = encryptCredentialSecret('private-api-key', 'Daftra')
  const lastCharacter = encrypted.at(-1)
  const modified = `${encrypted.slice(0, -1)}${lastCharacter === 'a' ? 'b' : 'a'}`

  assert.throws(
    () => decryptCredentialSecret(modified, 'Daftra'),
    /could not be opened/
  )
})

test('Daftra account URLs accept official hosts only', async () => {
  const { normalizeDaftraAccountUrl } = await import('../server/utils/daftra.js')

  assert.equal(
    normalizeDaftraAccountUrl('store.daftra.com/path'),
    'https://store.daftra.com'
  )
  assert.throws(
    () => normalizeDaftraAccountUrl('store.daftra.com.example.org'),
    /official HTTPS domain/
  )
})
