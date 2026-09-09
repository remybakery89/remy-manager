/* F&B Manager V10 — ingredient UI integration
   Phase 7: quick ingredient creation and ingredient deletion compatibility rules live here.
*/
(function(){
  'use strict';

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
      const recipeUi=window.FNB_RECIPE_UI||{};
      if(typeof recipeUi.restoreRecipeDraft==='function')recipeUi.restoreRecipeDraft(before);
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
