/* F&B Manager V10 — safe destructive actions + workflow rollback */
(function(){
  'use strict';

  const rerender=p=>{save();render(p)};
  const confirmDelete=name=>confirm(`Xóa “${name}”?`);

  function ingredient(id){
    const x=db.ingredients.find(i=>i.id===id);if(!x)return;
    if(db.recipes.some(r=>(r.lines||[]).some(l=>l.kind!=='recipe'&&l.ingredientId===id))){toast('Không thể xóa: nguyên liệu đang được dùng trong công thức.');return}
    if(!confirm(`Xóa nguyên liệu “${x.name}”?\nCác lô của nguyên liệu này cũng sẽ bị xóa.`))return;
    db.ingredients=db.ingredients.filter(i=>i.id!==id);db.batches=db.batches.filter(b=>b.ingredientId!==id);rerender('ingredients');toast('Đã xóa nguyên liệu');
  }

  function recipe(id){
    const x=db.recipes.find(r=>r.id===id);if(!x)return;
    if(db.products.some(p=>(p.components||[]).some(c=>c.recipeId===id))||db.recipes.some(r=>r.id!==id&&(r.lines||[]).some(l=>l.kind==='recipe'&&l.recipeId===id))){toast('Không thể xóa: công thức đang được sử dụng.');return}
    if(!confirmDelete(x.name))return;
    db.recipes=db.recipes.filter(r=>r.id!==id);rerender('recipes');toast('Đã xóa công thức');
  }

  function product(id){
    const x=db.products.find(p=>p.id===id);if(!x)return;
    if(db.sales.some(o=>(o.items||[]).some(i=>i.pid===id))||db.plans.some(p=>(p.items||[]).some(i=>i.productId===id)||p.productId===id)){toast('Không thể xóa: sản phẩm đã có trong đơn hàng hoặc kế hoạch.');return}
    if(!confirmDelete(x.name))return;
    db.products=db.products.filter(p=>p.id!==id);rerender('products');toast('Đã xóa sản phẩm');
  }

  function customer(id){
    const x=db.customers.find(c=>c.id===id);if(!x)return;
    if(db.sales.some(o=>o.customerId===id)||db.debts.some(d=>d.customerId===id)){toast('Không thể xóa: khách hàng còn lịch sử mua hàng hoặc công nợ.');return}
    if(!confirmDelete(x.name))return;
    db.customers=db.customers.filter(c=>c.id!==id);rerender('customers');toast('Đã xóa khách hàng');
  }

  function plan(id){
    const x=db.plans.find(p=>p.id===id);if(!x)return;
    if(['producing','completed'].includes(x.status)){toast('Không thể xóa kế hoạch đã bắt đầu hoặc hoàn thành.');return}
    if(!confirmDelete(x.name))return;
    db.plans=db.plans.filter(p=>p.id!==id);rerender('production');toast('Đã xóa kế hoạch');
  }

  function planToDraft(id){
    const x=db.plans.find(p=>p.id===id);if(!x)return;
    if(x.status==='draft'){toast('Kế hoạch đã ở trạng thái Nháp.');return}
    if(x.status!=='approved'){toast('Chỉ kế hoạch Đã duyệt mới có thể đưa về Nháp.');return}
    if(!confirm(`Đưa kế hoạch “${x.name}” về Nháp?\nKế hoạch sẽ không còn được giữ chỗ nguyên liệu.`))return;
    x.status='draft';delete x.approvedAt;delete x.approvedBy;x.issued=[];
    const needs=typeof r4NeedsForItems==='function'?r4NeedsForItems(x.items||[]):x.needs||{};
    x.needs=needs;x.shortages=typeof r4PlanShortages==='function'?r4PlanShortages(needs):[];
    rerender('production');toast('Đã đưa kế hoạch về Nháp');
  }

  function sale(id){
    const x=db.sales.find(o=>o.id===id);if(!x)return;
    if(!confirm(`Xóa hóa đơn #${String(id).slice(-6).toUpperCase()}?\nTồn kho sản phẩm sẽ được hoàn lại.`))return;
    (x.items||[]).forEach(i=>{const p=db.products.find(p=>p.id===i.pid);if(p)p.stock=(Number(p.stock)||0)+(Number(i.qty)||0)});
    db.sales=db.sales.filter(o=>o.id!==id);rerender('pos');toast('Đã xóa hóa đơn và hoàn tồn sản phẩm');
  }

  function batch(id){
    const x=db.batches.find(b=>b.id===id);if(!x)return;
    if(!confirm(`Xóa lô “${x.lot||id}”?\nThao tác này sẽ loại lô khỏi tồn kho.`))return;
    db.batches=db.batches.filter(b=>b.id!==id);save();closeModal();render('inventory');toast('Đã xóa lô nguyên liệu');
  }

  function employee(id){
    const x=db.employees.find(e=>e.id===id);if(!x)return;
    if(x.id===db.sessionEmployeeId){toast('Không thể xóa tài khoản nhân viên đang đăng nhập.');return}
    if(!confirmDelete(x.name||x.username||id))return;
    db.employees=db.employees.filter(e=>e.id!==id);rerender('employees');toast('Đã xóa nhân viên');
  }

  window.FNB_DELETE={ingredient,recipe,product,customer,plan,planToDraft,sale,batch,employee};

  function idFromButtons(root,rx){
    for(const b of root.querySelectorAll('button[onclick]')){
      const m=(b.getAttribute('onclick')||'').match(rx);if(m)return m[1];
    }
    return '';
  }
  function addButton(parent,label,cls,fn){
    const b=document.createElement('button');b.type='button';b.className=`btn small ${cls||''}`;b.textContent=label;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();fn()};parent.append(' ',b);return b;
  }

  function injectRecipes(view){
    view.querySelectorAll('.recipe-card').forEach(card=>{
      if(card.dataset.fnbRecipeActions)return;
      const rid=idFromButtons(card,/recipe(?:DetailModal|Modal)\(['"]([^'"]+)/);if(!rid)return;
      const actions=card.querySelector('button')?.parentElement;if(!actions)return;
      addButton(actions,'Xóa','danger',()=>recipe(rid));card.dataset.fnbRecipeActions='1';
    });
  }

  function injectPlans(root){
    root.querySelectorAll('[onclick*="r4PlanDetail("]').forEach(detailBtn=>{
      const m=(detailBtn.getAttribute('onclick')||'').match(/r4PlanDetail\(['"]([^'"]+)/);if(!m)return;
      const pid=m[1],p=db.plans.find(x=>x.id===pid);if(!p)return;
      const holder=detailBtn.parentElement;if(!holder||holder.dataset.fnbPlanActions)return;
      if(p.status!=='producing'&&p.status!=='completed')addButton(holder,'Xóa','danger',()=>plan(pid));
      if(p.status==='approved')addButton(holder,'Về Nháp','',()=>planToDraft(pid));
      holder.dataset.fnbPlanActions='1';
    });
  }

  function injectInventoryModal(){
    const modal=document.getElementById('modal');if(!modal)return;
    const heading=[...modal.querySelectorAll('h1,h2,h3,.section-title')].find(el=>/^Các lô\s*:/.test(el.textContent.trim()));
    if(!heading)return;
    const ingNameText=heading.textContent.replace(/^Các lô\s*:\s*/,'').trim();
    const ing=db.ingredients.find(i=>String(i.name||'').trim()===ingNameText);
    const sourceLots=ing?db.batches.filter(b=>b.ingredientId===ing.id):[];
    modal.querySelectorAll('table tbody tr').forEach((row,index)=>{
      if(row.dataset.fnbBatchAction)return;
      const action=row.lastElementChild;if(!action)return;
      const existing=row.querySelector('button[onclick*="deleteBatch("]');
      if(existing){row.dataset.fnbBatchAction='1';return;}
      const cellLot=(row.cells[0]?.innerText||'').replace(/Tùy chỉnh/g,'').trim();
      let x=sourceLots.find(b=>String(b.lot||'').trim()===cellLot);
      if(!x && sourceLots.length===modal.querySelectorAll('table tbody tr').length)x=sourceLots[index];
      if(!x)return;
      addButton(action,'Xóa','danger',()=>batch(x.id));row.dataset.fnbBatchAction='1';
    });
  }

  function inject(view){
    if(!view)return;
    const page=document.querySelector('.nav button.active')?.dataset.page||'';
    if(page==='recipes')injectRecipes(view);
    if(page==='production')injectPlans(view);
    const cfg={
      ingredients:[/ingredientModal\(['"]([^'"]+)/,'ingredient'],
      products:[/productModalV5\(['"]([^'"]+)/,'product'],
      customers:[/v8CustomerDetail\(['"]([^'"]+)/,'customer'],
      pos:[/orderDetailModal\(['"]([^'"]+)/,'sale'],
      employees:[/v8EmployeeDetail\(['"]([^'"]+)/,'employee']
    }[page];
    if(cfg)view.querySelectorAll('.table tbody tr').forEach(row=>{
      if(row.dataset.fnbDelete)return;
      const action=row.lastElementChild;if(!action)return;
      const rid=idFromButtons(row,cfg[0]);if(!rid)return;
      addButton(action,'Xóa','danger',()=>FNB_DELETE[cfg[1]](rid));row.dataset.fnbDelete='1';
    });
  }

  const mb=document.getElementById('modalBack');
  if(mb)mb.addEventListener('click',e=>{if(e.target===mb){e.preventDefault();e.stopImmediatePropagation()}},true);

  const view=document.getElementById('view');
  const obs=new MutationObserver(()=>requestAnimationFrame(()=>{inject(view);injectPlans(view);injectInventoryModal()}));
  obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{inject(view);injectPlans(view);injectInventoryModal()},0);
})();
