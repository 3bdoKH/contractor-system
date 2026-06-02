# Agent Prompt — إضافة صفحة الموردين والتوريدات

> Add this feature to the existing Electron + React + TypeScript contractor system. Follow the exact same patterns already used in the codebase for customers, invoices, and payments.

---

## Overview

Add a completely separate **Suppliers (الموردين)** section to the app. It mirrors the customer/invoice/payment pattern but from the purchasing side:

- A **supplier** (مورد) is someone you buy materials from
- A **supply invoice** (فاتورة توريد) records what you purchased, quantity, and cost
- **Payments** track what you've paid toward each supply invoice
- The system shows how much you still owe each supplier

---

## Database — Add These Tables

```sql
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supply_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,  -- e.g. SUP-1001
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  date TEXT NOT NULL,                   -- manually entered
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supply_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supply_invoice_id INTEGER NOT NULL REFERENCES supply_invoices(id),
  merchandise_id INTEGER REFERENCES merchandise(id), -- null if custom
  custom_name TEXT,                     -- used if merchandise_id is null
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supply_invoice_id INTEGER NOT NULL REFERENCES supply_invoices(id),
  amount REAL NOT NULL,
  date TEXT NOT NULL,                   -- manually entered
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Add these tables inside the existing `initDB()` function in `src/main/db/index.ts`.

---

## IPC Handlers — New File

Create `src/main/ipc/suppliers.ts` and register it in `src/main/index.ts` as `registerSupplierHandlers()`.

### Suppliers

| Handler | Description |
|---|---|
| `suppliers:getAll` | All suppliers with balance summary (total_invoiced, total_paid, total_remaining), ordered by name |
| `suppliers:getById(id)` | Supplier + all supply invoices + items + payments per invoice |
| `suppliers:create(data)` | Create supplier `{ name, phone?, address?, notes? }` |
| `suppliers:update(id, data)` | Update supplier info |
| `suppliers:delete(id)` | Cascade delete supplier → supply_invoices → supply_invoice_items + supplier_payments |
| `suppliers:search(query)` | Search by name or phone, includes balance summary |

### Supply Invoices

| Handler | Description |
|---|---|
| `supplyInvoices:create(data)` | Create supply invoice + items. Auto-generate invoice_number starting from SUP-1001. Data: `{ supplier_id, date, notes?, items: [{ merchandise_id?, custom_name?, quantity, unit_price }] }` |
| `supplyInvoices:getBySupplier(supplierId)` | Invoices with items and payment summary |
| `supplyInvoices:delete(id)` | Delete invoice + its items and payments |

### Supplier Payments

| Handler | Description |
|---|---|
| `supplierPayments:add(data)` | Add payment `{ supply_invoice_id, amount, date, notes? }` |
| `supplierPayments:getByInvoice(invoiceId)` | All payments for a supply invoice |
| `supplierPayments:delete(id)` | Delete a payment |

### Balance Calculation

Always calculate invoice status at query time — never store it:
- `مدفوع بالكامل` → `SUM(supplier_payments.amount) >= supply_invoices.total`
- `مدفوع جزئياً` → `SUM > 0 AND < total`
- `غير مدفوع` → `SUM = 0 OR no payments`

---

## Preload — Update `src/preload/preload.ts`

Add to the existing `api` object exposed via `contextBridge.exposeInMainWorld`:

```ts
suppliers: {
  getAll: (): Promise<Supplier[]> => ipcRenderer.invoke('suppliers:getAll'),
  getById: (id: number): Promise<SupplierDetail | null> => ipcRenderer.invoke('suppliers:getById', id),
  create: (data: { name: string; phone?: string; address?: string; notes?: string }) =>
    ipcRenderer.invoke('suppliers:create', data),
  update: (id: number, data: { name: string; phone?: string; address?: string; notes?: string }) =>
    ipcRenderer.invoke('suppliers:update', id, data),
  delete: (id: number) => ipcRenderer.invoke('suppliers:delete', id),
  search: (query: string): Promise<Supplier[]> => ipcRenderer.invoke('suppliers:search', query),
},
supplyInvoices: {
  create: (data: any) => ipcRenderer.invoke('supplyInvoices:create', data),
  getBySupplier: (supplierId: number) => ipcRenderer.invoke('supplyInvoices:getBySupplier', supplierId),
  delete: (id: number) => ipcRenderer.invoke('supplyInvoices:delete', id),
},
supplierPayments: {
  add: (data: any) => ipcRenderer.invoke('supplierPayments:add', data),
  getByInvoice: (invoiceId: number) => ipcRenderer.invoke('supplierPayments:getByInvoice', invoiceId),
  delete: (id: number) => ipcRenderer.invoke('supplierPayments:delete', id),
},
```

Also add the TypeScript interfaces `Supplier`, `SupplierDetail`, `SupplyInvoice`, `SupplyInvoiceItem`, `SupplierPayment` following the exact same pattern as the existing customer interfaces.

---

## New Pages

### `src/renderer/src/pages/Suppliers.tsx`

Identical structure to `Customers.tsx`:
- Page title: **الموردين**
- Search bar (by name or phone)
- Supplier list: name, phone, total remaining debt, status badge
- "مورد جديد" button → modal form (name, phone, address, notes)
- Each supplier row links to `/suppliers/:id`

### `src/renderer/src/pages/SupplierDetail.tsx`

Identical structure to `CustomerDetail.tsx`:
- Supplier info header with edit + delete buttons
- **Print button** — triggers `print:supplierReport(supplierId)` (see Print section below)
- Balance summary cards: إجمالي التوريدات / إجمالي المدفوع / الرصيد المتبقي
- Supply invoice list, each showing:
  - Invoice number, date, total, paid, remaining, status badge
  - Expandable section: items table + payment history
  - "إضافة دفعة" button per invoice
- "فاتورة توريد جديدة" button → links to `/suppliers/:id/new-supply-invoice`

### `src/renderer/src/pages/NewSupplyInvoice.tsx`

Identical structure to `NewInvoice.tsx`:
- Date field (manual input)
- Items table:
  - Each row: dropdown from existing `merchandise` list OR free-text custom item
  - Quantity, unit price, auto-calculated row total
  - Add/remove rows
- Running grand total
- Notes field
- Save → calls `supplyInvoices:create` → navigates to `/suppliers/:id`

### Payment Modal

Reuse or duplicate the existing `PaymentModal.tsx` component for supplier payments. It should call `supplierPayments:add` instead of `payments:add`. Show invoice balance before/after.

---

## Routing — Update `App.tsx`

Add these routes:

```tsx
<Route path="/suppliers" element={<Suppliers />} />
<Route path="/suppliers/:id" element={<SupplierDetail />} />
<Route path="/suppliers/:id/new-supply-invoice" element={<NewSupplyInvoice />} />
```

---

## Sidebar — Update `Sidebar.tsx`

Add a new link below العملاء:

```
الموردين  (with an appropriate icon, e.g. Truck from lucide-react)
```

---

## Dashboard — Update `Dashboard.tsx`

Add two new summary cards below the existing four:

- **إجمالي المشتريات** — total of all supply_invoices
- **إجمالي المستحق للموردين** — total remaining debt across all suppliers (red if > 0)

---

## Print — Add to `src/main/ipc/print.ts`

Add a new IPC handler `print:supplierReport` following the exact same HTML-to-PDF pattern as `print:customerReport`. Layout:

- Header: نظام المقاول + print date
- Supplier info: name, phone, address
- Summary box: إجمالي التوريدات / إجمالي المدفوع / المستحق للمورد
- Per invoice section:
  - Dark header bar: invoice number + date + status
  - Items table: الصنف / الكمية / سعر الوحدة / الإجمالي
  - Totals row: الإجمالي / المدفوع / المتبقي
  - Payments section if any: التاريخ / المبلغ / ملاحظات
- Page numbers

Also add to preload:
```ts
print: {
  customerReport: ..., // existing
  supplierReport: (supplierId: number): Promise<string> =>
    ipcRenderer.invoke('print:supplierReport', supplierId),
}
```

---

## Important Rules

1. All text Arabic only, all layouts RTL
2. Follow the **exact same code patterns** as the existing customers/invoices/payments implementation — same error handling, same loading states, same modal patterns, same Tailwind classes
3. Supply invoice numbers are separate from customer invoice numbers — start from `SUP-1001`
4. Status is always calculated at query time, never stored
5. Cascade deletes: supplier → supply_invoices → supply_invoice_items + supplier_payments
6. Reuse the existing `merchandise:getAll` IPC handler for the items dropdown in NewSupplyInvoice
7. Dates are always manually entered — no forced defaults
8. Do not modify any existing customer/invoice/payment code — only add new code
