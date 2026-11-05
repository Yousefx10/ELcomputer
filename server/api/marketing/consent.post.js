import {createError} from 'h3'
import {readEmailBody} from '../../utils/email/core'
import {metaHeaders,saveMetaConsent} from '../../utils/metaTracking'
export default defineEventHandler(async event=>{metaHeaders(event);const body=await readEmailBody(event,1024);if(typeof body.granted!=='boolean'||Object.keys(body).some(k=>k!=='granted'))throw createError({statusCode:400,statusMessage:'Choose a privacy preference.'});return saveMetaConsent(event,body.granted)})
