# F&B Manager V10 — Index Map

> Mục đích: bản đồ chi tiết của `index.html` trước khi thực hiện **Domain Extraction**.
>
> **Quy tắc:** tài liệu này chỉ mô tả ownership, dependency và chuỗi override hiện tại. Không xóa hoặc di chuyển implementation chỉ dựa trên map này. Mỗi function chỉ được tách sau khi đã kiểm tra toàn bộ call site và xác định implementation canonical.

## 1. Tổng quan cấu trúc hiện tại

`index.html` hiện chứa đồng thời:

- HTML shell + navigation + modal/toast containers
- CSS giao diện chung
- runtime data `db`
- shared helpers
- implementation nghiệp vụ V1
- các lớp nâng cấp V2.1 → V8
- nhiều implementation lịch sử và override cùng tên
- compatibility hooks cho V10/V9
- bootstrap cuối file gọi `v10-sync.js`

### Runtime flow hiện tại

```text
index.html
├── HTML/CSS shell
├── runtime db + shared helpers
├── V1 implementation
├── V2.1 units + batch pricing
├── Round 1 / V3.1 recipes + costing
├── Round 2 pricing
├── Round 3 price history + alerts
├── Round 4 inventory + production
├── Round 5 POS + orders + invoice
├── Round 6 cashflow
├── Round 7 reports
├── V8 customers + employees + permissions + account switching
└── v10-sync.js
```

---

# 2. HTML Shell / Core UI

## Ownership

**Current owner:** `index.html`

### Shell

- `.app`
- `.sidebar`
- `.nav`
- `.main`
- `.topbar`
- `#view`
- `#modalBack` / `#modal`
- `#toast`
- mobile overlay / menu button

### Navigation pages

```text
dashboard
ingredients
recipes
products
inventory
production
pos
cashflow
customers
employees
alerts
reports
settings
```

### Important inline handlers

- `go('alerts')`
- `v9OpenAccount()`
- navigation button `.onclick`
- modal close behavior
- mobile menu behavior

**Extraction note:** Shell should remain in `index.html` initially. Navigation behavior must not be extracted together with a domain implementation until the final routing contract is stable.

---

# 3. Shared Runtime / Utilities

## Current implementation in `index.html`

### Runtime data

```text
db
KEY
legacySampleData
cart
checkoutState
posMode
invoiceImageCache
editingRecipeId
recipeReturnDraft
```

### Generic helpers

```text
money()
num()
id()
today()
fmtDate()
fmtMoney()
f()
toast()
openModal()
closeModal()
filterTable()
```

### Navigation / rendering

```text
go()
closeMenu()
render()
```

### Cross-domain lookup helpers

```text
ingName()
recipeName()
productName()
```

### Costing / inventory helpers used by multiple domains

```text
productCost()
productCostBreakdown()
inventoryTotals()
standardPricePerUnit()
priceInUnit()
convertQty()
unitInfo()
recipeStandardCost()
recipeLeafNeeds()
recipeEffectiveYield()
recipeCostPerYield()
```

### Persistence bridge

```text
save()
```

Current behavior is intentionally only:

```text
window.dispatchEvent(new CustomEvent('fnb:data-saved'))
```

**Extraction rule:** these helpers must not be copied into individual domain files. They are cross-domain infrastructure and need a shared ownership decision before domain extraction.

---

# 4. Data Initialization / Migration Layers

## Base data

Initial `db` contains:

```text
ingredients
batches
recipes
products
plans
sales
cash
customers
debts
employees
roles
customerGroups
loyaltySettings
priceHistory
priceAlerts
settings
```

## Migration / upgrade blocks

### V2.1

- `UNIT_GROUPS`
- `unitInfo()`
- `unitOptions()`
- `convertQty()`
- `standardPricePerUnit()`
- `priceInUnit()`

### V3.1

- recipe history initialization
- recipe version fields
- recipe line normalization

### Round 2

- `db.settings.r2`
- pricing defaults

### Round 3

- `db.priceHistory`
- `db.priceAlerts`

### Round 4

- `db.inventoryHistory`
- `db.purchaseReceipts`
- production plan fields

### Round 5

- invoice settings
- vouchers
- sales normalization

### Round 6

- cash normalization
- debts normalization
- shifts
- reconciliations
- historical sales → cash entries

### V8

