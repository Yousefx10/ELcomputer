import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPdcShipment} from '../server/utils/pdcShipping.js'

const settings={origin_city_id:1,origin_address:'Synthetic origin',origin_phone:'01000000000',origin_contact_name:'Synthetic sender',product_id:64,default_weight_kg:1,shipment_type_id:1,allow_open_shipment:false}
test('PDC cash uses the saved final balance including fees and applicable discounts in decimal major units',async()=>{
 for(const [merchandise,discount,delivery,fee,total] of [['100.00','0.00','50.00','50.00','200.00'],['100.35','10.10','50.00','50.00','190.25'],['100.01','0.00','50.00','50.00','200.01']]){
  const minor=value=>BigInt(value.replace('.','')),balance=minor(merchandise)-minor(discount)+minor(delivery)+minor(fee)
  assert.equal(balance,minor(total))
  const order={first_name:'Synthetic',last_name:'Customer',street_address:'Owned street',city:'Owned city',governorate:'Owned area',phone:'01012345678',subtotal_amount:merchandise,discount_amount:discount,total_amount:total,amount_paid:'0.00'}
  const shipment=await buildPdcShipment({settings,order,items:[{product_title:'Owned synthetic item',quantity:1}],orderReference:'SYNTHETIC-COD-AMOUNT',destinationCityId:2,codAmountMinor:Number(balance)})
  assert.equal(shipment.cod,Number(total));assert.equal(shipment.declaredValue,Number(minor(merchandise)-minor(discount))/100)
  assert.equal('pickupID' in shipment,false);assert.equal('refuseCOD' in shipment,false)
 }
})
test('verified prepaid card sends zero COD; invalid minor amounts cannot produce a shipment',async()=>{
 const input={settings,order:{first_name:'Synthetic',street_address:'Owned street',city:'Owned city',governorate:'Owned area',phone:'01012345678',subtotal_amount:'100.35',discount_amount:'0.00',total_amount:'150.35',amount_paid:'150.35'},items:[{product_title:'Owned synthetic item',quantity:1}],orderReference:'SYNTHETIC-CARD',destinationCityId:2}
 assert.equal((await buildPdcShipment({...input,codAmountMinor:0})).cod,0)
 for(const codAmountMinor of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])await assert.rejects(buildPdcShipment({...input,codAmountMinor}))
})
