import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'
import { createError } from 'h3'

const SECRET_VERSION = 'v1'

const getEncryptionKey = (label) => {
  const rawKey = String(useRuntimeConfig().credentialsEncryptionKey || '').trim()

  if (rawKey.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: `${label} secret encryption is not configured.`
    })
  }

  return createHash('sha256').update(rawKey).digest()
}

export const isCredentialEncryptionReady = () => {
  return String(useRuntimeConfig().credentialsEncryptionKey || '').trim().length >= 32
}

export const encryptCredentialSecret = (value, label = 'Credential') => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return null
  }

  const initializationVector = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(label), initializationVector)
  const encryptedValue = Buffer.concat([
    cipher.update(normalizedValue, 'utf8'),
    cipher.final()
  ])
  const authenticationTag = cipher.getAuthTag()

  return [
    SECRET_VERSION,
    initializationVector.toString('base64url'),
    authenticationTag.toString('base64url'),
    encryptedValue.toString('base64url')
  ].join('.')
}

export const decryptCredentialSecret = (value, label = 'Credential') => {
  const [version, encodedVector, encodedTag, encodedValue] = String(value || '').split('.')

  if (
    version !== SECRET_VERSION
    || !encodedVector
    || !encodedTag
    || !encodedValue
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: `The saved ${label.toLowerCase()} secret is invalid.`
    })
  }

  const encryptionKey = getEncryptionKey(label)

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(encodedVector, 'base64url')
    )
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))

    return Buffer.concat([
      decipher.update(Buffer.from(encodedValue, 'base64url')),
      decipher.final()
    ]).toString('utf8')
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: `The saved ${label.toLowerCase()} secret could not be opened.`
    })
  }
}

export const credentialSecretsMatch = (left, right) => {
  const leftDigest = createHash('sha256').update(String(left || '')).digest()
  const rightDigest = createHash('sha256').update(String(right || '')).digest()

  return timingSafeEqual(leftDigest, rightDigest)
}