- customers/groups/loyalty
- employees/roles/session

**Extraction note:** migrations are cross-cutting and must remain ordered. Do not move a migration into a domain module unless module load order guarantees it runs before every consumer.

---

# 5. Dashboard Domain

## Current canonical renderer

The final dashboard implementation is the later V5 `dashboard()` implementation.

### Functions / dependencies

```text
dashboard()
  ├── inventoryTotals()
  ├── alerts()
  ├── activeOrders()
  ├── productCost()
  ├── db.sales
  ├── db.products
  └── db.batches
```

### Existing extracted facade

```text
v10/ui/dashboard.js
```

**Status:** facade exists; implementation still in `index.html`.

**Extraction priority:** relatively safe read-only domain, but shared helpers must be resolved first.

---

# 6. Ingredients Domain

## Render chain

```text
ingredients()
    ↓
ingredientsRound3()
```

Final renderer: `ingredientsRound3()`.

## Core functions

```text
ingredientModal()
updateIngredientUnitHint()
saveIngredientV21()
impactedProducts()
ingredientImpactHtml()
impactModal()
quickIngredientModal()
saveQuickIngredient()
```

## Price intelligence

```text
r3RecipeUsesIngredient()
r3AffectedRecipes()
r3AffectedProducts()
r3RecipeCostDelta()
r3ProductCostDelta()
r3RecordPriceChange()
r3PriceHistoryForIngredient()
r3PriceHistoryModal()
r3ImpactModal()
r3AllChanges()
r3ExportChanges()
r3ChangesModal()
r3UnreadPriceAlerts()
r3MarkPriceAlertsRead()
r3UnreadAlertsModal()
r3FinishUnreadAlertsView()
r3IngredientRowActions()
r3ClickableAlert()
```

## Cross-domain dependencies

```text
Recipes → ingredient references
Products → productCostBreakdown()
Inventory → batches / stock
Alerts → price alerts
```

### Existing extracted facade

```text
v10/ui/ingredients.js
```

**Status:** facade exists; implementation still in `index.html`.

**Safety:** ingredient deletion/impact behavior must be mapped before extraction.

---

# 7. Recipes Domain

## Historical implementation

```text
recipeLineV1()
refreshRecipeLine()
addRecipeLineV1()
saveRecipeV1()
recipeLine()
addRecipeLine()
saveRecipe()
```

These are historical implementations and should not be blindly extracted.

## Canonical V3.1 implementation

```text
recipeLineV31()
refreshRecipeLineV31()
addRecipeLineV31()
hasRecipeCycle()
saveRecipeV31()
recipeModal()
recipes()
cloneRecipe()
recipeSnapshot()
recipeVersionData()
recipeDetailModal()
recipeHistoryModal()
```

## Costing dependencies

```text
recipeLineEffectiveQty()
recipeStandardCost()
recipeLeafNeeds()
recipeTheoreticalCost()
recipeEffectiveYield()
recipeCostPerYield()
```

## Quick ingredient / draft behavior

```text
quickIngredientModal()
saveQuickIngredient()
editingRecipeId
recipeReturnDraft
```

### Existing extracted facade

```text
v10/ui/recipes.js
```

**Status:** facade exists; implementation still in `index.html`.

**Safety:** recipe history/versioning and nested recipe cycle detection must remain intact.

---

# 8. Products / Pricing Domain

## Historical renderer chain

```text
products()
productsRound2()
productsV5()
productsNormalV5()
```

Final product presentation is explicitly restored to the simple V4-style renderer:

```text
productsNormalV5()
```

and later:

```text
productModal(editId) → productModalNormalV5()
```

## Product editor

```text
productModal()
productModalV5()
productModalNormalV5()
componentLine()
addComponent()
saveProduct()
saveProductV5()
saveProductNormalV5()
```

## Pricing calculation layer

```text
r2()
roundPrice()
r2FixedPerProduct()
r2LaborCost()
r2Cost()
r2SuggestedRaw()
r2Suggested()
r2CurrentMargin()
r2CurrentProfit()
r2PriceStatus()
r2CostLines()
r2CostDetailHtml()
priceGuideModal()
```

## Product quick pricing in POS

Separate from the Products page:

```text
productQuickPriceModalV5()
setCartQuickPriceV5()
quickInputPriceV5()
quickDiscountV5()
saveCartRefreshV5()
```

