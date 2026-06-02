# Agent Prompt 2 — صفحة المصروفات (Expenses Page)

> Add this feature to the existing Electron + React + TypeScript contractor system. Do NOT modify any existing working features. Run this prompt AFTER prompt 1 (Settings) has been completed.

---

## Overview

Add a **Expenses page (المصروفات)** for recording daily business expenses not tied to any supplier — fuel, labor, rent, tools, etc. Each expense has a category, amount, date, and optional notes.

---

## Database — Add Expenses Tables

Add inside the existing `initDB()` in `src/main/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES expense_categories(id),
  custom_category TEXT,        -- used if category_id is null
  amount REAL NOT NULL,
  date TEXT NOT NULL,          -- manually entered
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Seed default categories if `expense_categories` is empty:

```ts
const defaultCategories = [
  'وقود', 'عمالة', 'إيجار', 'صيانة', 'مواصلات',
  'كهرباء', 'مياه', 'اتصالات', 'مستلزمات مكتبية', 'أخرى'
];
```

---

## IPC Handlers — New File

Create `src/main/ipc/expenses.ts` and register it in `src/main/index.ts` as `registerExpenseHandlers()`.

| Handler | Description |
|---|---|
| `expenses:getAll(filters?)` | All expenses ordered by date DESC. Optional filters: `{ from?: string, to?: string, category_id?: number }` |
| `expenses:create(data)` | Create expense `{ category_id?, custom_category?, amount, date, notes? }` |
| `expenses:update(id, data)` | Update expense |
| `expenses:delete(id)` | Delete expense |
| `expenses:getTotal(filters?)` | Returns `{ total }` — sum of filtered expenses |
| `expenses:getCategories()` | Returns all categories |
| `expenses:createCategory(name)` | Add a new custom category |

---

## Preload — Update `src/preload/preload.ts`

Add to the existing `api` object:

```ts
expenses: {
  getAll: (filters?: { from?: string; to?: string; category_id?: number }) =>
    ipcRenderer.invoke('expenses:getAll', filters),
  create: (data: { category_id?: number; custom_category?: string; amount: number; date: string; notes?: string }) =>
    ipcRenderer.invoke('expenses:create', data),
  update: (id: number, data: any) => ipcRenderer.invoke('expenses:update', id, data),
  delete: (id: number) => ipcRenderer.invoke('expenses:delete', id),
  getTotal: (filters?: any) => ipcRenderer.invoke('expenses:getTotal', filters),
  getCategories: () => ipcRenderer.invoke('expenses:getCategories'),
  createCategory: (name: string) => ipcRenderer.invoke('expenses:createCategory', name),
},
```

---

## New Page — `src/renderer/src/pages/Expenses.tsx`

### Layout

- Page title: **المصروفات**
- Top bar with:
  - "مصروف جديد" button (opens modal)
  - Date range filter: from / to (two date inputs)
  - Category filter dropdown
- Summary card at the top: **إجمالي المصروفات** for the current filter
- Expenses list/table

### Expenses Table

Each row shows:
- التاريخ
- الفئة (category name or custom_category)
- المبلغ
- ملاحظات
- Delete button (with confirmation)
- Edit button (opens same modal pre-filled)

### New/Edit Expense Modal

Fields:
- Date (manual input, required)
- Category: dropdown from `expense_categories` + option "أخرى (مخصص)" which reveals a free text field
- Amount (number input, required)
- Notes (optional textarea)

---

## Routing — Update `App.tsx`

Add:
```tsx
<Route path="/expenses" element={<Expenses />} />
```

---

## Sidebar — Update `Sidebar.tsx`

Add between الموردين and الإعدادات:
```
المصروفات  (Receipt or CreditCard icon from lucide-react)
```

---

## Dashboard — Update `Dashboard.tsx`

Add one new summary card:
- **إجمالي المصروفات** — total of all expenses (shown in orange/amber)

---

## Important Rules

1. All text Arabic only, RTL layout
2. Do NOT modify any existing code outside of what is specified above
3. Dates are manually entered — no forced defaults
4. The date range filter should update the list and the total summary card reactively
5. Use the same Tailwind styling patterns as the rest of the app
6. Category dropdown must include all seeded categories + any user-added ones
7. Deleting an expense requires a confirmation prompt
