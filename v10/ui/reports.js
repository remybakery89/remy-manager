/* F&B Manager V10 — reports domain UI
   Phase 8: read-only report presentation is isolated from index.html.
   Shared calculations and primitives remain owned by the existing app runtime.
*/
(function(){
  'use strict';

  function render(){
    let sales=activeOrders(),revenue=sales.reduce((s,x)=>s+x.total,0),cost=sales.reduce((s,x)=>s+x.cost,0),ranked=[...db.products].sort((a,b)=>b.stock-a.stock);
    return `<div class="page-head"><div><h1>Báo cáo</h1><p>Tổng quan doanh thu, giá vốn và tồn kho.</p></div></div><div class="grid stats"><div class="card stat"><div class="label">Tổng doanh thu</div><div class="value">${fmtMoney(revenue)}</div></div><div class="card stat"><div class="label">Giá vốn</div><div class="value">${fmtMoney(cost)}</div></div><div class="card stat"><div class="label">Lợi nhuận gộp</div><div class="value">${fmtMoney(revenue-cost)}</div></div><div class="card stat"><div class="label">Số đơn hoàn tất</div><div class="value">${num(sales.length)}</div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title">Sản phẩm & giá vốn</div>${db.products.map(p=>{let c=productCost(p),m=p.price?((p.price-c)/p.price*100):0;return `<div class="list-item"><div class="row"><b>${p.name}</b><span>${fmtMoney(c)} → ${fmtMoney(p.price)}</span></div><div class="progress" style="margin-top:8px"><span style="width:${Math.max(0,Math.min(100,m))}%"></span></div><div style="font-size:12px;color:var(--muted);margin-top:5px">Biên lợi nhuận ${m.toFixed(1)}%</div></div>`}).join('')}</div><div class="card"><div class="section-title">Tồn kho thành phẩm</div>${ranked.map(p=>`<div class="list-item row"><span>${p.name}</span><b>${num(p.stock)}</b></div>`).join('')}</div></div>`;
  }

  window.FNB_REPORTS_UI={render};
})();
