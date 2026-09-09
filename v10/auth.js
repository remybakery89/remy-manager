/* F&B Manager V10 — authentication facade
   Phase 3 establishes the public authentication boundary.
   The current runtime engine still owns the internal login flow; this module
   exposes one stable auth surface so the implementation can be moved out of
   v10-sync-base.js without changing application behavior in this phase.
*/
(function(){
  'use strict';

  const runtime=window.FNB_RUNTIME||{};
  const state=runtime.state||{};

  function requireAuth(name){
    const fn=window[name];
    if(typeof fn!=='function')throw new Error('Auth module chưa sẵn sàng: '+name);
    return fn;
  }

  window.FNB_AUTH={
    login:function(username,password){
      const fn=window.v10LoginAccount||window.v9LoginAccount;
      if(typeof fn!=='function')throw new Error('Auth login chưa sẵn sàng');
      return fn(username,password);
    },
    openLogin:function(message){
      return requireAuth('v9LoginModal')(message);
    },
    logout:function(){
      return requireAuth('v9Logout')();
    },
    openAccount:function(){
      return requireAuth('v9OpenAccount')();
    },
    getState:function(){
      return {
        user:state.user||null,
        employee:state.employee||null,
        branchId:state.branchId||null
      };
    }
  };
})();
