import { createError } from 'h3'

// Reference guards also protect the existing direct category/gallery writers.
export const throwUnavailableMediaReference = error => {
  if (error?.message === 'This image is unavailable. Choose another image.') {
    throw createError({ statusCode: 400, statusMessage: error.message, data: { code: 'MEDIA_UNAVAILABLE' } })
  }
}
