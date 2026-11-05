import {readEmailBody} from '../../utils/email/core'
import {metaHeaders,recordMetaEvent} from '../../utils/metaTracking'
export default defineEventHandler(async event=>{metaHeaders(event);return recordMetaEvent(event,await readEmailBody(event,4096))})
