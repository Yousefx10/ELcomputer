import test from 'node:test'
import assert from 'node:assert/strict'
import { validOptionValues, configuredVariantDimensions, resolveVariantCombination, optionChoiceAvailable, variantSalePrice, productOptionPriceRange } from '../app/utils/productOptions.js'
const variants = [
 { id:'black-red', is_active:true, stock_quantity:3, option_values:{color:'Black',switch:'Red'}, sale_price:'150.25' },
 { id:'black-blue', is_active:true, stock_quantity:0, option_values:{color:'Black',switch:'Blue'}, sale_price:null },
 { id:'white-red', is_active:true, stock_quantity:5, option_values:{color:'White',switch:'Red'}, sale_price:'175.00' }
]
test('authored option dimensions resolve one exact SKU without inventing combinations', () => {
 const dimensions = configuredVariantDimensions(variants)
 assert.deepEqual(dimensions.map(d=>d.key),['color','switch'])
 assert.equal(resolveVariantCombination(variants,dimensions,{color:'Black'}),null)
 assert.equal(resolveVariantCombination(variants,dimensions,{color:'Black',switch:'Red'}).id,'black-red')
 assert.equal(resolveVariantCombination(variants,dimensions,{color:'White',switch:'Blue'}),null)
 assert.equal(optionChoiceAvailable(variants,{color:'White'},'switch','Blue',{}),false)
 assert.equal(optionChoiceAvailable(variants,{color:'Black'},'switch','Blue',{}),false)
 assert.equal(optionChoiceAvailable(variants,{color:'Black'},'switch','Blue',{allowBackorder:true}),true)
 assert.equal(optionChoiceAvailable(variants,{color:'Black'},'switch','Blue',{stockIndependent:true}),true)
})
test('plain Default and legacy options do not acquire inferred dimensions', () => {
 assert.deepEqual(configuredVariantDimensions([{id:'default',name:'Default'}]),[])
 assert.deepEqual(configuredVariantDimensions([{id:'a',name:'Red switches'},{id:'b',name:'Blue switches'}]),[])
 assert.deepEqual(configuredVariantDimensions([variants[0],{...variants[2],option_values:{model:'Other'}}]),[])
 assert.equal(resolveVariantCombination([...variants,variants[0]],configuredVariantDimensions(variants),{color:'Black',switch:'Red'}),null)
})
test('option values are bounded, plain and cannot become prototype keys', () => {
 assert.equal(validOptionValues({model:'Actual model',capacity:'16 GB'}),true)
 for(const value of [null,[],{model:''},{model:12},{model:' bad'},{model:'x\n'},JSON.parse('{"__proto__":"bad"}'),Object.fromEntries(Array.from({length:9},(_,i)=>['field'+i,'value']))])assert.equal(validOptionValues(value),false)
})
test('a variant override changes display price; inherited prices retain parent repricing', () => {
 assert.equal(variantSalePrice({price:100},variants[0]),150.25)
 assert.equal(variantSalePrice({price:100},variants[1]),100)
 assert.equal(variantSalePrice({price:200},variants[1]),200)
 assert.equal(variantSalePrice({price:100},null),100)
  assert.deepEqual(productOptionPriceRange({price:100},variants),{minimum:100,maximum:175})
  assert.deepEqual(productOptionPriceRange({price:100},variants.filter(v=>v.sale_price!==null)),{minimum:150.25,maximum:175})
})
