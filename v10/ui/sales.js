/* F&B Manager V10 — POS / Sales domain
   Phase 11: move the canonical POS/Sales UI implementation behind the V10 boundary.
   Legacy copies in index.html remain temporarily for rollback safety.
*/
(function(){
  'use strict';

  function setActive(title){
    const t=document.getElementById('topTitle');if(t)t.textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='pos'));
  }
  function renderSales(){
    const v=document.getElementById('view');
    if(v&&typeof pos==='function')v.innerHTML=pos();
    setActive('Bán hàng');
  }

  function calcCheckout(){
    const subtotal=cart.reduce((s,c)=>{const p=db.products.find(x=>x.id===c.pid);const unit=Number(c.unitPrice??p?.price??0)||0;return s+unit*c.qty},0);
    let manual=0;
    if(checkoutState.discountType==='percent') manual=Math.min(subtotal,subtotal*Math.max(0,Number(checkoutState.discountValue)||0)/100);
    else manual=Math.min(subtotal,Math.max(0,Number(checkoutState.discountValue)||0));
    let voucherDiscount=0,voucher=null;
    if(checkoutState.voucherCode){
      voucher=voucherByCode(checkoutState.voucherCode);
      if(voucher&&subtotal>=Number(voucher.minOrder||0)) voucherDiscount=voucher.type==='percent'?Math.min(subtotal-manual,(subtotal-manual)*Number(voucher.value||0)/100):Math.min(subtotal-manual,Number(voucher.value)||0);
    }
    const shipping=Math.max(0,Number(checkoutState.shippingFee)||0);
    return {subtotal,manualDiscount:manual,voucherDiscount,shipping,total:Math.max(0,subtotal-manual-voucherDiscount+shipping),voucher};
  }

  function cartHtmlV5(){
    if(!cart.length)return '<div class="empty">Chưa có sản phẩm.</div>';
    cart.forEach(c=>{const p=db.products.find(x=>x.id===c.pid);if(c.unitPrice==null)c.unitPrice=Number(p?.price)||0;});
    return cart.map(c=>{const p=db.products.find(x=>x.id===c.pid),unit=Number(c.unitPrice)||0;return `<div class="cart-item quick-cart-item" onclick="productQuickPriceModalV5('${c.pid}')"><div><b>${escapeHtmlV5(p?.name||'—')}</b><div style="font-size:12px;color:var(--muted)">${fmtMoney(unit)} / cái${c.priceLabel?` · <span style="color:var(--green)">${escapeHtmlV5(c.priceLabel)}</span>`:''}</div></div><div class="qty" onclick="event.stopPropagation()"><button onclick="changeCartV5('${c.pid}',-1)">−</button><b>${c.qty}</b><button onclick="changeCartV5('${c.pid}',1)">+</button></div><b>${fmtMoney(unit*c.qty)}</b></div>`}).join('');
  }
  function addCart(pid){
    const p=db.products.find(x=>x.id===pid);if(!p)return;let c=cart.find(x=>x.pid===pid);
    if(c)c.qty++;else cart.push({pid,qty:1,unitPrice:Number(p.price)||0,priceLabel:'Giá bán lẻ'});
    if(c&&c.qty>p.stock){c.qty=p.stock;toast('Không đủ tồn kho');}
    const e=document.getElementById('cart');if(e)e.innerHTML=cartHtmlV5();renderCheckoutBox();
  }
  function changeCartV5(pid,d){
    const c=cart.find(x=>x.pid===pid);if(!c)return;const p=db.products.find(x=>x.id===pid);c.qty+=d;
    if(c.qty>Number(p?.stock||0)){c.qty=Number(p?.stock||0);toast('Không đủ tồn kho')}
    if(c.qty<=0)cart=cart.filter(x=>x!==c);
    const e=document.getElementById('cart');if(e)e.innerHTML=cartHtmlV5();renderCheckoutBox();
  }
  function clearCart(){cart=[];const e=document.getElementById('cart');if(e)e.innerHTML=cartHtmlV5();renderCheckoutBox();}
  function completeOrderV5(){
    if(!cart.length)return;
    const c=calcCheckout(),paid=paymentTotal();
    if(paid!==c.total){toast('Số tiền thanh toán chưa đủ hoặc đang dư');return}
    for(const item of cart){const p=db.products.find(x=>x.id===item.pid);if(!p||item.qty>p.stock){toast(`Không đủ tồn: ${p?.name||'sản phẩm'}`);return}}
    const items=cart.map(x=>{const p=db.products.find(p=>p.id===x.pid);return {pid:x.pid,qty:x.qty,unitPrice:Number(x.unitPrice??p.price)||0,priceLabel:x.priceLabel||'Giá bán lẻ'}});
    items.forEach(x=>db.products.find(p=>p.id===x.pid).stock-=x.qty);
    const order={id:id(),date:today(),createdAt:new Date().toISOString(),customerId:checkoutState.customerId,items,subtotal:c.subtotal,discount:c.manualDiscount+c.voucherDiscount,manualDiscount:c.manualDiscount,voucherDiscount:c.voucherDiscount,voucherCode:c.voucher?.code||'',shippingFee:c.shipping,total:c.total,cost:items.reduce((s,x)=>s+productCost(db.products.find(p=>p.id===x.pid))*x.qty,0),payments:JSON.parse(JSON.stringify(checkoutState.payments)),status:'completed',returnedItems:[]};
    db.sales.push(order);save();cart=[];const id0=order.id;resetCheckout();toast('Đã hoàn tất đơn hàng');orderDetailModal(id0);
  }

  function posProducts(){
    const q=(document.getElementById('posSearch')?.value||'').toLowerCase();
    return db.products.filter(p=>p.name.toLowerCase().includes(q)).map(p=>`<button class="product-card" onclick="addCart('${p.id}')"><b>${escapeHtmlV5(p.name)}</b><div class="price">${fmtMoney(p.price)}</div><div style="font-size:12px;color:var(--muted);margin-top:5px">Tồn: ${num(p.stock)}</div></button>`).join('')||'<div class="empty">Không tìm thấy sản phẩm.</div>';
  }
  function renderPosProducts(){const e=document.getElementById('posProducts');if(e)e.innerHTML=posProducts()}

  function escapeHtmlV5(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function numberToVietnameseWordsV5(n){
    n=Math.round(Number(n)||0);if(n===0)return 'Không đồng';
    const ones=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
    function read3(x){const h=Math.floor(x/100),t=Math.floor((x%100)/10),u=x%10,parts=[];if(h){parts.push(ones[h]+' trăm');if(t===0&&u)parts.push('lẻ')}if(t){parts.push(ones[t]+' mươi');if(u===1)parts[parts.length-1]='mười';else if(u===5)parts.push('lăm');else if(u)parts.push(ones[u])}else if(u)parts.push(ones[u]);return parts.join(' ')}
    const units=['','nghìn','triệu','tỷ'];let groups=[];while(n){groups.unshift(n%1000);n=Math.floor(n/1000)}let out=[];groups.forEach((g,i)=>{if(g)out.push(read3(g)+' '+units[groups.length-1-i])});return out.join(' ').replace(/\s+/g,' ').trim()+' đồng';
  }

  function invoicePreviewContentV5(oid){
    const o=db.sales.find(x=>x.id===oid);if(!o)return '<div class="empty">Không tìm thấy đơn.</div>';
    const c=orderCustomer(o),s=Object.assign({storeName:'F&B Manager',phone:'',address:'',logo:'',bankName:'',bankAccount:'',bankOwner:'',bankQr:'',title:'ĐƠN BÁN HÀNG',footer:'Cảm ơn quý khách!',note:'',showOrderCode:true,showDate:true,showCustomer:true,showPhone:true,showDiscount:true,showShipping:true,showPayment:true,showBankQr:false,showAddress:true,showFooter:true,showItemUnitPrice:true,showItemTotal:true},db.settings.invoice||{});
    const rows=o.items.map((i,idx)=>{const p=db.products.find(x=>x.id===i.pid);return `<tr><td>${idx+1}. ${escapeHtmlV5(p?.name||'—')}${i.priceLabel?`<div style="font-size:11px;color:#777">${escapeHtmlV5(i.priceLabel)}</div>`:''}</td><td class="num">${num(i.qty)}</td>${s.showItemUnitPrice?`<td class="num">${fmtMoney(i.unitPrice)}</td>`:''}${s.showItemTotal?`<td class="num">${fmtMoney(i.qty*i.unitPrice)}</td>`:''}</tr>`}).join('');
    const bankQr=s.showBankQr&&s.bankQr?`<div class="invoice-bank"><div><b>${escapeHtmlV5(s.bankName)}</b><br>STK: ${escapeHtmlV5(s.bankAccount)}<br>Chủ TK: ${escapeHtmlV5(s.bankOwner)}</div><img src="${s.bankQr}" alt="QR ngân hàng"></div>`:'';
    return `<div class="invoice-image-sheet">${s.logo?`<div class="invoice-head"><img class="invoice-logo" src="${s.logo}"><div><div class="invoice-store">${escapeHtmlV5(s.storeName)}</div>${s.phone?`<div>SĐT: ${escapeHtmlV5(s.phone)}</div>`:''}${s.showAddress&&s.address?`<div>${escapeHtmlV5(s.address)}</div>`:''}</div></div>`:`<div class="invoice-head"><div><div class="invoice-store">${escapeHtmlV5(s.storeName)}</div>${s.phone?`<div>SĐT: ${escapeHtmlV5(s.phone)}</div>`:''}${s.showAddress&&s.address?`<div>${escapeHtmlV5(s.address)}</div>`:''}</div></div>`}<div class="invoice-title">${escapeHtmlV5(s.title)}</div><div class="invoice-meta">${s.showOrderCode?`Mã đơn: <b>#${o.id.slice(-6).toUpperCase()}</b><br>`:''}${s.showDate?`Ngày bán: ${new Date(o.createdAt||o.date).toLocaleString('vi-VN')}<br>`:''}${s.showCustomer?`Khách hàng: ${escapeHtmlV5(c?.name||'Khách lẻ')}${s.showPhone&&c?.phone?` · ${escapeHtmlV5(c.phone)}`:''}`:''}</div><table class="invoice-table"><thead><tr><th>STT / Sản phẩm</th><th class="num">SL</th>${s.showItemUnitPrice?'<th class="num">Giá</th>':''}${s.showItemTotal?'<th class="num">T.Tiền</th>':''}</tr></thead><tbody>${rows}</tbody></table><div class="invoice-totals">${s.showDiscount?`<div class="num">Giảm giá: − ${fmtMoney(o.discount)}</div>`:''}${s.showShipping?`<div class="num">Phí giao hàng: + ${fmtMoney(o.shippingFee)}</div>`:''}<div class="num invoice-total">Tổng tiền đơn hàng: ${fmtMoney(o.total)}</div><div class="invoice-words">${numberToVietnameseWordsV5(o.total)}</div></div>${s.showPayment?`<div class="invoice-payment">Thanh toán: ${(o.payments||[]).map(p=>`${paymentLabel(p.method)} ${fmtMoney(p.amount)}`).join(' · ')}</div>`:''}${bankQr}${s.note?`<div class="invoice-note">${escapeHtmlV5(s.note)}</div>`:''}${s.showFooter?`<div class="invoice-footer">${escapeHtmlV5(s.footer)}</div>`:''}</div>`;
  }
  function previewInvoiceV5(oid){
    const html=invoicePreviewContentV5(oid);openModal(`<div class="invoice-preview-shell"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Xem trước hóa đơn</h2><span class="badge info">Ảnh hóa đơn</span></div><div class="invoice-preview-frame">${html}</div><div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button><button class="btn" onclick="printInvoiceV5('${oid}')">🖨 In hóa đơn</button><button class="btn primary" onclick="saveInvoiceImageV5('${oid}')">⬇ Lưu ảnh</button></div></div>`);
  }
  function invoiceImageDocumentV5(oid){
    const wrapper=document.createElement('div');wrapper.style.cssText='position:fixed;left:-100000px;top:0;width:800px;background:#fff;z-index:-1;font-family:Arial,Helvetica,sans-serif;color:#111;';
    wrapper.innerHTML=`<style>.invoice-image-sheet{width:800px;background:#fff;padding:34px 38px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.45}.invoice-head{display:flex;gap:18px;align-items:center;border-bottom:2px solid #111;padding-bottom:16px}.invoice-logo{width:105px;height:105px;border-radius:50%;object-fit:cover;border:1px solid #ddd}.invoice-store{font-size:28px;font-weight:800;margin-bottom:6px}.invoice-title{text-align:center;font-size:26px;font-weight:800;margin:20px 0}.invoice-meta{font-size:16px;line-height:1.65;margin-bottom:14px}.invoice-table{width:100%;border-collapse:collapse;font-size:15px}.invoice-table th,.invoice-table td{padding:10px 5px;border-bottom:1px solid #ccc;text-align:left}.invoice-table th{font-weight:700;border-top:1px solid #111}.num{text-align:right!important}.invoice-totals{margin-top:12px;border-top:2px solid #111;padding-top:8px}.invoice-total{font-size:24px;font-weight:800;padding-top:10px}.invoice-words{text-align:right;font-style:italic;font-size:15px;margin-top:5px}.invoice-payment{margin-top:14px}.invoice-bank{display:flex;align-items:center;gap:18px;margin-top:18px;padding-top:16px;border-top:1px solid #ccc}.invoice-bank img{width:145px;height:145px;object-fit:contain}.invoice-note{margin-top:10px;font-size:13px;color:#555}.invoice-footer{text-align:center;margin-top:22px;font-size:15px;line-height:1.6}</style>${invoicePreviewContentV5(oid)}`;
    document.body.appendChild(wrapper);return wrapper;
  }
  async function saveInvoiceImageV5(oid){
    const wrapper=invoiceImageDocumentV5(oid);try{
      if(document.fonts?.ready)await document.fonts.ready;await new Promise(r=>setTimeout(r,80));
      const w=800,h=wrapper.scrollHeight,svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml">${wrapper.innerHTML}</div></foreignObject></svg>`;
      const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(2,2);ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);canvas.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`HoaDon_${oid.slice(-6).toUpperCase()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Đã lưu ảnh hóa đơn');},'image/png')};
      img.onerror=()=>{URL.revokeObjectURL(url);toast('Không thể tạo ảnh hóa đơn trên trình duyệt này')};img.src=url;
    }finally{setTimeout(()=>wrapper.remove(),3000)}
  }
  function printInvoiceV5(oid){
    const o=db.sales.find(x=>x.id===oid);if(!o)return;const c=orderCustomer(o),s=Object.assign({storeName:'F&B Manager',phone:'',address:'',logo:'',bankName:'',bankAccount:'',bankOwner:'',bankQr:'',title:'ĐƠN BÁN HÀNG',footer:'Cảm ơn quý khách!',note:'',showOrderCode:true,showDate:true,showCustomer:true,showPhone:true,showDiscount:true,showShipping:true,showPayment:true,showBankQr:false,showAddress:true,showFooter:true,showItemUnitPrice:true,showItemTotal:true},db.settings.invoice||{});
    const w=window.open('','_blank','width=900,height=1000');if(!w){toast('Trình duyệt đã chặn cửa sổ in');return}
    const rows=o.items.map((i,idx)=>{const p=db.products.find(x=>x.id===i.pid);return `<tr><td>${idx+1}. ${escapeHtmlV5(p?.name||'—')}</td><td class="num">${num(i.qty)}</td>${s.showItemUnitPrice?`<td class="num">${fmtMoney(i.unitPrice)}</td>`:''}${s.showItemTotal?`<td class="num">${fmtMoney(i.qty*i.unitPrice)}</td>`:''}</tr>`}).join('');
    const bankQr=s.showBankQr&&s.bankQr?`<div class="bank"><div><b>${escapeHtmlV5(s.bankName)}</b><br>STK: ${escapeHtmlV5(s.bankAccount)}<br>Chủ TK: ${escapeHtmlV5(s.bankOwner)}</div><img src="${s.bankQr}" alt="QR ngân hàng"></div>`:'';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Hóa đơn #${o.id}</title><style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;background:#f2f2f2;margin:0;padding:24px;color:#111}.invoice{width:min(780px,100%);margin:auto;background:#fff;padding:32px 34px;box-shadow:0 2px 10px rgba(0,0,0,.08)}.head{display:flex;gap:18px;align-items:center;border-bottom:2px solid #111;padding-bottom:16px}.logo{width:105px;height:105px;border-radius:50%;object-fit:cover;border:1px solid #ddd}.store{flex:1}.store h2{margin:0 0 7px;font-size:28px}.store div{font-size:16px;line-height:1.5}.title{text-align:center;font-size:26px;font-weight:800;margin:20px 0}.meta{font-size:16px;line-height:1.65;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:15px}th,td{padding:10px 5px;border-bottom:1px solid #ccc;text-align:left}th{font-weight:700;border-top:1px solid #111}.num{text-align:right}.totals{margin-top:12px;border-top:2px solid #111}.total{font-size:24px;font-weight:800;padding-top:12px}.words{text-align:right;font-style:italic;font-size:15px;margin-top:5px}.bank{display:flex;align-items:center;gap:18px;margin-top:18px;padding-top:16px;border-top:1px solid #ccc}.bank img{width:145px;height:145px;object-fit:contain}.footer{text-align:center;margin-top:22px;font-size:15px;line-height:1.6}.note{margin-top:10px;font-size:13px;color:#555}</style></head><body><div class="invoice">${s.logo?`<div class="head"><img class="logo" src="${s.logo}"><div class="store"><h2>${escapeHtmlV5(s.storeName)}</h2>${s.phone?`<div>SĐT: ${escapeHtmlV5(s.phone)}</div>`:''}${s.showAddress&&s.address?`<div>${escapeHtmlV5(s.address)}</div>`:''}</div></div>`:`<div class="head"><div class="store"><h2>${escapeHtmlV5(s.storeName)}</h2>${s.phone?`<div>SĐT: ${escapeHtmlV5(s.phone)}</div>`:''}${s.showAddress&&s.address?`<div>${escapeHtmlV5(s.address)}</div>`:''}</div></div>`}<div class="title">${escapeHtmlV5(s.title)}</div><div class="meta">${s.showOrderCode?`Mã đơn: <b>#${o.id.slice(-6).toUpperCase()}</b><br>`:''}${s.showDate?`Ngày bán: ${new Date(o.createdAt||o.date).toLocaleString('vi-VN')}<br>`:''}${s.showCustomer?`Khách hàng: ${escapeHtmlV5(c?.name||'Khách lẻ')}${s.showPhone&&c?.phone?` · ${escapeHtmlV5(c.phone)}`:''}`:''}</div><table><thead><tr><th>STT / Sản phẩm</th><th class="num">SL</th>${s.showItemUnitPrice?'<th class="num">Giá</th>':''}${s.showItemTotal?'<th class="num">T.Tiền</th>':''}</tr></thead><tbody>${rows}</tbody></table><div class="totals">${s.showDiscount?`<div class="num" style="padding-top:8px">Giảm giá: − ${fmtMoney(o.discount)}</div>`:''}${s.showShipping?`<div class="num" style="padding-top:6px">Phí giao hàng: + ${fmtMoney(o.shippingFee)}</div>`:''}<div class="num total">Tổng tiền đơn hàng: ${fmtMoney(o.total)}</div><div class="words">${numberToVietnameseWordsV5(o.total)}</div></div>${s.showPayment?`<div style="margin-top:14px">Thanh toán: ${(o.payments||[]).map(p=>`${paymentLabel(p.method)} ${fmtMoney(p.amount)}`).join(' · ')}</div>`:''}${bankQr}${s.note?`<div class="note">${escapeHtmlV5(s.note)}</div>`:''}${s.showFooter?`<div class="footer">${escapeHtmlV5(s.footer)}</div>`:''}</div><script>window.onload=()=>window.print()<\\/script></body></html>`);w.document.close();
  }

  function orderDetailModal(oid){
    const o=db.sales.find(x=>x.id===oid);if(!o)return;const c=orderCustomer(o),canReturn=o.status==='completed'||o.status==='returned';
    openModal(`<h2>Đơn #${o.id.slice(-6).toUpperCase()} ${orderStatusBadge(o)}</h2><div class="grid two"><div class="card" style="box-shadow:none"><div class="section-title">Thông tin</div><div class="list-item row"><span>Ngày</span><b>${fmtDate(o.date)}</b></div><div class="list-item row"><span>Khách hàng</span><b>${escapeHtmlV5(c?.name||'Khách lẻ')}</b></div>${c?.phone?`<div class="list-item row"><span>SĐT</span><b>${escapeHtmlV5(c.phone)}</b></div>`:''}<div class="list-item row"><span>Thanh toán</span><b>${(o.payments||[]).map(p=>`${paymentLabel(p.method)} ${fmtMoney(p.amount)}`).join(' · ')}</b></div></div><div class="card" style="box-shadow:none"><div class="section-title">Tổng tiền</div><div class="list-item row"><span>Tạm tính</span><b>${fmtMoney(orderSubtotal(o))}</b></div><div class="list-item row"><span>Giảm giá</span><b>− ${fmtMoney(o.discount)}</b></div><div class="list-item row"><span>Phí giao hàng</span><b>+ ${fmtMoney(o.shippingFee)}</b></div><div class="list-item row"><span>Tổng</span><b style="color:var(--green);font-size:18px">${fmtMoney(o.total)}</b></div></div></div><div class="card" style="margin-top:15px;box-shadow:none"><div class="section-title">Chi tiết sản phẩm</div>${orderItems(o).map(i=>{const p=db.products.find(x=>x.id===i.pid);const ret=returnedQty(o,i.pid);return `<div class="list-item"><div class="row"><div><b>${escapeHtmlV5(p?.name||'—')}</b><div style="font-size:12px;color:var(--muted)">${num(i.qty)} × ${fmtMoney(i.unitPrice)}${i.priceLabel?` · ${escapeHtmlV5(i.priceLabel)}`:''}</div></div><b>${fmtMoney(i.qty*i.unitPrice)}</b></div>${ret?`<div style="font-size:12px;color:var(--warn);margin-top:4px">Đã trả: ${num(ret)}</div>`:''}</div>`}).join('')}</div><div class="modal-actions"><button class="btn" onclick="previewInvoiceV5('${o.id}')">👁 Xem hóa đơn</button><button class="btn primary" onclick="saveInvoiceImageV5('${o.id}')">⬇ Lưu ảnh</button>${o.status==='completed'?`<button class="btn danger" onclick="cancelOrderV5('${o.id}')">Hủy đơn</button>`:''}${canReturn?`<button class="btn" onclick="returnOrderV5('${o.id}')">Trả hàng</button>`:''}<button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  function cancelOrderV5(oid){const o=db.sales.find(x=>x.id===oid);if(!o||o.status!=='completed')return;if(!confirm('Hủy đơn này và trả toàn bộ thành phẩm về kho?'))return;o.items.forEach(i=>{const p=db.products.find(x=>x.id===i.pid);if(p)p.stock+=i.qty-returnedQty(o,i.pid)});o.status='cancelled';o.cancelledAt=new Date().toISOString();save();closeModal();render('pos');toast('Đã hủy đơn và hoàn tồn thành phẩm')}
  function returnOrderV5(oid){const o=db.sales.find(x=>x.id===oid);if(!o||!['completed','returned'].includes(o.status))return;openModal(`<h2>Trả hàng — #${o.id.slice(-6).toUpperCase()}</h2><p style="color:var(--muted)">Nhập số lượng muốn trả. Hệ thống sẽ tự tính tiền hoàn theo giá bán của đơn.</p>${o.items.map((i,idx)=>{const p=db.products.find(x=>x.id===i.pid),max=i.qty-returnedQty(o,i.pid);return `<div class="list-item row"><div><b>${escapeHtmlV5(p?.name||'—')}</b><div style="font-size:12px;color:var(--muted)">Đã mua ${num(i.qty)} · còn có thể trả ${num(max)}</div></div><input id="ret_${idx}" data-pid="${i.pid}" data-price="${i.unitPrice}" type="number" min="0" max="${max}" value="0" style="width:100px;padding:9px;border:1px solid var(--line);border-radius:9px"></div>`}).join('')}<div class="modal-actions"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="confirmReturnV5('${oid}')">Xác nhận trả</button></div>`)}
  function confirmReturnV5(oid){const o=db.sales.find(x=>x.id===oid);if(!o)return;const returned=[];document.querySelectorAll('[id^="ret_"]').forEach(e=>{const q=Math.max(0,Math.floor(+e.value||0));if(q)returned.push({pid:e.dataset.pid,qty:q,refund:q*(Number(e.dataset.price)||0)})});const totalQty=returned.reduce((s,x)=>s+x.qty,0),refund=returned.reduce((s,x)=>s+x.refund,0);if(!totalQty){toast('Chưa nhập số lượng trả');return}for(const r of returned){const item=o.items.find(i=>i.pid===r.pid);if(!item||r.qty>item.qty-returnedQty(o,r.pid)){toast('Số lượng trả vượt quá số lượng đã mua');return}}returned.forEach(r=>{const p=db.products.find(x=>x.id===r.pid);if(p)p.stock+=r.qty;o.returnedItems.push({pid:r.pid,qty:r.qty,refund:r.refund,date:new Date().toISOString()})});o.returnedTotal=(Number(o.returnedTotal)||0)+refund;o.status=o.items.every(i=>returnedQty(o,i.pid)>=i.qty)?'returned':'completed';save();closeModal();render('pos');toast(`Đã trả hàng · hoàn ${fmtMoney(refund)}`)}

  window.posProducts=posProducts;
  window.renderPosProducts=renderPosProducts;
  window.calcCheckout=calcCheckout;
  window.cartHtmlV5=cartHtmlV5;
  window.addCart=addCart;
  window.changeCartV5=changeCartV5;
  window.clearCart=clearCart;
  window.completeOrderV5=completeOrderV5;
  window.escapeHtmlV5=escapeHtmlV5;
  window.numberToVietnameseWordsV5=numberToVietnameseWordsV5;
  window.invoicePreviewContentV5=invoicePreviewContentV5;
  window.previewInvoiceV5=previewInvoiceV5;
  window.invoiceImageDocumentV5=invoiceImageDocumentV5;
  window.saveInvoiceImageV5=saveInvoiceImageV5;
  window.printInvoiceV5=printInvoiceV5;
  window.orderDetailModal=orderDetailModal;
  window.cancelOrderV5=cancelOrderV5;
  window.returnOrderV5=returnOrderV5;
  window.confirmReturnV5=confirmReturnV5;
  window.FNB_SALES_UI={renderSales,openOrder:orderDetailModal,renderHistory:()=>typeof orderHistoryPage==='function'?orderHistoryPage():undefined,addToCart:addCart,changeCart:changeCartV5,clearCart,checkout:completeOrderV5,resetCheckout:()=>resetCheckout(),renderCheckout:()=>renderCheckoutBox(),returnOrder:returnOrderV5,cancelOrder:cancelOrderV5};
})();
