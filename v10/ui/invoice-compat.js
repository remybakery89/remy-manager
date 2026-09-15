/* F&B Manager V10 — invoice image compatibility
   Keep invoice data/preview unchanged. Replace the fragile SVG/foreignObject
   rasterization path with direct Canvas drawing for cross-browser export.
*/
(function(){
  'use strict';
  function settings(){return Object.assign({storeName:'F&B Manager',phone:'',address:'',logo:'',bankName:'',bankAccount:'',bankOwner:'',bankQr:'',title:'ĐƠN BÁN HÀNG',footer:'Cảm ơn quý khách!',note:'',showOrderCode:true,showDate:true,showCustomer:true,showPhone:true,showDiscount:true,showShipping:true,showPayment:true,showBankQr:false,showAddress:true,showFooter:true,showItemUnitPrice:true,showItemTotal:true},db.settings.invoice||{});}
  function loadImage(src){return new Promise(resolve=>{if(!src)return resolve(null);const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});}
  function wrapText(ctx,text,maxWidth){const words=String(text??'').split(/\s+/).filter(Boolean),lines=[];let line='';words.forEach(word=>{const next=line?line+' '+word:word;if(ctx.measureText(next).width<=maxWidth||!line)line=next;else{lines.push(line);line=word;}});if(line)lines.push(line);return lines.length?lines:[''];}
  function drawText(ctx,text,x,y,maxWidth,lineHeight,opts={}){ctx.font=opts.font||'16px Arial,sans-serif';ctx.fillStyle=opts.color||'#111';ctx.textAlign=opts.align||'left';ctx.textBaseline='top';const lines=wrapText(ctx,text,maxWidth);lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));return y+lines.length*lineHeight;}
  function line(ctx,x1,y,x2){ctx.strokeStyle='#cfcfcf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();}
  async function renderInvoiceCanvas(oid){
    const o=db.sales.find(x=>x.id===oid);if(!o)throw new Error('Không tìm thấy đơn');
    const c=orderCustomer(o),s=settings(),W=994,pad=42,contentW=W-pad*2;
    const rows=[],temp=document.createElement('canvas').getContext('2d');temp.font='16px Arial,sans-serif';
    o.items.forEach((item,idx)=>{const p=db.products.find(x=>x.id===item.pid),name=`${idx+1}. ${p?.name||'—'}`,lines=wrapText(temp,name,contentW-360);rows.push({item,name,lines,p});});
    let H=360+rows.reduce((n,r)=>n+Math.max(36,r.lines.length*24)+18,0)+190;H=Math.max(1231,H);
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';ctx.textBaseline='top';
    let y=pad;const logo=await loadImage(s.logo);
    if(logo){ctx.drawImage(logo,pad,y,105,105);drawText(ctx,s.storeName,pad+125,y+4,contentW-125,34,{font:'800 30px Arial'});if(s.phone)drawText(ctx,'SĐT: '+s.phone,pad+125,y+42,contentW-125,23);if(s.showAddress&&s.address)drawText(ctx,s.address,pad+125,y+68,contentW-125,23);y+=120}else{y=drawText(ctx,s.storeName,pad,y,contentW,36,{font:'800 30px Arial'});if(s.phone)y=drawText(ctx,'SĐT: '+s.phone,pad,y+4,contentW,23);if(s.showAddress&&s.address)y=drawText(ctx,s.address,pad,y+2,contentW,23);y+=10}
    ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=20;y=drawText(ctx,s.title,W/2,y,contentW,34,{font:'800 30px Arial',align:'center'});y+=18;
    if(s.showOrderCode)y=drawText(ctx,`Mã đơn: #${o.id.slice(-6).toUpperCase()}`,pad,y,contentW,25,{font:'16px Arial'});if(s.showDate)y=drawText(ctx,`Ngày bán: ${new Date(o.createdAt||o.date).toLocaleString('vi-VN')}`,pad,y,contentW,25);if(s.showCustomer)y=drawText(ctx,`Khách hàng: ${c?.name||'Khách lẻ'}${s.showPhone&&c?.phone?' · '+c.phone:''}`,pad,y,contentW,25);
    y+=12;line(ctx,pad,y,W-pad);y+=14;const xQty=W-310,xPrice=W-205,xTotal=W-pad;ctx.font='800 16px Arial';ctx.fillStyle='#111';ctx.textAlign='left';ctx.fillText('STT / Sản phẩm',pad,y);ctx.textAlign='right';ctx.fillText('SL',xQty,y);if(s.showItemUnitPrice)ctx.fillText('Giá',xPrice,y);if(s.showItemTotal)ctx.fillText('T.Tiền',xTotal,y);y+=26;line(ctx,pad,y,W-pad);y+=10;
    rows.forEach(r=>{const item=r.item,rowH=Math.max(36,r.lines.length*24),qty=Number(item.qty)||0,unit=Number(item.unitPrice)||0,total=qty*unit;drawText(ctx,r.name,pad,y,contentW-360,24,{font:'16px Arial'});ctx.font='16px Arial';ctx.fillStyle='#111';ctx.textAlign='right';ctx.fillText(num(qty),xQty,y);if(s.showItemUnitPrice)ctx.fillText(fmtMoney(unit),xPrice,y);if(s.showItemTotal)ctx.fillText(fmtMoney(total),xTotal,y);y+=rowH+18;line(ctx,pad,y,W-pad);y+=10;});
    y+=4;line(ctx,pad,y,W-pad);y+=14;ctx.textAlign='right';ctx.font='16px Arial';if(s.showDiscount){ctx.fillText(`Giảm giá: − ${fmtMoney(o.discount)}`,xTotal,y);y+=27}if(s.showShipping){ctx.fillText(`Phí giao hàng: + ${fmtMoney(o.shippingFee)}`,xTotal,y);y+=27}ctx.font='800 28px Arial';ctx.fillText(`Tổng tiền đơn hàng: ${fmtMoney(o.total)}`,xTotal,y);y+=36;ctx.font='italic 16px Arial';ctx.fillText(numberToVietnameseWordsV5(o.total),xTotal,y);y+=30;
    if(s.showPayment){ctx.textAlign='left';ctx.font='16px Arial';ctx.fillText(`Thanh toán: ${(o.payments||[]).map(p=>`${paymentLabel(p.method)} ${fmtMoney(p.amount)}`).join(' · ')||'—'}`,pad,y);y+=32}
    if(s.showBankQr&&s.bankQr){line(ctx,pad,y,W-pad);y+=16;const qr=await loadImage(s.bankQr);if(qr)ctx.drawImage(qr,W-pad-145,y,145,145);ctx.textAlign='left';ctx.font='16px Arial';ctx.fillText(s.bankName||'',pad,y);ctx.fillText('STK: '+(s.bankAccount||''),pad,y+25);ctx.fillText('Chủ TK: '+(s.bankOwner||''),pad,y+50);y+=160}
    if(s.note){y=drawText(ctx,s.note,pad,y,contentW,20,{font:'13px Arial',color:'#555'});y+=10}if(s.showFooter){y+=18;drawText(ctx,s.footer,W/2,y,contentW,24,{font:'16px Arial',align:'center'});}
    return canvas;
  }
  window.saveInvoiceImageV5=async function(oid){try{const canvas=await renderInvoiceCanvas(oid),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Không tạo được PNG');const name=`HoaDon_${String(oid).slice(-6).toUpperCase()}.png`,url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Đã lưu ảnh hóa đơn');}catch(e){console.error('V10 invoice image export',e);toast('Không thể tạo ảnh hóa đơn trên trình duyệt này');}};
  const style=document.createElement('style');style.textContent='@media(max-width:800px){.modal-actions{flex-wrap:wrap;justify-content:stretch}.modal-actions .btn{flex:1 1 calc(50% - 5px);min-height:42px}}';document.head.appendChild(style);
})();
