/* F&B Manager V10 — single browser entry point
   Load shared core modules first, then durable device persistence, online sync,
   authentication, compatibility facade, and isolated UI integration modules.
   Mobile-safe loader: retry failed script loads and never let one UI module
   failure stop the remaining modules from loading.
*/
(function(){
  'use strict';

  const modules=[
    './v10/config.js?v=1101','./v10/state.js?v=1101','./v10/api.js?v=1101','./v10-sync-base.js?v=1108','./v10/persistence.js?v=1101','./v10/sync.js?v=1110','./v10/auth.js?v=1110','./v10/compatibility.js?v=1104','./v10/ui/dashboard.js?v=1104','./v10/ui/reports.js?v=1102','./v10/ui/pricing.js?v=1102','./v10/ui/recipes.js?v=1102','./v10/ui/ingredients.js?v=1102','./v10/ui/ingredient-units.js?v=1103','./v10/ui/inventory.js?v=1103','./v10/ui/production.js?v=1104','./v10/ui/customers.js?v=1104','./v10/ui/sales.js?v=1104','./v10/ui/cashflow.js?v=1103','./v10/ui/employees.js?v=1103','./v10/ui/alerts.js?v=1105','./v10/ui/settings.js?v=1103','./v10/ui/delete-actions.js?v=1103','./v10-ui-patches.js?v=1105'
  ];
  const MAX_ATTEMPTS=3;
  const RETRY_DELAYS=[500,1200];
  const failures=[];
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function setBootStatus(text,kind){try{const view=document.getElementById('view');if(!view)return;const color=kind==='danger'?'#c93b3b':'#718078';view.innerHTML=`<div class="empty" style="padding-top:80px"><div style="font-size:32px;margin-bottom:12px">${kind==='danger'?'⚠️':'⏳'}</div><b>${text}</b></div>`;view.style.color=color;}catch(_e){}}
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');let settled=false;const finish=(ok,error)=>{if(settled)return;settled=true;s.onload=s.onerror=null;ok?resolve():reject(error||new Error('Không tải được '+src));};s.onload=()=>finish(true);s.onerror=()=>finish(false,new Error('Không tải được module: '+src));s.src=src;s.async=false;document.head.appendChild(s);});}
  async function loadWithRetry(src,index){let lastError=null;for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){try{await loadScript(src);return true}catch(e){lastError=e;if(attempt<MAX_ATTEMPTS)await delay(RETRY_DELAYS[attempt-1]||1500);}}failures.push({index,src,error:lastError});console.error('V10 module load failed after retries:',src,lastError);return false;}
  async function loadAll(){setBootStatus('Đang khởi tạo F&B Manager...','info');for(let i=0;i<modules.length;i++)await loadWithRetry(modules[i],i);try{if(window.FNB_AUTH?.init)await window.FNB_AUTH.init();else throw new Error('Auth module chưa được tải');}catch(e){console.error('V10 direct init',e);setBootStatus('Không thể khởi tạo ứng dụng. Vui lòng tải lại trang.','danger');return;}if(failures.length)console.warn('V10 loaded with module failures:',failures);}
  loadAll().catch(e=>{console.error('V10 bootstrap',e);setBootStatus('Không thể khởi tạo ứng dụng. Vui lòng tải lại trang.','danger');});
})();