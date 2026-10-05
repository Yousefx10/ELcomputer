// Safe variables and event identities shared by Dashboard configuration and worker.
export const orderSmsEvents = ['order_confirmed', 'payment_confirmed', 'processing', 'cancelled']
export const orderSmsVariables = ['customer_name', 'order_number', 'order_total', 'currency', 'order_status', 'payment_method']
export const ORDER_SMS_MAX_SEGMENTS = 10
