/* F&B Manager V10 — dashboard domain UI
   Phase 8: read-only dashboard presentation is isolated from index.html.
   Shared calculations and primitives remain owned by the existing app runtime.
*/
(function(){
  'use strict';

  function focusPage(page,target){
    go(page);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const el=document.getElementById(target);
      if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }

  function operationalOverview(){
    const now=new Date();
    const expiry=db.batches.filter(b=>Number(b.qty)>0&&b.expiry&&new Date(b.expiry+'T23:59:59')<now).length;
    const expiring=db.batches.filter(b=>Number(b.qty)>0&&b.expiry&&new Date(b.expiry+'T23:59:59')>=now&&new Date(b.expiry+'T23:59:59')-now<=7*86400000).length;
    const lowStock=db.ingredients.filter(i=>{const q=db.batches.filter(b=>b.ingredientId===i.id&&Number(b.qty)>0&&(!b.expiry||b.expiry>=today())).reduce((s,b)=>s+Number(b.qty||0),0);return q>0&&q<Number(i.pack||0);}).length;
    const plans=db.plans.filter(p=>p.status==='draft'||p.status==='approved');
    let shortageIngredients=0;
    const needs={};
    function addRecipe(r,outputQty,seen=[]){
      if(!r||seen.includes(r.id))return;
      const yieldQty=Math.max(1,Number(r.yield)||1);
      const batchQty=(Number(outputQty)||0)/yieldQty;
      const next=[...seen,r.id];
      (r.lines||[]).forEach(l=>{
        if(l.kind==='recipe'){
          addRecipe(db.recipes.find(x=>x.id===l.recipeId),batchQty*(Number(l.qty)||0),next);
        }else if(l.ingredientId){
          const q=Number(l.qty)||0,w=Math.min(99.99,Math.max(0,Number(l.wastePct)||0))/100;
          needs[l.ingredientId]=(needs[l.ingredientId]||0)+batchQty*(w>=1?q:q/(1-w));
        }
      });
    }
    plans.forEach(p=>{
      const qty=Number(p.qty)||0;
      if(p.recipeId)addRecipe(db.recipes.find(r=>r.id===p.recipeId),qty);
      else if(p.productId){
        const pr=db.products.find(x=>x.id===p.productId);
        (pr?.components||[]).forEach(c=>addRecipe(db.recipes.find(r=>r.id===c.recipeId),qty*(Number(c.qty)||0)));
      }
    });
    shortageIngredients=Object.entries(needs).filter(([id,q])=>{
      const stock=db.batches.filter(b=>b.ingredientId===id&&Number(b.qty)>0&&(!b.expiry||b.expiry>=today())).reduce((s,b)=>s+Number(b.qty||0),0);
      return Number(q)>stock;
    }).length;
    const suggestions=typeof r4ProductSuggestions==='function'?r4ProductSuggestions().length:0;
    const item=(icon,title,value,sub,page,target,kind)=>`<div class="card" style="cursor:pointer" onclick="focusPage('${page}','${target}')"><div class="row"><div><div class="label">${icon} ${title}</div><div class="value">${value}</div><div class="sub">${sub}</div></div><span class="badge ${kind}">Xem</span></div></div>`;
    return `<div class="card" style="margin-top:16px"><div class="section-title">Tổng quan vấn đề cần chú ý</div><div style="font-size:12px;color:var(--muted);margin:-8px 0 12px">Bổ sung nhanh vào Dashboard hiện tại — bấm từng mục để xử lý chi tiết.</div><div class="grid stats">${item('🔴','Hết hạn',expiry,'lô cần xử lý','alerts','r4ExpiredAlerts','danger')}${item('🟠','Sắp hết hạn',expiring,'lô trong 7 ngày','alerts','r4ExpiringAlerts','warn')}${item('🟡','Thiếu nguyên liệu',shortageIngredients,'nguyên liệu cho kế hoạch','production','r4ProductionMaterialSummary','warn')}${item('🔵','Tồn kho thấp',lowStock,'nguyên liệu dưới mức theo dõi','inventory','r4InventoryIngredientTotals','info')}${item('🚀','Sản phẩm nên đẩy',suggestions,'gợi ý từ nguyên liệu hạn','alerts','r4ProductSuggestions','ok')}</div></div>`;
  }

  function render(){
    const al=alerts();
    const sales=(typeof activeOrders==='function'?activeOrders():db.sales).filter(s=>s.date===today());
    const revenue=sales.reduce((s,x)=>s+x.total,0),cost=sales.reduce((s,x)=>s+x.cost,0);
    return `<div class="page-head"><div><h1>Xin chào 👋</h1><p>Đây là tình hình cửa hàng của bạn hôm nay.</p></div><button class="btn primary" onclick="go('production')">+ Lập kế hoạch sản xuất</button></div><div class="grid stats"><div class="card stat"><div class="label">Doanh thu hôm nay</div><div class="value">${fmtMoney(revenue)}</div><div class="sub">${sales.length} đơn hàng</div></div><div class="card stat"><div class="label">Lợi nhuận tạm tính</div><div class="value">${fmtMoney(revenue-cost)}</div><div class="sub">Theo các đơn hoàn tất</div></div><div class="card stat"><div class="label">Giá trị tồn nguyên liệu</div><div class="value">${fmtMoney(db.batches.reduce((s,b)=>s+b.qty*b.pricePerUnit,0))}</div><div class="sub">${db.ingredients.length} nguyên liệu</div></div><div class="card stat"><div class="label">Cảnh báo</div><div class="value">${al.length}</div><div class="sub"><button class="btn small" onclick="go('alerts')">Xem cảnh báo</button></div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title">Cảnh báo cần chú ý</div>${al.slice(0,5).map(a=>`<div class="alert ${a.type}"><div>${a.type==='danger'?'🔴':'🟠'}</div><div><b>${a.title}</b><div style="font-size:13px;margin-top:3px">${a.detail}</div></div></div>`).join('')||'<div class="empty">Không có cảnh báo 🎉</div>'}</div><div class="card"><div class="section-title">Sản phẩm đang có trong kho</div>${db.products.slice(0,6).map(p=>`<div class="list-item row"><div><b>${p.name}</b><div style="font-size:12px;color:var(--muted)">${fmtMoney(productCost(p))} / sản phẩm</div></div><span class="badge ${p.stock<5?'warn':'ok'}">${num(p.stock)} cái</span></div>`).join('')}</div></div>${operationalOverview()}`;
  }

  window.FNB_DASHBOARD_UI={render};
  window.focusPage=focusPage;
})();
