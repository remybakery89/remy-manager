/* F&B Manager V10 — dashboard domain UI
   Phase 8: read-only dashboard presentation is isolated from index.html.
   Shared calculations and primitives remain owned by the existing app runtime.
*/
(function(){
  'use strict';

  function render(){
    const inv=inventoryTotals(),al=alerts(),sales=activeOrders().filter(s=>s.date===today()),revenue=sales.reduce((s,x)=>s+x.total,0),cost=sales.reduce((s,x)=>s+x.cost,0);
    return `<div class="page-head"><div><h1>Xin chào 👋</h1><p>Đây là tình hình cửa hàng của bạn hôm nay.</p></div><button class="btn primary" onclick="go('production')">+ Lập kế hoạch sản xuất</button></div><div class="grid stats"><div class="card stat"><div class="label">Doanh thu hôm nay</div><div class="value">${fmtMoney(revenue)}</div><div class="sub">${sales.length} đơn hàng</div></div><div class="card stat"><div class="label">Lợi nhuận tạm tính</div><div class="value">${fmtMoney(revenue-cost)}</div><div class="sub">Theo các đơn hoàn tất</div></div><div class="card stat"><div class="label">Giá trị tồn nguyên liệu</div><div class="value">${fmtMoney(db.batches.reduce((s,b)=>s+b.qty*b.pricePerUnit,0))}</div><div class="sub">${db.ingredients.length} nguyên liệu</div></div><div class="card stat"><div class="label">Cảnh báo</div><div class="value">${al.length}</div><div class="sub"><button class="btn small" onclick="go('alerts')">Xem cảnh báo</button></div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title">Cảnh báo cần chú ý</div>${al.slice(0,5).map(a=>`<div class="alert ${a.type}"><div>${a.type==='danger'?'🔴':'🟠'}</div><div><b>${a.title}</b><div style="font-size:13px;margin-top:3px">${a.detail}</div></div></div>`).join('')||'<div class="empty">Không có cảnh báo 🎉</div>'}</div><div class="card"><div class="section-title">Sản phẩm đang có trong kho</div>${db.products.slice(0,6).map(p=>`<div class="list-item row"><div><b>${p.name}</b><div style="font-size:12px;color:var(--muted)">${fmtMoney(productCost(p))} / sản phẩm</div></div><span class="badge ${p.stock<5?'warn':'ok'}">${num(p.stock)} cái</span></div>`).join('')}</div></div>`;
  }

  window.FNB_DASHBOARD_UI={render};
})();
