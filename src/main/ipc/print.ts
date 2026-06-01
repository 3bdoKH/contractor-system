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

function getStatusColor(total: number, paid: number): string {
  if (paid >= total) return '#198754';
  if (paid > 0) return '#fd7e14';
  return '#dc3545';
}

export function registerPrintHandlers() {
  const db = getDb();

  ipcMain.handle('print:customerReport', async (_event, customerId: number) => {
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

    // Build HTML
    const invoicesHTML = invoicesWithDetails.map(inv => {
      const invPaid = inv.total_paid;
      const invRemaining = inv.total - invPaid;
      const status = getStatus(inv.total, invPaid);
      const statusColor = getStatusColor(inv.total, invPaid);

      const itemsRows = inv.items.map((item: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'}">
          <td style="text-align: center;">${item.item_name || ''}</td>
          <td style="text-align: center;">${item.quantity}</td>
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
            <span style="color:${statusColor}; font-weight:bold">${status}</span>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="invoice-totals">
            <span>الإجمالي: <strong>${formatNum(inv.total)} ج.م</strong></span>
            <span>المدفوع: <strong style="color:#198754">${formatNum(invPaid)} ج.م</strong></span>
            <span>المتبقي: <strong style="color:${invRemaining > 0 ? '#dc3545' : '#198754'}">${formatNum(invRemaining)} ج.م</strong></span>
          </div>
          ${paymentsRows}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @font-face {
              font-family: 'Cairo';
              src: url('${path.join(app.getAppPath(), 'assets', 'font', 'Cairo.ttf').replace(/\\/g, '/')}') format('truetype');
              font-weight: 400 700;
              font-style: normal;
            }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Cairo', sans-serif;
            font-size: 12px;
            color: #212529;
            direction: rtl;
            padding: 30px;
          }

          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #343a40;
            padding-bottom: 12px;
          }

          .header h1 { font-size: 22px; font-weight: 700; color: #343a40; }
          .header .print-date { font-size: 11px; color: #6c757d; margin-top: 4px; }

          .customer-info {
            margin-bottom: 16px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #dee2e6;
          }

          .customer-info .name { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
          .customer-info .detail { font-size: 11px; color: #495057; margin-top: 3px; }

          .summary-box {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }

          .summary-card {
            padding: 10px;
            border-radius: 6px;
            text-align: center;
            border: 1px solid #dee2e6;
          }

          .summary-card .label { font-size: 10px; color: #6c757d; margin-bottom: 4px; }
          .summary-card .value { font-size: 14px; font-weight: 700; }

          .invoice-block {
            margin-bottom: 20px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            overflow: hidden;
            page-break-inside: avoid;
          }

          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #343a40;
            color: white;
            padding: 8px 12px;
            font-size: 11px;
          }

          table { width: 100%; border-collapse: collapse; }

          .items-table th {
            background: #e9ecef;
            padding: 7px 10px;
            font-size: 11px;
            font-weight: 600;
            border-bottom: 1px solid #dee2e6;
          }

          .items-table td {
            padding: 6px 10px;
            font-size: 11px;
            border-bottom: 1px solid #f0f0f0;
          }

          .invoice-totals {
            display: flex;
            justify-content: space-around;
            padding: 8px 12px;
            background: #fff3cd;
            border-top: 1px solid #ffc107;
            font-size: 11px;
          }

          .payments-section { border-top: 1px solid #dee2e6; }

          .payments-header {
            background: #e8f5e9;
            color: #1b5e20;
            padding: 6px 12px;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
          }

          .payments-table th {
            background: #f1f8f1;
            padding: 5px 10px;
            font-size: 10px;
            font-weight: 600;
          }

          .payments-table td {
            padding: 5px 10px;
            font-size: 10px;
            border-bottom: 1px solid #f0f0f0;
          }

          @media print {
            body { padding: 15px; }
            .invoice-block { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>الحاج حسن البطاط</h1>
          <div class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>

        <div class="customer-info">
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
            <div class="value" style="color:#198754">${formatNum(totalPaid)} ج.م</div>
          </div>
          <div class="summary-card">
            <div class="label">الرصيد المتبقي</div>
            <div class="value" style="color:${remaining > 0 ? '#dc3545' : '#198754'}">${formatNum(remaining)} ج.م</div>
          </div>
        </div>

        ${invoicesHTML}
      </body>
      </html>
    `;

    // Write HTML to temp file
    const tmpHtml = path.join(app.getPath('temp'), `report-${customerId}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf-8');

    // Use hidden BrowserWindow to print to PDF
    const win = new BrowserWindow({ show: false });
    await win.loadFile(tmpHtml);

    const docsDir = app.getPath('documents');
    const outputPath = path.join(docsDir, `customer-${customerId}-${Date.now()}.pdf`);

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