/* F&B Manager V10 — employees & permissions UI
   Phase 10: employee accounts and role/permission presentation are isolated behind
   a stable domain facade. Canonical V8 business logic remains in index.html during
   the safe extraction phase so account, role and permission behavior stays unchanged.
*/
(function(){
  'use strict';

  function setActive(){
    const t=document.getElementById('topTitle');
    if(t)t.textContent='Nhân viên';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='employees'));
  }

  function renderEmployees(){
    if(typeof window.renderV8Employees==='function')return window.renderV8Employees();
    setActive();
    return '';
  }

  function openEmployee(id){
    if(typeof window.v8EmployeeDetail==='function')return window.v8EmployeeDetail(id);
  }

  function editEmployee(id){
    if(typeof window.v8EmployeeModal==='function')return window.v8EmployeeModal(id);
  }

  function createEmployee(){return editEmployee('');}

  function openRole(id){
    if(typeof window.v8RoleModal==='function')return window.v8RoleModal(id);
  }

  function createRole(){return openRole('');}

  window.FNB_EMPLOYEES_UI={
    renderEmployees,
    openEmployee,
    editEmployee,
    createEmployee,
    openRole,
    createRole
  };
})();