### Existing extracted facade

```text
v10/ui/pricing.js
```

**Status:** facade exists; implementation still in `index.html`.

**Critical safety rule:** preserve the current `productsNormalV5()` presentation and the current “Giá bán đề xuất” behavior from `productsRound2()` where it is intentionally routed. Do not delete historical pricing implementations until all references are mapped.

---

# 9. Inventory Domain

## Render chain

```text
inventory()
    ↓
inventoryRound4()
```

Final inventory renderer: `inventoryRound4()`.

## Core inventory functions

```text
r4LotValue()
r4ValidLots()
r4ExpiredLots()
r4RecordMovement()
r4RecordSimpleMovement()
r4ReceiptLine()
r4SyncReceiptLine()
addR4ReceiptLine()
r4ReceiptModal()
r4UpdateReceiptTotal()
r4SaveReceipt()
r4InventoryHistoryModal()
r4RenderHistoryRows()
r4AdjustModal()
r4PopulateAdjLots()
r4SaveAdjustment()
ingredientBatches()
deleteBatch()
```

## Cross-domain dependency

```text
Production → FEFO issue
Production → inventoryHistory
Cashflow → purchase expense
Ingredients → batch references
```

### Existing extracted facade

```text
v10/ui/inventory.js
```

**Status:** facade exists; implementation still in `index.html`.

**Extraction rule:** inventory and production remain one dependency cluster during extraction because production mutates inventory lots and history.

---

# 10. Production Domain

## Render chain

```text
production()
    ↓
productionRound4()
    ↓
productionRound4 reassigned by later V4 patches
```

Final implementation is the latest reassigned `productionRound4`.

## Plan functions

```text
r4PlanModal()
r4PlanItem()
r4BindPlanRows()
r4AddPlanItem()
r4UpdatePlanPreview()
r4SavePlan()
r4UpdateDraftPlan()
r4OpenEditDraft()
r4ApprovePlanV4()
r4ApprovePlan()
r4StartPlan()
r4FinishPlan()
r4CompletePlan()
r4PlanShortages()
r4PlanShortagesForPlan()
r4PlanReservedNeeds()
r4PlanAvailableAfterReservations()
r4GlobalPlanOverview()
r4PlanListItemV4()
r4PlanListItem()
r4RenderPlanTable()
r4PlanDetail()
```

## Formula snapshot

```text
r4RecipeTree()
r4FormulaRows()
r4FormulaCard()
r4BuildFormulaSnapshot()
r4PrintTicket()
```

## FEFO / actual cost

```text
r4IssueNeeds()
r4IssuedCost()
r4ValidLots()
r4RecordMovement()
```

### Existing extracted facade

```text
v10/ui/production.js
```

**Status:** facade exists; implementation still in `index.html`.

**Critical safety:**

- Draft → Approved → Producing → Completed
- Approved plans reserve inventory
- Producing issues inventory by FEFO
- Completed must not issue inventory again
- Actual cost uses the already-issued lots
- Formula snapshot preserves recipe/version at planning time

These behaviors must be preserved during extraction.

---

# 11. POS / Sales Domain

## Renderer chain

Historical:

```text
pos()
```

Final `pos()` switches between:

```text
posSalePage()
orderHistoryPage()
```

## Cart / checkout

```text
cart
posMode
checkoutState
posProducts()
renderPosProducts()
addCart()
changeCartV5()
clearCart()
cartHtmlV5()
calcCheckout()
paymentTotal()
paymentLabel()
paymentRowHtml()
addPaymentRow()
removePaymentRow()
renderCheckoutBox()
refreshPaymentSummary()
applyVoucher()
resetCheckout()
```

## Order lifecycle

```text
completeOrderV5()
orderHistoryPage()
renderOrderRows()
orderRowsHtml()
orderStatusBadge()
orderDetailModal()
cancelOrderV5()
returnOrderV5()
confirmReturnV5()
```

## Customer / voucher interactions

```text
customerModal()
saveCustomerV5()
customerListModal()
voucherModal()
newVoucherForm()
saveVoucherV5()
```

## Invoice

```text
printInvoiceV5()
previewInvoiceContentV5()
previewInvoiceV5()
invoiceImageDocumentV5()
saveInvoiceImageV5()
numberToVietnameseWordsV5()
escapeHtmlV5()
```

