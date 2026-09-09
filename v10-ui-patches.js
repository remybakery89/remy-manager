/* F&B Manager V10 — UI integration layer
   Keeps targeted UI compatibility fixes separate from the online data/auth engine.
   Pricing/settings UI now lives in v10/ui/pricing.js; this file keeps the remaining
   temporary recipe/ingredient compatibility patches until those domains are mapped.
*/
(function(){
  'use strict';

  /*
    index.html still contains a later V5 renderer which can overwrite the
    Round-2 product screen. Keep this compatibility rule in the UI layer.
  */
  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(page){
      if(page==='products'){
        const v=document.getElementById('view');
        if(v)v.innerHTML=typeof productsRound2==='function'?productsRound2():'';
        document.getElementById('topTitle').textContent='Sản phẩm';
        document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='products'));
        return;
      }
      return baseRender(page);
    };
  }

  function captureRecipeDraft(){
    if(typeof editingRecipeId==='undefined'||(!editingRecipeId&&!document.getElementById('rName')))return null;
    const rows=[...document.querySelectorAll('#recipeLines .recipe-line')];
    return {
      id:editingRecipeId||'',
      name:document.getElementById('rName')?.value||'',
      yield:document.getElementById('rYield')?.value||'1',
      wastePct:document.getElementById('rWaste')?.value||'0',
      processTemp:document.getElementById('rTemp')?.value||'',
      processTime:document.getElementById('rTime')?.value||'',
      notes:document.getElementById('rNotes')?.value||'',
      lines:rows.map(row=>{
        const kind=row.querySelector('.rl-kind')?.value||'ingredient';
        const ref=row.querySelector('.rl-ref')?.value||'';
        const qty=row.querySelector('.rl-qty')?.value||'0';
        const waste=row.querySelector('.rl-waste')?.value||'0';
        return kind==='recipe'
          ? {kind,recipeId:ref,qty:+qty||0}
          : {kind:'ingredient',ingredientId:ref,qty:+qty||0,wastePct:+waste||0};
      })
    };
  }

  function restoreRecipeDraft(d){
    if(!d||typeof window.recipeModal!=='function')return;
    window.recipeModal(d.id||'');
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val??''};
    set('rName',d.name);
    set('rYield',d.yield);
    set('rWaste',d.wastePct);
    set('rTemp',d.processTemp);
    set('rTime',d.processTime);
    set('rNotes',d.notes);
    const holder=document.getElementById('recipeLines');
    if(holder)holder.innerHTML=(d.lines||[]).map((l,i)=>typeof recipeLineV31==='function'?recipeLineV31(l,i):'').join('');
  }

  const originalQuick=window.quickIngredientModal;
  if(typeof originalQuick==='function'){
    window.quickIngredientModal=function(){
      window.__v10RecipeDraft=captureRecipeDraft();
      return originalQuick();
    };
  }

  window.saveQuickIngredient=function(){
    const before=window.__v10RecipeDraft;
    const x={
      id:id(),
      name:f('qiName').trim(),
      group:f('qiGroup'),
      unit:f('qiUnit'),
      pack:+f('qiPack'),
      packUnit:f('qiPackUnit'),
      price:+f('qiPrice')
    };
    const q=convertQty(x.pack,x.packUnit,x.unit);
    if(!x.name||!x.pack||!q||x.price<0){toast('Vui lòng kiểm tra thông tin nguyên liệu');return}
    db.ingredients.push(x);
    save();
    toast('Đã tạo nguyên liệu');
    closeModal();
    if(before){
      restoreRecipeDraft(before);
      const rows=[...document.querySelectorAll('#recipeLines .recipe-line')];
      const holder=document.getElementById('recipeLines');
      if(holder&&typeof recipeLineV31==='function'){
        holder.insertAdjacentHTML('beforeend',recipeLineV31({kind:'ingredient',ingredientId:x.id,qty:0,wastePct:0},rows.length));
      }
    }
    window.__v10RecipeDraft=null;
  };

  window.deleteIngredient=function(iid){
    const ing=(db.ingredients||[]).find(i=>i.id===iid);
    if(!ing){toast('Không tìm thấy nguyên liệu');return}
    const recipeRefs=(db.recipes||[]).filter(r=>(r.lines||[]).some(l=>l.kind==='ingredient'&&l.ingredientId===iid));
    const batchRefs=(db.batches||[]).filter(b=>b.ingredientId===iid);
    const inventoryRefs=(db.inventoryHistory||[]).filter(h=>h.ingredientId===iid);
    const receiptRefs=(db.purchaseReceipts||[]).filter(r=>r.ingredientId===iid);
    if(recipeRefs.length||batchRefs.length||inventoryRefs.length||receiptRefs.length){
      const parts=[];
      if(recipeRefs.length)parts.push(recipeRefs.length+' công thức');
      if(batchRefs.length)parts.push(batchRefs.length+' lô kho');
      if(inventoryRefs.length)parts.push(inventoryRefs.length+' giao dịch kho');
      if(receiptRefs.length)parts.push(receiptRefs.length+' phiếu nhập');
      toast('Không thể xóa: nguyên liệu đang được dùng trong '+parts.join(', '));
      return;
    }
    if(!confirm('Xóa nguyên liệu “'+ing.name+'”?'))return;
    db.ingredients=(db.ingredients||[]).filter(i=>i.id!==iid);
    save();
    if(typeof render==='function')render('ingredients');
    toast('Đã xóa nguyên liệu');
  };

  if(typeof r3IngredientRowActions==='function'){
    const oldActions=r3IngredientRowActions;
    window.r3IngredientRowActions=function(i){
      return oldActions(i)+` <button class="btn small danger" onclick="deleteIngredient('${i.id}')">Xóa</button>`;
    };
  }
})();