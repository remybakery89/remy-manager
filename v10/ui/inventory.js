/* F&B Manager V10 — Inventory domain UI
   Phase 8: Inventory + Production domain extracted.
*/
(function(){
  'use strict';

function inventoryTotals(){
  const out={};db.ingredients.forEach(i=>out[i.id]=0);db.batches.forEach(b=>out[b.ingredientId]=(out[b.ingredientId]||0)+Number(b.qty||0));return out;
}

function inventory(){
 const inv=inventoryTotals();
 return `<div class="page-head"><div><h1>Kho</h1><p>Theo dõi tồn, lô, giá trị và hạn sử dụng.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="inventoryHistory()">Lịch sử kho</button><button class="btn primary" onclick="batchModal()">+ Nhập lô nguyên liệu</button></div></div>
 <div class="grid stats">
  <div class="card stat"><div class="label">Giá trị kho nguyên liệu</div><div class="value">${money(db.batches.reduce((s,b)=>s+b.qty*b.pricePerUnit,0))}</div></div>
  <div class="card stat"><div class="label">Số lô đang có</div><div class="value">${num(db.batches.filter(b=>b.qty>0).length)}</div></div>
  <div class="card stat"><div class="label">Lô sắp hết hạn</div><div class="value">${db.batches.filter(b=>b.qty>0 && new Date(b.expiry)-new Date()<6*86400000 && new Date(b.expiry)>=new Date()).length}</div></div>
  <div class="card stat"><div class="label">Lô đã hết hạn</div><div class="value">${db.batches.filter(b=>b.qty>0 && new Date(b.expiry)<new Date()).length}</div></div>
 </div>
 <div class="grid two" style="margin-top:16px">
  <div class="card"><div class="section-title">Kho nguyên liệu</div><div class="table-wrap"><table class="table"><thead><tr><th>Nguyên liệu</th><th class="num">Tồn</th><th class="num">Giá trị</th><th>Trạng thái</th><th></th></tr></thead><tbody>${db.ingredients.map(i=>{let q=inv[i.id]||0,val=db.batches.filter(b=>b.ingredientId===i.id).reduce((s,b)=>s+b.qty*b.pricePerUnit,0);return `<tr><td><b>${i.name}</b></td><td class="num">${num(q)} ${i.unit}</td><td class="num">${money(val)}</td><td>${q<=0?'<span class="badge danger">Hết</span>':q<i.pack?'<span class="badge warn">Tồn thấp</span>':'<span class="badge ok">Ổn</span>'}</td><td><button class="btn small" onclick="ingredientBatches('${i.id}')">Xem lô</button></td></tr>`}).join('')}</tbody></table></div></div>
  <div class="card"><div class="section-title">Lô gần hết hạn</div>${[...db.batches].filter(b=>b.qty>0).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,8).map(b=>`<div class="list-item row"><div><b>${ingName(b.ingredientId)}</b><div style="font-size:12px;color:var(--muted)">Lô ${b.lot||'—'} · ${num(b.qty)} ${b.unit} · ${money(b.pricePerUnit)}/${b.unit}</div></div><span class="badge ${new Date(b.expiry)-new Date()<6*86400000?'warn':'ok'}">${fmtDate(b.expiry)}</span></div>`).join('')||'<div class="empty">Không có lô.</div>'}</div>
 </div>`;
}

function inventoryRound4(){
  const inv=inventoryTotals(), value=db.batches.reduce((s,b)=>s+r4LotValue(b),0),active=db.batches.filter(b=>b.qty>0);
  const expiring=active.filter(b=>b.expiry&&new Date(b.expiry+'T23:59:59')-new Date()<7*86400000).length;
  return `<div class="page-head"><div><h1>Kho</h1><p>Nhập theo phiếu, theo dõi lô, điều chỉnh tồn và xuất FEFO khi sản xuất.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="r4InventoryHistoryModal()">Lịch sử kho</button><button class="btn" onclick="r4AdjustModal()">⚖️ Điều chỉnh tồn</button><button class="btn primary" onclick="r4ReceiptModal()">+ Phiếu nhập</button></div></div>
    <div class="grid stats"><div class="card stat"><div class="label">Giá trị tồn theo lô</div><div class="value">${money(value)}</div><div class="sub">${active.length} lô còn hàng</div></div><div class="card stat"><div class="label">Nguyên liệu</div><div class="value">${db.ingredients.length}</div><div class="sub">Đang theo dõi</div></div><div class="card stat"><div class="label">Lô sắp HSD</div><div class="value">${expiring}</div><div class="sub">Trong 7 ngày</div></div><div class="card stat"><div class="label">Lịch sử kho</div><div class="value">${db.inventoryHistory.length}</div><div class="sub">Nhập · xuất · điều chỉnh</div></div></div>
    <div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title">Tồn theo nguyên liệu</div><div class="table-wrap"><table class="table"><thead><tr><th>Nguyên liệu</th><th class="num">Tồn</th><th class="num">Giá trị</th><th>Giá vốn theo lô</th><th></th></tr></thead><tbody>${db.ingredients.map(i=>{const lots=db.batches.filter(b=>b.ingredientId===i.id&&b.qty>0),q=lots.reduce((s,b)=>s+b.qty,0),v=lots.reduce((s,b)=>s+r4LotValue(b),0),avg=q?v/q:0;return `<tr><td><b>${i.name}</b></td><td class="num">${num(q)} ${i.unit}</td><td class="num">${money(v)}</td><td class="num">${money(avg)}/${i.unit}</td><td class="num"><button class="btn small" onclick="ingredientBatches('${i.id}')">Xem lô</button></td></tr>`}).join('')}</tbody></table></div></div>
    <div class="card"><div class="section-title">FEFO — lô ưu tiên xuất</div>${active.sort((a,b)=>(a.expiry||'9999-12-31').localeCompare(b.expiry||'9999-12-31')).slice(0,10).map(b=>`<div class="list-item row"><div><b>${ingName(b.ingredientId)}</b><div style="font-size:12px;color:var(--muted)">Lô ${b.lot||'—'} · ${num(b.qty)} ${b.unit} · ${money(b.pricePerUnit)}/${b.unit}</div></div><span class="badge ${b.expiry&&b.expiry<today()?'danger':b.expiry&&b.expiry<=today()?'warn':'info'}">${b.expiry?fmtDate(b.expiry):'Không HSD'}</span></div>`).join('')||'<div class="empty">Kho đang trống.</div>'}</div></div>`;
}

window.inventoryRound4=inventoryRound4;
  window.FNB_INVENTORY_UI={renderInventory:function(){const html=inventoryRound4();const v=document.getElementById('view');if(v)v.innerHTML=html;document.getElementById('topTitle').textContent='Kho';document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='inventory'));}};
})();