### Existing extracted facades

```text
v10/ui/sales.js
v10/ui/customers.js
```

**Status:** facades exist; implementation still in `index.html`.

**Critical safety:** POS is a complete checkout lifecycle. Do not split cart, checkout, payment, order history, return, cancellation and invoice independently until all references are mapped.

---

# 12. Customers Domain

## V8 implementation

```text
customerModal()
v8SaveCustomer()
v8CustomerDebt()
v8SaveDebt()
v8CustomerDetail()
renderV8Customers()
v8CustomerSettingsHtml()
v8SaveLoyalty()
v8FilterCustomers()
```

## Data

```text
db.customers
db.customerGroups
db.loyaltySettings
db.debts
```

## Dependencies

```text
POS → customerId / customer history
Cashflow → customer debt
Employees/permissions → navigation access
```

### Existing extracted facade

```text
v10/ui/customers.js
```

**Status:** facade exists; V8 implementation still in `index.html`.

---

# 13. Cashflow Domain

## Renderer

```text
cashflowPage()
```

## Cash ledger

```text
r6CashMethodLabel()
r6CashTypeLabel()
r6CashSourceKey()
r6CashEntries()
r6CashTotals()
r6CashRowsHtml()
r6CashModal()
r6SaveCash()
```

## Debt

```text
r6DebtOutstanding()
r6DebtStatus()
r6DebtBadge()
r6DebtRowsHtml()
r6DebtModal()
r6SaveDebt()
r6DebtPaymentModal()
r6CollectDebt()
r6DebtBookModal()
```

## Shift / reconciliation

```text
r6CurrentShift()
r6ShiftTotals()
r6OpenShiftModal()
r6OpenShift()
r6CloseShiftModal()
r6CloseShift()
r6ReconcileModal()
r6SaveReconcile()
r6ReportModal()
r6ReportHtml()
```

## Cross-domain wrappers

```text
completeOrderV5 → cashflow income
cancelOrderV5 → cashflow refund
confirmReturnV5 → cashflow refund
```

### Existing extracted facade

```text
v10/ui/cashflow.js
```

**Status:** facade exists; implementation still in `index.html`.

**Safety:** cashflow depends on POS lifecycle and customer debts. Extract after POS/customer dependency boundaries are stable.

---

# 14. Alerts Domain

## Shared calculation

```text
alerts()
```

Current alert sources:

- inventory empty/low stock
- expired / near-expiry lots
- production shortages
- price-change alerts

## Presentation

```text
alertsPage()
alertsRound2()
alertsPageRound2()
alertsPageRound3()
r3ClickableAlert()
r3UnreadAlertsModal()
```

Final alert renderer is the later Round-3 implementation:

```text
alertsPageRound3()
```

### Existing extracted facade

```text
v10/ui/alerts.js
```

**Status:** facade exists; implementation still in `index.html`.

**Extraction rule:** keep calculation (`alerts()`) separate from presentation (`alertsPageRound3()`) when extracting.

---

# 15. Reports Domain

## Renderer chain

Historical:

```text
reports()
reportsV5New()
reportsV5
reports()
```

Final route is later overridden to:

```text
r7ReportHtml()
```

## Report helpers

```text
r7DateValue()
r7StartDate()
r7EndDate()
r7InRange()
r7Sales()
r7CompletedPlans()
r7InventoryValue()
r7SalesQty()
r7RevenueByDay()
r7IngredientConsumption()
r7PurchaseRows()
r7PriceHistory()
r7Bar()
r7SvgChart()
r7ProfitByTime()
r7ProfitChart()
r7ReportHtml()
r7Apply()
r7Clear()
r7ExportCSV()
r7PrintPDF()
```

### Existing extracted facade

```text
v10/ui/reports.js
```

**Status:** facade exists; final report implementation still in `index.html`.

**Map warning:** `r7CompletedPlans()` currently filters `status==='done'`, while Round 4 normalizes completed plans to `status==='completed'`. This is an existing cross-version inconsistency to verify during testing/extraction; do not silently change it as part of the map.

---

# 16. Settings Domain

## Historical renderer

```text
settings()
settingsRound2()
renderV8Settings()
```

Final V8 settings entry keeps the existing `settingsRound2()` content and appends/owns V8 customer/loyalty settings elsewhere.

## Pricing settings

