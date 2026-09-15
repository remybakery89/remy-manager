/* F&B Manager V10 — Sales policy
   Keep POS behavior explicit: sales may exceed stock for fast quoting,
   and unpaid/partial payments become customer receivables.
*/
(function(){
  'use strict';

  // Allow cart quantity to exceed current stock. The actual stock is allowed
  // to become negative when the order is completed.
  const baseAddCart=window.addCart;
  if(typeof baseAddCart==='function'){
    window.addCart=function(pid){
      const p=db.products.find(x=>x.id===pid);
      const c=cart.find(x=>x.pid===pid);
      const oldStock=p?Number(p.stock)||0:0;
      if(p&&c)p.stock=Math.max(oldStock,Number(c.qty||0)+1);
      try{return baseAddCart(pid)}finally{if(p)p.stock=oldStock;}
    };
  }

  const baseChangeCart=window.changeCartV5;
  if(typeof baseChangeCart==='function'){
    window.changeCartV5=function(pid,d){
      const p=db.products.find(x=>x.id===pid);
      const c=cart.find(x=>x.pid===pid);
      const oldStock=p?Number(p.stock)||0:0;
      if(p&&c&&Number(d)>0)p.stock=Math.max(oldStock,Number(c.qty||0)+Number(d));
      try{return baseChangeCart(pid,d)}finally{if(p)p.stock=oldStock;}
    };
  }

  const baseCompleteOrderV5=window.completeOrderV5;
  if(typeof baseCompleteOrderV5==='function'){
    window.completeOrderV5=function(){
      if(!cart.length)return;

      const subtotal=cart.reduce((s,item)=>{
        const p=db.products.find(x=>x.id===item.pid);
        return s+(Number(item.unitPrice??p?.price??0)||0)*Number(item.qty||0);
      },0);
      let manualDiscount=0;
      if(checkoutState.discountType==='percent'){
        manualDiscount=Math.min(subtotal,subtotal*Math.max(0,Number(checkoutState.discountValue)||0)/100);
      }else{
        manualDiscount=Math.min(subtotal,Math.max(0,Number(checkoutState.discountValue)||0));
      }
      let voucherDiscount=0,voucher=null;
      if(checkoutState.voucherCode){
        voucher=voucherByCode(checkoutState.voucherCode);
        if(voucher&&subtotal>=Number(voucher.minOrder||0)){
          voucherDiscount=voucher.type==='percent'
            ?Math.min(subtotal-manualDiscount,(subtotal-manualDiscount)*Number(voucher.value||0)/100)
            :Math.min(subtotal-manualDiscount,Number(voucher.value)||0);
        }
      }
      const shipping=Math.max(0,Number(checkoutState.shippingFee)||0);
      const total=Math.max(0,subtotal-manualDiscount-voucherDiscount+shipping);
      const paid=(checkoutState.payments||[]).reduce((s,p)=>s+Math.max(0,Number(p.amount)||0),0);
      const outstanding=Math.max(0,total-paid);

      // Any unpaid balance is a customer receivable. A customer is required
      // so the balance can be tracked from the Customers > Debt section.
      if(outstanding>0&&!checkoutState.customerId){
        toast('Vui lòng chọn khách hàng để ghi công nợ');
        return;
      }
      // Overpayment is invalid. Partial payment is valid and the remainder
      // becomes customer debt below.
      if(paid>total){
        toast('Số tiền thanh toán đang dư');
        return;
      }

      const items=cart.map(x=>{
        const p=db.products.find(p=>p.id===x.pid);
        return {pid:x.pid,qty:x.qty,unitPrice:Number(x.unitPrice??p?.price??0)||0,priceLabel:x.priceLabel||'Giá bán lẻ'};
      });
      items.forEach(x=>{
        const p=db.products.find(p=>p.id===x.pid);
        if(p)p.stock=(Number(p.stock)||0)-Number(x.qty||0);
      });

      const order={
        id:id(),date:today(),createdAt:new Date().toISOString(),customerId:checkoutState.customerId,
        items,subtotal,discount:manualDiscount+voucherDiscount,manualDiscount,voucherDiscount,
        voucherCode:voucher?.code||'',shippingFee:shipping,total,
        cost:items.reduce((s,x)=>s+productCost(db.products.find(p=>p.id===x.pid))*x.qty,0),
        payments:(checkoutState.payments||[]).filter(p=>Number(p.amount)>0).map(p=>({...p,amount:Number(p.amount)||0})),
        paymentStatus:outstanding>0?(paid>0?'partial':'unpaid'):'paid',
        status:'completed',returnedItems:[]
      };

      // The existing debt ledger is the single source of truth for customer
      // receivables. Link the debt to this sale so it is traceable to the order.
      if(outstanding>0){
        const customer=db.customers.find(c=>c.id===checkoutState.customerId);
        db.debts=Array.isArray(db.debts)?db.debts:[];
        db.debts.push({
          id:id(),customerId:checkoutState.customerId,customerName:customer?.name||'Khách hàng',
          date:today(),amount:outstanding,paid:0,status:'open',sourceId:order.id,sourceType:'sale',
          note:`Công nợ từ đơn #${order.id.slice(-6).toUpperCase()}`,payments:[]
        });
      }

      db.sales.push(order);
      save();
      cart=[];
      const id0=order.id;
      resetCheckout();
      toast(outstanding>0?`Đã hoàn tất đơn · còn nợ ${fmtMoney(outstanding)}`:'Đã hoàn tất đơn hàng');
      orderDetailModal(id0);
    };
  }
})();
