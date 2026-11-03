import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {parse} from '@babel/parser'
import {allowsCartBackorder} from '../app/utils/backorder.js'
import {validOptionValues} from '../app/utils/productOptions.js'
const source=await readFile('app/composables/useCart.js','utf8'),wanted=['UUID_PATTERN','normalizePositiveInteger','normalizeOptionalIdentifier','buildCartKey','getMaximumCartQuantity','normalizeCartItem']
const statements=parse(source,{sourceType:'module'}).program.body.filter(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>wanted.includes(d.id.name)))
const context={allowsCartBackorder,validOptionValues};vm.createContext(context);vm.runInContext(statements.map(n=>source.slice(n.start,n.end)).join('\n')+'\nglobalThis.normalize=normalizeCartItem',context)
test('normal serialized untracked items retain zero real stock and their allowed cart quantity',()=>{
 const item={id:'fixture-item',variant_id:'fixture-option',is_serialized:true,selling_mode:'normal',stock_quantity:0,allow_out_of_stock_purchases:true,quantity:1,price:25}
 const untracked=context.normalize(item,{inventory_tracking_required:false});assert.equal(untracked.allow_out_of_stock_purchases,true);assert.equal(untracked.stock_quantity,0);assert.equal(untracked.quantity,1)
 const restored=context.normalize(JSON.parse(JSON.stringify(untracked)),{inventory_tracking_required:false});assert.equal(restored.allow_out_of_stock_purchases,true);assert.equal(restored.stock_quantity,0)
 for(const settings of [{},{inventory_tracking_required:true}])assert.equal(context.normalize(item,settings).allow_out_of_stock_purchases,false)
 assert.equal(context.normalize({...item,allow_out_of_stock_purchases:false},{inventory_tracking_required:false}).allow_out_of_stock_purchases,true)
 assert.equal(context.normalize({...item,selling_mode:'coming_soon'},{inventory_tracking_required:false}).allow_out_of_stock_purchases,false)
 const preorder=context.normalize({...item,selling_mode:'preorder',preorder_customer_limit:2,preorder_remaining:1,quantity:3},{inventory_tracking_required:false});assert.equal(preorder.quantity,1)
 const stocked=context.normalize({...item,stock_quantity:2,quantity:3},{inventory_tracking_required:true});assert.equal(stocked.quantity,2)
})