```text
r2()
r2LaborCost()
r2FixedPerProduct()
saveRound2SettingsTime()
```

## Invoice settings

```text
invoiceImageCache
previewInvoiceImage()
saveInvoiceSettingsV5()
previewInvoiceTemplate()
```

## Compatibility settings

```text
v9SettingsCard()
v9TestConnection()
```

### Existing extracted facades

```text
v10/ui/pricing.js
v10/ui/settings.js
```

**Status:** facades exist; canonical settings implementation remains in `index.html`.

**Safety:** settings contains pricing, labor, fixed/variable costs, tax, target profit, rounding, invoice, logo/QR and display settings. It must be extracted as a dependency-aware cluster rather than by visual card boundaries only.

---

# 17. Employees / Permissions Domain

## Data

```text
db.employees
db.roles
db.sessionEmployeeId
```

## Permission helpers

```text
currentEmployee()
currentRole()
isAdmin()
can()
v8RefreshPermissions()
```

## Employee lifecycle

```text
v8EmployeeModal()
v8SaveEmployee()
v8EmployeeDetail()
renderV8Employees()
```

## Role lifecycle

```text
v8RoleModal()
v8SaveRole()
```

## Account switching

```text
v8LoginModal()
v8Login()
```

### Existing extracted facade

```text
v10/ui/employees.js
```

**Status:** facade exists; V8 implementation remains in `index.html`.

**Critical safety:** Admin cannot be downgraded/deactivated; role permissions control navigation; account switching delegates authentication to `v10LoginAccount()`.

---

# 18. Compatibility / V9 Hooks Still Referenced by Index

The final `index.html` still references or depends on legacy public names, including:

```text
v9OpenAccount()
v9SettingsCard()
v9TestConnection()
```

The V10 compatibility layer is expected to provide these names.

**Extraction rule:** do not remove these calls until `v10/compatibility.js` is verified as the sole compatibility owner.

---

# 19. Render Override Chain

This is one of the most important parts of the monolith.

### Base

```text
render(page)
```

### Round 2

```text
_renderBeforeRound2Final
render = function(page){
  products → productsRound2()
  settings → settingsRound2()
  alerts → alertsPageRound2()
  otherwise → previous render
}
```

### Round 3

```text
_renderBeforeRound3
render = function(page){
  ingredients → ingredientsRound3()
  alerts → alertsPageRound3()
  otherwise → previous render
}
```

### Round 4

```text
_renderBeforeRound4
render = function(page){
  inventory → inventoryRound4()
  production → productionRound4()
  otherwise → previous render
}
```

### Round 7

```text
r7RenderBase
render = function(page){
  reports → r7ReportHtml()
  otherwise → previous render
}
```

### Final V5 product patch

```text
_renderV5Patch
render = function(page){
  products → productsNormalV5()
  otherwise → previous render
}
```

### V8

V8 intentionally does **not** override `go()` / `render()` globally. It binds selected navigation buttons directly and provides:

```text
renderV8Customers()
renderV8Employees()
renderV8Settings()
```

**Extraction priority:** resolve this chain before removing any old renderer.

---

# 20. `go()` Override Chain

Base:

```text
go(page)
```

Later Round 6 reassigns:

```text
const _goBeforeR6 = go;
go = function(page){
  ...
  if(page==='cashflow') cashflowPage();
  else _goBeforeR6(page);
}
```

V8 explicitly avoids another global `go()` override and binds customers/employees/settings buttons directly.

**Extraction rule:** navigation ownership should eventually move to a single V10 UI router, but that is a later architectural step, not part of the first Domain Extraction.

---

# 21. Important Function Override / Alias Table

