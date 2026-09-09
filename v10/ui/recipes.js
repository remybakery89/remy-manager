/* F&B Manager V10 — recipe domain UI
   Phase 8: recipe presentation/actions are exposed behind a stable domain facade.
   The canonical business/render functions remain in index.html during the safe
   extraction phase so behavior is unchanged while dependencies are being mapped.
*/
(function(){
  'use strict';

  function setActive(page,title){
    document.getElementById('topTitle').textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  }

  function renderRecipes(){
    const html=typeof window.recipes==='function'?window.recipes():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive('recipes','Công thức');
  }

  function openRecipe(id){
    if(typeof window.recipeModal==='function')return window.recipeModal(id||'');
  }

  function openRecipeDetail(id,version){
    if(typeof window.recipeDetailModal==='function')return window.recipeDetailModal(id,version);
  }

  function openRecipeHistory(id){
    if(typeof window.recipeHistoryModal==='function')return window.recipeHistoryModal(id);
  }

  function cloneRecipe(id){
    if(typeof window.cloneRecipe==='function')return window.cloneRecipe(id);
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
    set('rName',d.name); set('rYield',d.yield); set('rWaste',d.wastePct);
    set('rTemp',d.processTemp); set('rTime',d.processTime); set('rNotes',d.notes);
    const holder=document.getElementById('recipeLines');
    if(holder)holder.innerHTML=(d.lines||[]).map((l,i)=>typeof recipeLineV31==='function'?recipeLineV31(l,i):'').join('');
  }

  window.FNB_RECIPE_UI={
    renderRecipes,openRecipe,openRecipeDetail,openRecipeHistory,cloneRecipe,
    captureRecipeDraft,restoreRecipeDraft
  };

  const originalQuick=window.quickIngredientModal;
  if(typeof originalQuick==='function'){
    window.quickIngredientModal=function(){
      window.__v10RecipeDraft=captureRecipeDraft();
      return originalQuick();
    };
  }
})();
