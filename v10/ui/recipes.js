/* F&B Manager V10 — Recipes domain UI
   Phase 8: Ingredients + Recipes domain extracted
   Canonical recipe/cost/version logic now lives here.
   Shared db/runtime helpers remain supplied by the existing app runtime.
*/
(function(){
  'use strict';

  function recipeLineEffectiveQty(l){
    const q=Number(l.qty)||0, w=Math.min(99.99,Math.max(0,Number(l.wastePct)||0))/100;
    return w>=1?q:q/(1-w);
  }
  function recipeStandardCost(r, seen=[]){
    if(!r || seen.includes(r.id)) return 0;
    const next=[...seen,r.id];
    return (r.lines||[]).reduce((s,l)=>{
      if(l.kind==='recipe'){
        const child=db.recipes.find(x=>x.id===l.recipeId);
        return s+(child?recipeStandardCost(child,next)*(Number(l.qty)||0):0);
      }
      const ing=db.ingredients.find(x=>x.id===l.ingredientId);
      return s+(ing?standardPricePerUnit(ing)*recipeLineEffectiveQty(l):0);
    },0);
  }
  function recipeLeafNeeds(r,mult=1,seen=[]){
    if(!r||seen.includes(r.id)) return {};
    const out={}, next=[...seen,r.id];
    (r.lines||[]).forEach(l=>{
      if(l.kind==='recipe'){
        const child=db.recipes.find(x=>x.id===l.recipeId);
        const childNeeds=recipeLeafNeeds(child,mult*(Number(l.qty)||0),next);
        Object.entries(childNeeds).forEach(([iid,q])=>out[iid]=(out[iid]||0)+q);
      }else if(l.ingredientId){
        out[l.ingredientId]=(out[l.ingredientId]||0)+mult*recipeLineEffectiveQty(l);
      }
    });
    return out;
  }
  function recipeTheoreticalCost(r){return recipeStandardCost(r)}
  function recipeEffectiveYield(r){const y=Number(r?.yield)||0,w=Math.min(99.99,Math.max(0,Number(r?.wastePct)||0))/100;return y*(1-w)}
  function recipeCostPerYield(r){const y=recipeEffectiveYield(r);return y?recipeTheoreticalCost(r)/y:0}
  function productCost(p){
    return (p.components||[]).reduce((s,c)=>{
      const r=db.recipes.find(x=>x.id===c.recipeId);
      return s+(r?(recipeTheoreticalCost(r)/recipeEffectiveYield(r)*Number(c.qty||0)):0);
    },0);
  }
  function productCostBreakdown(p){
    const out=[];
    (p.components||[]).forEach(c=>{
      const r=db.recipes.find(x=>x.id===c.recipeId); if(!r)return;
      const leaves=recipeLeafNeeds(r,Number(c.qty||0));
      Object.entries(leaves).forEach(([iid,qty])=>{
        const ing=db.ingredients.find(x=>x.id===iid); if(!ing)return;
        out.push({ingredientId:iid,name:ing.name,qty,unit:ing.unit,cost:standardPricePerUnit(ing)*qty});
      });
    });
    const map={};out.forEach(x=>{if(!map[x.ingredientId])map[x.ingredientId]={...x};else{map[x.ingredientId].qty+=x.qty;map[x.ingredientId].cost+=x.cost}});
    return Object.values(map);
  }
  function cloneRecipe(id0){
    const r=db.recipes.find(x=>x.id===id0); if(!r)return;
    const copy=JSON.parse(JSON.stringify(r));
    copy.id=id(); copy.name=r.name+' - Bản sao'; copy.version=1; copy.history=[]; copy.updatedAt=new Date().toISOString();
    db.recipes.push(copy);save();render('recipes');toast('Đã nhân bản công thức');
  }
  function recipeSnapshot(r){return JSON.parse(JSON.stringify({id:r.id,name:r.name,yield:r.yield,wastePct:r.wastePct,processTemp:r.processTemp,processTime:r.processTime,notes:r.notes,lines:r.lines,version:r.version,updatedAt:r.updatedAt}))}
  function recipeVersionData(rid, version){
    const r=db.recipes.find(x=>x.id===rid);if(!r)return null;
    if(Number(version)===Number(r.version||1)) return recipeSnapshot(r);
    return (r.history||[]).find(h=>Number(h.version)===Number(version))||null;
  }
  function recipeDetailModal(rid, version){
    const r=db.recipes.find(x=>x.id===rid);if(!r)return;
    const currentVersion=Number(r.version)||1;
    const data=recipeVersionData(rid, version||currentVersion);if(!data)return;
    const selectedVersion=Number(data.version)||currentVersion;
    const versions=[{version:currentVersion,label:`v${currentVersion} — Hiện tại`,data:recipeSnapshot(r)},...(r.history||[]).map(h=>({version:Number(h.version)||1,label:`v${h.version}`,data:h}))]
      .filter((v,i,a)=>a.findIndex(x=>x.version===v.version)===i)
      .sort((a,b)=>b.version-a.version);
    const lines=data.lines||[];
    const cost=recipeStandardCost(data);
    const effectiveYield=recipeEffectiveYield(data);
    openModal(`<h2>${data.name||r.name} <span class="badge info">v${selectedVersion}</span></h2>
      <div class="toolbar" style="margin-bottom:16px"><label style="font-size:12px;font-weight:800;color:var(--muted);display:flex;align-items:center;gap:8px">Xem phiên bản
        <select id="recipeVersionSelect" onchange="recipeDetailModal('${rid}',this.value)">${versions.map(v=>`<option value="${v.version}" ${v.version===selectedVersion?'selected':''}>${v.label}</option>`).join('')}</select>
      </label></div>
      <div class="grid two">
        <div class="card" style="box-shadow:none"><div class="section-title">Tổng quan</div>
          <div class="list-item row"><span>Yield chuẩn</span><b>${num(data.yield)}</b></div>
          <div class="list-item row"><span>Yield sau hao hụt</span><b>${num(effectiveYield)}</b></div>
          <div class="list-item row"><span>Hao hụt công thức</span><b>${num(data.wastePct||0)}%</b></div>
          <div class="list-item row"><span>Cost chuẩn</span><b>${money(cost)}</b></div>
          <div class="list-item row"><span>Cost / yield thực dùng</span><b style="color:var(--green)">${money(effectiveYield?cost/effectiveYield:0)}</b></div>
        </div>
        <div class="card" style="box-shadow:none"><div class="section-title">Thông số & ghi chú</div>
          <div class="list-item"><b>Nhiệt độ / thông số</b><div style="margin-top:5px;color:var(--muted)">${data.processTemp||'—'}</div></div>
          <div class="list-item"><b>Thời gian</b><div style="margin-top:5px;color:var(--muted)">${data.processTime||'—'}</div></div>
          <div class="list-item"><b>Ghi chú / quy trình</b><div style="margin-top:5px;white-space:pre-wrap;color:var(--muted)">${data.notes||'—'}</div></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;box-shadow:none"><div class="section-title">Thành phần</div><div class="table-wrap"><table class="table"><thead><tr><th>Loại</th><th>Tên</th><th class="num">Lượng</th><th class="num">Hao hụt</th><th class="num">Lượng tính cost</th><th class="num">Cost</th></tr></thead><tbody>${lines.map(l=>{
        if(l.kind==='recipe'){
          const child=db.recipes.find(x=>x.id===l.recipeId), qty=Number(l.qty)||0, c=child?recipeStandardCost(child)*qty:0;
          return `<tr><td><span class="badge info">Công thức con</span></td><td><b>${child?.name||'—'}</b></td><td class="num">${num(qty)} batch</td><td class="num">—</td><td class="num">${num(qty)} batch</td><td class="num">${money(c)}</td></tr>`;
        }
        const ing=db.ingredients.find(x=>x.id===l.ingredientId), qty=Number(l.qty)||0, eff=recipeLineEffectiveQty(l), c=ing?standardPricePerUnit(ing)*eff:0;
        return `<tr><td><span class="badge info">Nguyên liệu</span></td><td><b>${ing?.name||'—'}</b></td><td class="num">${num(qty)} ${ing?.unit||''}</td><td class="num">${num(l.wastePct||0)}%</td><td class="num">${num(eff)} ${ing?.unit||''}</td><td class="num">${money(c)}</td></tr>`;
      }).join('')||'<tr><td colspan="6" class="empty">Chưa có thành phần.</td></tr>'}</tbody></table></div></div>
      <div class="modal-actions"><button class="btn" onclick="recipeHistoryModal('${rid}')">Lịch sử phiên bản</button><button class="btn" onclick="closeModal()">Đóng</button>${selectedVersion===currentVersion?`<button class="btn primary" onclick="recipeModal('${rid}')">Chỉnh sửa</button>`:''}</div>`);
  }
  function recipeHistoryModal(rid){
    const r=db.recipes.find(x=>x.id===rid);if(!r)return;
    const rows=[recipeSnapshot(r),...(r.history||[])].sort((a,b)=>Number(b.version||0)-Number(a.version||0));
    openModal(`<h2>Lịch sử: ${r.name}</h2><p style="color:var(--muted)">Mỗi lần lưu thay đổi sẽ tạo một phiên bản mới. Bạn có thể mở bất kỳ phiên bản nào để xem lại đầy đủ dữ liệu.</p>
    <div class="table-wrap"><table class="table"><thead><tr><th>Phiên bản</th><th>Thời điểm</th><th>Yield</th><th>Hao hụt</th><th>Ghi chú</th><th></th></tr></thead><tbody>${rows.map(h=>`<tr><td><b>v${h.version}</b>${Number(h.version)===Number(r.version)?' <span class="badge ok">Hiện tại</span>':''}</td><td>${fmtDate(h.updatedAt)}</td><td>${num(h.yield)}</td><td>${num(h.wastePct||0)}%</td><td>${h.notes?'Có ghi chú/quy trình':'—'}</td><td class="num"><button class="btn small" onclick="recipeDetailModal('${rid}',${Number(h.version)})">Xem</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Chưa có phiên bản.</td></tr>'}</tbody></table></div>
    <div class="modal-actions"><button class="btn" onclick="recipeDetailModal('${rid}',${Number(r.version)||1})">Quay lại chi tiết</button><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function quickIngredientModal(){
    openModal(`<h2>Thêm nguyên liệu nhanh</h2><p style="color:var(--muted);margin-top:-8px">Tạo nguyên liệu ngay khi đang làm công thức.</p>
    <div class="form-grid"><div class="field full"><label>Tên nguyên liệu</label><input id="qiName"></div><div class="field"><label>Nhóm</label><select id="qiGroup"><option>Nguyên liệu</option><option>Bao bì</option></select></div><div class="field"><label>Đơn vị sử dụng</label><select id="qiUnit">${unitOptions('g')}</select></div><div class="field"><label>Quy cách mua</label><input id="qiPack" type="number" value="1000"></div><div class="field"><label>Đơn vị quy cách</label><select id="qiPackUnit">${unitOptions('g')}</select></div><div class="field full"><label>Giá mua / quy cách</label><input id="qiPrice" type="number" value="0"></div></div>
    <div class="modal-actions"><button class="btn" onclick="recipeModal(editingRecipeId)">Quay lại công thức</button><button class="btn primary" onclick="saveQuickIngredient()">Tạo nguyên liệu</button></div>`);
  }
  function recipeModal(editId){
    editingRecipeId=editId||'';
    const x=db.recipes.find(r=>r.id===editId)||{name:'',yield:1,wastePct:0,notes:'',processTemp:'',processTime:'',lines:[{kind:'ingredient',ingredientId:db.ingredients[0]?.id||'',qty:0,wastePct:0}],version:1,history:[]};
    openModal(`<h2>${editId?'Sửa':'Tạo'} công thức ${editId?`<span class="badge info">v${x.version||1}</span>`:''}</h2>
    <div class="form-grid"><div class="field full"><label>Tên công thức</label><input id="rName" value="${x.name||''}"></div><div class="field"><label>Yield / sản lượng chuẩn</label><input id="rYield" type="number" min="0.0001" step="0.01" value="${x.yield||1}"></div><div class="field"><label>Hao hụt chuẩn của công thức (%)</label><input id="rWaste" type="number" min="0" max="99.99" step="0.01" value="${x.wastePct||0}"></div><div class="field"><label>Nhiệt độ / thông số</label><input id="rTemp" value="${x.processTemp||''}" placeholder="VD: 170°C"></div><div class="field"><label>Thời gian</label><input id="rTime" value="${x.processTime||''}" placeholder="VD: 35 phút"></div><div class="field full"><label>Ghi chú / quy trình</label><textarea id="rNotes" rows="3">${x.notes||''}</textarea></div></div>
    <div style="margin-top:18px"><div class="row"><b>Thành phần</b><button class="btn small" onclick="quickIngredientModal()">+ Nguyên liệu mới</button><button class="btn small" onclick="addRecipeLineV31()">+ Thêm dòng</button></div><div id="recipeLines" style="margin-top:10px">${(x.lines||[]).map((l,i)=>recipeLineV31(l,i)).join('')}</div></div>
    <div class="alert info" style="margin-top:14px">Cost chuẩn dùng giá chuẩn nguyên liệu. Hao hụt từng dòng được tính vào lượng cần chuẩn bị; công thức con được tính vào cost và tự bung ra nguyên liệu khi sản xuất.</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Hủy</button>${editId?`<button class="btn" onclick="recipeHistoryModal('${editId}')">Lịch sử</button>`:''}<button class="btn primary" onclick="saveRecipeV31('${editId||''}')">Lưu công thức</button></div>`);
  }
  function recipeLineV31(l,i){
    const kind=l.kind||'ingredient';
    const refs=kind==='recipe'?db.recipes.filter(r=>r.id!==editingRecipeId):db.ingredients;
    return `<div class="recipe-line" style="grid-template-columns:1fr 1.5fr .75fr .65fr auto"><div class="field"><label>Loại</label><select class="rl-kind" onchange="refreshRecipeLineV31(this)"><option value="ingredient" ${kind==='ingredient'?'selected':''}>Nguyên liệu</option><option value="recipe" ${kind==='recipe'?'selected':''}>Công thức con</option></select></div><div class="field"><label>${kind==='recipe'?'Công thức':'Nguyên liệu'}</label><select class="rl-ref">${refs.map(r=>`<option value="${r.id}" ${((kind==='recipe'?l.recipeId:l.ingredientId)===r.id)?'selected':''}>${r.name}</option>`).join('')}</select></div><div class="field"><label>${kind==='recipe'?'Số batch':'Lượng'}</label><input class="rl-qty" type="number" min="0" step="0.0001" value="${l.qty||0}"></div><div class="field"><label>Hao hụt %</label><input class="rl-waste" type="number" min="0" max="99.99" step="0.01" value="${l.wastePct||0}" ${kind==='recipe'?'disabled':''}></div><button class="btn remove" onclick="this.parentElement.remove()">×</button></div>`;
  }
  function refreshRecipeLineV31(sel){
    const row=sel.closest('.recipe-line'),kind=sel.value;
    const ref=row.querySelector('.rl-ref'),labels=row.querySelectorAll('label'),waste=row.querySelector('.rl-waste');
    labels[1].textContent=kind==='recipe'?'Công thức':'Nguyên liệu';labels[2].textContent=kind==='recipe'?'Số batch':'Lượng';
    const refs=kind==='recipe'?db.recipes.filter(r=>r.id!==editingRecipeId):db.ingredients;
    ref.innerHTML=refs.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    waste.disabled=kind==='recipe';if(kind==='recipe')waste.value=0;
  }
  function addRecipeLineV31(){document.getElementById('recipeLines').insertAdjacentHTML('beforeend',recipeLineV31({kind:'ingredient',ingredientId:db.ingredients[0]?.id||'',qty:0,wastePct:0},Date.now()))}
  function hasRecipeCycle(recipeId,lines){
    const graph={};db.recipes.forEach(r=>graph[r.id]=(r.lines||[]).filter(l=>l.kind==='recipe').map(l=>l.recipeId));graph[recipeId]=(lines||[]).filter(l=>l.kind==='recipe').map(l=>l.recipeId);
    const seen=new Set(),stack=new Set();
    function dfs(n){if(stack.has(n))return true;if(seen.has(n))return false;seen.add(n);stack.add(n);for(const c of graph[n]||[])if(c===recipeId||dfs(c))return true;stack.delete(n);return false}
    return dfs(recipeId);
  }
  function saveRecipeV31(eid){
    const lines=[...document.querySelectorAll('#recipeLines .recipe-line')].map(row=>{const kind=row.querySelector('.rl-kind').value,ref=row.querySelector('.rl-ref').value,qty=+row.querySelector('.rl-qty').value||0,waste=+row.querySelector('.rl-waste').value||0;return kind==='recipe'?{kind,recipeId:ref,qty}:{kind,ingredientId:ref,qty,wastePct:waste}}).filter(x=>x.qty>0);
    const name=f('rName').trim(),yieldQty=+f('rYield'),wastePct=Math.min(99.99,Math.max(0,+f('rWaste')||0));
    if(!name||!yieldQty||!lines.length){toast('Vui lòng nhập tên, yield và thành phần');return}
    if(eid&&hasRecipeCycle(eid,lines)){toast('Không thể lưu: công thức con tạo vòng lặp');return}
    const old=db.recipes.find(r=>r.id===eid);
    const x={id:eid||id(),name,yield:yieldQty,wastePct,processTemp:f('rTemp'),processTime:f('rTime'),notes:f('rNotes'),lines,version:old?(Number(old.version)||1)+1:1,history:old?(old.history||[]).concat([recipeSnapshot(old)]):[],updatedAt:new Date().toISOString()};
    if(eid)db.recipes[db.recipes.findIndex(r=>r.id===eid)]=x;else db.recipes.push(x);
    save();closeModal();render('recipes');toast(old?`Đã lưu công thức · v${x.version}`:'Đã tạo công thức');
  }
  function recipes(){
    return `<div class="page-head"><div><h1>Công thức</h1><p>Định lượng, yield, công thức con và giá vốn chuẩn.</p></div><button class="btn primary" onclick="recipeModal()">+ Tạo công thức</button></div>
    <div class="grid three">${db.recipes.map(r=>{const cost=recipeTheoreticalCost(r),nested=(r.lines||[]).filter(l=>l.kind==='recipe').length;return `<div class="card recipe-card" style="cursor:pointer" onclick="recipeDetailModal('${r.id}')" title="Bấm để xem chi tiết công thức"><div class="row"><div><h3 style="margin:0">${r.name}</h3><div style="color:var(--muted);font-size:13px;margin-top:4px">v${r.version||1} · Yield: ${num(r.yield)} · Yield sau hao hụt: ${num(recipeEffectiveYield(r))} · Hao hụt: ${num(r.wastePct||0)}%</div></div><span class="badge info">${r.lines.length} dòng</span></div><hr style="border:0;border-top:1px solid var(--line);margin:15px 0"><div class="row"><span>Cost chuẩn</span><b>${money(cost)}</b></div><div class="row" style="margin-top:8px"><span>Cost / yield</span><b style="color:var(--green)">${money(recipeCostPerYield(r))}</b></div><div style="font-size:12px;color:var(--muted);margin-top:8px">${nested?nested+' công thức con · ':''}${r.processTemp||r.processTime?'Có thông số sản xuất · ':''}${r.notes?'Có ghi chú/quy trình':''}</div><div style="margin-top:15px;display:flex;gap:7px;flex-wrap:wrap"><button class="btn small" onclick="event.stopPropagation();recipeModal('${r.id}')">Chỉnh sửa</button><button class="btn small" onclick="event.stopPropagation();cloneRecipe('${r.id}')">Nhân bản</button><button class="btn small" onclick="event.stopPropagation();recipeHistoryModal('${r.id}')">Lịch sử</button></div></div>`}).join('')}</div>`;
  }
  function recipeLineV1(l,i){
   const kind=l.kind||'ingredient';
   return `<div class="recipe-line"><div class="field"><label>Loại</label><select class="rl-kind" onchange="refreshRecipeLine(this)"><option value="ingredient" ${kind==='ingredient'?'selected':''}>Nguyên liệu</option><option value="recipe" ${kind==='recipe'?'selected':''}>Công thức con</option></select></div><div class="field"><label>${kind==='recipe'?'Công thức':'Nguyên liệu'}</label><select class="rl-ref">${kind==='recipe'?db.recipes.filter(r=>r.id!==f('rId')).map(r=>`<option value="${r.id}" ${r.id===l.recipeId?'selected':''}>${r.name}</option>`).join(''):db.ingredients.map(r=>`<option value="${r.id}" ${r.id===l.ingredientId?'selected':''}>${r.name}</option>`).join('')}</select></div><div class="field"><label>${kind==='recipe'?'Số batch':'Lượng'}</label><input class="rl-qty" type="number" min="0" step="0.0001" value="${l.qty||0}"></div><button class="btn remove" onclick="this.parentElement.remove()">×</button></div>`;
  }
  function refreshRecipeLine(sel){
   const row=sel.closest('.recipe-line'), kind=sel.value, ref=row.querySelector('.rl-ref'), label=row.querySelectorAll('label')[1], qtyLabel=row.querySelectorAll('label')[2];
   label.textContent=kind==='recipe'?'Công thức':'Nguyên liệu';qtyLabel.textContent=kind==='recipe'?'Số batch':'Lượng';
   ref.innerHTML=kind==='recipe'?db.recipes.filter(r=>r.id!==f('rEditId')).map(r=>`<option value="${r.id}">${r.name}</option>`).join(''):db.ingredients.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  }
  function addRecipeLineV1(){document.getElementById('recipeLines').insertAdjacentHTML('beforeend',recipeLineV1({kind:'ingredient',ingredientId:db.ingredients[0]?.id||'',qty:0},Date.now()))}
  function saveRecipeV1(eid){
   const lines=[...document.querySelectorAll('#recipeLines .recipe-line')].map(row=>{const kind=row.querySelector('.rl-kind').value,ref=row.querySelector('.rl-ref').value,qty=+row.querySelector('.rl-qty').value||0;return kind==='recipe'?{kind,recipeId:ref,qty}:{kind,ingredientId:ref,qty}}).filter(x=>x.qty>0);
   if(!f('rName')||!+f('rYield')||!lines.length){toast('Vui lòng nhập tên, yield và thành phần');return}
   const x={id:eid||id(),name:f('rName').trim(),yield:+f('rYield'),wastePct:+f('rWaste')||0,processTemp:f('rTemp'),processTime:f('rTime'),notes:f('rNotes'),lines,updatedAt:new Date().toISOString()};
   if(eid)db.recipes[db.recipes.findIndex(r=>r.id===eid)]=x;else db.recipes.push(x);save();closeModal();render('recipes');toast('Đã lưu công thức');
  }
  function recipeLine(l,i){return `<div class="recipe-line"><div class="field"><label>Nguyên liệu</label><select class="rl-ing">${db.ingredients.map(x=>`<option value="${x.id}" ${x.id===l.ingredientId?'selected':''}>${x.name}</option>`).join('')}</select></div><div class="field"><label>Lượng</label><input class="rl-qty" type="number" value="${l.qty}"></div><div class="field"><label>Đơn vị</label><input value="${db.ingredients.find(x=>x.id===l.ingredientId)?.unit||''}" disabled></div><button class="btn remove" onclick="this.parentElement.remove()">×</button></div>`}
  function addRecipeLine(){document.getElementById('recipeLines').insertAdjacentHTML('beforeend',recipeLine({ingredientId:db.ingredients[0]?.id||'',qty:0},Date.now()))}
  function saveRecipe(eid){let lines=[...document.querySelectorAll('#recipeLines .recipe-line')].map(r=>({ingredientId:r.querySelector('.rl-ing').value,qty:+r.querySelector('.rl-qty').value})).filter(x=>x.qty>0);let x={id:eid||id(),name:f('rName'),yield:+f('rYield'),lines};if(!x.name||!x.yield||!lines.length){toast('Vui lòng nhập tên, yield và nguyên liệu');return}if(eid)db.recipes[db.recipes.findIndex(r=>r.id===eid)]=x;else db.recipes.push(x);save();closeModal();render('recipes');toast('Đã lưu công thức')}

  let editingRecipeId='';
  let recipeReturnDraft=null;

  window.recipeLineEffectiveQty=recipeLineEffectiveQty;
  window.recipeStandardCost=recipeStandardCost;
  window.recipeLeafNeeds=recipeLeafNeeds;
  window.recipeTheoreticalCost=recipeTheoreticalCost;
  window.recipeEffectiveYield=recipeEffectiveYield;
  window.recipeCostPerYield=recipeCostPerYield;
  window.productCost=productCost;
  window.productCostBreakdown=productCostBreakdown;
  window.cloneRecipe=cloneRecipe;
  window.recipeSnapshot=recipeSnapshot;
  window.recipeVersionData=recipeVersionData;
  window.recipeDetailModal=recipeDetailModal;
  window.recipeHistoryModal=recipeHistoryModal;
  window.quickIngredientModal=quickIngredientModal;
  window.recipeModal=recipeModal;
  window.recipeLineV31=recipeLineV31;
  window.refreshRecipeLineV31=refreshRecipeLineV31;
  window.addRecipeLineV31=addRecipeLineV31;
  window.hasRecipeCycle=hasRecipeCycle;
  window.saveRecipeV31=saveRecipeV31;
  window.recipeLineV1=recipeLineV1;
  window.refreshRecipeLine=refreshRecipeLine;
  window.addRecipeLineV1=addRecipeLineV1;
  window.saveRecipeV1=saveRecipeV1;
  window.recipeLine=recipeLine;
  window.addRecipeLine=addRecipeLine;
  window.saveRecipe=saveRecipe;

  function setActive(){const t=document.getElementById('topTitle');if(t)t.textContent='Công thức';document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='recipes'));}
  function renderRecipes(){const v=document.getElementById('view');if(v)v.innerHTML=recipes();setActive();}
  function openRecipe(id){return recipeModal(id||'');}
  function openRecipeDetail(id,version){return recipeDetailModal(id,version);}
  function openRecipeHistory(id){return recipeHistoryModal(id);}
  function captureRecipeDraft(){if(!editingRecipeId&&!document.getElementById('rName'))return null;const rows=[...document.querySelectorAll('#recipeLines .recipe-line')];return {id:editingRecipeId||'',name:document.getElementById('rName')?.value||'',yield:document.getElementById('rYield')?.value||'1',wastePct:document.getElementById('rWaste')?.value||'0',processTemp:document.getElementById('rTemp')?.value||'',processTime:document.getElementById('rTime')?.value||'',notes:document.getElementById('rNotes')?.value||'',lines:rows.map(row=>{const kind=row.querySelector('.rl-kind')?.value||'ingredient';const ref=row.querySelector('.rl-ref')?.value||'';const qty=row.querySelector('.rl-qty')?.value||'0';const waste=row.querySelector('.rl-waste')?.value||'0';return kind==='recipe'?{kind,recipeId:ref,qty:+qty||0}:{kind:'ingredient',ingredientId:ref,qty:+qty||0,wastePct:+waste||0}})}}
  function restoreRecipeDraft(d){if(!d)return;recipeModal(d.id||'');const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val??''};set('rName',d.name);set('rYield',d.yield);set('rWaste',d.wastePct);set('rTemp',d.processTemp);set('rTime',d.processTime);set('rNotes',d.notes);const holder=document.getElementById('recipeLines');if(holder)holder.innerHTML=(d.lines||[]).map((l,i)=>recipeLineV31(l,i)).join('')}
  window.FNB_RECIPE_UI={renderRecipes,openRecipe,openRecipeDetail,openRecipeHistory,cloneRecipe,captureRecipeDraft,restoreRecipeDraft};
  const originalQuick=window.quickIngredientModal;
  if(typeof originalQuick==='function'&&originalQuick!==quickIngredientModal){window.quickIngredientModal=function(){window.__v10RecipeDraft=captureRecipeDraft();return originalQuick()}}
})();
