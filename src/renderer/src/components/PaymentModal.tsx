import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { formatCurrency, getInvoiceStatus, STATUS_LABELS } from '../utils';

interface PaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentModal({ invoice, onClose, onSaved }: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const remaining = invoice.total - invoice.total_paid;
  const previewPaid = invoice.total_paid + (parseFloat(amount) || 0);
  const previewRemaining = invoice.total - previewPaid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!date) {
      setError('يرجى إدخال التاريخ');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await window.api.payments.add({
        invoice_id: invoice.id,
        amount: amountNum,
        date,
        notes: notes || undefined,
      });
      onSaved();
    } catch (err) {
      setError('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">إضافة دفعة</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Invoice info */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <p className="text-sm text-slate-600">
            فاتورة رقم: <span className="font-semibold text-slate-900">{invoice.invoice_number}</span>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div className="text-center">
              <p className="text-slate-500">الإجمالي</p>
              <p className="font-semibold text-slate-900">{formatCurrency(invoice.total)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">المدفوع</p>
              <p className="font-semibold text-emerald-600">{formatCurrency(invoice.total_paid)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">المتبقي</p>
              <p className="font-semibold text-red-600">{formatCurrency(remaining)}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">المبلغ <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">التاريخ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={date}
              onChange={e => setDate(e.target.value)}
              placeholder="مثال: 2024-01-15"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="اختياري"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Preview */}
          {parseFloat(amount) > 0 && (
            <div className="p-3 bg-blue-50 rounded-xl text-sm space-y-1">
              <p className="text-blue-700 font-medium">معاينة بعد الدفع:</p>
              <p className="text-blue-600">المدفوع: {formatCurrency(previewPaid)}</p>
              <p className="text-blue-600">المتبقي: {formatCurrency(Math.max(0, previewRemaining))}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {loading ? 'جاري الحفظ...' : 'تأكيد الدفعة'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
