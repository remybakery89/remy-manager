/* F&B Manager V10 — ingredient unit UX patch
   Keep one unit selector for an ingredient. The purchase specification uses
   the same unit as the ingredient usage/storage unit. Existing records are
   normalized to that unit when edited, preserving the represented quantity.
*/
(function(){
  'use strict';

  // Add the missing length measurement group without replacing existing groups.
  UNIT_GROUPS.length={m:1,dm:0.1,cm:0.01};

  const COMMON=['g','kg','mg','ml','l','m','dm','cm','cái','hộp','gói','chai','lon','quả','chiếc'];
  window.unitOptions=function(selected){
    return COMMON.map(u=>`<option value="${u}" ${String(u)===String(selected)?'selected':''}>${u}</option>`).join('');
  };

  window.ingredientModal=function(editId){
    const original=db.ingredients.find(i=>i.id===editId);
    const fallback={name:'',group:'Nguyên liệu',unit:'g',pack:1000,packUnit:'g',price:0};
    const x=original||fallback;
    let displayPack=Number(x.pack)||0;
    if(original && x.packUnit && x.unit && x.packUnit!==x.unit){
      const converted=convertQty(displayPack,x.packUnit,x.unit);
      if(converted!=null) displayPack=converted;
    }
    openModal(`<h2>${editId?'Sửa':'Thêm'} nguyên liệu</h2><div class="form-grid">
      <div class="field full"><label>Tên nguyên liệu</label><input id="fName" value="${x.name||''}"></div>
      <div class="field"><label>Nhóm</label><select id="fGroup"><option ${x.group==='Nguyên liệu'?'selected':''}>Nguyên liệu</option><option ${x.group==='Bao bì'?'selected':''}>Bao bì</option></select></div>
      <div class="field"><label>Đơn vị</label><select id="fUnit">${unitOptions(x.unit||'g')}</select></div>
      <div class="field"><label>Quy cách mua</label><input id="fPack" type="number" min="0" step="0.001" value="${displayPack}"></div>
      <div class="field full"><label>Giá mua / quy cách</label><input id="fPrice" type="number" min="0" step="0.01" value="${x.price||0}"></div>
    </div><div id="ingredientUnitHint" class="alert info" style="margin-top:14px"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveIngredientV21('${editId||''}')">Lưu</button></div>`);

    let lastUnit=x.unit||'g';
    const syncPackUnit=function(){
      const next=f('fUnit'), pack=+f('fPack')||0;
      if(next!==lastUnit){
        const converted=convertQty(pack,lastUnit,next);
        if(converted!=null){fEl('fPack').value=String(Number(converted.toFixed(6)));}
        lastUnit=next;
      }
      updateIngredientUnitHint();
    };
    updateIngredientUnitHint();
    ['fUnit'].forEach(k=>document.getElementById(k)?.addEventListener('change',syncPackUnit));
    ['fPack','fPrice'].forEach(k=>document.getElementById(k)?.addEventListener('input',updateIngredientUnitHint));
  };

  window.updateIngredientUnitHint=function(){
    const pack=+f('fPack')||0, price=+f('fPrice')||0, unit=f('fUnit');
    const el=document.getElementById('ingredientUnitHint');
    if(!el)return;
    el.innerHTML=`Một quy cách = <b>${num(pack)} ${unit}</b> · Giá chuẩn = <b>${money(pack?price/pack:0)}/${unit}</b>`;
  };

  const saveOriginal=window.saveIngredientV21;
  window.saveIngredientV21=function(eid){
    // The single visible unit is canonical for both usage and purchase specification.
    const unit=f('fUnit'), pack=+f('fPack')||0;
    if(!unit||pack<=0){toast('Vui lòng kiểm tra đơn vị và quy cách');return}
    const old=db.ingredients.find(i=>i.id===eid);
    const oldUnit=old?standardPricePerUnit(old):0;
    const x={id:eid||id(),name:f('fName'),group:f('fGroup'),unit,pack,packUnit:unit,price:+f('fPrice')||0};
    if(!x.name||x.price<0){toast('Vui lòng kiểm tra tên và giá');return}
    const newUnit=standardPricePerUnit(x);
    const priceChanged=!!old&&Math.abs(newUnit-oldUnit)>1e-12;
    if(eid&&old&&priceChanged){
      const delta=newUnit-oldUnit;
      const items=impactedProducts(eid);
      const list=items.map(p=>{
        const z=productCostBreakdown(p).find(y=>y.ingredientId===eid);
        return `${p.name}: ${delta>=0?'+':''}${money((z?.qty||0)*delta)}`;
      }).join('\n')||'Không có sản phẩm bị ảnh hưởng';
      if(!confirm(`Giá chuẩn thay đổi ${delta>=0?'+':''}${money(delta)}/${unit}.\n\nẢnh hưởng dự kiến:\n${list}\n\nLưu thay đổi?`))return;
    }
    if(eid){db.ingredients[db.ingredients.findIndex(i=>i.id===eid)]=x;}else db.ingredients.push(x);
    if(priceChanged&&typeof r3RecordPriceChange==='function') r3RecordPriceChange(x,oldUnit,newUnit,old.unit,x.unit);
    save();closeModal();render('ingredients');toast(priceChanged?'Đã lưu · Đã ghi nhận biến động giá':'Đã lưu nguyên liệu');
  };
})();
