import { ipcMain, app, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../db';

interface InventoryFilters {
  from?: string;
  to?: string;
}

function getInventoryReportData(db: any, filters?: InventoryFilters) {
  const fromDate = filters?.from || '0000-00-00';
  const toDate = filters?.to || '9999-12-31';

  const rows = db.prepare(`
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
      ), 0) as latest_price
    FROM merchandise m
    ORDER BY m.name ASC
  `).all(fromDate, fromDate, fromDate, toDate, fromDate, toDate) as any[];

  const items = rows.map((row) => {
    const closing_stock = row.opening_stock + row.incoming - row.outgoing;
    const valuation = closing_stock * row.latest_price;
    return {
      id: row.id,
      name: row.name,
      opening_stock: row.opening_stock,
      incoming: row.incoming,
      outgoing: row.outgoing,
      closing_stock,
      latest_price: row.latest_price,
      valuation,
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
  const db = getDb();

  ipcMain.handle('inventory:getReport', (_event, filters?: InventoryFilters) => {
    return getInventoryReportData(db, filters);
  });

  ipcMain.handle('print:inventoryReport', async (_event, filters?: InventoryFilters, titleLabel?: string) => {
    const reportTitle = titleLabel || 'تقرير حركة وجرد المخزن';

    // Load settings for PDF title header
    const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
    const cfg: Record<string, string> = {};
    settings.forEach((s: any) => { cfg[s.key] = s.value; });

    // Fetch same inventory report directly
    const res = getInventoryReportData(db, filters);
    const items = res.items as any[];
    const summary = res.summary as any;

    const formatNum = (n: number): string => {
      return Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const tableRows = items.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8f9fa'}">
        <td style="text-align: right; padding: 10px; border-bottom: 1px solid #dee2e6;">${item.name}</td>
        <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">${formatNum(item.opening_stock)}</td>
        <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6; color: #198754;">+${formatNum(item.incoming)}</td>
        <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6; color: #dc3545;">-${formatNum(item.outgoing)}</td>
        <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${formatNum(item.closing_stock)}</td>
        <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">${formatNum(item.latest_price)} ج.م</td>
        <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${formatNum(item.valuation)} ج.م</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${reportTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { margin: 0; font-size: 24px; color: #111; }
          .header .sub { margin: 5px 0 0 0; font-size: 14px; color: #666; }
          .date-range { text-align: right; font-size: 12px; color: #555; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
          .summary-card .label { font-size: 11px; color: #718096; margin-bottom: 5px; font-weight: bold; }
          .summary-card .value { font-size: 18px; font-weight: 900; color: #2d3748; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #343a40; color: #fff; padding: 10px; text-align: center; border: 1px solid #dee2e6; }
          th:first-child { text-align: right; }
          td { border: 1px solid #dee2e6; }
          .footer-note { margin-top: 30px; text-align: center; font-size: 11px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 10px; }
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

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">عدد المواد</div>
            <div class="value">${summary.total_items}</div>
          </div>
          <div class="summary-card">
            <div class="label">إجمالي كمية المخزون</div>
            <div class="value">${formatNum(summary.total_stock_qty)}</div>
          </div>
          <div class="summary-card">
            <div class="label">إجمالي قيمة المخزون الحالي</div>
            <div class="value">${formatNum(summary.total_valuation)} ج.م</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: right; width: 25%;">اسم البضاعة / المادة</th>
              <th style="width: 12%;">رصيد أول</th>
              <th style="width: 12%;">الوارد (+)</th>
              <th style="width: 12%;">المنصرف (-)</th>
              <th style="width: 12%;">رصيد آخر</th>
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

    const win = new BrowserWindow({ show: false });
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
