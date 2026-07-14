import { ipcMain, app, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDb, queryAll, saveDb } from '../db';

/** Parse contractor phones: stored as JSON array or legacy plain string */
function parsePhones(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch { /* not JSON */ }
  return raw ? [raw] : [];
}

/** Build the contractor contact lines for the PDF header */
function buildContractorContactHtml(cfg: Record<string, string>): string {
  const phones = parsePhones(cfg.contractor_phone);
  const address = cfg.contractor_address?.trim();
  const lines: string[] = [];
  if (phones.length > 0) {
    lines.push(`<div class="sub">الهاتف: ${phones.join(' | ')}</div>`);
  }
  if (address) {
    lines.push(`<div class="sub">العنوان: ${address}</div>`);
  }
  return lines.join('\n');
}

interface InventoryFilters {
  from?: string;
  to?: string;
}

interface ManualAdjustment {
  merchandise_id: number;
  manual_quantity: number | null;
  manual_price: number | null;
  notes: string | null;
  updated_at: string;
}

/**
 * Resolve the conversion_factor for (merchandise_id, unit) from merchandise_units.
 * Falls back to 1 if the unit isn't found (unknown / custom unit).
 */
function getConversionFactor(
  conversionMap: Map<string, number>,
  merchandiseId: number,
  unit: string | null,
): number {
  if (!unit) return 1;
  return conversionMap.get(`${merchandiseId}:${unit}`) ?? 1;
}

function getInventoryReportData(filters?: InventoryFilters) {
  const fromDate = filters?.from || '0000-00-00';
  const toDate = filters?.to || '9999-12-31';

  // Load all unit conversion factors into a Map keyed by "merchandiseId:unit"
  const unitRows = queryAll<{
    merchandise_id: number;
    unit: string;
    conversion_factor: number;
    is_default: number;
  }>('SELECT merchandise_id, unit, conversion_factor, is_default FROM merchandise_units');

  // Map for conversion lookups
  const conversionMap = new Map<string, number>();
  // Map from merchandiseId → default unit name (for display)
  const defaultUnitMap = new Map<number, string>();

  for (const u of unitRows) {
    conversionMap.set(`${u.merchandise_id}:${u.unit}`, Number(u.conversion_factor));
    if (u.is_default === 1) {
      defaultUnitMap.set(u.merchandise_id, u.unit);
    }
  }

  // Fetch raw transaction rows (quantity + unit per line item)
  const supplyItems = queryAll<{
    merchandise_id: number;
    quantity: number;
    unit: string | null;
    date: string;
    unit_price: number;
  }>(`
    SELECT sii.merchandise_id, sii.quantity, sii.unit, sii.unit_price, si.date
    FROM supply_invoice_items sii
    JOIN supply_invoices si ON si.id = sii.supply_invoice_id
    WHERE sii.merchandise_id IS NOT NULL
  `);

  const salesItems = queryAll<{
    merchandise_id: number;
    quantity: number;
    unit: string | null;
    date: string;
  }>(`
    SELECT ii.merchandise_id, ii.quantity, ii.unit, i.date
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE ii.merchandise_id IS NOT NULL
  `);

  const merchandise = queryAll<{ id: number; name: string }>(
    'SELECT id, name FROM merchandise ORDER BY name ASC'
  );

  const adjustments = queryAll<{
    merchandise_id: number;
    manual_quantity: number | null;
    manual_price: number | null;
  }>('SELECT merchandise_id, manual_quantity, manual_price FROM inventory_adjustments');
  const adjMap = new Map<number, { manual_quantity: number | null; manual_price: number | null }>();
  for (const a of adjustments) adjMap.set(a.merchandise_id, a);

  // For each merchandise item, compute normalized quantities (all in base unit)
  const items = merchandise.map(m => {
    const mid = m.id;

    // Latest purchase price (use the conversion to get per-base-unit price)
    const latestSupply = supplyItems
      .filter(s => s.merchandise_id === mid)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];

    // per-base-unit price = unit_price / conversion_factor
    const latest_price_raw = latestSupply
      ? latestSupply.unit_price / getConversionFactor(conversionMap, mid, latestSupply.unit)
      : 0;

    // Opening stock: all transactions BEFORE fromDate, normalized to base units
    const opening_incoming = supplyItems
      .filter(s => s.merchandise_id === mid && s.date < fromDate)
      .reduce((sum, s) => sum + s.quantity * getConversionFactor(conversionMap, mid, s.unit), 0);

    const opening_outgoing = salesItems
      .filter(s => s.merchandise_id === mid && s.date < fromDate)
      .reduce((sum, s) => sum + s.quantity * getConversionFactor(conversionMap, mid, s.unit), 0);

    const opening_stock = opening_incoming - opening_outgoing;

    // Period transactions (fromDate ≤ date ≤ toDate)
    const incoming = supplyItems
      .filter(s => s.merchandise_id === mid && s.date >= fromDate && s.date <= toDate)
      .reduce((sum, s) => sum + s.quantity * getConversionFactor(conversionMap, mid, s.unit), 0);

    const outgoing = salesItems
      .filter(s => s.merchandise_id === mid && s.date >= fromDate && s.date <= toDate)
      .reduce((sum, s) => sum + s.quantity * getConversionFactor(conversionMap, mid, s.unit), 0);

    const auto_closing_stock = opening_stock + incoming - outgoing;

    const adj = adjMap.get(mid);
    const closing_stock =
      adj?.manual_quantity !== null && adj?.manual_quantity !== undefined
        ? Number(adj.manual_quantity)
        : auto_closing_stock;

    const price =
      adj?.manual_price !== null && adj?.manual_price !== undefined
        ? Number(adj.manual_price)
        : latest_price_raw;

    const valuation = closing_stock * price;
    const base_unit = defaultUnitMap.get(mid) ?? '';

    return {
      id: mid,
      name: m.name,
      base_unit,
      opening_stock,
      incoming,
      outgoing,
      auto_closing_stock,
      closing_stock,
      latest_price: price,
      valuation,
      has_manual_override: adj?.manual_quantity !== null && adj?.manual_quantity !== undefined,
    };
  });

  const total_items = items.length;
  const total_stock_qty = items.reduce((sum, item) => sum + item.closing_stock, 0);
  const total_valuation = items.reduce((sum, item) => sum + item.valuation, 0);

  return {
    items,
    summary: { total_items, total_stock_qty, total_valuation },
  };
}

