/* V10 patch loader: preserve the existing sync engine, then apply the three targeted UI fixes. */
(function(){
  const s=document.createElement('script');
  s.src='./v10-sync-base.js?v=1003';
  s.onload=function(){
    function v10RenderPricingSettings(){
      try{
        const html=typeof settingsRound2==='function'?settingsRound2():'';
        if(!html){toast('Không tải được màn Giá bán');return;}
        const v=document.getElementById('view');
        if(v)v.innerHTML=html;
        document.getElementById('topTitle').textContent='Cài đặt';
        document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='settings'));
      }catch(e){console.error('pricing settings',e);toast('Không mở được phần Giá bán')}
    }
    document.addEventListener('click',function(e){
      const b=e.target.closest?.('button[data-page="settings"]');
      if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();v10RenderPricingSettings();
    },true);

    /*
      Quan trọng: trong index.html có một lớp render V5 được khai báo SAU lớp Vòng 2.
      Lớp V5 này đã ghi đè màn Sản phẩm bằng productsNormalV5(), nên cột
      "Giá bán đề xuất" của Vòng 2 biến mất dù r2Suggested() vẫn còn nguyên.
      V10 phải là lớp cuối cùng và trả lại đúng màn productsRound2().
    */
    const v10RenderBase=window.render;
    window.render=function(page){
      if(page==='products'){
        const v=document.getElementById('view');
        if(v)v.innerHTML=typeof productsRound2==='function'?productsRound2():'';
        document.getElementById('topTitle').textContent='Sản phẩm';
        document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='products'));
        return;
      }
      return v10RenderBase(page);
    };

    function v10CaptureRecipeDraft(){
      if(typeof editingRecipeId==='undefined'||(!editingRecipeId&&!document.getElementById('rName')))return null;
      const rows=[...document.querySelectorAll('#recipeLines .recipe-line')];
      return {id:editingRecipeId||'',name:document.getElementById('rName')?.value||'',yield:document.getElementById('rYield')?.value||'1',wastePct:document.getElementById('rWaste')?.value||'0',processTemp:document.getElementById('rTemp')?.value||'',processTime:document.getElementById('rTime')?.value||'',notes:document.getElementById('rNotes')?.value||'',lines:rows.map(row=>{const kind=row.querySelector('.rl-kind')?.value||'ingredient',ref=row.querySelector('.rl-ref')?.value||'',qty=row.querySelector('.rl-qty')?.value||'0',waste=row.querySelector('.rl-waste')?.value||'0';return kind==='recipe'?{kind,recipeId:ref,qty:+qty||0}:{kind:'ingredient',ingredientId:ref,qty:+qty||0,wastePct:+waste||0}})};
    }
    function v10RestoreRecipeDraft(d){
      if(!d||typeof window.recipeModal!=='function')return;
      window.recipeModal(d.id||'');
      const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val??''};
      set('rName',d.name);set('rYield',d.yield);set('rWaste',d.wastePct);set('rTemp',d.processTemp);set('rTime',d.processTime);set('rNotes',d.notes);
      const holder=document.getElementById('recipeLines');
      if(holder)holder.innerHTML=(d.lines||[]).map((l,i)=>typeof recipeLineV31==='function'?recipeLineV31(l,i):'').join('');
    }
    const originalQuick=window.quickIngredientModal;
    window.quickIngredientModal=function(){window.__v10RecipeDraft=v10CaptureRecipeDraft();if(typeof originalQuick==='function')return originalQuick()};
    window.saveQuickIngredient=function(){
      const before=window.__v10RecipeDraft;
      const x={id:id(),name:f('qiName').trim(),group:f('qiGroup'),unit:f('qiUnit'),pack:+f('qiPack'),packUnit:f('qiPackUnit'),price:+f('qiPrice')};
      const q=convertQty(x.pack,x.packUnit,x.unit);
      if(!x.name||!x.pack||!q||x.price<0){toast('Vui lòng kiểm tra thông tin nguyên liệu');return}
      db.ingredients.push(x);save();toast('Đã tạo nguyên liệu');closeModal();
      if(before){
        v10RestoreRecipeDraft(before);
        const rows=[...document.querySelectorAll('#recipeLines .recipe-line')],holder=document.getElementById('recipeLines');
        if(holder&&typeof recipeLineV31==='function')holder.insertAdjacentHTML('beforeend',recipeLineV31({kind:'ingredient',ingredientId:x.id,qty:0,wastePct:0},rows.length));
      }
      window.__v10RecipeDraft=null;
    };

    window.deleteIngredient=function(iid){
      const ing=(db.ingredients||[]).find(i=>i.id===iid);if(!ing){toast('Không tìm thấy nguyên liệu');return}
      const recipeRefs=(db.recipes||[]).filter(r=>(r.lines||[]).some(l=>l.kind==='ingredient'&&l.ingredientId===iid));
      const batchRefs=(db.batches||[]).filter(b=>b.ingredientId===iid);
      const inventoryRefs=(db.inventoryHistory||[]).filter(h=>h.ingredientId===iid);
      const receiptRefs=(db.purchaseReceipts||[]).filter(r=>r.ingredientId===iid);
      if(recipeRefs.length||batchRefs.length||inventoryRefs.length||receiptRefs.length){
        const parts=[];if(recipeRefs.length)parts.push(recipeRefs.length+' công thức');if(batchRefs.length)parts.push(batchRefs.length+' lô kho');if(inventoryRefs.length)parts.push(inventoryRefs.length+' giao dịch kho');if(receiptRefs.length)parts.push(receiptRefs.length+' phiếu nhập');
        toast('Không thể xóa: nguyên liệu đang được dùng trong '+parts.join(', '));return;
      }
      if(!confirm('Xóa nguyên liệu “'+ing.name+'”?'))return;
      db.ingredients=(db.ingredients||[]).filter(i=>i.id!==iid);save();
      if(typeof render==='function')render('ingredients');
      toast('Đã xóa nguyên liệu');
    };

    /* Vòng 1 safety guard: không cho lưu dòng công thức tham chiếu tới
       nguyên liệu/công thức con không còn tồn tại. Dữ liệu hợp lệ cũ không đổi. */
    if(typeof window.saveRecipeV31==='function'){
      const originalSaveRecipeV31=window.saveRecipeV31;
      window.saveRecipeV31=function(eid){
        const rows=[...document.querySelectorAll('#recipeLines .recipe-line')];
        const invalid=rows.some(row=>{
          const kind=row.querySelector('.rl-kind')?.value||'ingredient';
          const ref=row.querySelector('.rl-ref')?.value||'';
          const qty=Number(row.querySelector('.rl-qty')?.value)||0;
          if(qty<=0)return false;
          return kind==='recipe'
            ? !(db.recipes||[]).some(r=>r.id===ref&&r.id!==eid)
            : !(db.ingredients||[]).some(i=>i.id===ref);
        });
        if(invalid){toast('Có thành phần không còn tồn tại. Vui lòng chọn lại trước khi lưu.');return}
        return originalSaveRecipeV31(eid);
      };
    }

    if(typeof r3IngredientRowActions==='function'){
      const oldActions=r3IngredientRowActions;
      window.r3IngredientRowActions=function(i){return oldActions(i)+` <button class="btn small danger" onclick="deleteIngredient('${i.id}')">Xóa</button>`};
    }
  };
  document.head.appendChild(s);
})();