| Function | Historical → final/current | Domain | Extraction caution |
|---|---|---|---|
| `render` | base → R2 → R3 → R4 → R7 → V5 product patch | Core UI / all domains | Must untangle before extraction |
| `go` | base → Round 6 wrapper | Core UI | Must preserve cashflow special route |
| `dashboard` | base → V5 final | Dashboard | Shared `activeOrders()` dependency |
| `ingredients` | base → `ingredientsRound3` route | Ingredients | Price history/alerts |
| `products` | base → `productsRound2` → `productsV5` → `productsNormalV5` | Products/Pricing | Canonical final must be verified |
| `productModal` | historical → `productModalV5` → `productModalNormalV5` | Products | Do not remove historical editor before call-site audit |
| `pos` | base → V5 sale/history | Sales | Full checkout lifecycle |
| `addCart` | base → V5 → later quick-price version | Sales | Cart price override must survive |
| `cartHtmlV5` | multiple definitions | Sales | Final definition must be identified |
| `calcCheckout` | multiple definitions | Sales | Final definition uses per-line `unitPrice` |
| `completeOrderV5` | multiple definitions + Round 6 wrapper + V8 loyalty wrapper | Sales / Cashflow / Customers | Highest-risk extraction area |
| `orderDetailModal` | earlier → invoice-image-aware final | Sales | Preserve invoice preview/save actions |
| `printInvoiceV5` | multiple definitions | Sales/Settings | Preserve final invoice settings |
| `reports` | multiple definitions → final R7 route | Reports | Final route is `r7ReportHtml()` |
| `productionRound4` | multiple reassignment layers | Production | Final implementation is latest reassignment |
| `r4SavePlan` | multiple reassignment layers | Production | Final saves time + formula snapshot |
| `r4PlanDetail` | multiple reassignment layers | Production | Final shows shortage + formula snapshot |
| `r4PlanListItem` | base → V4 final | Production | Final shows shortage/edit controls |
| `r4RenderPlanTable` | base → later reassignment | Production | Final table includes shortage + edit |
| `cashflowPage` | base → debt-book wrapper | Cashflow | Preserve Sổ ghi nợ button |
| `customerModal` | earlier POS version → V8 customer version | Customers | Final V8 version is canonical |
| `saveCustomerV5` | POS customer version | Customers/POS | V8 has separate `v8SaveCustomer` |

---

# 22. Domain Dependency Graph

```text
                         ┌──────────────┐
                         │ Shared Core  │
                         │ db/helpers   │
                         └──────┬───────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
     Ingredients            Recipes              Products
          │                     │                     │
          └──────────────┬──────┴──────────────┐      │
                         │                     │      │
                    Inventory            Pricing/Cost │
                         │                     │      │
                         └──────────┬──────────┘      │
                                    │                 │
                               Production             │
                                    │                 │
                                    └────────┬────────┘
                                             │
                                        POS / Sales
                                           │   │
                              ┌────────────┘   └─────────────┐
                              │                              │
                         Customers                      Cashflow
                              │                              │
                              └──────────┬───────────────────┘
                                         │
                                      Reports
                                         │
                            ┌────────────┴────────────┐
                            │                         │
                         Alerts                   Settings
                            │
                         Dashboard

Employees / Permissions cuts across all routes.
Compatibility / Auth / Sync cuts across the entire application.
```

---

# 23. Extraction Order from This Map

Follow the already approved order from `DOMAIN-MAP.md`, but use this detailed map to decide exact boundaries:

1. Dashboard + Reports
2. Products + Pricing
3. Ingredients + Recipes
4. Inventory + Production
5. Customers + POS/Sales
6. Cashflow
7. Employees/Permissions
8. Alerts/Settings cleanup

Before each extraction:

```text
1. Identify canonical implementation.
2. Identify every caller.
3. Identify shared dependencies.
4. Move implementation without behavior change.
5. Replace index call sites with module facade/API only where safe.
6. Verify syntax/static references.
7. Only then remove old implementation.
```

---

# 24. Things NOT to Remove During First Domain Extraction

Do not remove these merely because a facade exists:

- historical renderer implementations
- old editor implementations
- shared helpers
- `db` lexical binding
- `save()` bridge
- V8 permission functions
- V9 compatibility call sites
- migration blocks
- invoice helpers used by POS/settings
- pricing/cost helpers used by production/reports/alerts
- inventory helpers used by dashboard/production/reports

---

# 25. First Domain Extraction Candidate

The first real extraction should be **Dashboard + Reports**, because they are mostly read-only.

However, before moving them, the shared calculation dependencies must be assigned explicitly:

```text
inventoryTotals()
alerts()
activeOrders()
productCost()
productCostBreakdown()
recipeStandardCost()
recipeLeafNeeds()
recipeEffectiveYield()
```

Those functions should not be duplicated into dashboard/reports modules.

**Current state after Index Map:**

```text
✅ Domain Map
✅ Domain Facades
✅ Index Map
⏭️ Domain Extraction
```
