import { publicAiHandler, serveAiMarkdown } from '../../utils/publicAi.js'

export default defineEventHandler(publicAiHandler(serveAiMarkdown))
