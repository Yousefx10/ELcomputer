import {customerCart} from '../../utils/customerCart'
export default defineEventHandler(event => customerCart(event, true))
