/* F&B Manager V10 — Production domain UI
   Phase 8: Inventory + Production domain extracted.
*/
(function(){
  'use strict';

  function production(){
    return `<div class="page-head"><div><h1>Kế hoạch sản xuất</h1><p>Scale công thức, kiểm tra kho và ghi nhận cost lý thuyết/thực tế.</p></div><button class="btn primary" onclick="planModal()">+ Tạo kế hoạch</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Kế hoạch</th><th>Ngày</th><th class="num">KH</th><th class="num">Thực tế</th><th>Trạng thái</th><th class="num">Cost chuẩn</th><th class="num">Cost thực tế</th><th class="num">Chênh lệch</th><th></th></tr></thead><tbody>${db.plans.length?db.plans.map(p=>{const variance=p.actualCost!=null?p.actualCost-(p.theoreticalCost||0):null;return `<tr><td><b>${p.name}</b></td><td>${fmtDate(p.date)}</td><td class="num">${num(p.qty)}</td><td class="num">${p.actualOutput!=null?num(p.actualOutput):'—'}</td><td><span class="badge ${p.status==='done'?'ok':p.shortages?.length?'danger':'info'}">${p.status==='done'?'Đã hoàn thành':p.status==='draft'?'Nháp':'Đã duyệt'}</span></td><td class="num">${p.theoreticalCost!=null?money(p.theoreticalCost):'—'}</td><td class="num">${p.actualCost!=null?money(p.actualCost):'—'}</td><td class="num">${variance==null?'—':`<span class="badge ${variance>0?'warn':'ok'}">${variance>=0?'+':''}${money(variance)}</span>`}</td><td class="num">${p.status!=='done'?`<button class="btn small" onclick="finishPlan('${p.id}')">Hoàn thành</button>`:''}</td></tr>`}).join(''):'<tr><td colspan="9" class="empty">Chưa có kế hoạch sản xuất.</td></tr>'}</tbody></table></div></div>`;
  }

  function productionMaterialNeeds(filter){
    const plans=db.plans.filter(p=>{const s=p.status||'draft';return filter==='draft'?s==='draft':filter==='approved'?s==='approved':s==='draft'||s==='approved';});
    const out={};
    function addRecipe(recipe,outputQty,seen=[]){
      if(!recipe||seen.includes(recipe.id))return;
      const yieldQty=Math.max(1,Number(recipe.yield)||1);
      const batchQty=(Number(outputQty)||0)/yieldQty;
      const next=[...seen,recipe.id];
      (recipe.lines||[]).forEach(l=>{
        if(l.kind==='recipe'){
          const child=db.recipes.find(r=>r.id===l.recipeId);
          addRecipe(child,batchQty*(Number(l.qty)||0),next);
        }else if(l.ingredientId){
          const q=Number(l.qty)||0,w=Math.min(99.99,Math.max(0,Number(l.wastePct)||0))/100,effective=w>=1?q:q/(1-w);
          out[l.ingredientId]=(out[l.ingredientId]||0)+batchQty*effective;
        }
      });
    }
    plans.forEach(p=>{
      const qty=Number(p.qty)||0;
      const recipe=p.recipeId?db.recipes.find(r=>r.id===p.recipeId):null;
      if(!recipe&&p.productId){
        const product=db.products.find(x=>x.id===p.productId);
        (product?.components||[]).forEach(c=>{
          const r=db.recipes.find(x=>x.id===c.recipeId);
          if(r)addRecipe(r,qty*(Number(c.qty)||0));
        });
      }else if(recipe)addRecipe(recipe,qty);
    });
    return Object.entries(out).map(([ingredientId,need])=>{const ing=db.ingredients.find(i=>i.id===ingredientId);if(!ing)return null;const lots=db.batches.filter(b=>b.ingredientId===ingredientId&&Number(b.qty)>0&&(!b.expiry||b.expiry>=today()));const stock=lots.reduce((s,b)=>s+Number(b.qty||0),0);return {ingredientId,name:ing.name,unit:ing.unit,need,stock,shortage:Math.max(0,need-stock)};}).filter(Boolean).sort((a,b)=>b.shortage-a.shortage||b.need-a.need);
  }

  function productionShortageSummary(){return `<div class="card" id="r4ProductionMaterialSummary" style="margin-top:16px"><div class="row" style="gap:12px;align-items:flex-start"><div><div class="section-title" style="margin-bottom:3px">Tổng nguyên liệu thiếu</div><div style="font-size:12px;color:var(--muted)">Tổng hợp theo kế hoạch Nháp và Đã duyệt, đối chiếu với tồn khả dụng.</div></div><select id="r4MaterialFilter" onchange="r4RenderMaterialSummary()"><option value="all">Tất cả</option><option value="approved">Đã duyệt</option><option value="draft">Nháp</option></select></div><div id="r4MaterialSummaryBody" style="margin-top:12px"></div></div>`;}

  function renderMaterialSummary(){const box=document.getElementById('r4MaterialSummaryBody');if(!box)return;const filter=document.getElementById('r4MaterialFilter')?.value||'all';const rows=productionMaterialNeeds(filter),shortageRows=rows.filter(x=>x.shortage>0);box.innerHTML=shortageRows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Nguyên liệu</th><th class="num">Tổng cần</th><th class="num">Tồn khả dụng</th><th class="num">Thiếu</th></tr></thead><tbody>${shortageRows.map(x=>`<tr><td><b>${x.name}</b></td><td class="num">${num(x.need)} ${x.unit}</td><td class="num">${num(x.stock)} ${x.unit}</td><td class="num"><span class="badge danger">${num(x.shortage)} ${x.unit}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Không có nguyên liệu thiếu theo bộ lọc hiện tại. 🎉</div>';}

  function productionRound4(){
    const dates=[...new Set(db.plans.map(p=>p.date).filter(Boolean))].sort().reverse();
    const currentWeek=r4Week(today());
    const weekPlans=db.plans.filter(p=>r4Week(p.date)===currentWeek);
    const counts={draft:0,approved:0,producing:0,completed:0};db.plans.forEach(p=>counts[p.status||'draft']++);
    return `<div class="page-head"><div><h1>Kế hoạch & lịch sản xuất</h1><p>Quản lý theo ngày/tuần, từ Nháp → Đã duyệt → Đang sản xuất → Đã hoàn thành.</p></div><button class="btn primary" onclick="r4PlanModal()">+ Tạo kế hoạch</button></div>
    <div class="grid stats"><div class="card stat"><div class="label">Nháp</div><div class="value">${counts.draft}</div><div class="sub">Chưa duyệt</div></div><div class="card stat"><div class="label">Đã duyệt</div><div class="value">${counts.approved}</div><div class="sub">Sẵn sàng sản xuất</div></div><div class="card stat"><div class="label">Đang sản xuất</div><div class="value">${counts.producing}</div><div class="sub">Đã xuất nguyên liệu</div></div><div class="card stat"><div class="label">Đã hoàn thành</div><div class="value">${counts.completed}</div><div class="sub">Đã ghi nhận thực tế</div></div></div>
    ${productionShortageSummary()}
    <div class="card" style="margin-top:16px"><div class="row"><div><div class="section-title" style="margin-bottom:3px">Lịch tuần hiện tại</div><div style="font-size:12px;color:var(--muted)">Tuần ${currentWeek}</div></div><span class="badge ${weekPlans.length?'info':'ok'}">${weekPlans.length} kế hoạch</span></div>${weekPlans.length?`<div class="list">${weekPlans.sort((a,b)=>a.date.localeCompare(b.date)).map(r4PlanListItem).join('')}</div>`:'<div class="empty">Tuần này chưa có kế hoạch.</div>'}</div>
    <div class="card" style="margin-top:16px"><div class="section-title">Lịch sản xuất</div><div class="toolbar"><select id="r4PlanWeekFilter" onchange="r4RenderPlanTable()"><option value="">Tất cả tuần</option>${[...new Set(dates.map(r4Week))].map(w=>`<option value="${w}">${w}</option>`).join('')}</select><input class="search" id="r4PlanSearch" placeholder="Tìm kế hoạch/sản phẩm..." oninput="r4RenderPlanTable()"></div><div id="r4PlanTable"></div></div>`;
  }

  window.r4RenderMaterialSummary=renderMaterialSummary;
  window.productionRound4=productionRound4;
  window.FNB_PRODUCTION_UI={renderProduction:function(){const html=productionRound4();const v=document.getElementById('view');if(v)v.innerHTML=html;document.getElementById('topTitle').textContent='Sản xuất';document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='production'));renderMaterialSummary();}};
})();
