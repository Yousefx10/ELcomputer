import { downloadChatAttachment } from '../../../utils/liveChatAttachments'

export default defineEventHandler(event => downloadChatAttachment(event, true))
