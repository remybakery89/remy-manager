/* F&B Manager V10 — Ingredients domain UI
   Phase 8: Ingredients + Recipes domain extracted
   Canonical ingredient/unit/batch/price-history logic now lives here.
   Shared db/runtime helpers remain supplied by the existing app runtime.
*/
(function(){
  'use strict';

  function unitInfo(u){
   const key=String(u||'').trim().toLowerCase();
   for(const [group,map] of Object.entries(UNIT_GROUPS)) if(map[key]!=null) return {group,factor:map[key],label:key};
   return {group:'custom',factor:1,label:key||'đơn vị'};
  }
  function unitOptions(selected, groupHint){
   const common=['g','kg','mg','ml','l','cái','hộp','gói','chai','lon','quả','chiếc'];
   return common.map(u=>`<option value="${u}" ${String(u)===String(selected)?'selected':''}>${u}</option>`).join('');
  }
  function convertQty(qty,from,to){
   const a=unitInfo(from),b=unitInfo(to); if(a.group!==b.group) return null; return qty*a.factor/b.factor;
  }
  function standardPricePerUnit(ing){
   const totalUsage=convertQty(Number(ing.pack)||0,ing.packUnit,ing.unit);
   return totalUsage?Number(ing.price)/totalUsage:0;
  }
  function priceInUnit(ing,pricePerUsageUnit,targetUnit){
   const q=convertQty(1,targetUnit,ing.unit); return q==null?pricePerUsageUnit:pricePerUsageUnit*q;
  }
  function impactedProducts(ingredientId){return db.products.filter(p=>productCostBreakdown(p).some(x=>x.ingredientId===ingredientId))}
  function ingredientImpactHtml(ingredientId){
   const ing=db.ingredients.find(i=>i.id===ingredientId);
   const items=impactedProducts(ingredientId);
   return items.map(p=>{
    const b=productCostBreakdown(p).find(x=>x.ingredientId===ingredientId);
    return `<div class="list-item"><div class="row"><b>${p.name}</b><span>Cost ${money(productCost(p))}</span></div><div style="font-size:12px;color:var(--muted);margin-top:5px">Dùng ${num(b.qty)} ${b.unit} · Chi phí từ ${ing.name}: ${money(b.cost)}</div></div>`;
   }).join('')||'<div class="empty">Không có sản phẩm nào dùng nguyên liệu này.</div>';
  }
  function impactModal(ingredientId){
   const ing=db.ingredients.find(i=>i.id===ingredientId);
   openModal(`<h2>Ảnh hưởng: ${ing.name}</h2><p style="color:var(--muted)">Giá chuẩn hiện tại: <b>${money(ing.price/ing.pack)}/${ing.unit}</b></p>${ingredientImpactHtml(ingredientId)}<div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function ingredients(){
   return `<div class="page-head"><div><h1>Nguyên liệu</h1><p>Khai báo nguyên liệu và giá mua chuẩn.</p></div><button class="btn primary" onclick="ingredientModal()">+ Thêm nguyên liệu</button></div>
   <div class="card"><div class="toolbar"><input class="search" id="ingSearch" placeholder="Tìm nguyên liệu..." oninput="filterTable('ingSearch','ingTable')"></div>
   <div class="table-wrap"><table class="table" id="ingTable"><thead><tr><th>Tên</th><th>Nhóm</th><th>Đơn vị</th><th class="num">Quy cách</th><th class="num">Giá mua</th><th class="num">Giá / đơn vị</th><th></th></tr></thead><tbody>${db.ingredients.map(i=>`<tr><td><b>${i.name}</b></td><td>${i.group}</td><td>${i.unit}</td><td class="num">${num(i.pack)} ${i.packUnit}</td><td class="num">${money(i.price)}</td><td class="num">${money(i.price/i.pack)}</td><td class="num"><button class="btn small" onclick="ingredientModal('${i.id}')">Sửa</button> <button class="btn small" onclick="impactModal('${i.id}')">Ảnh hưởng</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function ingredientModal(editId){
   const x=db.ingredients.find(i=>i.id===editId)||{name:'',group:'Nguyên liệu',unit:'g',pack:1000,packUnit:'g',price:0};
   openModal(`<h2>${editId?'Sửa':'Thêm'} nguyên liệu</h2><div class="form-grid">
    <div class="field full"><label>Tên nguyên liệu</label><input id="fName" value="${x.name}"></div>
    <div class="field"><label>Nhóm</label><select id="fGroup"><option ${x.group==='Nguyên liệu'?'selected':''}>Nguyên liệu</option><option ${x.group==='Bao bì'?'selected':''}>Bao bì</option></select></div>
    <div class="field"><label>Đơn vị đo lường / sử dụng</label><select id="fUnit">${unitOptions(x.unit)}</select></div>
    <div class="field"><label>Quy cách mua</label><input id="fPack" type="number" min="0" step="0.001" value="${x.pack}"></div>
    <div class="field"><label>Đơn vị quy cách</label><select id="fPackUnit">${unitOptions(x.packUnit)}</select></div>
    <div class="field full"><label>Giá mua / quy cách</label><input id="fPrice" type="number" min="0" step="0.01" value="${x.price}"></div>
   </div><div id="ingredientUnitHint" class="alert info" style="margin-top:14px"></div>
   <div class="modal-actions"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveIngredientV21('${editId||''}')">Lưu</button></div>`);
   updateIngredientUnitHint();
   ['fUnit','fPack','fPackUnit','fPrice'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateIngredientUnitHint));
   ['fUnit','fPackUnit'].forEach(id=>document.getElementById(id)?.addEventListener('change',updateIngredientUnitHint));
  }
  function updateIngredientUnitHint(){
   const pack=+f('fPack')||0, price=+f('fPrice')||0, unit=f('fUnit'), packUnit=f('fPackUnit');
   const q=convertQty(pack,packUnit,unit), el=document.getElementById('ingredientUnitHint');
   el.innerHTML=q==null?`⚠️ Đơn vị <b>${packUnit}</b> và <b>${unit}</b> không cùng nhóm đo lường. Hãy chọn lại.`:`Một quy cách = <b>${num(q)} ${unit}</b> · Giá chuẩn = <b>${money(q?price/q:0)}/${unit}</b>`;
  }
  function saveIngredientV21(eid){
   const old=db.ingredients.find(i=>i.id===eid);
   const x={id:eid||id(),name:f('fName'),group:f('fGroup'),unit:f('fUnit'),pack:+f('fPack'),packUnit:f('fPackUnit'),price:+f('fPrice')};
   const q=convertQty(x.pack,x.packUnit,x.unit);
   if(!x.name||!x.pack||!q||x.price<0){toast('Vui lòng kiểm tra tên, quy cách, đơn vị và giá');return}
   const oldUnit=old?standardPricePerUnit(old):0;
   const newUnit=standardPricePerUnit(x);
   const priceComparable=old&&old.unit===x.unit;
   const priceChanged=priceComparable&&Math.abs(newUnit-oldUnit)>1e-12;
   if(eid&&old&&priceChanged){
     const delta=newUnit-oldUnit;
     const items=impactedProducts(eid);
     const list=items.map(p=>{
       const z=productCostBreakdown(p).find(y=>y.ingredientId===eid);
       return `${p.name}: ${delta>=0?'+':''}${money((z?.qty||0)*delta)}`;
     }).join('\n')||'Không có sản phẩm bị ảnh hưởng';
     if(!confirm(`Giá chuẩn thay đổi ${delta>=0?'+':''}${money(delta)}/${x.unit}.\n\nẢnh hưởng dự kiến:\n${list}\n\nLưu thay đổi?`))return;
   }
   if(eid){
     const i=db.ingredients.findIndex(x=>x.id===eid);
     db.ingredients[i]=x;
   }else{
     db.ingredients.push(x);
   }
   // Vòng 3 dùng cùng một luồng lưu này để ghi lịch sử + cảnh báo, không cần định nghĩa lại hàm.
   if(priceChanged&&typeof r3RecordPriceChange==='function') r3RecordPriceChange(x,oldUnit,newUnit,old.unit,x.unit);
   save();closeModal();render('ingredients');
   toast(priceChanged?'Đã lưu · Đã ghi nhận biến động giá':'Đã lưu nguyên liệu');
  }
  function batchModal(){
   openModal(`<h2>Nhập lô nguyên liệu</h2><div class="form-grid">
    <div class="field full"><label>Nguyên liệu</label><select id="bIng" onchange="syncBatchV21()">${db.ingredients.map(i=>`<option value="${i.id}">${i.name}</option>`).join('')}</select></div>
    <div class="field"><label>Số lượng nhập</label><input id="bQty" type="number" min="0" step="0.001" value="1" oninput="syncBatchV21()"></div>
    <div class="field"><label>Đơn vị nhập</label><select id="bUnit" onchange="syncBatchV21()"></select></div>
    <div class="field full"><label>Giá nhập</label><div style="display:flex;gap:8px;flex-wrap:wrap">
     <label style="flex:1;min-width:220px;border:1px solid var(--line);border-radius:10px;padding:11px"><input type="radio" name="priceMode" value="standard" checked onchange="syncBatchV21()"> Dùng giá gốc nguyên liệu <b id="batchStdPrice"></b></label>
     <label style="flex:1;min-width:220px;border:1px solid var(--line);border-radius:10px;padding:11px"><input type="radio" name="priceMode" value="custom" onchange="syncBatchV21()"> Giá tùy chỉnh theo lô</label>
    </div></div>
    <div class="field"><label>Giá / đơn vị nhập</label><input id="bPrice" type="number" min="0" step="0.01" disabled oninput="syncBatchV21()"></div>
    <div class="field"><label>Số lô</label><input id="bLot"></div>
    <div class="field"><label>Hạn sử dụng</label><input id="bExp" type="date"></div>
   </div><div id="batchPriceInfo" class="alert info" style="margin-top:14px"></div>
   <div id="batchImpactInfo" class="card" style="margin-top:12px;padding:14px"></div>
   <div class="modal-actions"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveBatchV21()">Nhập kho</button></div>`);
   populateBatchUnits(); syncBatchV21();
  }
  function populateBatchUnits(){
   const ing=db.ingredients.find(x=>x.id===f('bIng')), sel=document.getElementById('bUnit');if(!ing||!sel)return;
   const group=unitInfo(ing.unit).group, units=Object.keys(UNIT_GROUPS[group]||{});
   sel.innerHTML=units.map(u=>`<option value="${u}" ${u===ing.unit?'selected':''}>${u}</option>`).join('');
  }
  function syncBatchV21(){
   const ing=db.ingredients.find(x=>x.id===f('bIng'));if(!ing)return;
   if(!document.getElementById('bUnit')?.options.length)populateBatchUnits();
   const selected=f('bUnit')||ing.unit, qty=+f('bQty')||0, mode=document.querySelector('input[name="priceMode"]:checked')?.value||'standard';
   const standardUsage=standardPricePerUnit(ing), standardSelected=priceInUnit(ing,standardUsage,selected), input=document.getElementById('bPrice');
   document.getElementById('batchStdPrice').textContent=`(${money(standardSelected)}/${selected})`;
   input.disabled=mode!=='custom';if(mode==='standard')input.value=standardSelected;
   const price=+input.value||0, diff=price-standardSelected,pct=standardSelected?diff/standardSelected*100:0, normalizedQty=convertQty(qty,selected,ing.unit)||0, lotValue=qty*price;
   document.getElementById('batchPriceInfo').innerHTML=mode==='standard'?`Giá chuẩn: <b>${money(standardSelected)}/${selected}</b> · Giá lô: <b>${money(price)}/${selected}</b> · Chênh lệch: <b>0đ (0%)</b>`:`Giá chuẩn: <b>${money(standardSelected)}/${selected}</b> · Giá lô: <b>${money(price)}/${selected}</b> · Chênh lệch: <b>${diff>=0?'+':''}${money(diff)}</b> (${pct>=0?'+':''}${pct.toFixed(1)}%)`;
   const existing=db.batches.filter(b=>b.ingredientId===ing.id&&b.qty>0), oldQty=existing.reduce((s,b)=>s+b.qty,0),oldValue=existing.reduce((s,b)=>s+b.qty*b.pricePerUnit,0),newQty=oldQty+normalizedQty,newValue=oldValue+lotValue,avg=newQty?newValue/newQty:0;
   document.getElementById('batchImpactInfo').innerHTML=`<b>Sau khi nhập lô này</b><div class="grid three" style="margin-top:10px"><div><small>Tồn tăng</small><div><b>+${num(normalizedQty)} ${ing.unit}</b></div></div><div><small>Giá trị kho tăng</small><div><b>+${money(lotValue)}</b></div></div><div><small>Giá vốn bình quân tồn</small><div><b>${money(avg)}/${ing.unit}</b></div></div></div><div style="font-size:12px;color:var(--muted);margin-top:8px">Giá chuẩn nguyên liệu vẫn <b>${money(standardUsage)}/${ing.unit}</b>, không tự thay đổi.</div>`;
  }
  function saveBatchV21(){
   const iid=f('bIng'),ing=db.ingredients.find(x=>x.id===iid),unit=f('bUnit'),qty=+f('bQty')||0,mode=document.querySelector('input[name="priceMode"]:checked')?.value||'standard';
   const standardUsage=standardPricePerUnit(ing),standardSelected=priceInUnit(ing,standardUsage,unit),price=mode==='standard'?standardSelected:+f('bPrice'),normalizedQty=convertQty(qty,unit,ing.unit);
   if(!qty||normalizedQty==null||price<0){toast('Vui lòng kiểm tra số lượng, đơn vị và giá');return}
   const x={id:id(),ingredientId:iid,qty:normalizedQty,unit:ing.unit,enteredQty:qty,enteredUnit:unit,pricePerUnit:price/priceInUnit(ing,1,unit)*standardUsage,enteredPrice:price,priceUnit:unit,priceMode:mode,standardPriceAtEntry:standardUsage,lot:f('bLot'),expiry:f('bExp'),createdAt:new Date().toISOString()};
   // For compatibility, pricePerUnit is always stored per ingredient usage unit.
   x.pricePerUnit=convertQty(1,unit,ing.unit)?price/convertQty(1,unit,ing.unit):price;
   db.batches.push(x);db.cash.push({id:id(),date:today(),type:'expense',category:'Nhập nguyên liệu',amount:qty*price,note:`${ing.name} · Lô ${x.lot||'—'}`});save();closeModal();render('inventory');toast('Đã nhập lô');
  }
  function r3RecipeUsesIngredient(recipeId, ingredientId, seen=[]){
    if(seen.includes(recipeId)) return false;
    const r=db.recipes.find(x=>x.id===recipeId); if(!r)return false;
    const next=[...seen,recipeId];
    return (r.lines||[]).some(l=>l.kind==='ingredient'
      ? l.ingredientId===ingredientId
      : l.kind==='recipe' && r3RecipeUsesIngredient(l.recipeId,ingredientId,next));
  }
  function r3AffectedRecipes(ingredientId){
    return db.recipes.filter(r=>r3RecipeUsesIngredient(r.id,ingredientId)).map(r=>({id:r.id,name:r.name}));
  }
  function r3AffectedProducts(ingredientId){
    return db.products.filter(p=>(productCostBreakdown(p)||[]).some(x=>x.ingredientId===ingredientId)).map(p=>({id:p.id,name:p.name}));
  }
  function r3ProductCostDelta(p, ingredientId, unitDelta){
    const row=(productCostBreakdown(p)||[]).find(x=>x.ingredientId===ingredientId);
    return row ? row.qty*unitDelta : 0;
  }
  function r3RecipeCostDelta(r, ingredientId, unitDelta){
    const needs=recipeLeafNeeds(r,1)||{};
    return Number(needs[ingredientId]||0)*unitDelta;
  }
  function r3RecordPriceChange(ingredient, oldPrice, newPrice, oldUnit, newUnit){
    const delta=newPrice-oldPrice;
    if(Math.abs(delta)<1e-12) return null;
    const affectedRecipes=r3AffectedRecipes(ingredient.id);
    const affectedProducts=r3AffectedProducts(ingredient.id);
    const unit=ingredient.unit;
    const recipeRows=affectedRecipes.map(r=>{
      const recipe=db.recipes.find(x=>x.id===r.id);
      const costDelta=r3RecipeCostDelta(recipe,ingredient.id,delta);
      return {id:r.id,name:r.name,costDelta};
    });
    const productRows=affectedProducts.map(p=>{
      const prod=db.products.find(x=>x.id===p.id);
      const costDelta=r3ProductCostDelta(prod,ingredient.id,delta);
      const oldCost=(r2Cost(prod)||{}).total||0;
      const newCost=oldCost+costDelta;
      return {id:p.id,name:p.name,costDelta,oldCost,newCost,profitDelta:-costDelta,oldProfit:(Number(prod.price)||0)-oldCost,newProfit:(Number(prod.price)||0)-newCost};
    });
    const entry={
      id:id(),date:new Date().toISOString(),ingredientId:ingredient.id,ingredientName:ingredient.name,
      unit,oldPrice,newPrice,delta,deltaPct:oldPrice?delta/oldPrice*100:0,
      oldUnit,newUnit,affectedRecipes:recipeRows,affectedProducts:productRows
    };
    db.priceHistory.unshift(entry);
    const direction=delta>0?'tăng':'giảm';
    productRows.forEach(p=>{
      db.priceAlerts.unshift({
        id:id(),date:entry.date,type:delta>0?'warn':'info',
        title:`${ingredient.name} ${direction} giá`,
        detail:`${delta>0?'+':''}${money(delta)}/${unit} · ${delta>=0?'+':''}${entry.deltaPct.toFixed(1)}% → ${p.name} ${delta>=0?'tăng':'giảm'} cost ${money(Math.abs(p.costDelta))}`,
        ingredientId:ingredient.id,ingredientName:ingredient.name,
        productId:p.id,productName:p.name,costDelta:p.costDelta,profitDelta:p.profitDelta,
        affectedRecipes:affectedRecipes.map(r=>r.id),affectedProducts:[p.id],
        read:false,readAt:null
      });
    });
    if(!productRows.length && affectedRecipes.length){
      db.priceAlerts.unshift({
        id:id(),date:entry.date,type:delta>0?'warn':'info',title:`${ingredient.name} ${direction} giá`,
        detail:`${delta>0?'+':''}${money(delta)}/${unit} · ${entry.deltaPct.toFixed(1)}% · Có ${affectedRecipes.length} công thức bị ảnh hưởng.`,
        ingredientId:ingredient.id,ingredientName:ingredient.name,affectedRecipes:affectedRecipes.map(r=>r.id),affectedProducts:[],costDelta:0,profitDelta:0,
        read:false,readAt:null
      });
    }
    return entry;
  }
  function r3PriceHistoryForIngredient(iid){return db.priceHistory.filter(h=>h.ingredientId===iid).sort((a,b)=>b.date.localeCompare(a.date));}
  function r3PriceHistoryModal(iid){
    const ing=db.ingredients.find(i=>i.id===iid); if(!ing)return;
    const rows=r3PriceHistoryForIngredient(iid);
    openModal(`<h2>Lịch sử giá: ${ing.name}</h2>
      <p style="color:var(--muted)">Mỗi lần giá chuẩn thay đổi, hệ thống lưu lại giá cũ, giá mới và những công thức/sản phẩm bị ảnh hưởng.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Thời điểm</th><th class="num">Giá cũ</th><th class="num">Giá mới</th><th class="num">Thay đổi</th><th class="num">%</th><th>Ảnh hưởng</th></tr></thead><tbody>
      ${rows.map(h=>`<tr><td>${fmtDate(h.date)}</td><td class="num">${money(h.oldPrice)}/${h.unit}</td><td class="num"><b>${money(h.newPrice)}/${h.unit}</b></td><td class="num"><span class="badge ${h.delta>0?'warn':'info'}">${h.delta>0?'+':''}${money(h.delta)}</span></td><td class="num">${h.deltaPct>=0?'+':''}${h.deltaPct.toFixed(1)}%</td><td>${h.affectedRecipes.length} công thức · ${h.affectedProducts.length} sản phẩm</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Chưa có biến động giá.</td></tr>'}</tbody></table></div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function r3ImpactModal(historyId){
    const h=db.priceHistory.find(x=>x.id===historyId); if(!h)return;
    openModal(`<h2>Ảnh hưởng: ${h.ingredientName}</h2>
      <div class="alert ${h.delta>0?'warn':'info'}"><div>${h.delta>0?'🟠':'🔵'}</div><div><b>${h.delta>0?'Giá tăng':'Giá giảm'} ${h.delta>0?'+':''}${money(h.delta)}/${h.unit}</b><div style="font-size:12px;margin-top:3px">${h.deltaPct>=0?'+':''}${h.deltaPct.toFixed(1)}% · ${fmtDate(h.date)}</div></div></div>
      <div class="grid two" style="margin-top:14px">
        <div class="card" style="box-shadow:none"><div class="section-title">Công thức bị ảnh hưởng</div>
          ${h.affectedRecipes.map(r=>`<div class="list-item row"><div><b>${r.name}</b><div style="font-size:12px;color:var(--muted)">Cost thay đổi ${r.costDelta>=0?'+':''}${money(r.costDelta)}</div></div><button class="btn small" onclick="recipeDetailModal('${r.id}')">Mở công thức</button></div>`).join('')||'<div class="empty">Không có công thức trực tiếp bị ảnh hưởng.</div>'}
        </div>
        <div class="card" style="box-shadow:none"><div class="section-title">Sản phẩm bị ảnh hưởng</div>
          ${h.affectedProducts.map(p=>`<div class="list-item row"><div><b>${p.name}</b><div style="font-size:12px;color:var(--muted)">Cost ${money(p.oldCost)} → ${money(p.newCost)}<br>Lợi nhuận ${money(p.oldProfit)} → ${money(p.newProfit)}</div></div><button class="btn small" onclick="priceGuideModal('${p.id}')">Mở sản phẩm</button></div>`).join('')||'<div class="empty">Không có sản phẩm bị ảnh hưởng.</div>'}
        </div>
      </div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function r3AllChanges(){return db.priceHistory.slice().sort((a,b)=>b.date.localeCompare(a.date));}
  function r3ExportChanges(){
    const rows=r3AllChanges();
    if(!rows.length){toast('Chưa có thay đổi giá để xuất');return;}
    const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const out=[['Thời điểm','Nguyên liệu','Đơn vị','Giá cũ','Giá mới','Thay đổi','Thay đổi %','Công thức bị ảnh hưởng','Sản phẩm bị ảnh hưởng','Ảnh hưởng cost/lợi nhuận']];
    rows.forEach(h=>{
      const products=h.affectedProducts||[];
      const impact=products.map(p=>`${p.name}: cost ${p.costDelta>=0?'+':''}${Math.round(p.costDelta)}đ; lợi nhuận ${p.profitDelta>=0?'+':''}${Math.round(p.profitDelta)}đ`).join(' | ');
      out.push([new Date(h.date).toLocaleString('vi-VN'),h.ingredientName,h.unit,h.oldPrice,h.newPrice,h.delta,`${h.deltaPct.toFixed(2)}%`,h.affectedRecipes.map(r=>r.name).join(' | '),products.map(p=>p.name).join(' | '),impact]);
    });
    const csv='\ufeff'+out.map(r=>r.map(esc).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`bien-dong-gia-${today()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Đã xuất danh sách thay đổi');
  }
  function r3ChangesModal(){
    const rows=r3AllChanges();
    openModal(`<h2>Biến động giá</h2>
      <div class="toolbar"><button class="btn primary" onclick="r3ExportChanges()">⬇ Xuất danh sách thay đổi</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Thời điểm</th><th>Nguyên liệu</th><th class="num">Giá cũ</th><th class="num">Giá mới</th><th class="num">Thay đổi</th><th>Ảnh hưởng</th><th></th></tr></thead><tbody>
      ${rows.map(h=>`<tr><td>${fmtDate(h.date)}</td><td><b>${h.ingredientName}</b></td><td class="num">${money(h.oldPrice)}/${h.unit}</td><td class="num">${money(h.newPrice)}/${h.unit}</td><td class="num"><span class="badge ${h.delta>0?'warn':'info'}">${h.delta>0?'+':''}${money(h.delta)} (${h.deltaPct>=0?'+':''}${h.deltaPct.toFixed(1)}%)</span></td><td>${h.affectedRecipes.length} công thức · ${h.affectedProducts.length} sản phẩm</td><td class="num"><button class="btn small" onclick="r3ImpactModal('${h.id}')">Xem ảnh hưởng</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Chưa có thay đổi giá.</td></tr>'}</tbody></table></div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function r3IngredientRowActions(i){
    return `<button class="btn small" onclick="ingredientModal('${i.id}')">Sửa</button> <button class="btn small" onclick="impactModal('${i.id}')">Ảnh hưởng</button> <button class="btn small" onclick="r3PriceHistoryModal('${i.id}')">Lịch sử giá</button>`;
  }
  function r3UnreadPriceAlerts(){
    return db.priceAlerts.filter(a=>a.read!==true);
  }
  function r3MarkPriceAlertsRead(ids){
    const set=new Set(ids||[]);
    if(!set.size)return;
    const now=new Date().toISOString();
    db.priceAlerts.forEach(a=>{
      if(set.has(a.id)&&a.read!==true){a.read=true;a.readAt=now;}
    });
    save();
  }
  function r3UnreadAlertsModal(){
    const rows=r3UnreadPriceAlerts().sort((a,b)=>b.date.localeCompare(a.date));
    if(!rows.length){
      openModal(`<h2>Cảnh báo ảnh hưởng</h2><div class="empty">Không có cảnh báo mới. Mọi thay đổi đã được xem. 🎉</div><div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
      return;
    }
    openModal(`<h2>Cảnh báo ảnh hưởng</h2>
      <p style="color:var(--muted)">Đây là các ảnh hưởng mới chưa xem. Lịch sử biến động giá vẫn được giữ nguyên.</p>
      <div class="list">${rows.map(r3ClickableAlert).join('')}</div>
      <div class="modal-actions"><button class="btn" onclick="r3FinishUnreadAlertsView()">Đã xem</button><button class="btn primary" onclick="r3FinishUnreadAlertsView()">Đóng</button></div>`);
  }
  function r3FinishUnreadAlertsView(){
    const ids=r3UnreadPriceAlerts().map(a=>a.id);
    r3MarkPriceAlertsRead(ids);
    closeModal();
    render('ingredients');
    toast('Đã đánh dấu các cảnh báo ảnh hưởng là đã xem');
  }
  function ingredientsRound3(){
    const changes=r3AllChanges();
    return `<div class="page-head"><div><h1>Nguyên liệu</h1><p>Giá chuẩn, lịch sử giá và những gì sẽ bị ảnh hưởng khi giá thay đổi.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="r3ChangesModal()">📈 Biến động giá</button><button class="btn primary" onclick="ingredientModal()">+ Thêm nguyên liệu</button></div></div>
      <div class="grid stats" style="margin-bottom:16px">
        <div class="card stat"><div class="label">Thay đổi giá đã ghi nhận</div><div class="value">${num(changes.length)}</div><div class="sub">Tất cả lần tăng/giảm giá chuẩn</div></div>
        <div class="card stat"><div class="label">Giá đang tăng</div><div class="value">${num(changes.filter(x=>x.delta>0).length)}</div><div class="sub">Lần tăng giá</div></div>
        <div class="card stat"><div class="label">Giá đang giảm</div><div class="value">${num(changes.filter(x=>x.delta<0).length)}</div><div class="sub">Lần giảm giá</div></div>
        <button class="card stat" style="text-align:left;border:1px solid var(--line);cursor:pointer" onclick="r3UnreadAlertsModal()"><div class="label">Cảnh báo ảnh hưởng chưa xem</div><div class="value">${num(r3UnreadPriceAlerts().length)}</div><div class="sub">${r3UnreadPriceAlerts().length?'Bấm để xem các ảnh hưởng mới':'Không có cảnh báo mới'}</div></button>
      </div>
      <div class="card"><div class="toolbar"><input class="search" id="ingSearch" placeholder="Tìm nguyên liệu..." oninput="filterTable('ingSearch','ingTable')"></div>
      <div class="table-wrap"><table class="table" id="ingTable"><thead><tr><th>Tên</th><th>Nhóm</th><th>Đơn vị</th><th class="num">Quy cách</th><th class="num">Giá mua</th><th class="num">Giá / đơn vị</th><th></th></tr></thead><tbody>${db.ingredients.map(i=>`<tr><td><b>${i.name}</b></td><td>${i.group}</td><td>${i.unit}</td><td class="num">${num(i.pack)} ${i.packUnit}</td><td class="num">${money(i.price)}</td><td class="num">${money(standardPricePerUnit(i))}</td><td class="num">${r3IngredientRowActions(i)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function r3ClickableAlert(a){
    let action='';
    if(a.productId) action=`onclick="priceGuideModal('${a.productId}')"`;
    else if(a.affectedRecipes?.length) action=`onclick="recipeDetailModal('${a.affectedRecipes[0]}')"`;
    const unread=a.read!==true&&a.ingredientId;
    return `<div class="alert ${a.type}" style="cursor:${action?'pointer':'default'};${unread?'border:1px solid #f0c56a;':''}" ${action}>
      <div style="font-size:20px">${a.type==='warn'?'🟠':a.type==='danger'?'🔴':'🔵'}</div>
      <div style="flex:1"><b>${a.title}</b>${unread?'<span class="badge warn" style="margin-left:8px">Mới</span>':''}<div style="margin-top:3px;font-size:13px">${a.detail}</div>${action?'<div style="font-size:11px;color:var(--muted);margin-top:6px">Nhấn để mở phần bị ảnh hưởng →</div>':''}</div>
    </div>`;
  }
  function alertsPageRound3(){
    const base=typeof alertsRound2==='function'?alertsRound2():[];
    const priceAlerts=db.priceAlerts.slice().sort((a,b)=>b.date.localeCompare(a.date));
    const all=[...priceAlerts,...base];
    return `<div class="page-head"><div><h1>Cảnh báo</h1><p>Giá nguyên liệu thay đổi sẽ được giải thích thành ảnh hưởng tới cost và lợi nhuận.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="r3UnreadAlertsModal()">🔔 Cảnh báo mới (${r3UnreadPriceAlerts().length})</button><button class="btn" onclick="r3ChangesModal()">📈 Xem biến động giá</button></div></div>
      <div class="card">${all.map(r3ClickableAlert).join('')||'<div class="empty">Mọi thứ đang ổn 🎉</div>'}</div>`;
  }

  window.unitInfo=unitInfo;window.unitOptions=unitOptions;window.convertQty=convertQty;window.standardPricePerUnit=standardPricePerUnit;window.priceInUnit=priceInUnit;
  window.impactedProducts=impactedProducts;window.ingredientImpactHtml=ingredientImpactHtml;window.impactModal=impactModal;
  window.ingredients=ingredients;window.ingredientModal=ingredientModal;window.updateIngredientUnitHint=updateIngredientUnitHint;window.saveIngredientV21=saveIngredientV21;
  window.batchModal=batchModal;window.populateBatchUnits=populateBatchUnits;window.syncBatchV21=syncBatchV21;window.saveBatchV21=saveBatchV21;
  window.r3RecipeUsesIngredient=r3RecipeUsesIngredient;window.r3AffectedRecipes=r3AffectedRecipes;window.r3AffectedProducts=r3AffectedProducts;window.r3ProductCostDelta=r3ProductCostDelta;window.r3RecipeCostDelta=r3RecipeCostDelta;window.r3RecordPriceChange=r3RecordPriceChange;
  window.r3PriceHistoryForIngredient=r3PriceHistoryForIngredient;window.r3PriceHistoryModal=r3PriceHistoryModal;window.r3ImpactModal=r3ImpactModal;window.r3AllChanges=r3AllChanges;window.r3ExportChanges=r3ExportChanges;window.r3ChangesModal=r3ChangesModal;window.r3IngredientRowActions=r3IngredientRowActions;
  window.r3UnreadPriceAlerts=r3UnreadPriceAlerts;window.r3MarkPriceAlertsRead=r3MarkPriceAlertsRead;window.r3UnreadAlertsModal=r3UnreadAlertsModal;window.r3FinishUnreadAlertsView=r3FinishUnreadAlertsView;window.ingredientsRound3=ingredientsRound3;window.r3ClickableAlert=r3ClickableAlert;window.alertsPageRound3=alertsPageRound3;

  function setActive(){const t=document.getElementById('topTitle');if(t)t.textContent='Nguyên liệu';document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='ingredients'));}
  function renderIngredients(){const v=document.getElementById('view');if(v)v.innerHTML=ingredientsRound3();setActive();}
  function saveQuickIngredient(){const before=window.__v10RecipeDraft;const x={id:id(),name:f('qiName').trim(),group:f('qiGroup'),unit:f('qiUnit'),pack:+f('qiPack'),packUnit:f('qiPackUnit'),price:+f('qiPrice')};const q=convertQty(x.pack,x.packUnit,x.unit);if(!x.name||!x.pack||!q||x.price<0){toast('Vui lòng kiểm tra thông tin nguyên liệu');return}db.ingredients.push(x);save();toast('Đã tạo nguyên liệu');closeModal();if(before&&window.FNB_RECIPE_UI?.restoreRecipeDraft)window.FNB_RECIPE_UI.restoreRecipeDraft(before);window.__v10RecipeDraft=null;}
  function deleteIngredient(iid){const ing=(db.ingredients||[]).find(i=>i.id===iid);if(!ing){toast('Không tìm thấy nguyên liệu');return}const recipeRefs=(db.recipes||[]).filter(r=>(r.lines||[]).some(l=>l.kind==='ingredient'&&l.ingredientId===iid));const batchRefs=(db.batches||[]).filter(b=>b.ingredientId===iid);const inventoryRefs=(db.inventoryHistory||[]).filter(h=>h.ingredientId===iid);const receiptRefs=(db.purchaseReceipts||[]).filter(r=>(r.items||[]).some(x=>x.ingredientId===iid));if(recipeRefs.length||batchRefs.length||inventoryRefs.length||receiptRefs.length){const parts=[];if(recipeRefs.length)parts.push(recipeRefs.length+' công thức');if(batchRefs.length)parts.push(batchRefs.length+' lô kho');if(inventoryRefs.length)parts.push(inventoryRefs.length+' giao dịch kho');if(receiptRefs.length)parts.push(receiptRefs.length+' phiếu nhập');toast('Không thể xóa: nguyên liệu đang được dùng trong '+parts.join(', '));return}if(!confirm('Xóa nguyên liệu “'+ing.name+'”?'))return;db.ingredients=db.ingredients.filter(i=>i.id!==iid);save();renderIngredients();toast('Đã xóa nguyên liệu');}
  window.FNB_INGREDIENTS_UI={renderIngredients,saveQuickIngredient,deleteIngredient};window.saveQuickIngredient=saveQuickIngredient;window.deleteIngredient=deleteIngredient;
})();
