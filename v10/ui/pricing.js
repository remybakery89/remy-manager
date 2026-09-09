/* F&B Manager V10 — Products/Pricing domain UI
   Phase 8: Products/Pricing domain extracted
   Canonical product renderer/editor and Round 2 pricing helpers now live here.
   Shared runtime/data helpers remain owned by index.html during the staged extraction.
*/
(function(){
  'use strict';

  function componentLine(c){return `<div class="recipe-line"><div class="field"><label>Công thức</label><select class="cp-rec">${db.recipes.map(r=>`<option value="${r.id}" ${r.id===c.recipeId?'selected':''}>${r.name}</option>`).join('')}</select></div><div class="field"><label>Số phần / sản phẩm</label><input class="cp-qty" type="number" step="0.01" value="${c.qty}"></div><div></div><button class="btn remove" onclick="this.parentElement.remove()">×</button></div>`}

  function addComponent(){document.getElementById('components').insertAdjacentHTML('beforeend',componentLine({recipeId:db.recipes[0]?.id||'',qty:1}))}

  function productModalNormalV5(editId){
    const x=db.products.find(p=>p.id===editId)||{name:'',price:0,stock:0,components:[{recipeId:db.recipes[0]?.id||'',qty:1}]};
    openModal(`<h2>${editId?'Sửa':'Thêm'} sản phẩm</h2><div class="form-grid"><div class="field full"><label>Tên sản phẩm</label><input id="pName" value="${escapeHtmlV5(x.name)}"></div><div class="field"><label>Giá bán</label><input id="pPrice" type="number" value="${Number(x.price)||0}"></div><div class="field"><label>Tồn kho hiện tại</label><input id="pStock" type="number" value="${Number(x.stock)||0}"></div></div><div style="margin-top:18px"><div class="row"><b>Công thức cấu thành</b><button class="btn small" onclick="addComponent()">+ Thêm</button></div><div id="components" style="margin-top:10px">${x.components.map(c=>componentLine(c)).join('')}</div></div><div class="modal-actions"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveProductNormalV5('${editId||''}')">Lưu sản phẩm</button></div>`);
  }

  function saveProductNormalV5(eid){
    const comps=[...document.querySelectorAll('#components .recipe-line')].map(r=>({recipeId:r.querySelector('.cp-rec').value,qty:+r.querySelector('.cp-qty').value})).filter(x=>x.qty>0);
    const x={id:eid||id(),name:f('pName').trim(),price:+f('pPrice')||0,stock:+f('pStock')||0,components:comps};
    if(!x.name||!comps.length){toast('Vui lòng nhập tên và công thức');return}
    if(eid)db.products[db.products.findIndex(p=>p.id===eid)]=x;else db.products.push(x);save();closeModal();render('products');toast('Đã lưu sản phẩm');
  }

  function productModal(editId){productModalNormalV5(editId)}

  function productsNormalV5(){
    return `<div class="page-head"><div><h1>Sản phẩm</h1><p>Một sản phẩm có thể gồm nhiều công thức.</p></div><button class="btn primary" onclick="productModalV5()">+ Thêm sản phẩm</button></div>
    <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Sản phẩm</th><th>Cấu thành</th><th class="num">Giá vốn</th><th class="num">Giá bán</th><th class="num">Lợi nhuận</th><th class="num">Tồn</th><th></th></tr></thead><tbody>
    ${db.products.map(p=>{const c=productCost(p),profit=(Number(p.price)||0)-c,margin=p.price?profit/p.price:0;return `<tr><td><b>${escapeHtmlV5(p.name)}</b></td><td>${p.components.map(c=>recipeName(c.recipeId)).join(' + ')}</td><td class="num">${fmtMoney(c)}</td><td class="num">${fmtMoney(p.price)}</td><td class="num">${fmtMoney(profit)} <span class="badge ${margin<.2?'warn':'ok'}">${Math.round(margin*100)}%</span></td><td class="num">${num(p.stock)}</td><td class="num"><button class="btn small" onclick="productModalV5('${p.id}')">Sửa</button></td></tr>`}).join('')}
    </tbody></table></div></div>`;
  }

  function r2(){
    db.settings.r2 = db.settings.r2 || {};
    return db.settings.r2;
  }

  function roundPrice(v){
    const step=Math.max(1,Number(r2().rounding)||1);
    return Math.ceil(Math.max(0,Number(v)||0)/step)*step;
  }

  function r2FixedPerProduct(){
    const units=Math.max(1,Number(r2().expectedMonthlyUnits)||1);
    return (Number(r2().fixedMonthly)||0)/units;
  }

  function r2LaborCost(){
    const s=r2();
    const hourly=Math.max(0,Number(s.laborHourly)||0);
    const minutes=Math.max(0,Number(s.directLaborMinutes)||0);
    // Khi đã khai báo cả giá trị 1 giờ công và thời gian trực tiếp, ưu tiên cách tính này.
    if(hourly>0 && minutes>0) return hourly*minutes/60;
    // Dữ liệu cũ vẫn hoạt động, không bị mất.
    return Math.max(0,Number(s.laborPerProduct)||0);
  }

  function r2Cost(p){
    const recipe=Number(productCost(p))||0;
    const labor=r2LaborCost();
    const utilities=Math.max(0,Number(r2().utilitiesPerProduct)||0);
    const depreciation=Math.max(0,Number(r2().depreciationPerProduct)||0);
    const variable=Math.max(0,Number(r2().variablePerProduct)||0);
    const fixed=r2FixedPerProduct();
    return {recipe,labor,utilities,depreciation,variable,fixed,total:recipe+labor+utilities+depreciation+variable+fixed};
  }

  function r2SuggestedRaw(p){
    const c=r2Cost(p).total;
    const tax=Math.max(0,Number(r2().tax)||0)/100;
    const profit=Math.max(0,Number(r2().profit)||0)/100;
    const denominator=1-tax-profit;
    if(denominator<=0)return Infinity;
    return c/denominator;
  }

  function r2Suggested(p){return roundPrice(r2SuggestedRaw(p))}

  function r2CurrentMargin(p){
    const price=Number(p.price)||0,cost=r2Cost(p).total;
    return price>0?(price-cost)/price*100:0;
  }

  function r2CurrentProfit(p){return (Number(p.price)||0)-r2Cost(p).total}

  function r2PriceStatus(p){
    const current=Number(p.price)||0,suggested=r2Suggested(p),margin=r2CurrentMargin(p),target=Number(r2().profit)||0;
    if(!current)return {type:'danger',label:'Chưa có giá bán'};
    if(!isFinite(suggested))return {type:'danger',label:'Cần kiểm tra mục tiêu'};
    if(current<suggested)return {type:'danger',label:'Giá hiện tại thấp'};
    if(margin<target)return {type:'warn',label:'Lợi nhuận thấp'};
    return {type:'ok',label:'Ổn'};
  }

  function r2CostLines(p){
    const c=r2Cost(p),s=r2();
    const laborNote=(Number(s.laborHourly)>0&&Number(s.directLaborMinutes)>0)
      ? `${money(Number(s.laborHourly))}/giờ × ${num(Number(s.directLaborMinutes))} phút`
      : 'Đang dùng mức nhân công cũ / sản phẩm';
    return [
      ['Nguyên liệu',c.recipe,'Theo cost chuẩn của công thức'],
      ['Công sức',c.labor,laborNote],
      ['Điện & nước',c.utilities,'Chi phí ước tính cho 1 sản phẩm'],
      ['Khấu hao',c.depreciation,'Máy móc, lò, tủ, dụng cụ...'],
      ['Chi phí biến đổi khác',c.variable,'Các khoản tăng theo sản lượng'],
      ['Chi phí cố định phân bổ',c.fixed,`Từ ${money(Number(s.fixedMonthly)||0)}/tháng ÷ ${num(Number(s.expectedMonthlyUnits)||0)} sản phẩm`]
    ];
  }

  function r2CostDetailHtml(p){
    const c=r2Cost(p);
    return `<div class="list">${r2CostLines(p).map(x=>`<div class="list-item row"><div><b>${x[0]}</b><div style="font-size:11px;color:var(--muted);margin-top:3px">${x[2]}</div></div><b>${money(x[1])}</b></div>`).join('')}</div>
    <div class="alert info" style="margin-top:12px"><div>💡</div><div><b>Để làm 1 ${p.name}, hiện đang tính khoảng ${money(c.total)}.</b><div style="font-size:12px;margin-top:4px">Bao bì không cộng riêng vì đã nằm trong nguyên liệu của công thức.</div></div></div>`;
  }

  function priceGuideModal(pid){
    const p=db.products.find(x=>x.id===pid);if(!p)return;
    const c=r2Cost(p),current=Number(p.price)||0,raw=r2SuggestedRaw(p),suggested=r2Suggested(p);
    const currentProfit=r2CurrentProfit(p),currentMargin=r2CurrentMargin(p),targetProfit=Number(r2().profit)||0,tax=Number(r2().tax)||0,status=r2PriceStatus(p);
    const diff=suggested-current;
    openModal(`<h2>${p.name}</h2>
      <div class="grid two">
        <div class="card" style="box-shadow:none">
          <div class="section-title">1. Làm 1 cái hết bao nhiêu?</div>
          ${r2CostDetailHtml(p)}
        </div>
        <div class="card" style="box-shadow:none">
          <div class="section-title">2. Giá hiện tại đang thế nào?</div>
          <div class="stat"><div class="label">Giá đang bán</div><div class="value">${money(current)}</div></div>
          <div class="list" style="margin-top:10px">
            <div class="list-item row"><span>Tổng chi phí</span><b>${money(c.total)}</b></div>
            <div class="list-item row"><span>Còn lại</span><b class="${currentProfit<0?'badge danger':'badge ok'}">${money(currentProfit)}</b></div>
            <div class="list-item row"><span>Tỷ lệ còn lại</span><b>${currentMargin.toFixed(1)}%</b></div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;box-shadow:none">
        <div class="section-title">3. Giá bán đề xuất</div>
        <div style="font-size:13px;color:var(--muted)">Dựa trên toàn bộ chi phí ở trên + <b>${tax}%</b> thuế dự phòng + <b>${targetProfit}%</b> <b>lợi nhuận mong muốn</b>.</div>
        <div style="font-size:34px;font-weight:900;color:var(--green);margin-top:8px">${isFinite(suggested)?money(suggested):'—'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Giá tính trước làm tròn: ${isFinite(raw)?money(raw):'Không thể tính'}</div>
        <div class="alert ${status.type}" style="margin-top:12px"><div>${status.type==='ok'?'🟢':status.type==='warn'?'🟠':'🔴'}</div><div><b>${status.label}</b><div style="font-size:12px;margin-top:3px">${current<suggested?'Giá hiện tại thấp hơn mức đề xuất khoảng '+money(Math.abs(diff))+'.':current>suggested?'Giá hiện tại cao hơn mức đề xuất khoảng '+money(Math.abs(diff))+'.':'Giá hiện tại đang sát mức đề xuất.'}</div></div></div>
      </div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }

  function setActive(page,title){const t=document.getElementById('topTitle');if(t)t.textContent=title;document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));}
  function renderProducts(){const v=document.getElementById('view');if(v)v.innerHTML=productsNormalV5();setActive('products','Sản phẩm');}
  function renderPricingSettings(){try{const html=typeof window.settingsRound2==='function'?window.settingsRound2():'';if(!html){toast('Không tải được màn Giá bán');return;}const v=document.getElementById('view');if(v)v.innerHTML=html;setActive('settings','Cài đặt');}catch(e){console.error('pricing settings',e);toast('Không mở được phần Giá bán')}}
  window.componentLine=componentLine;window.addComponent=addComponent;window.productModalNormalV5=productModalNormalV5;window.saveProductNormalV5=saveProductNormalV5;window.productModal=window.productModalV5;window.productsNormalV5=productsNormalV5;
  window.r2=r2;window.roundPrice=roundPrice;window.r2FixedPerProduct=r2FixedPerProduct;window.r2LaborCost=r2LaborCost;window.r2Cost=r2Cost;window.r2SuggestedRaw=r2SuggestedRaw;window.r2Suggested=r2Suggested;window.r2CurrentMargin=r2CurrentMargin;window.r2CurrentProfit=r2CurrentProfit;window.r2PriceStatus=r2PriceStatus;window.r2CostLines=r2CostLines;window.r2CostDetailHtml=r2CostDetailHtml;window.priceGuideModal=priceGuideModal;
  window.FNB_PRICING_UI={renderProducts,renderPricingSettings};
  document.addEventListener('click',function(e){const b=e.target.closest?.('button[data-page="settings"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();renderPricingSettings();},true);
})();
