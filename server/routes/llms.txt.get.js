import { publicAiHandler, serveLlms } from '../utils/publicAi.js'

export default defineEventHandler(publicAiHandler(serveLlms))
