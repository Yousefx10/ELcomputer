import { handleChatAttachmentUpload } from '../../../../utils/liveChatAttachments'

export default defineEventHandler(event => handleChatAttachmentUpload(event, true))
