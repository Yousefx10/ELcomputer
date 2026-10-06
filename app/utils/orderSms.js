// Safe variables and event identities shared by Dashboard configuration and worker.
export const orderSmsEvents = ['order_confirmed', 'payment_confirmed', 'processing', 'cancelled']
export const orderSmsVariables = ['customer_name', 'order_number', 'order_total', 'currency', 'order_status', 'payment_method']
export const pdcSmsEvents = ['pdc_out_for_delivery', 'pdc_delivery_exception', 'pdc_delivered']
export const pdcSmsVariables = ['customer_name', 'order_number', 'awb', 'courier_name', 'delivery_reason']
export const automatedSmsEvents = [...orderSmsEvents, ...pdcSmsEvents]
export const smsEventVariables = event => pdcSmsEvents.includes(event) ? pdcSmsVariables : orderSmsVariables
export const ORDER_SMS_MAX_SEGMENTS = 10
