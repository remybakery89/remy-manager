/* F&B Manager V10 — Inventory domain UI
   Phase 8: Inventory + Production domain extracted.
   Phase 9: responsive inventory layout — FEFO first, then ingredient totals.
*/
(function(){
  'use strict';

  function inventoryTotals(){
    const out={};
    db.ingredients.forEach(i=>out[i.id]=0);
    db.batches.forEach(b=>out[b.ingredientId]=(out[b.ingredientId]||0)+Number(b.qty||0));
    return out;
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
    <div class="card" style="margin-top:16px"><div class="section-title">Kho nguyên liệu</div><div class="table-wrap"><table class="table"><thead><tr><th>Nguyên liệu</th><th class="num">Tồn</th><th class="num">Giá trị</th><th>Trạng thái</th><th></th></tr></thead><tbody>${db.ingredients.map(i=>{let q=inv[i.id]||0,val=db.batches.filter(b=>b.ingredientId===i.id).reduce((s,b)=>s+b.qty*b.pricePerUnit,0);return `<tr><td><b>${i.name}</b></td><td class="num">${num(q)} ${i.unit}</td><td class="num">${money(val)}</td><td>${q<=0?'<span class="badge danger">Hết</span>':q<i.pack?'<span class="badge warn">Tồn thấp</span>':'<span class="badge ok">Ổn</span>'}</td><td><button class="btn small" onclick="ingredientBatches('${i.id}')">Xem lô</button></td></tr>`}).join('')}</tbody></table></div></div>
    <div class="card" style="margin-top:16px"><div class="section-title">Lô gần hết hạn</div>${[...db.batches].filter(b=>b.qty>0).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,8).map(b=>`<div class="list-item row"><div><b>${ingName(b.ingredientId)}</b><div style="font-size:12px;color:var(--muted)">Lô ${b.lot||'—'} · ${num(b.qty)} ${b.unit} · ${money(b.pricePerUnit)}/${b.unit}</div></div><span class="badge ${new Date(b.expiry)-new Date()<6*86400000?'warn':'ok'}">${fmtDate(b.expiry)}</span></div>`).join('')||'<div class="empty">Không có lô.</div>'}</div>`;
  }

  function inventoryRound4(){
    const active=db.batches.filter(b=>Number(b.qty)>0);
    const value=db.batches.reduce((s,b)=>s+r4LotValue(b),0);
    const expiring=active.filter(b=>b.expiry&&new Date(b.expiry+'T23:59:59')-new Date()<7*86400000).length;
    const fefo=[...active].sort((a,b)=>(a.expiry||'9999-12-31').localeCompare(b.expiry||'9999-12-31'));

    const fefoRows=fefo.length?fefo.map((b,index)=>{
      const days=b.expiry?Math.ceil((new Date(b.expiry+'T23:59:59')-new Date())/86400000):null;
      const status=b.expiry&&b.expiry<today()?'Hết hạn':days!==null&&days<=7?'Sắp HSD':'Đang dùng';
      const cls=status==='Hết hạn'?'danger':status==='Sắp HSD'?'warn':'info';
      return `<tr><td data-label="Nguyên liệu"><b>${ingName(b.ingredientId)}</b></td><td data-label="Lô">${b.lot||'—'}</td><td data-label="Tồn" class="num">${num(b.qty)} ${b.unit}</td><td data-label="Giá/đv" class="num">${money(b.pricePerUnit)}</td><td data-label="HSD">${b.expiry?fmtDate(b.expiry):'Không HSD'}</td><td data-label="Trạng thái"><span class="badge ${cls}">${status}</span></td><td data-label="Thao tác" class="num"><button class="btn small" onclick="ingredientBatches('${b.ingredientId}')">Xem</button></td></tr>`;
    }).join(''):'<tr><td colspan="7"><div class="empty">Kho đang trống.</div></td></tr>';

    const ingredientRows=db.ingredients.map(i=>{
      const lots=db.batches.filter(b=>b.ingredientId===i.id&&Number(b.qty)>0);
      const q=lots.reduce((s,b)=>s+Number(b.qty||0),0);
      const v=lots.reduce((s,b)=>s+r4LotValue(b),0);
      const avg=q?v/q:0;
      return `<tr><td data-label="Nguyên liệu"><b>${i.name}</b></td><td data-label="Tổng tồn" class="num">${num(q)} ${i.unit}</td><td data-label="Giá trị" class="num">${money(v)}</td><td data-label="Giá vốn" class="num">${money(avg)}/${i.unit}</td><td data-label="Số lô" class="num">${lots.length}</td><td data-label="Thao tác" class="num"><button class="btn small" onclick="ingredientBatches('${i.id}')">Xem lô</button></td></tr>`;
    }).join('');

    return `<div class="page-head"><div><h1>Kho</h1><p>Nhập theo phiếu, theo dõi lô, điều chỉnh tồn và xuất FEFO khi sản xuất.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="r4InventoryHistoryModal()">Lịch sử kho</button><button class="btn" onclick="r4AdjustModal()">⚖️ Điều chỉnh tồn</button><button class="btn primary" onclick="r4ReceiptModal()">+ Phiếu nhập</button></div></div>

    <div class="grid stats"><div class="card stat"><div class="label">Giá trị tồn theo lô</div><div class="value">${money(value)}</div><div class="sub">${active.length} lô còn hàng</div></div><div class="card stat"><div class="label">Nguyên liệu</div><div class="value">${db.ingredients.length}</div><div class="sub">Đang theo dõi</div></div><div class="card stat"><div class="label">Lô sắp HSD</div><div class="value">${expiring}</div><div class="sub">Trong 7 ngày</div></div><div class="card stat"><div class="label">Lịch sử kho</div><div class="value">${(db.inventoryHistory||[]).length}</div><div class="sub">Nhập · xuất · điều chỉnh</div></div></div>

    <div class="card inventory-section" style="margin-top:16px"><div class="row inventory-section-head"><div><div class="section-title" style="margin-bottom:3px">FEFO — Lô ưu tiên xuất</div><div style="font-size:12px;color:var(--muted)">Lô có HSD gần nhất được đưa lên trước.</div></div><span class="badge info">${fefo.length} lô</span></div><div class="table-wrap"><table class="table inventory-table fefo-table"><thead><tr><th>Nguyên liệu</th><th>Lô</th><th class="num">Tồn</th><th class="num">Giá/đv</th><th>HSD</th><th>Trạng thái</th><th></th></tr></thead><tbody>${fefoRows}</tbody></table></div></div>

    <div class="card inventory-section" style="margin-top:16px"><div class="section-title">Tồn theo nguyên liệu</div><div style="font-size:12px;color:var(--muted);margin:-8px 0 14px">Tổng hợp tồn hiện tại theo từng nguyên liệu. Bấm “Xem lô” để quản lý các lô bên trong.</div><div class="table-wrap"><table class="table inventory-table ingredient-stock-table"><thead><tr><th>Nguyên liệu</th><th class="num">Tổng tồn</th><th class="num">Giá trị</th><th class="num">Giá vốn</th><th class="num">Số lô</th><th></th></tr></thead><tbody>${ingredientRows}</tbody></table></div></div>

    <style>
      .inventory-section .table-wrap{overflow-x:auto}
      .inventory-table{min-width:760px}
      .inventory-section-head{margin-bottom:2px}
      @media(max-width:800px){
        .inventory-table{min-width:0;width:100%;border-collapse:separate;border-spacing:0 10px}
        .inventory-table thead{display:none}
        .inventory-table tbody,.inventory-table tr,.inventory-table td{display:block;width:100%}
        .inventory-table tbody tr{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 12px;box-shadow:0 3px 12px rgba(20,50,38,.05)}
        .inventory-table td{border:0;padding:6px 0;text-align:left!important;display:flex;justify-content:space-between;align-items:center;gap:14px;font-size:13px}
        .inventory-table td::before{content:attr(data-label);font-size:11px;color:var(--muted);font-weight:700;flex:0 0 auto}
        .inventory-table td[data-label="Nguyên liệu"]{padding-top:2px;padding-bottom:8px;font-size:14px}
        .inventory-table td[data-label="Nguyên liệu"]::before{display:none}
        .inventory-table td[data-label="Thao tác"]{justify-content:flex-end;border-top:1px solid var(--line);margin-top:5px;padding-top:9px}
        .inventory-table td[data-label="Thao tác"]::before{display:none}
        .fefo-table td[data-label="Nguyên liệu"] b{font-size:14px}
        .inventory-section-head{align-items:flex-start}
      }
    </style>`;
  }

  window.inventoryRound4=inventoryRound4;
  window.FNB_INVENTORY_UI={renderInventory:function(){
    const html=inventoryRound4();
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    document.getElementById('topTitle').textContent='Kho';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='inventory'));
  }};
})();
