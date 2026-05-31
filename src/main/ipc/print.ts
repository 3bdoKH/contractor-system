import { ipcMain, app, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { getDb } from '../db';

function formatNumber(n: number): string {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatus(total: number, paid: number): string {
  if (paid >= total) return 'مدفوع بالكامل';
  if (paid > 0) return 'مدفوع جزئياً';
  return 'غير مدفوع';
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
      ORDER BY i.date DESC
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

    // Ensure Documents directory exists
    const docsDir = app.getPath('documents');
    const outputPath = path.join(docsDir, `customer-${customerId}-${Date.now()}.pdf`);

    const fontPath = path.join(app.getAppPath(), 'assets', 'font', 'Cairo.ttf');

    return new Promise<string>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;

      function registerFont() {
        if (fs.existsSync(fontPath)) {
          doc.registerFont('Cairo', fontPath);
          doc.font('Cairo');
        }
      }

      registerFont();

      // ─── HEADER ───────────────────────────────────────────────────────────
      doc.fontSize(22).text('الحاج حسن البطاط', margin, 50, {
        width: contentWidth, align: 'right',
      });

      doc.fontSize(11).text(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}`, margin, 80, {
        width: contentWidth, align: 'right',
      });

      doc.moveDown(0.5);
      doc.fontSize(13).text(`العميل: ${customer.name}`, { width: contentWidth, align: 'right' });
      if (customer.phone) doc.fontSize(11).text(`الهاتف: ${customer.phone}`, { width: contentWidth, align: 'right' });
      if (customer.address) doc.fontSize(11).text(`العنوان: ${customer.address}`, { width: contentWidth, align: 'right' });

      doc.moveDown(0.5);
      doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
      doc.moveDown(0.5);

      // ─── SUMMARY ──────────────────────────────────────────────────────────
      doc.fontSize(12)
        .text(`إجمالي الفواتير: ${formatNumber(totalInvoiced)} ج.م`, { width: contentWidth, align: 'right' })
        .text(`إجمالي المدفوع: ${formatNumber(totalPaid)} ج.م`, { width: contentWidth, align: 'right' })
        .text(`الرصيد المتبقي: ${formatNumber(remaining)} ج.م`, { width: contentWidth, align: 'right' });

      doc.moveDown(0.5);
      doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();

      // ─── PER INVOICE ──────────────────────────────────────────────────────
      for (const inv of invoicesWithDetails) {
        doc.moveDown(0.8);
        const invPaid = inv.total_paid;
        const invRemaining = inv.total - invPaid;
        const status = getStatus(inv.total, invPaid);

        doc.fontSize(13).text(`فاتورة رقم: ${inv.invoice_number}   التاريخ: ${inv.date}   الحالة: ${status}`, {
          width: contentWidth, align: 'right',
        });

        doc.moveDown(0.4);

        // Items table header
        doc.fontSize(11)
          .text('الإجمالي', margin, doc.y, { width: contentWidth * 0.25, align: 'center' })
          .text('سعر الوحدة', margin + contentWidth * 0.25, doc.y - doc.currentLineHeight(), { width: contentWidth * 0.25, align: 'center' })
          .text('الكمية', margin + contentWidth * 0.5, doc.y - doc.currentLineHeight(), { width: contentWidth * 0.25, align: 'center' })
          .text('الصنف', margin + contentWidth * 0.75, doc.y - doc.currentLineHeight(), { width: contentWidth * 0.25, align: 'right' });

        doc.moveDown(0.3);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
        doc.moveDown(0.2);

        // Items rows
        for (const item of inv.items) {
          const rowTotal = item.quantity * item.unit_price;
          const y = doc.y;
          doc.fontSize(10)
            .text(formatNumber(rowTotal), margin, y, { width: contentWidth * 0.25, align: 'center' })
            .text(formatNumber(item.unit_price), margin + contentWidth * 0.25, y, { width: contentWidth * 0.25, align: 'center' })
            .text(String(item.quantity), margin + contentWidth * 0.5, y, { width: contentWidth * 0.25, align: 'center' })
            .text(item.item_name || '', margin + contentWidth * 0.75, y, { width: contentWidth * 0.25, align: 'right' });
        }

        doc.moveDown(0.4);
        doc.fontSize(11).text(`إجمالي الفاتورة: ${formatNumber(inv.total)} ج.م`, { width: contentWidth, align: 'right' });

        // Payments
        if (inv.payments.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(11).text('المدفوعات:', { width: contentWidth, align: 'right' });

          for (const pmt of inv.payments) {
            doc.fontSize(10).text(
              `${pmt.date}   ${formatNumber(pmt.amount)} ج.م${pmt.notes ? '   ' + pmt.notes : ''}`,
              { width: contentWidth, align: 'right' }
            );
          }
        }

        doc.moveDown(0.3);
        doc.fontSize(11)
          .text(`المدفوع: ${formatNumber(invPaid)} ج.م   المتبقي: ${formatNumber(invRemaining)} ج.م`, {
            width: contentWidth, align: 'right',
          });

        doc.moveDown(0.4);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).dash(3, { space: 3 }).stroke();
        doc.undash();
      }

      // Page numbers
      const totalPages = (doc.bufferedPageRange().count) || 1;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(9).text(`صفحة ${i + 1} من ${totalPages}`, margin, doc.page.height - 40, {
          width: contentWidth, align: 'center',
        });
      }

      doc.end();

      stream.on('finish', () => {
        shell.openPath(outputPath);
        resolve(outputPath);
      });
      stream.on('error', reject);
    });
  });
}
