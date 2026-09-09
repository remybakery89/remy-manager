/* F&B Manager V10 — Alerts domain UI
   Phase 14: alert presentation takes runtime ownership through the V10 boundary.
   Canonical alert logic remains in index.html temporarily for rollback safety.
*/
(function(){
  'use strict';
  function setActive(){const t=document.getElementById('topTitle');if(t)t.textContent='Cảnh báo';document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='alerts'));}
  function leafNeeds(recipe,mult=1,seen=[]){if(!recipe||seen.includes(recipe.id))return {};const out={},next=[...seen,recipe.id];(recipe.lines||[]).forEach(l=>{if(l.kind==='recipe'){const child=db.recipes.find(r=>r.id===l.recipeId);const x=leafNeeds(child,mult*(Number(l.qty)||0),next);Object.entries(x).forEach(([id,q])=>out[id]=(out[id]||0)+q);}else if(l.ingredientId){const q=Number(l.qty)||0,w=Math.min(99.99,Math.max(0,Number(l.wastePct)||0))/100;out[l.ingredientId]=(out[l.ingredientId]||0)+mult*(w>=1?q:q/(1-w));}});return out;}
  function productNeeds(product){const out={};(product.components||[]).forEach(c=>{const r=db.recipes.find(x=>x.id===c.recipeId);const x=leafNeeds(r,Number(c.qty)||0);Object.entries(x).forEach(([id,q])=>out[id]=(out[id]||0)+q);});return out;}
  function expiryData(){
    const now=new Date();
    return db.batches.filter(b=>Number(b.qty)>0&&b.expiry).map(b=>{const days=Math.ceil((new Date(b.expiry+'T23:59:59')-now)/86400000);return {...b,days,ingredient:db.ingredients.find(i=>i.id===b.ingredientId)};}).filter(b=>b.ingredient&&(b.days<=7)).sort((a,b)=>a.days-b.days);
  }
  function productSuggestions(){
    const exp=expiryData();const byId={};
    exp.forEach(b=>{const weight=b.days<0?3:b.days<=2?2.5:b.days<=4?2:1.5;byId[b.ingredientId]=Math.max(byId[b.ingredientId]||0,weight);});
    return db.products.map(p=>{const needs=productNeeds(p);const hits=Object.entries(needs).filter(([id])=>byId[id]);const score=hits.reduce((s,[id,q])=>s+Number(q||0)*byId[id],0);return {p,hits,score};}).filter(x=>x.hits.length).sort((a,b)=>b.score-a.score||b.hits.length-a.hits.length).slice(0,8);
  }
  function expiryDetail(ingredientId){
    const ing=db.ingredients.find(i=>i.id===ingredientId);if(!ing)return;
    const recipes=db.recipes.filter(r=>{const n=leafNeeds(r);return Number(n[ingredientId]||0)>0;});
    const products=db.products.filter(p=>Number(productNeeds(p)[ingredientId]||0)>0);
    openModal(`<h2>⏳ ${ing.name}</h2><div class="card" style="box-shadow:none"><div class="section-title">Các lô cần ưu tiên</div>${expiryData().filter(b=>b.ingredientId===ingredientId).map(b=>`<div class="list-item row"><div><b>Lô ${b.lot||'—'}</b><div style="font-size:12px;color:var(--muted)">${num(b.qty)} ${b.unit}</div></div><span class="badge ${b.days<0?'danger':'warn'}">${b.days<0?'Đã hết hạn':`Còn ${b.days} ngày`}</span></div>`).join('')||'<div class="empty">Không còn lô cần ưu tiên.</div>'}</div><div class="grid two" style="margin-top:16px"><div class="card" style="box-shadow:none"><div class="section-title">Công thức sử dụng</div>${recipes.map(r=>`<div class="list-item"><b>${r.name}</b><div style="font-size:12px;color:var(--muted)">${num(leafNeeds(r)[ingredientId])} ${ing.unit} / yield</div></div>`).join('')||'<div class="empty">Chưa có công thức.</div>'}</div><div class="card" style="box-shadow:none"><div class="section-title">Sản phẩm sử dụng</div>${products.map(p=>`<div class="list-item"><b>${p.name}</b><div style="font-size:12px;color:var(--muted)">${num(productNeeds(p)[ingredientId])} ${ing.unit} / sản phẩm</div></div>`).join('')||'<div class="empty">Chưa có sản phẩm.</div>'}</div></div><div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function expiryGroups(items){
    const groups={};
    items.forEach(b=>{if(!groups[b.ingredientId])groups[b.ingredientId]={ingredient:b.ingredient,items:[]};groups[b.ingredientId].items.push(b);});
    return Object.values(groups);
  }
  function expiryCard(id,title,description,groups,emptyText){
    return `<div class="card" id="${id}" style="margin-top:16px;scroll-margin-top:24px"><div class="section-title">${title}</div><div style="font-size:12px;color:var(--muted);margin:-8px 0 12px">${description}</div>${groups.map(g=>{const days=Math.min(...g.items.map(x=>x.days));const qty=g.items.reduce((s,x)=>s+Number(x.qty||0),0);return `<div class="list-item row" style="cursor:pointer" onclick="r4ExpiryDetail('${g.ingredient.id}')"><div><b>${g.ingredient.name}</b><div style="font-size:12px;color:var(--muted)">${num(qty)} ${g.ingredient.unit} · ${g.items.length} lô</div></div><span class="badge ${days<0?'danger':'warn'}">${days<0?'Đã hết hạn':`Còn ${days} ngày`}</span></div>`;}).join('')||`<div class="empty">${emptyText}</div>`}</div>`;
  }
  function actionPanel(){
    const exp=expiryData();
    const expired=expiryGroups(exp.filter(b=>b.days<0));
    const expiring=expiryGroups(exp.filter(b=>b.days>=0));
    const suggestions=productSuggestions();
    return `${expiryCard('r4ExpiredAlerts','⛔ Lô đã hết hạn','Các lô đã quá HSD, cần xử lý trước khi tiếp tục sử dụng.',expired,'Không có lô đã hết hạn. 🎉')}${expiryCard('r4ExpiringAlerts','⏳ Nguyên liệu sắp hết hạn','Các lô còn hạn nhưng sẽ hết hạn trong 7 ngày. Bấm vào nguyên liệu để xem công thức và sản phẩm liên quan.',expiring,'Không có nguyên liệu sắp hết hạn trong 7 ngày. 🎉')}<div class="card" id="r4ProductSuggestions" style="margin-top:16px;scroll-margin-top:24px"><div class="section-title">🚀 Sản phẩm nên ưu tiên đẩy bán</div><div style="font-size:12px;color:var(--muted);margin:-8px 0 12px">Xếp theo lượng sử dụng và số loại nguyên liệu đang hết hạn/gần hết hạn.</div>${suggestions.map((x,i)=>`<div class="list-item row"><div><b>${i<2?'🔥 ':''}${x.p.name}</b><div style="font-size:12px;color:var(--muted)">${x.hits.length} loại nguyên liệu cần ưu tiên</div></div><span class="badge ${i<2?'danger':i<5?'warn':'info'}">${i<2?'Rất cao':i<5?'Cao':'Trung bình'}</span></div>`).join('')||'<div class="empty">Chưa có sản phẩm cần ưu tiên.</div>'}</div>`;
  }
  function renderAlerts(){
    const renderer=typeof alertsPageRound3==='function'?alertsPageRound3:(typeof alertsPageRound2==='function'?alertsPageRound2:(typeof alertsPage==='function'?alertsPage:null));
    const html=typeof renderer==='function'?renderer():'';
    const v=document.getElementById('view');if(v)v.innerHTML=html+actionPanel();setActive();return html;
  }
  window.r4ExpiryDetail=expiryDetail;
  window.r4ProductSuggestions=productSuggestions;
  window.FNB_ALERTS_UI={renderAlerts};
})();
