import { ipcMain, app, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDb, queryAll, saveDb } from '../db';

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

function getInventoryReportData(filters?: InventoryFilters) {
  const fromDate = filters?.from || '0000-00-00';
  const toDate = filters?.to || '9999-12-31';

  const rows = queryAll(`
    SELECT
      m.id,
      m.name,
      -- Opening stock
      (
        COALESCE((
          SELECT SUM(sii.quantity)
          FROM supply_invoice_items sii
          JOIN supply_invoices si ON si.id = sii.supply_invoice_id
          WHERE sii.merchandise_id = m.id AND si.date < ?
        ), 0) -
        COALESCE((
          SELECT SUM(ii.quantity)
          FROM invoice_items ii
          JOIN invoices i ON i.id = ii.invoice_id
          WHERE ii.merchandise_id = m.id AND i.date < ?
        ), 0)
      ) as opening_stock,

      -- Incoming
      COALESCE((
        SELECT SUM(sii.quantity)
        FROM supply_invoice_items sii
        JOIN supply_invoices si ON si.id = sii.supply_invoice_id
        WHERE sii.merchandise_id = m.id AND si.date >= ? AND si.date <= ?
      ), 0) as incoming,

      -- Outgoing
      COALESCE((
        SELECT SUM(ii.quantity)
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id
        WHERE ii.merchandise_id = m.id AND i.date >= ? AND i.date <= ?
      ), 0) as outgoing,

      -- Latest unit price
      COALESCE((
        SELECT sii.unit_price
        FROM supply_invoice_items sii
        JOIN supply_invoices si ON si.id = sii.supply_invoice_id
        WHERE sii.merchandise_id = m.id
        ORDER BY si.date DESC, sii.id DESC
        LIMIT 1
      ), 0) as latest_price,

      -- Manual adjustment
      ia.manual_quantity,
      ia.manual_price
    FROM merchandise m
    LEFT JOIN inventory_adjustments ia ON ia.merchandise_id = m.id
    ORDER BY m.name ASC
  `, [fromDate, fromDate, fromDate, toDate, fromDate, toDate]) as any[];

  const items = rows.map((row) => {
    const auto_closing = row.opening_stock + row.incoming - row.outgoing;
    // If a manual quantity override is set, use it as the effective closing stock
    const closing_stock = row.manual_quantity !== null && row.manual_quantity !== undefined
      ? Number(row.manual_quantity)
      : auto_closing;
    const price = row.manual_price !== null && row.manual_price !== undefined
      ? Number(row.manual_price)
      : row.latest_price;
    const valuation = closing_stock * price;
    return {
      id: row.id,
      name: row.name,
      opening_stock: row.opening_stock,
      incoming: row.incoming,
      outgoing: row.outgoing,
      auto_closing_stock: auto_closing,
      closing_stock,
      latest_price: price,
      valuation,
      has_manual_override: row.manual_quantity !== null && row.manual_quantity !== undefined,
    };
  });

  const total_items = items.length;
  const total_stock_qty = items.reduce((sum, item) => sum + item.closing_stock, 0);
  const total_valuation = items.reduce((sum, item) => sum + item.valuation, 0);

  return {
    items,
    summary: {
      total_items,
      total_stock_qty,
      total_valuation,
    },
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
              <th style="text-align: right; width: 25%;">اسم البضاعة / المادة</th>
              <th style="width: 12%;">الوارد (+)</th>
              <th style="width: 12%;">المنصرف (-)</th>
              <th style="width: 12%;"> الرصيد</th>
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
