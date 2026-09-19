import { downloadSupportAttachment } from '../../../utils/supportTickets'

export default defineEventHandler(event => downloadSupportAttachment(event))
