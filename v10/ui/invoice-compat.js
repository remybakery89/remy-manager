/* F&B Manager V10 — invoice image compatibility
   Keep invoice data/preview unchanged. Replace the fragile SVG/foreignObject
   rasterization path with direct Canvas drawing for cross-browser export.
*/
(function(){
  'use strict';

  function settings(){
    return Object.assign({
      storeName:'F&B Manager',phone:'',address:'',logo:'',bankName:'',bankAccount:'',bankOwner:'',bankQr:'',
      title:'ĐƠN BÁN HÀNG',footer:'Cảm ơn quý khách!',note:'',showOrderCode:true,showDate:true,showCustomer:true,
      showPhone:true,showDiscount:true,showShipping:true,showPayment:true,showBankQr:false,showAddress:true,
      showFooter:true,showItemUnitPrice:true,showItemTotal:true
    },db.settings.invoice||{});
  }

  function loadImage(src){
    return new Promise(resolve=>{
      if(!src)return resolve(null);
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=src;
    });
  }

  function wrapText(ctx,text,maxWidth){
    const words=String(text??'').split(/\s+/).filter(Boolean),lines=[];let line='';
    words.forEach(word=>{
      const next=line?line+' '+word:word;
      if(ctx.measureText(next).width<=maxWidth||!line)line=next;
      else{lines.push(line);line=word;}
    });
    if(line)lines.push(line);
    return lines.length?lines:[''];
  }

  function drawText(ctx,text,x,y,maxWidth,lineHeight,opts={}){
    ctx.font=opts.font||'16px Arial, sans-serif';
    ctx.fillStyle=opts.color||'#111';
    ctx.textAlign=opts.align||'left';
    ctx.textBaseline='top';
    const lines=wrapText(ctx,text,maxWidth);
    lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));
    return y+lines.length*lineHeight;
  }

  function line(ctx,x1,y,x2){ctx.strokeStyle='#cfcfcf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();}

  async function renderInvoiceCanvas(oid){
    const o=db.sales.find(x=>x.id===oid);if(!o)throw new Error('Không tìm thấy đơn');
    const c=orderCustomer(o),s=settings(),W=800,pad=38,contentW=W-pad*2;
    const rows=[];
    const temp=document.createElement('canvas').getContext('2d');
    temp.font='15px Arial, sans-serif';
    o.items.forEach((item,idx)=>{
      const p=db.products.find(x=>x.id===item.pid);
      const name=`${idx+1}. ${p?.name||'—'}`;
      const lines=wrapText(temp,name,contentW-300);
      rows.push({item,name,lines,p});
    });

    let H=80;
    if(s.logo)H=128;
    H+=36+24;
    H+=(s.showOrderCode||s.showDate||s.showCustomer)?90:20;
    H+=42;
    rows.forEach(r=>{H+=Math.max(32,r.lines.length*22)+14});
    H+=125;
    if(s.showPayment)H+=34;
    if(s.showBankQr&&s.bankQr)H+=175;
    if(s.note)H+=45;
    if(s.showFooter)H+=55;
    H+=35;

    // Keep the exported invoice in a portrait receipt ratio similar to the
    // reference: about 1.22x taller than its width. Longer invoices expand.
    H=Math.max(H,Math.round(W*1.22));

    const canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;
    const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#111';ctx.textBaseline='top';

    let y=pad;
    const logo=await loadImage(s.logo);
    if(logo){ctx.drawImage(logo,pad,y,92,92);drawText(ctx,s.storeName,pad+110,y+3,contentW-110,30,{font:'800 28px Arial'});if(s.phone)drawText(ctx,'SĐT: '+s.phone,pad+110,y+38,contentW-110,22);if(s.showAddress&&s.address)drawText(ctx,s.address,pad+110,y+62,contentW-110,22);y+=105}
    else{y=drawText(ctx,s.storeName,pad,y,contentW,34,{font:'800 28px Arial'});if(s.phone)y=drawText(ctx,'SĐT: '+s.phone,pad,y+4,contentW,22);if(s.showAddress&&s.address)y=drawText(ctx,s.address,pad,y+2,contentW,22);y+=10}
    ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=18;

    y=drawText(ctx,s.title,W/2,y,contentW,32,{font:'800 26px Arial',align:'center'});y+=12;
    ctx.font='16px Arial';
    if(s.showOrderCode){y=drawText(ctx,`Mã đơn: #${o.id.slice(-6).toUpperCase()}`,pad,y,contentW,24,{font:'16px Arial'});}
    if(s.showDate){y=drawText(ctx,`Ngày bán: ${new Date(o.createdAt||o.date).toLocaleString('vi-VN')}`,pad,y,contentW,24);}
    if(s.showCustomer){y=drawText(ctx,`Khách hàng: ${c?.name||'Khách lẻ'}${s.showPhone&&c?.phone?' · '+c.phone:''}`,pad,y,contentW,24);}
    y+=10;line(ctx,pad,y,W-pad);y+=12;

    const xName=pad,xQty=W-270,xPrice=W-190,xTotal=W-pad;
    ctx.font='700 15px Arial';ctx.fillStyle='#111';ctx.textAlign='left';ctx.fillText('STT / Sản phẩm',xName,y);ctx.textAlign='right';ctx.fillText('SL',xQty,y);
    if(s.showItemUnitPrice)ctx.fillText('Giá',xPrice,y);if(s.showItemTotal)ctx.fillText('T.Tiền',xTotal,y);y+=24;line(ctx,pad,y,W-pad);y+=8;

    rows.forEach(r=>{
      const item=r.item, rowH=Math.max(32,r.lines.length*22),qty=Number(item.qty)||0,unit=Number(item.unitPrice)||0,total=qty*unit;
      drawText(ctx,r.name,xName,y,contentW-300,22,{font:'15px Arial'});
      ctx.font='15px Arial';ctx.fillStyle='#111';ctx.textAlign='right';ctx.fillText(num(qty),xQty,y);
      if(s.showItemUnitPrice)ctx.fillText(fmtMoney(unit),xPrice,y);
      if(s.showItemTotal)ctx.fillText(fmtMoney(total),xTotal,y);
      y+=rowH+14;line(ctx,pad,y,W-pad);y+=8;
    });

    y+=2;line(ctx,pad,y,W-pad);y+=10;
    ctx.font='15px Arial';ctx.textAlign='right';ctx.fillStyle='#111';
    if(s.showDiscount){ctx.fillText(`Giảm giá: − ${fmtMoney(o.discount)}`,W-pad,y);y+=24;}
    if(s.showShipping){ctx.fillText(`Phí giao hàng: + ${fmtMoney(o.shippingFee)}`,W-pad,y);y+=24;}
    ctx.font='800 24px Arial';ctx.fillText(`Tổng tiền đơn hàng: ${fmtMoney(o.total)}`,W-pad,y);y+=31;
    ctx.font='italic 15px Arial';ctx.fillText(numberToVietnameseWordsV5(o.total),W-pad,y);y+=28;

    if(s.showPayment){ctx.font='15px Arial';ctx.textAlign='left';ctx.fillText(`Thanh toán: ${(o.payments||[]).map(p=>`${paymentLabel(p.method)} ${fmtMoney(p.amount)}`).join(' · ')||'—'}`,pad,y);y+=30;}
    if(s.showBankQr&&s.bankQr){line(ctx,pad,y,W-pad);y+=14;const qr=await loadImage(s.bankQr);if(qr)ctx.drawImage(qr,W-pad-145,y,145,145);ctx.font='15px Arial';ctx.textAlign='left';ctx.fillText(s.bankName||'',pad,y);ctx.fillText('STK: '+(s.bankAccount||''),pad,y+24);ctx.fillText('Chủ TK: '+(s.bankOwner||''),pad,y+48);y+=155;}
    if(s.note){y=drawText(ctx,s.note,pad,y,contentW,20,{font:'13px Arial',color:'#555'});y+=8;}
    if(s.showFooter){y+=10;drawText(ctx,s.footer,W/2,y,contentW,22,{font:'15px Arial',align:'center'});}
    return canvas;
  }

  window.saveInvoiceImageV5=async function(oid){
    try{
      const canvas=await renderInvoiceCanvas(oid);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('Không tạo được PNG');
      const name=`HoaDon_${String(oid).slice(-6).toUpperCase()}.png`;

      // Always save/download locally. Do not invoke the device Share sheet.
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      toast('Đã lưu ảnh hóa đơn');
    }catch(e){console.error('V10 invoice image export',e);toast('Không thể tạo ảnh hóa đơn trên trình duyệt này');}
  };

  const style=document.createElement('style');
  style.textContent='@media(max-width:800px){.modal-actions{flex-wrap:wrap;justify-content:stretch}.modal-actions .btn{flex:1 1 calc(50% - 5px);min-height:42px}}';
  document.head.appendChild(style);
})();
