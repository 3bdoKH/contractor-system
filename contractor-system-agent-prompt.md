# Agent Prompt — نظام المقاول (Contractor System)

---

You are building a **desktop Electron + React + TypeScript** application for an Egyptian building materials contractor. The app is fully in **Arabic, RTL layout**. Use **Tailwind CSS** for styling. The UI must be clean, professional, and easy to use — prioritize clarity and good UX.

---

## Tech Stack

- Electron (main process) + Vite + React + TypeScript (renderer)
- `better-sqlite3` for local database
- `pdfkit` for PDF/print generation
- `react-router-dom` for navigation
- `lucide-react` for icons
- Tailwind CSS

---

## Project Structure

```
src/
├── main/
│   ├── index.ts              ← Electron main process
│   ├── db/
│   │   ├── index.ts          ← DB connection + init
│   │   └── seed.ts           ← seed merchandise items
│   └── ipc/
│       ├── customers.ts
│       ├── invoices.ts
│       ├── payments.ts
│       ├── merchandise.ts
│       └── print.ts
├── preload/
│   └── index.ts              ← exposes window.api
└── renderer/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css          ← RTL + Tailwind base
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── Customers.tsx
        │   ├── CustomerDetail.tsx
        │   └── NewInvoice.tsx
        └── components/
            ├── Layout.tsx
            ├── Sidebar.tsx
            ├── InvoiceCard.tsx
            └── PaymentModal.tsx
```

---

## Database Schema

```sql
CREATE TABLE merchandise (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,  -- e.g. INV-1001
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  date TEXT NOT NULL,                   -- manually entered, stored as ISO string
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  merchandise_id INTEGER REFERENCES merchandise(id), -- null if custom item
  custom_name TEXT,                     -- used if merchandise_id is null
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL GENERATED ALWAYS AS (quantity * unit_price) VIRTUAL
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL,
  date TEXT NOT NULL,                   -- manually entered
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Seed the `merchandise` table on first run with these exact items:

```
اسمنت ابيض, اسمنت اسود, طوب احمر, طوب ابيض, سن, رمل ابيض, رمل اصفر, زلط, حديد, بودرة, اعتاب, مسمار, شمبر, سلك, سيخ 3 لنيا, سيخ 4 لنيا, سيخ 5 لنيا, حديد 2.5, مباني, مصنعيه
```

---

## IPC API (exposed via preload as `window.api`)

### Customers

| Handler | Description |
|---|---|
| `customers.getAll()` | Returns all customers with balance summary (total invoiced, total paid, total remaining) |
| `customers.getById(id)` | Returns customer + all invoices + payments per invoice |
| `customers.create(data)` | Creates new customer |
| `customers.update(id, data)` | Updates customer info |
| `customers.delete(id)` | Deletes customer and all related data (cascade) |
| `customers.search(query)` | Search by name or phone |

### Invoices

| Handler | Description |
|---|---|
| `invoices.create(data)` | Creates invoice + items, auto-generates invoice_number |
| `invoices.getByCustomer(customerId)` | Returns invoices with items and payment summary |
| `invoices.delete(id)` | Deletes invoice and its items and payments |

### Payments

| Handler | Description |
|---|---|
| `payments.add(data)` | Add payment `{ invoice_id, amount, date, notes }` |
| `payments.getByInvoice(invoiceId)` | List all payments for an invoice |
| `payments.delete(id)` | Delete a specific payment |

### Merchandise

| Handler | Description |
|---|---|
| `merchandise.getAll()` | Returns all seeded items |

### Print

| Handler | Description |
|---|---|
| `print.customerReport(customerId)` | Generates A4 PDF, saves to Documents, opens with system viewer |

---

## Pages & Features

### Layout
- RTL sidebar on the **right** (Arabic convention)
- Sidebar links: لوحة التحكم / العملاء
- Clean top bar with app title: **الحاج حسن البطاط**

### Dashboard (`/`)
- Summary cards:
  - إجمالي العملاء
  - إجمالي المبيعات
  - إجمالي المحصل
  - إجمالي المتبقي
- List of customers with outstanding balance (المديونيات), sorted by highest remaining balance

### Customers (`/customers`)
- Search bar (by name or phone)
- Customer list showing: name, phone, total remaining balance, status badge
- Button to add new customer (modal form)

### Customer Detail (`/customers/:id`)
- Customer info header with edit button
- **Print button** — triggers `print.customerReport`
- Invoice list, each invoice card showing:
  - Invoice number, date, total, paid amount, remaining, status badge:
    - `مدفوع بالكامل` (green) — when SUM(payments) >= total
    - `مدفوع جزئياً` (yellow) — when SUM(payments) > 0 but < total
    - `غير مدفوع` (red) — when SUM(payments) = 0
  - Expandable section showing:
    - Invoice items table
    - Payment history list
  - **"إضافة دفعة"** button per invoice
- **"فاتورة جديدة"** button

### New Invoice (`/customers/:id/new-invoice`)
- Date field (manual input, no forced today's date)
- Items table:
  - Each row: dropdown from merchandise list **OR** free-text custom item name
  - Quantity field
  - Unit price field
  - Auto-calculated row total (quantity × unit price)
  - Add row / remove row buttons
- Running grand total at bottom (auto-calculated)
- Notes field
- Save button

### Payment Modal
- Triggered from Customer Detail page per invoice
- Fields: amount, date (manual input), notes
- Shows current invoice balance before and after the payment
- Confirm / Cancel buttons

---

## PDF Print Report (A4)

Generate using `pdfkit`. The font file is at `assets/fonts/Cairo.ttf` — use it for all text to support Arabic rendering. Layout (Arabic, RTL):

### Header
- App name: **الحاج حسن البطاط**
- Print date
- Customer name, phone, address

### Summary Row
- إجمالي الفواتير / إجمالي المدفوع / الرصيد المتبقي

### Per Invoice Section (repeat for each invoice)
- Invoice number + date + status
- **Items table:** الصنف / الكمية / سعر الوحدة / الإجمالي
- **Payments table:** التاريخ / المبلغ / ملاحظات
- Invoice balance at bottom of each section

### Footer
- Page numbers on every page

---

## Important Rules

1. All text in the app is **Arabic only**
2. All layouts are **RTL** — set `dir="rtl"` on the root HTML element and `direction: rtl` in base CSS
3. Invoice status is always **calculated at query time** from the DB, never stored as a column:
   - `مدفوع` → `SUM(payments.amount) >= invoices.total`
   - `جزئي` → `SUM(payments.amount) > 0 AND < invoices.total`
   - `غير مدفوع` → `SUM(payments.amount) = 0 OR no payments`
4. Dates are manually entered by the user — do not default to today's date automatically
5. When deleting a customer, cascade delete all their invoices, invoice_items, and payments
6. The app must work **fully offline** — no external API calls at runtime
7. On first launch, run DB migrations and seed merchandise if the table is empty
8. Use **Tailwind CSS** for all styling — no inline styles, no external UI component libraries
9. IPC handler names must be namespaced: `customers:getAll`, `invoices:create`, `payments:add`, etc.
10. After generating the PDF, open it automatically using Electron's `shell.openPath(outputPath)`
11. Numbers (amounts, quantities) must be formatted with Arabic-style thousand separators where displayed
12. The app is **single user** — no authentication needed