export function registerInventoryHandlers() {
  // Get the full inventory report (with manual overrides applied)
  ipcMain.handle('inventory:getReport', (_event, filters?: InventoryFilters) => {
    return getInventoryReportData(filters);
  });

  // Get all manual adjustments
  ipcMain.handle('inventory:getAdjustments', () => {
    return queryAll<ManualAdjustment>('SELECT * FROM inventory_adjustments');
  });

  // Set (upsert) a manual adjustment for a merchandise item
  ipcMain.handle('inventory:setAdjustment', (_event, data: {
    merchandise_id: number;
    manual_quantity: number | null;
    manual_price: number | null;
    notes?: string;
  }) => {
    getDb().run(`
      INSERT INTO inventory_adjustments (merchandise_id, manual_quantity, manual_price, notes, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(merchandise_id) DO UPDATE SET
        manual_quantity = excluded.manual_quantity,
        manual_price = excluded.manual_price,
        notes = excluded.notes,
        updated_at = datetime('now')
    `, [data.merchandise_id, data.manual_quantity, data.manual_price, data.notes ?? null]);
    saveDb();
    return { success: true };
  });

  // Remove manual adjustment for a specific item (revert to auto)
  ipcMain.handle('inventory:removeAdjustment', (_event, merchandise_id: number) => {
    getDb().run('DELETE FROM inventory_adjustments WHERE merchandise_id = ?', [merchandise_id]);
    saveDb();
    return { success: true };
  });

  // Reset ALL manual adjustments (clears the whole table)
  ipcMain.handle('inventory:resetAllAdjustments', () => {
    getDb().run('DELETE FROM inventory_adjustments');
    saveDb();
    return { success: true };
  });

  // Set every merchandise item's closing stock to zero (by inserting 0 for all)
  ipcMain.handle('inventory:resetToZero', () => {
    const merchandise = queryAll<{ id: number }>('SELECT id FROM merchandise');
    const db = getDb();
    for (const item of merchandise) {
      db.run(`
        INSERT INTO inventory_adjustments (merchandise_id, manual_quantity, manual_price, notes, updated_at)
        VALUES (?, 0, NULL, 'إعادة تعيين يدوي', datetime('now'))
        ON CONFLICT(merchandise_id) DO UPDATE SET
          manual_quantity = 0,
          notes = 'إعادة تعيين يدوي',
          updated_at = datetime('now')
      `, [item.id]);
    }
    saveDb();
    return { success: true, count: merchandise.length };
  });

  ipcMain.handle('print:inventoryReport', async (_event, filters?: InventoryFilters, titleLabel?: string) => {
    const reportTitle = titleLabel || 'تقرير حركة وجرد المخزن';

    // Load settings for PDF title header
    const settings = queryAll<{ key: string; value: string }>('SELECT key, value FROM settings');
    const cfg: Record<string, string> = {};
    settings.forEach((s) => { cfg[s.key] = s.value; });

    // Fetch same inventory report directly
    const res = getInventoryReportData(filters);
    const items = res.items as any[];
    const summary = res.summary as any;

    const formatNum = (n: number): string => {
      return Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const tableRows = items.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f4f4f4'}">
        <td style="text-align: right; padding: 10px; border: 1px solid #ccc;">${item.name}${item.has_manual_override ? ' *' : ''}</td>
        <td style="text-align: center; padding: 10px; border: 1px solid #ccc;">${item.base_unit || '—'}</td>
        <td style="text-align: center; padding: 10px; border: 1px solid #ccc;">${formatNum(item.incoming)}</td>
        <td style="text-align: center; padding: 10px; border: 1px solid #ccc;">${formatNum(item.outgoing)}</td>
        <td style="text-align: center; padding: 10px; border: 1px solid #ccc; font-weight: bold;">${formatNum(item.closing_stock)}</td>
        <td style="text-align: center; padding: 10px; border: 1px solid #ccc;">${formatNum(item.latest_price)} ج.م</td>
        <td style="text-align: center; padding: 10px; border: 1px solid #ccc; font-weight: bold;">${formatNum(item.valuation)} ج.م</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${reportTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #000; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .header h1 { margin: 0; font-size: 24px; color: #000; }
          .header .sub { margin: 5px 0 0 0; font-size: 14px; color: #333; }
          .date-range { text-align: right; font-size: 12px; color: #333; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
          .summary-card { border: 1px solid #999; padding: 15px; text-align: center; }
          .summary-card .label { font-size: 11px; color: #444; margin-bottom: 5px; font-weight: bold; }
          .summary-card .value { font-size: 18px; font-weight: 900; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #000; color: #fff; padding: 10px; text-align: center; border: 1px solid #000; }
          th:first-child { text-align: right; }
          td { border: 1px solid #ccc; }
          .footer-note { margin-top: 30px; text-align: center; font-size: 11px; color: #333; border-top: 1px solid #999; padding-top: 10px; }
          .legend { font-size: 10px; color: #333; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${cfg.contractor_name || 'نظام المقاول'}</h1>
          <div class="sub">${reportTitle}</div>
          ${buildContractorContactHtml(cfg)}
        </div>

        <div class="date-range">
          <strong>الفترة:</strong> 
          ${filters?.from ? `من ${filters.from}` : 'البداية'} 
          ${filters?.to ? `إلى ${filters.to}` : 'اليوم'}
        </div>

        ${items.some(i => i.has_manual_override) ? '<div class="legend">✏️ = كمية يدوية مُعدَّلة</div>' : ''}

        <table>
          <thead>
            <tr>
              <th style="text-align: right; width: 22%;">اسم البضاعة / المادة</th>
              <th style="width: 10%;">وحدة الأساس</th>
              <th style="width: 11%;">الوارد (+)</th>
              <th style="width: 11%;">المنصرف (-)</th>
              <th style="width: 11%;"> الرصيد</th>
              <th style="width: 13%;">آخر سعر شراء</th>
              <th style="width: 14%;">القيمة التقديرية</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        ${cfg.pdf_footer_note ? `<div class="footer-note">${cfg.pdf_footer_note}</div>` : ''}
      </body>
      </html>
    `;

    const tmpHtml = path.join(app.getPath('temp'), `inventory-report-${Date.now()}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf-8');

    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
    await win.loadFile(tmpHtml);

    const docsDir = app.getPath('documents');
    const outputPath = path.join(docsDir, `inventory-report-${Date.now()}.pdf`);

    const pdfBuffer = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'default' },
    });

    win.close();
    fs.writeFileSync(outputPath, pdfBuffer);
    fs.unlinkSync(tmpHtml);

    shell.openPath(outputPath);
    return outputPath;
  });
}
