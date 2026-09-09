/* F&B Manager V10 — authentication layer
   Phase 3 moves the public authentication surface out of the sync loader.
   The existing runtime engine remains the internal implementation for now;
   this module owns the public login/logout/account facade and compatibility names.
*/
(function(){
  'use strict';

  const runtime=window.FNB_RUNTIME||{};
  const state=runtime.state||{};

  const internal={
    login:window.v10LoginAccount,
    loginModal:window.v9LoginModal,
    doLogin:window.v10DoLogin,
    logout:window.v9Logout,
    openAccount:window.v9OpenAccount
  };

  function requireFn(fn,name){
    if(typeof fn!=='function')throw new Error('Auth module chưa sẵn sàng: '+name);
    return fn;
  }

  function login(username,password){
    return requireFn(internal.login,'login')(username,password);
  }

  function openLogin(message){
    return requireFn(internal.loginModal,'loginModal')(message);
  }

  function logout(){
    return requireFn(internal.logout,'logout')();
  }

  function openAccount(){
    return requireFn(internal.openAccount,'openAccount')();
  }

  async function doLogin(){
    return requireFn(internal.doLogin,'doLogin')();
  }

  window.v10LoginAccount=login;
  window.v9LoginModal=openLogin;
  window.v10DoLogin=doLogin;
  window.v9Login=doLogin;
  window.v9Logout=logout;
  window.v9OpenAccount=openAccount;

  window.FNB_AUTH={
    login,
    openLogin,
    logout,
    openAccount,
    getState:function(){
      return {
        user:state.user||null,
        employee:state.employee||null,
        branchId:state.branchId||null
      };
    }
  };
})();
