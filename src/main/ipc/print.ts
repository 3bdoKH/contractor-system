import { ipcMain, app, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../db';

function formatNum(n: number): string {
  return Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getStatus(total: number, paid: number): string {
  if (paid >= total) return 'مدفوع بالكامل';
  if (paid > 0) return 'مدفوع جزئياً';
  return 'غير مدفوع';
}

// Shared B&W CSS for both customer and supplier reports
const SHARED_CSS = (fontPath: string) => `
  @font-face {
    font-family: 'Cairo';
    src: url('${fontPath}') format('truetype');
    font-weight: 400 700;
    font-style: normal;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Cairo', sans-serif;
    font-size: 12px;
    color: #000;
    direction: rtl;
    padding: 30px;
  }

  .header {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #000;
    padding-bottom: 12px;
  }

  .header h1 { font-size: 22px; font-weight: 700; color: #000; }
  .header .print-date { font-size: 11px; color: #444; margin-top: 4px; }
  .header .sub-title { font-size: 13px; color: #000; margin-top: 2px; font-weight: 600; }

  .footer-note {
    margin-top: 20px;
    padding: 10px 14px;
    border: 1px solid #999;
    font-size: 11px;
    color: #000;
    text-align: center;
  }

  .entity-info {
    margin-bottom: 16px;
    padding: 12px;
    border: 1px solid #999;
  }

  .entity-info .name { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
  .entity-info .detail { font-size: 11px; color: #333; margin-top: 3px; }

  .summary-box {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }

  .summary-card {
    padding: 10px;
    text-align: center;
    border: 1px solid #999;
  }

  .summary-card .label { font-size: 10px; color: #444; margin-bottom: 4px; }
  .summary-card .value { font-size: 14px; font-weight: 700; color: #000; }

  .invoice-block {
    margin-bottom: 20px;
    border: 1px solid #999;
    overflow: hidden;
    page-break-inside: avoid;
  }

  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #000;
    color: #fff;
    padding: 8px 12px;
    font-size: 11px;
  }

  table { width: 100%; border-collapse: collapse; }

  .items-table th {
    background: #e0e0e0;
    color: #000;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 700;
    border-bottom: 1px solid #999;
    border: 1px solid #bbb;
  }

  .items-table td {
    padding: 6px 10px;
    font-size: 11px;
    border: 1px solid #ddd;
  }

  .invoice-totals {
    display: flex;
    justify-content: space-around;
    padding: 8px 12px;
    border-top: 2px solid #000;
    font-size: 11px;
    font-weight: 600;
  }

  .payments-section { border-top: 1px solid #999; }

  .payments-header {
    background: #e0e0e0;
    color: #000;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    border-bottom: 1px solid #999;
  }

  .payments-table th {
    background: #f0f0f0;
    padding: 5px 10px;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid #ccc;
  }

  .payments-table td {
    padding: 5px 10px;
    font-size: 10px;
    border: 1px solid #ddd;
  }

  @media print {
    body { padding: 15px; }
    .invoice-block { page-break-inside: avoid; }
  }
`;

export function registerPrintHandlers() {
  const db = getDb();

  ipcMain.handle('print:customerReport', async (_event, customerId: number) => {
    const settingRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const cfg: Record<string, string> = {};
    settingRows.forEach((s: any) => { cfg[s.key] = s.value; });

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) throw new Error('Customer not found');

    const invoices = db.prepare(`
      SELECT i.*, COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i.customer_id = ?
      GROUP BY i.id
      ORDER BY i.date ASC
    `).all(customerId) as any[];

    const invoicesWithDetails = invoices.map((inv) => {
      const items = db.prepare(`
        SELECT ii.*, COALESCE(m.name, ii.custom_name) as item_name
        FROM invoice_items ii
        LEFT JOIN merchandise m ON m.id = ii.merchandise_id
        WHERE ii.invoice_id = ?
      `).all(inv.id) as any[];
      const payments = db.prepare(`
        SELECT * FROM payments WHERE invoice_id = ? ORDER BY date ASC
      `).all(inv.id) as any[];
      return { ...inv, items, payments };
    });

    const totalInvoiced = invoicesWithDetails.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoicesWithDetails.reduce((s, i) => s + i.total_paid, 0);
    const remaining = totalInvoiced - totalPaid;

    const invoicesHTML = invoicesWithDetails.map(inv => {
      const invPaid = inv.total_paid;
      const invRemaining = inv.total - invPaid;
      const status = getStatus(inv.total, invPaid);

      const itemsRows = inv.items.map((item: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f4f4f4'}">
          <td style="text-align: center;">${item.item_name || ''}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: center;">${item.unit || '-'}</td>
          <td style="text-align: center;">${formatNum(item.unit_price)}</td>
          <td style="text-align: center;">${formatNum(item.quantity * item.unit_price)}</td>
        </tr>
      `).join('');

      const paymentsRows = inv.payments.length > 0 ? `
        <div class="payments-section">
          <div class="payments-header">سجل الدفعات</div>
          <table class="payments-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${inv.payments.map((p: any) => `
                <tr>
                  <td style="text-align: center;">${p.date}</td>
                  <td style="text-align: center;">${formatNum(p.amount)} ج.م</td>
                  <td style="text-align: center;">${p.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '';

      return `
        <div class="invoice-block">
          <div class="invoice-header">
            <span>فاتورة رقم: ${inv.invoice_number}</span>
            <span>التاريخ: ${inv.date}</span>
            <span style="font-weight:bold">${status}</span>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>الوحدة</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="invoice-totals">
            <span>الإجمالي: <strong>${formatNum(inv.total)} ج.م</strong></span>
            <span>المدفوع: <strong>${formatNum(invPaid)} ج.م</strong></span>
            <span>المتبقي: <strong>${formatNum(invRemaining)} ج.م</strong></span>
          </div>
          ${paymentsRows}
        </div>
      `;
    }).join('');

    const fontPath = path.join(app.getAppPath(), 'assets', 'font', 'Cairo.ttf').replace(/\\/g, '/');
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>${SHARED_CSS(fontPath)}</style>
      </head>
      <body>
        <div class="header">
          <h1>${cfg.contractor_name || 'نظام المقاول'}</h1>
          <div class="sub-title">${cfg.pdf_header_title || 'كشف حساب'}</div>
          <div class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>

        <div class="entity-info">
          <div class="name">${customer.name}</div>
          ${customer.phone ? `<div class="detail">الهاتف: ${customer.phone}</div>` : ''}
          ${customer.address ? `<div class="detail">العنوان: ${customer.address}</div>` : ''}
        </div>

        <div class="summary-box">
          <div class="summary-card">
            <div class="label">إجمالي الفواتير</div>
            <div class="value">${formatNum(totalInvoiced)} ج.م</div>
          </div>
          <div class="summary-card">
            <div class="label">إجمالي المدفوع</div>
            <div class="value">${formatNum(totalPaid)} ج.م</div>
          </div>
          <div class="summary-card">
            <div class="label">الرصيد المتبقي</div>
            <div class="value">${formatNum(remaining)} ج.م</div>
          </div>
        </div>

        ${invoicesHTML}
        ${cfg.pdf_footer_note ? `<div class="footer-note">${cfg.pdf_footer_note}</div>` : ''}
      </body>
      </html>
    `;

    const tmpHtml = path.join(app.getPath('temp'), `report-${customerId}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf-8');
    const win = new BrowserWindow({ show: false });
    await win.loadFile(tmpHtml);
    const docsDir = app.getPath('documents');
    const outputPath = path.join(docsDir, `customer-${customerId}-${Date.now()}.pdf`);
    const pdfBuffer = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' } });
    win.close();
    fs.writeFileSync(outputPath, pdfBuffer);
    fs.unlinkSync(tmpHtml);
    shell.openPath(outputPath);
    return outputPath;
  });

  ipcMain.handle('print:supplierReport', async (_event, supplierId: number) => {
    const settingRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const cfg: Record<string, string> = {};
    settingRows.forEach((s: any) => { cfg[s.key] = s.value; });

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) throw new Error('Supplier not found');

    const invoices = db.prepare(`
      SELECT si.*, COALESCE(SUM(sp.amount), 0) as total_paid
      FROM supply_invoices si
      LEFT JOIN supplier_payments sp ON sp.supply_invoice_id = si.id
      WHERE si.supplier_id = ?
      GROUP BY si.id
      ORDER BY si.date ASC
    `).all(supplierId) as any[];

    const invoicesWithDetails = invoices.map((inv) => {
      const items = db.prepare(`
        SELECT sii.*, COALESCE(m.name, sii.custom_name) as item_name
        FROM supply_invoice_items sii
        LEFT JOIN merchandise m ON m.id = sii.merchandise_id
        WHERE sii.supply_invoice_id = ?
      `).all(inv.id) as any[];
      const payments = db.prepare(`
        SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date ASC
      `).all(inv.id) as any[];
      return { ...inv, items, payments };
    });

    const totalInvoiced = invoicesWithDetails.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoicesWithDetails.reduce((s, i) => s + i.total_paid, 0);
    const remaining = totalInvoiced - totalPaid;

    const invoicesHTML = invoicesWithDetails.map(inv => {
      const invPaid = inv.total_paid;
      const invRemaining = inv.total - invPaid;
      const status = getStatus(inv.total, invPaid);

      const itemsRows = inv.items.map((item: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f4f4f4'}">
          <td style="text-align: center;">${item.item_name || ''}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: center;">${item.unit || '-'}</td>
          <td style="text-align: center;">${formatNum(item.unit_price)}</td>
          <td style="text-align: center;">${formatNum(item.quantity * item.unit_price)}</td>
        </tr>
      `).join('');

      const paymentsRows = inv.payments.length > 0 ? `
        <div class="payments-section">
          <div class="payments-header">سجل الدفعات</div>
          <table class="payments-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${inv.payments.map((p: any) => `
                <tr>
                  <td style="text-align: center;">${p.date}</td>
                  <td style="text-align: center;">${formatNum(p.amount)} ج.م</td>
                  <td style="text-align: center;">${p.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '';

      return `
        <div class="invoice-block">
          <div class="invoice-header">
            <span>فاتورة توريد رقم: ${inv.invoice_number}</span>
            <span>التاريخ: ${inv.date}</span>
            <span style="font-weight:bold">${status}</span>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>الوحدة</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="invoice-totals">
            <span>الإجمالي: <strong>${formatNum(inv.total)} ج.م</strong></span>
            <span>المدفوع: <strong>${formatNum(invPaid)} ج.م</strong></span>
            <span>المتبقي: <strong>${formatNum(invRemaining)} ج.م</strong></span>
          </div>
          ${paymentsRows}
        </div>
      `;
    }).join('');

    const fontPath = path.join(app.getAppPath(), 'assets', 'font', 'Cairo.ttf').replace(/\\/g, '/');
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>${SHARED_CSS(fontPath)}</style>
      </head>
      <body>
        <div class="header">
          <h1>${cfg.contractor_name || 'نظام المقاول'}</h1>
          <div class="sub-title">${cfg.pdf_header_title || 'كشف حساب'}</div>
          <div class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>

        <div class="entity-info">
          <div class="name">${supplier.name}</div>
          ${supplier.phone ? `<div class="detail">الهاتف: ${supplier.phone}</div>` : ''}
          ${supplier.address ? `<div class="detail">العنوان: ${supplier.address}</div>` : ''}
        </div>

        <div class="summary-box">
          <div class="summary-card">
            <div class="label">إجمالي التوريدات</div>
            <div class="value">${formatNum(totalInvoiced)} ج.م</div>
          </div>
          <div class="summary-card">
            <div class="label">إجمالي المدفوع</div>
            <div class="value">${formatNum(totalPaid)} ج.م</div>
          </div>
          <div class="summary-card">
            <div class="label">المستحق للمورد</div>
            <div class="value">${formatNum(remaining)} ج.م</div>
          </div>
        </div>

        ${invoicesHTML}
        ${cfg.pdf_footer_note ? `<div class="footer-note">${cfg.pdf_footer_note}</div>` : ''}
      </body>
      </html>
    `;

    const tmpHtml = path.join(app.getPath('temp'), `supplier-report-${supplierId}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf-8');
    const win = new BrowserWindow({ show: false });
    await win.loadFile(tmpHtml);
    const docsDir = app.getPath('documents');
    const outputPath = path.join(docsDir, `supplier-${supplierId}-${Date.now()}.pdf`);
    const pdfBuffer = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' } });
    win.close();
    fs.writeFileSync(outputPath, pdfBuffer);
    fs.unlinkSync(tmpHtml);
    shell.openPath(outputPath);
    return outputPath;
  });
}