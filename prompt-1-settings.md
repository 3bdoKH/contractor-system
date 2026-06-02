# Agent Prompt 1 — صفحة الإعدادات (Settings Page)

> Add this feature to the existing Electron + React + TypeScript contractor system. Do NOT modify any existing working features.

---

## Overview

Add a **Settings page (الإعدادات)** that lets the user configure app-wide information currently hardcoded in the app. Settings are persisted in a `settings` table in the existing SQLite database.

---

## Database — Add Settings Table

Add this inside the existing `initDB()` in `src/main/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

On first run, seed these default values if the table is empty:

```ts
const defaults = [
  { key: 'contractor_name', value: 'نظام المقاول' },
  { key: 'contractor_phone', value: '' },
  { key: 'contractor_address', value: '' },
  { key: 'pdf_header_title', value: 'كشف حساب' },
  { key: 'pdf_footer_note', value: '' },
];
```

---

## IPC Handlers — New File

Create `src/main/ipc/settings.ts` and register it in `src/main/index.ts` as `registerSettingsHandlers()`.

| Handler | Description |
|---|---|
| `settings:getAll` | Returns all settings as a flat object `{ contractor_name, contractor_phone, ... }` |
| `settings:update(data)` | Accepts a partial object and updates each key using INSERT OR REPLACE |

---

## Preload — Update `src/preload/preload.ts`

Add to the existing `api` object:

```ts
settings: {
  getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:getAll'),
  update: (data: Record<string, string>) => ipcRenderer.invoke('settings:update', data),
},
```

---

## New Page — `src/renderer/src/pages/Settings.tsx`

A clean single-page form with these fields:

| Field | Key | Label |
|---|---|---|
| Text input | `contractor_name` | اسم المقاول / اسم النشاط |
| Text input | `contractor_phone` | رقم الهاتف |
| Text input | `contractor_address` | العنوان |
| Text input | `pdf_header_title` | عنوان التقرير في PDF |
| Text input | `pdf_footer_note` | ملاحظة أسفل التقرير (اختياري) |

- Load current values on mount via `settings:getAll`
- Single "حفظ الإعدادات" button that calls `settings:update`
- Show a success toast/message after saving: "تم حفظ الإعدادات بنجاح ✓"
- Show error message if save fails

---

## Routing — Update `App.tsx`

Add:
```tsx
<Route path="/settings" element={<Settings />} />
```

---

## Sidebar — Update `Sidebar.tsx`

Add a settings link at the **bottom** of the sidebar, separated from the main nav links:

```
الإعدادات  (Settings icon from lucide-react)
```

---

## Update PDF Print Handlers

In `src/main/ipc/print.ts`, both `print:customerReport` and `print:supplierReport` must:

1. Load settings at the start of each handler:
```ts
const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
const cfg: Record<string, string> = {};
settings.forEach((s: any) => { cfg[s.key] = s.value; });
```

2. Replace all hardcoded strings in the HTML template:
- App title → `cfg.contractor_name || 'نظام المقاول'`
- PDF header title → `cfg.pdf_header_title || 'كشف حساب'`
- Footer note → `cfg.pdf_footer_note` (show only if not empty)

---

## Update App Title — `src/main/index.ts`

Load the contractor name from DB and set it as the window title:

```ts
const nameSetting = db.prepare("SELECT value FROM settings WHERE key = 'contractor_name'").get() as any;
mainWindow.setTitle(nameSetting?.value || 'نظام المقاول');
```

---

## Important Rules

1. All text Arabic only, RTL layout
2. Do NOT modify any existing customer, supplier, invoice, or payment code
3. Settings keys are fixed strings — do not allow the user to add/remove keys
4. Use the same Tailwind styling patterns as the rest of the app
5. The settings form should show the current saved values when opened, not empty fields
