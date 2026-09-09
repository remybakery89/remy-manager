/* F&B Manager V10 — recipe UI integration
   Phase 7: recipe-draft preservation around quick ingredient creation is isolated here.
*/
(function(){
  'use strict';

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

  window.FNB_RECIPE_UI={captureRecipeDraft,restoreRecipeDraft};

  const originalQuick=window.quickIngredientModal;
  if(typeof originalQuick==='function'){
    window.quickIngredientModal=function(){
      window.__v10RecipeDraft=captureRecipeDraft();
      return originalQuick();
    };
  }
})();
