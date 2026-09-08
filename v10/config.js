/* F&B Manager V10 — shared configuration
   Phase 1 of the core refactor: configuration is isolated from the runtime engine.
   This file has no DOM or application-state side effects.
*/
(function(){
  'use strict';

  window.FNB_CONFIG={
    API:'https://script.google.com/macros/s/AKfycbyL2y6Y3iyTMFKt6x_U_JmYP-zTTgMkp1SMi0cFudNF8tmkm5CfOu6Y_jPZT2XKO18aiQ/exec',
    BRANCH_DEFAULT:'MAIN',
    SETTINGS_DEFAULTS:Object.freeze({
      tax:8,
      profit:35,
      packaging:2000,
      overhead:8
    })
  };
})();
