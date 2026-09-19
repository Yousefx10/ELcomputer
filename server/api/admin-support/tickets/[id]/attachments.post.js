import { handleSupportUpload } from '../../../../utils/supportTickets'

export default defineEventHandler(event => handleSupportUpload(event, 'staff'))
