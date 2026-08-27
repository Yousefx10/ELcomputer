import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'
import { createError } from 'h3'

const SECRET_VERSION = 'v1'

const getEncryptionKey = () => {
  const rawKey = String(useRuntimeConfig().shippingCredentialsEncryptionKey || '').trim()

  if (rawKey.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Shipping secret encryption is not configured.'
    })
  }

  return createHash('sha256').update(rawKey).digest()
}

export const isShippingEncryptionReady = () => {
  return String(useRuntimeConfig().shippingCredentialsEncryptionKey || '').trim().length >= 32
}

export const encryptShippingSecret = (value) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return null
  }

  const initializationVector = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), initializationVector)
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

export const decryptShippingSecret = (value) => {
  const [version, encodedVector, encodedTag, encodedValue] = String(value || '').split('.')

  if (
    version !== SECRET_VERSION
    || !encodedVector
    || !encodedTag
    || !encodedValue
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The saved shipping secret is invalid.'
    })
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
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
      statusMessage: 'The saved shipping secret could not be opened.'
    })
  }
}

export const shippingSecretsMatch = (left, right) => {
  const leftDigest = createHash('sha256').update(String(left || '')).digest()
  const rightDigest = createHash('sha256').update(String(right || '')).digest()

  return timingSafeEqual(leftDigest, rightDigest)
}
