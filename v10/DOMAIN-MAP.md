# F&B Manager V10 — Domain Map

This map is the safety boundary for Phase 8. It documents the current `index.html` domains before any large extraction. The refactor must preserve existing UI/business behavior.

## Runtime ownership

| Responsibility | Current owner | Target owner |
|---|---|---|
| DOM shell + shared UI primitives | `index.html` | `index.html` initially; extract later only if safe |
| Runtime data object `db` | `index.html` lexical binding | shared runtime contract |
| API transport | `v10/api.js` | `v10/api.js` |
| Online sync/save/polling | `v10/sync.js` | `v10/sync.js` |
| Authentication/session facade | `v10/auth.js` | `v10/auth.js` |
| Legacy public names | `v10/compatibility.js` | `v10/compatibility.js` |
| Cross-cutting UI patches | `v10-ui-patches.js` | gradually reduced |

## Page domains

### 1. Dashboard

- Route: `dashboard`
- Renderer: `dashboard()`
- Main dependencies: `inventoryTotals()`, `alerts()`, `activeOrders()`, `productCost()` / `fmtMoney()` depending on active renderer layer.
- Read-only summary; should be extracted only after shared calculation helpers are mapped.

### 2. Ingredients

- Route: `ingredients`
- Renderers: `ingredients()`, `ingredientsRound3()`.
- Core actions: `ingredientModal()`, ingredient save/update, ingredient impact/history helpers.
- Round-3 price intelligence adds price history and alerts.
- V10 extracted UI patch: `v10/ui/ingredients.js` owns quick-create and delete behavior.
- Important dependency: recipe/batch/inventory/purchase references must be checked before deletion.

### 3. Recipes

- Route: `recipes`
- Renderer: `recipes()`.
- Core actions: `recipeModal()`, recipe save, clone/history/detail helpers, recipe costing helpers.
- V10 extracted UI patch: `v10/ui/recipes.js` owns draft capture/restore around quick ingredient creation.
- Important dependency: ingredient data and nested recipe costing.

### 4. Products / Pricing

- Route: `products`
- Renderers currently coexist: `products()`, `productsV5()`, `productsNormalV5()`, `productsRound2()`.
- Canonical V10 UI behavior is forced through `productsRound2()` by `v10-ui-patches.js`.
- Pricing helpers include `productCost()`, `suggestedSellingPrice()`, `r2Cost()`, `r2Suggested()`, `r2PriceStatus()` and related helpers.
- Product editor has multiple historical implementations; do not extract the editor until the canonical implementation and all call sites are confirmed.

### 5. Inventory

- Route: `inventory`
- Renderers: `inventory()`, `inventoryRound4()`.
- Core concepts: batches/lots, inventory history, FEFO, adjustments, purchase receipts.
- Main helpers/actions include `inventoryTotals()`, batch/receipt/adjustment modals, lot views, and inventory history.
- Important dependency: production consumes inventory and writes inventory history.

### 6. Production

- Route: `production`
- Renderers: `production()`, `productionRound4()`.
- Core concepts: plans, theoretical cost, actual cost, FEFO issue, output, waste, completion.
- Depends on products, recipes, ingredients, inventory lots, and cost helpers.
- Important: production and inventory must be treated as one dependency cluster during extraction.

### 7. POS / Sales

- Route: `pos`
- Renderer and helpers include `pos()`, product search/rendering, cart state, checkout state, payment rows, voucher logic, order completion/history/detail/return/cancel/invoice helpers.
- `db.sales`, `db.customers`, `db.products`, and pricing/cost helpers are cross-domain dependencies.
- Do not split POS into several files until the complete checkout lifecycle is mapped.

### 8. Cashflow

- Route: `cashflow`
- Data: `db.cash`, `db.debts` and related transaction helpers.
- Depends on sales/payment data and customer data.
- Extract after POS/customer dependencies are stable.

### 9. Customers

- Route: `customers`
- Data: `db.customers`, `db.customerGroups`, `db.loyaltySettings`, plus order history.
- Customer forms/list/detail helpers are coupled to POS checkout and order history.

### 10. Employees / Permissions

- Route: `employees`
- Data: `db.employees`, `db.roles`, `db.sessionEmployeeId`.
- Permission helpers include `currentEmployee()` and `currentRole()` and the existing `v8RefreshPermissions()` integration.
- This domain must remain compatible with `refresh()` permission refreshes.

### 11. Alerts

- Route: `alerts`
- Renderer: `alertsPage()`.
- Shared calculation: `alerts()`.
- Depends on inventory, ingredient price changes, production and other domain warnings.
- Keep alert calculation separate from alert presentation when extracting.

### 12. Reports

- Route: `reports`
- Renderer: `reports()` plus later `reportsV5` override.
- Depends on active sales, product cost/pricing, inventory and product stock.
- Extract only after canonical sales filtering is established.

### 13. Settings

- Route: `settings`
- Renderer: `settings()` plus V10 settings/online card integration.
- V10 compatibility currently exposes `v9SettingsCard()` and `v9TestConnection()`.
- Pricing settings are already patched through `v10/ui/pricing.js`.

## Cross-domain helpers that must NOT be copied into individual modules

- `money()`, `num()`, `id()`, `today()`, `fmtDate()`
- `toast()`, `openModal()`, `closeModal()`, `f()` and shared form helpers
- `render()`, `go()` and navigation helpers
- `productCost()` / canonical costing helpers
- `inventoryTotals()` where used by multiple domains
- `save()` / online persistence bridge

## Extraction order

1. Dashboard + Reports (read-only, after helper mapping)
2. Products + Pricing (canonicalize renderer first)
3. Ingredients + Recipes (already partially isolated)
4. Inventory + Production (keep FEFO/cost dependency together)
5. Customers + POS/Sales (keep checkout lifecycle together)
6. Cashflow
7. Employees/Permissions
8. Alerts/Settings cleanup

## Safety rule

No domain extraction should remove a function from `index.html` until every reference is accounted for and the canonical implementation is identified. Historical overrides such as `productsV5()` / `productsNormalV5()` / `productsRound2()` are intentionally documented rather than blindly deleted.
