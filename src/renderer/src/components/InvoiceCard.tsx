import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus, CreditCard, Receipt, Edit2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { formatCurrency, getInvoiceStatus, STATUS_LABELS, STATUS_CLASSES } from '../utils';
import PaymentModal from './PaymentModal';

interface InvoiceCardProps {
  invoice: Invoice;
  customerId: number;
  onDeleted: () => void;
  onPaymentAdded: () => void;
}

export default function InvoiceCard({ invoice, customerId, onDeleted, onPaymentAdded }: InvoiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const status = getInvoiceStatus(invoice.total, invoice.total_paid);
  const remaining = invoice.total - invoice.total_paid;

  async function handleDelete() {
    if (!confirm(`هل تريد حذف الفاتورة ${invoice.invoice_number}؟ سيتم حذف جميع البنود والمدفوعات.`)) return;
    setDeleting(true);
    try {
      await window.api.invoices.delete(invoice.id);
      onDeleted();
    } catch {
      alert('فشل حذف الفاتورة');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!confirm('هل تريد حذف هذه الدفعة؟')) return;
    await window.api.payments.delete(paymentId);
    onPaymentAdded(); // reload
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Invoice header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-slate-400 hover:text-slate-600"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLASSES[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-slate-500 text-xs">المتبقي</p>
              <p className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(remaining)} ج.م
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">المدفوع</p>
              <p className="font-semibold text-slate-700">{formatCurrency(invoice.total_paid)} ج.م</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">الإجمالي</p>
              <p className="font-semibold text-slate-900">{formatCurrency(invoice.total)} ج.م</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">التاريخ</p>
              <p className="font-medium text-slate-700">{invoice.date}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">رقم الفاتورة</p>
              <p className="font-bold text-blue-600">{invoice.invoice_number}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-4 pb-3 border-t border-slate-100 pt-3 bg-slate-50/50">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            إضافة دفعة
          </button>
          <Link
            to={`/customers/${customerId}/edit-invoice/${invoice.id}`}
            className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg transition-colors border border-blue-200"
          >
            <Edit2 size={14} />
            تعديل الفاتورة
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors border border-red-200"
          >
            <Trash2 size={14} />
            حذف الفاتورة
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-slate-200 p-4 space-y-4 bg-white">
            {/* Items */}
            {invoice.items && invoice.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Receipt size={15} />
                  بنود الفاتورة
                </h4>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-right font-medium">الصنف</th>
                        <th className="px-3 py-2 text-center font-medium">الكمية</th>
                        <th className="px-3 py-2 text-center font-medium">الوحدة</th>
                        <th className="px-3 py-2 text-center font-medium">سعر الوحدة</th>
                        <th className="px-3 py-2 text-center font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-3 py-2 text-slate-900">
                            {item.merchandise_name || item.custom_name || '—'}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-700">{item.quantity}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{item.unit || '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-center font-semibold text-slate-900">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 font-bold text-slate-700">الإجمالي</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900">{formatCurrency(invoice.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-amber-700 font-medium mb-1">ملاحظات</p>
                <p className="text-sm text-amber-900">{invoice.notes}</p>
              </div>
            )}

            {/* Payments */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <CreditCard size={15} />
                سجل المدفوعات
              </h4>
              {invoice.payments && invoice.payments.length > 0 ? (
                <div className="space-y-2">
                  {invoice.payments.map(pmt => {
                    const isAdvance = pmt.is_advance === 1;
                    return (
                      <div key={pmt.id} className={`flex items-center justify-between p-3 rounded-lg border ${isAdvance ? 'bg-teal-50 border-teal-200' : 'bg-emerald-50 border-emerald-100'}`}>
                        <button
                          onClick={() => handleDeletePayment(pmt.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={isAdvance ? 'حذف الدفعة المقدمة (سيتم استرداد الرصيد تلقائياً)' : 'حذف الدفعة'}
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="flex items-center gap-4 text-sm">
                          {isAdvance && (
                            <span className="text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                              دفعة مقدمة
                            </span>
                          )}
                          {pmt.notes && !isAdvance && <span className={`text-xs ${isAdvance ? 'text-teal-600' : 'text-emerald-600'}`}>{pmt.notes}</span>}
                          <span className={isAdvance ? 'text-teal-700' : 'text-emerald-700'}>{pmt.date}</span>
                          <span className={`font-bold ${isAdvance ? 'text-teal-800' : 'text-emerald-800'}`}>{formatCurrency(pmt.amount)} ج.م</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-3">لا توجد مدفوعات بعد</p>
              )}
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSaved={() => {
            setShowPaymentModal(false);
            onPaymentAdded();
          }}
        />
      )}
    </>
  );
}
