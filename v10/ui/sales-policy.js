/* F&B Manager V10 — Sales policy
   Keep POS behavior explicit: sales may exceed stock for fast quoting,
   and unpaid/partial payments become customer receivables.
*/
(function(){
  'use strict';

  const baseAddCart=window.addCart;
  if(typeof baseAddCart==='function'){
    window.addCart=function(pid){
      const p=db.products.find(x=>x.id===pid),c=cart.find(x=>x.pid===pid),oldStock=p?Number(p.stock)||0:0;
      if(p&&c)p.stock=Math.max(oldStock,Number(c.qty||0)+1);
      try{return baseAddCart(pid)}finally{if(p)p.stock=oldStock;}
    };
  }
  const baseChangeCart=window.changeCartV5;
  if(typeof baseChangeCart==='function'){
    window.changeCartV5=function(pid,d){
      const p=db.products.find(x=>x.id===pid),c=cart.find(x=>x.pid===pid),oldStock=p?Number(p.stock)||0:0;
      if(p&&c&&Number(d)>0)p.stock=Math.max(oldStock,Number(c.qty||0)+Number(d));
      try{return baseChangeCart(pid,d)}finally{if(p)p.stock=oldStock;}
    };
  }
  const baseCompleteOrderV5=window.completeOrderV5;
  if(typeof baseCompleteOrderV5==='function'){
    window.completeOrderV5=function(){
      if(!cart.length)return;
      const subtotal=cart.reduce((s,item)=>{const p=db.products.find(x=>x.id===item.pid);return s+(Number(item.unitPrice??p?.price??0)||0)*Number(item.qty||0)},0);
      let manualDiscount=checkoutState.discountType==='percent'?Math.min(subtotal,subtotal*Math.max(0,Number(checkoutState.discountValue)||0)/100):Math.min(subtotal,Math.max(0,Number(checkoutState.discountValue)||0));
      let voucherDiscount=0,voucher=null;
      if(checkoutState.voucherCode){voucher=voucherByCode(checkoutState.voucherCode);if(voucher&&subtotal>=Number(voucher.minOrder||0))voucherDiscount=voucher.type==='percent'?Math.min(subtotal-manualDiscount,(subtotal-manualDiscount)*Number(voucher.value||0)/100):Math.min(subtotal-manualDiscount,Number(voucher.value)||0)}
      const shipping=Math.max(0,Number(checkoutState.shippingFee)||0),total=Math.max(0,subtotal-manualDiscount-voucherDiscount+shipping),paid=(checkoutState.payments||[]).reduce((s,p)=>s+Math.max(0,Number(p.amount)||0),0),outstanding=Math.max(0,total-paid);
      if(outstanding>0&&!checkoutState.customerId){toast('Vui lòng chọn khách hàng để ghi công nợ');return}
      if(paid>total){toast('Số tiền thanh toán đang dư');return}
      const items=cart.map(x=>{const p=db.products.find(p=>p.id===x.pid);return {pid:x.pid,qty:x.qty,unitPrice:Number(x.unitPrice??p?.price??0)||0,priceLabel:x.priceLabel||'Giá bán lẻ'}});
      items.forEach(x=>{const p=db.products.find(p=>p.id===x.pid);if(p)p.stock=(Number(p.stock)||0)-Number(x.qty||0)});
      const order={id:id(),date:today(),createdAt:new Date().toISOString(),customerId:checkoutState.customerId,items,subtotal,discount:manualDiscount+voucherDiscount,manualDiscount,voucherDiscount,voucherCode:voucher?.code||'',shippingFee:shipping,total,cost:items.reduce((s,x)=>s+productCost(db.products.find(p=>p.id===x.pid))*x.qty,0),payments:(checkoutState.payments||[]).filter(p=>Number(p.amount)>0).map(p=>({...p,amount:Number(p.amount)||0})),paymentStatus:outstanding>0?(paid>0?'partial':'unpaid'):'paid',status:'completed',returnedItems:[]};
      if(outstanding>0){const customer=db.customers.find(c=>c.id===checkoutState.customerId);db.debts=Array.isArray(db.debts)?db.debts:[];db.debts.push({id:id(),customerId:checkoutState.customerId,customerName:customer?.name||'Khách hàng',date:today(),amount:outstanding,paid:0,status:'open',sourceId:order.id,sourceType:'sale',note:`Công nợ từ đơn #${order.id.slice(-6).toUpperCase()}`,payments:[]})}
      db.sales.push(order);save();cart=[];const id0=order.id;resetCheckout();toast(outstanding>0?`Đã hoàn tất đơn · còn nợ ${fmtMoney(outstanding)}`:'Đã hoàn tất đơn hàng');orderDetailModal(id0);
    };
  }

  // Compatibility fallback: this module is already loaded by the stable V10 loader.
  // Direct Canvas keeps the receipt at the exact sample pixel size (994x1231 for the short layout).
  window.saveInvoiceImageV5=async function(oid){
    try{
      const o=db.sales.find(x=>x.id===oid);if(!o)throw new Error('Không tìm thấy đơn');
      const c=orderCustomer(o),s=Object.assign({storeName:'F&B Manager',phone:'',address:'',logo:'',bankName:'',bankAccount:'',bankOwner:'',bankQr:'',title:'ĐƠN BÁN HÀNG',footer:'Cảm ơn quý khách!',note:'',showOrderCode:true,showDate:true,showCustomer:true,showPhone:true,showDiscount:true,showShipping:true,showPayment:true,showBankQr:false,showAddress:true,showFooter:true,showItemUnitPrice:true,showItemTotal:true},db.settings.invoice||{});
      const W=994,P=42,CW=W-P*2,probe=document.createElement('canvas').getContext('2d');probe.font='16px Arial,sans-serif';
      const wrap=(value,max)=>{const words=String(value??'').split(/\s+/).filter(Boolean),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(!line||probe.measureText(next).width<=max)line=next;else{lines.push(line);line=word}}if(line)lines.push(line);return lines.length?lines:['']};
      const rows=o.items.map((item,idx)=>{const p=db.products.find(x=>x.id===item.pid),name=`${idx+1}. ${p?.name||'—'}`;return {item,name,lines:wrap(name,CW-360)}});
      let H=360+rows.reduce((n,r)=>n+Math.max(36,r.lines.length*24)+18,0)+190;H=Math.max(1231,H);
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';ctx.textBaseline='top';
      const text=(value,x,y,max,lh,font='16px Arial',align='left')=>{ctx.font=font;ctx.fillStyle='#111';ctx.textAlign=align;const lines=wrap(value,max);lines.forEach((v,i)=>ctx.fillText(v,x,y+i*lh));return y+lines.length*lh};
      const line=(y,w=1)=>{ctx.strokeStyle='#111';ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(P,y);ctx.lineTo(W-P,y);ctx.stroke()};
      let y=P;
      if(s.logo){const logo=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=s.logo});if(logo)ctx.drawImage(logo,P,y,105,105);text(s.storeName,P+125,y+4,CW-125,34,'800 30px Arial');if(s.phone)text('SĐT: '+s.phone,P+125,y+42,CW-125,23);if(s.showAddress&&s.address)text(s.address,P+125,y+68,CW-125,23);y+=120}else{y=text(s.storeName,P,y,CW,36,'800 30px Arial');if(s.phone)y=text('SĐT: '+s.phone,P,y+4,CW,23);if(s.showAddress&&s.address)y=text(s.address,P,y+2,CW,23);y+=10}
      line(y,2);y+=20;y=text(s.title,W/2,y,CW,34,'800 30px Arial','center');y+=18;
      if(s.showOrderCode)y=text(`Mã đơn: #${o.id.slice(-6).toUpperCase()}`,P,y,CW,25);if(s.showDate)y=text(`Ngày bán: ${new Date(o.createdAt||o.date).toLocaleString('vi-VN')}`,P,y,CW,25);if(s.showCustomer)y=text(`Khách hàng: ${c?.name||'Khách lẻ'}${s.showPhone&&c?.phone?' · '+c.phone:''}`,P,y,CW,25);
      y+=12;line(y);y+=14;const xQty=W-310,xPrice=W-205,xTotal=W-P;ctx.font='800 16px Arial';ctx.textAlign='left';ctx.fillText('STT / Sản phẩm',P,y);ctx.textAlign='right';ctx.fillText('SL',xQty,y);if(s.showItemUnitPrice)ctx.fillText('Giá',xPrice,y);if(s.showItemTotal)ctx.fillText('T.Tiền',xTotal,y);y+=26;line(y);y+=10;
      rows.forEach(r=>{const item=r.item,qty=Number(item.qty)||0,unit=Number(item.unitPrice)||0,total=qty*unit;text(r.name,P,y,CW-360,24,'16px Arial');ctx.font='16px Arial';ctx.fillStyle='#111';ctx.textAlign='right';ctx.fillText(num(qty),xQty,y);if(s.showItemUnitPrice)ctx.fillText(fmtMoney(unit),xPrice,y);if(s.showItemTotal)ctx.fillText(fmtMoney(total),xTotal,y);y+=Math.max(36,r.lines.length*24)+18;line(y);y+=10});
      y+=4;line(y,2);y+=14;ctx.textAlign='right';ctx.font='16px Arial';if(s.showDiscount){ctx.fillText(`Giảm giá: − ${fmtMoney(o.discount)}`,xTotal,y);y+=27}if(s.showShipping){ctx.fillText(`Phí giao hàng: + ${fmtMoney(o.shippingFee)}`,xTotal,y);y+=27}ctx.font='800 28px Arial';ctx.fillText(`Tổng tiền đơn hàng: ${fmtMoney(o.total)}`,xTotal,y);y+=36;ctx.font='italic 16px Arial';ctx.fillText(numberToVietnameseWordsV5(o.total),xTotal,y);y+=30;
      if(s.showPayment){ctx.textAlign='left';ctx.font='16px Arial';ctx.fillText(`Thanh toán: ${(o.payments||[]).map(p=>`${paymentLabel(p.method)} ${fmtMoney(p.amount)}`).join(' · ')||'—'}`,P,y);y+=32}
      if(s.showBankQr&&s.bankQr){line(y);y+=16;const qr=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=s.bankQr});if(qr)ctx.drawImage(qr,W-P-145,y,145,145);ctx.textAlign='left';ctx.font='16px Arial';ctx.fillText(s.bankName||'',P,y);ctx.fillText('STK: '+(s.bankAccount||''),P,y+25);ctx.fillText('Chủ TK: '+(s.bankOwner||''),P,y+50);y+=160}
      if(s.note){y=text(s.note,P,y,CW,20,'13px Arial');y+=10}if(s.showFooter){y+=18;text(s.footer,W/2,y,CW,24,'16px Arial','center')}
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Không tạo được PNG');const name=`HoaDon_${String(oid).slice(-6).toUpperCase()}.png`,url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Đã lưu ảnh hóa đơn');
    }catch(e){console.error('V10 invoice image export',e);toast('Không thể tạo ảnh hóa đơn trên trình duyệt này')}
  };
  const invoiceMobileStyle=document.createElement('style');invoiceMobileStyle.textContent='@media(max-width:800px){.modal-actions{flex-wrap:wrap;justify-content:stretch}.modal-actions .btn{flex:1 1 calc(50% - 5px);min-height:42px}}';document.head.appendChild(invoiceMobileStyle);
})();
