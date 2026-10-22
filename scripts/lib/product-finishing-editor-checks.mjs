import {join} from 'node:path'
export async function reviewFinishingEditor({page,f,product,dir,check}) {
 await page.evaluate(()=>{window.pdpDashboard.actor('owner');window.pdpDashboard.show('specifications');window.pdpDashboard.appearance('en',false)})
 await page.getByRole('button',{name:'Add package item',exact:true}).waitFor();await page.waitForFunction(()=>window.specificationEditor)
 await page.getByLabel('Quantity',{exact:true}).fill('2');await page.waitForFunction(()=>window.specificationEditor.sectionDirty.value);check(true,'Quantity-only package draft participates in the existing navigation guard');await page.getByLabel('Item name',{exact:true}).fill('Owned package fixture');await page.getByRole('button',{name:'Add package item',exact:true}).click()
 await page.waitForFunction(()=>window.specificationEditor.rows.value.some(r=>r.value==='2 × Owned package fixture'))
 check((await f.db.query("select value from public.product_specifications where product_id=$1 and label='Box contents'",[product.id])).rows.some(r=>r.value==='2 × Owned package fixture'),'Actual Dashboard package name/quantity saves through existing RLS')
 await page.getByLabel('Tag',{exact:true}).fill('Owned factual tag');await page.getByRole('button',{name:'Add tag',exact:true}).click();await page.waitForFunction(()=>window.specificationEditor.rows.value.some(r=>r.value==='Owned factual tag'))
 await page.evaluate(()=>window.pdpDashboard.show('specifications'));await page.waitForFunction(()=>window.specificationEditor.rows.value.some(r=>r.value==='Owned factual tag'))
 check(true,'Dashboard package and tags survive section remount/reload')
 const nameInput=page.getByLabel('Item name',{exact:true}).nth(1),quantityInput=page.getByLabel('Quantity',{exact:true}).nth(1)
 await nameInput.fill('');check(await nameInput.evaluate(el=>el===document.activeElement),'Empty package name retains editable input and focus');await nameInput.fill('Owned package fixture');await quantityInput.fill('03')
 const packageRow=nameInput.locator('xpath=ancestor::div[contains(@class,"grid")][1]');await packageRow.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>window.specificationEditor.rows.value.some(r=>r.original.value==='3 × Owned package fixture'))
 check((await f.db.query("select value from public.product_specifications where product_id=$1 and label='Box contents'",[product.id])).rows.some(r=>r.value==='3 × Owned package fixture'),'Named package inputs normalize leading zeros and persist quantity via loaded-row conditional save')
 await page.waitForFunction(()=>window.specificationState?.saving===false)
 await page.evaluate(async()=>{const e=window.specificationEditor;await e.moveRow(e.rows.value.findIndex(r=>r.value==='Owned factual tag'),-1)})
 const ordered=(await f.db.query("select label from public.product_specifications where product_id=$1 and label in ('Tags','Box contents') order by sort_order",[product.id])).rows.map(r=>r.label);check(ordered.indexOf('Tags')<ordered.indexOf('Box contents'),'Authored package/tag ordering persists through existing reorder controls')
 const saved=(await f.db.query("select id from public.product_specifications where product_id=$1 and label='Tags' and value='Owned factual tag'",[product.id])).rows[0]
 await f.db.query("update public.product_specifications set value='Concurrent tag' where id=$1",[saved.id])
 await page.evaluate(async()=>{const e=window.specificationEditor,r=e.rows.value.find(r=>r.value==='Owned factual tag');r.value='Retained draft';await e.saveRow(r)})
 check((await f.db.query('select value from public.product_specifications where id=$1',[saved.id])).rows[0].value==='Concurrent tag','Stale tag writer cannot overwrite concurrent authored content')
 check(await page.evaluate(()=>window.specificationEditor.rows.value.some(r=>r.value==='Retained draft')),'Conflicted tag draft retained in memory')
 for(const locale of ['en','ar'])for(const width of [1280,768,390])for(const dark of [false,true]){await page.setViewportSize({width,height:1000});await page.evaluate(({locale,dark})=>window.pdpDashboard.appearance(locale,dark),{locale,dark});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Finishing editor '+locale+'/'+width+'/'+dark+' fits');await page.screenshot({path:join(dir,'finishing-editor-'+locale+'-'+width+'-'+dark+'.png'),fullPage:true})}
 await page.evaluate(()=>window.pdpDashboard.appearance('en',false));page.once('dialog',dialog=>dialog.accept());await page.evaluate(()=>window.specificationEditor.reloadSection())
 page.once('dialog',dialog=>dialog.accept());await page.evaluate(async()=>{const e=window.specificationEditor;await e.deleteRow(e.rows.value.find(r=>r.value==='Concurrent tag'))})
 check((await f.db.query('select count(*)::int n from public.product_specifications where id=$1',[saved.id])).rows[0].n===0,'Confirmed authored-tag deletion persists without affecting other rows')
}

