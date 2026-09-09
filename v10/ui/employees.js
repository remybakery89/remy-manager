/* F&B Manager V10 — Employees & Permissions domain UI
   Phase 13: employees UI takes runtime ownership through the V10 boundary.
   Canonical business/render functions remain in index.html temporarily for rollback safety.
*/
(function(){
  'use strict';

  function setActive(){
    const t=document.getElementById('topTitle');
    if(t)t.textContent='Nhân viên';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='employees'));
  }

  function renderEmployees(){
    const html=typeof renderV8Employees==='function'?renderV8Employees():'';
    const v=document.getElementById('view');
    if(v && typeof html==='string' && v.innerHTML!==html)v.innerHTML=html;
    setActive();
    return html;
  }

  function openEmployee(id){
    return typeof v8EmployeeDetail==='function'?v8EmployeeDetail(id):undefined;
  }

  function editEmployee(id){
    return typeof v8EmployeeModal==='function'?v8EmployeeModal(id):undefined;
  }

  function createEmployee(){return editEmployee('');}

  function openRole(id){
    return typeof v8RoleModal==='function'?v8RoleModal(id):undefined;
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
