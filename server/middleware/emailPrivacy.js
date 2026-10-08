import { defineEventHandler, getRequestURL, setHeader } from 'h3'
export default defineEventHandler(event=>{
 if(!/^\/(?:ar\/)?email\/unsubscribe\/?$/.test(getRequestURL(event).pathname))return
 setHeader(event,'Cache-Control','private, no-store')
 setHeader(event,'Referrer-Policy','no-referrer')
 setHeader(event,'X-Robots-Tag','noindex, nofollow')
})
