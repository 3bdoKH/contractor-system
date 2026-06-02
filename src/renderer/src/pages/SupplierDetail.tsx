import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Printer, Plus, Edit2, Trash2, Phone, MapPin, FileText, X, AlertCircle, ChevronDown, ChevronUp, CreditCard, Receipt } from 'lucide-react';
import { formatCurrency, getInvoiceStatus, STATUS_LABELS, STATUS_CLASSES } from '../utils';

interface SupplierPaymentModalProps {
  invoice: SupplyInvoice;
  onClose: () => void;
  onSaved: () => void;
}

function SupplierPaymentModal({ invoice, onClose, onSaved }: SupplierPaymentModalProps) {
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
    if (!amountNum || amountNum <= 0) { setError('يرجى إدخال مبلغ صحيح'); return; }
    if (!date) { setError('يرجى إدخال التاريخ'); return; }
    setLoading(true);
    setError('');
    try {
      await window.api.supplierPayments.add({
        supply_invoice_id: invoice.id,
        amount: amountNum,
        date,
        notes: notes || undefined,
      });
      onSaved();
    } catch {
      setError('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">إضافة دفعة للمورد</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <p className="text-sm text-slate-600">فاتورة توريد رقم: <span className="font-semibold text-slate-900">{invoice.invoice_number}</span></p>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div className="text-center"><p className="text-slate-500">الإجمالي</p><p className="font-semibold text-slate-900">{formatCurrency(invoice.total)}</p></div>
            <div className="text-center"><p className="text-slate-500">المدفوع</p><p className="font-semibold text-emerald-600">{formatCurrency(invoice.total_paid)}</p></div>
            <div className="text-center"><p className="text-slate-500">المتبقي</p><p className="font-semibold text-red-600">{formatCurrency(remaining)}</p></div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle size={16} /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">المبلغ <span className="text-red-500">*</span></label>
            <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">التاريخ <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          {parseFloat(amount) > 0 && (
            <div className="p-3 bg-blue-50 rounded-xl text-sm space-y-1">
              <p className="text-blue-700 font-medium">معاينة بعد الدفع:</p>
              <p className="text-blue-600">المدفوع: {formatCurrency(previewPaid)}</p>
              <p className="text-blue-600">المتبقي: {formatCurrency(Math.max(0, previewRemaining))}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-xl transition-colors">{loading ? 'جاري الحفظ...' : 'تأكيد الدفعة'}</button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SupplyInvoiceCardProps {
  invoice: SupplyInvoice;
  onDeleted: () => void;
  onPaymentAdded: () => void;
}

function SupplyInvoiceCard({ invoice, onDeleted, onPaymentAdded }: SupplyInvoiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const status = getInvoiceStatus(invoice.total, invoice.total_paid);
  const remaining = invoice.total - invoice.total_paid;

  async function handleDelete() {
    if (!confirm(`هل تريد حذف فاتورة التوريد ${invoice.invoice_number}؟`)) return;
    setDeleting(true);
    try {
      await window.api.supplyInvoices.delete(invoice.id);
      onDeleted();
    } catch {
      alert('فشل حذف الفاتورة');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!confirm('هل تريد حذف هذه الدفعة؟')) return;
    await window.api.supplierPayments.delete(paymentId);
    onPaymentAdded();
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} className="text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right"><p className="text-slate-500 text-xs">المتبقي</p><p className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(remaining)} ج.م</p></div>
            <div className="text-right"><p className="text-slate-500 text-xs">المدفوع</p><p className="font-semibold text-slate-700">{formatCurrency(invoice.total_paid)} ج.م</p></div>
            <div className="text-right"><p className="text-slate-500 text-xs">الإجمالي</p><p className="font-semibold text-slate-900">{formatCurrency(invoice.total)} ج.م</p></div>
            <div className="text-right"><p className="text-slate-500 text-xs">التاريخ</p><p className="font-medium text-slate-700">{invoice.date}</p></div>
            <div className="text-right"><p className="text-slate-500 text-xs">رقم الفاتورة</p><p className="font-bold text-blue-600">{invoice.invoice_number}</p></div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 border-t border-slate-100 pt-3 bg-slate-50/50">
          <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} />إضافة دفعة
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors border border-red-200">
            <Trash2 size={14} />حذف الفاتورة
          </button>
        </div>
        {expanded && (
          <div className="border-t border-slate-200 p-4 space-y-4 bg-white">
            {invoice.items && invoice.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Receipt size={15} />بنود الفاتورة</h4>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-right font-medium">الصنف</th>
                        <th className="px-3 py-2 text-center font-medium">الكمية</th>
                        <th className="px-3 py-2 text-center font-medium">سعر الوحدة</th>
                        <th className="px-3 py-2 text-center font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-3 py-2 text-slate-900">{item.merchandise_name || item.custom_name || '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{item.quantity}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-center font-semibold text-slate-900">{formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 font-bold text-slate-700">الإجمالي</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900">{formatCurrency(invoice.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            {invoice.notes && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-amber-700 font-medium mb-1">ملاحظات</p>
                <p className="text-sm text-amber-900">{invoice.notes}</p>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><CreditCard size={15} />سجل الدفعات</h4>
              {invoice.payments && invoice.payments.length > 0 ? (
                <div className="space-y-2">
                  {invoice.payments.map(pmt => (
                    <div key={pmt.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <button onClick={() => handleDeletePayment(pmt.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف الدفعة">
                        <Trash2 size={14} />
                      </button>
                      <div className="flex items-center gap-4 text-sm">
                        {pmt.notes && <span className="text-emerald-600 text-xs">{pmt.notes}</span>}
                        <span className="text-emerald-700">{pmt.date}</span>
                        <span className="font-bold text-emerald-800">{formatCurrency(pmt.amount)} ج.م</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-3">لا توجد مدفوعات بعد</p>
              )}
            </div>
          </div>
        )}
      </div>
      {showPaymentModal && (
        <SupplierPaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSaved={() => { setShowPaymentModal(false); onPaymentAdded(); }}
        />
      )}
    </>
  );
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supplierId = Number(id);

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSupplier(); }, [supplierId]);

  async function loadSupplier() {
    setLoading(true);
    try {
      const data = await window.api.suppliers.getById(supplierId);
      if (!data) { navigate('/suppliers'); return; }
      setSupplier(data);
      setEditForm({ name: data.name, phone: data.phone || '', address: data.address || '', notes: data.notes || '' });
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint() {
    setPrinting(true);
    try {
      await window.api.print.supplierReport(supplierId);
    } catch {
      alert('فشل إنشاء التقرير');
    } finally {
      setPrinting(false);
    }
  }

  async function handleDelete() {
    if (!supplier) return;
    if (!confirm(`هل تريد حذف المورد "${supplier.name}" وجميع بياناته؟`)) return;
    await window.api.suppliers.delete(supplierId);
    navigate('/suppliers');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError('الاسم مطلوب'); return; }
    setSaving(true);
    setEditError('');
    try {
      await window.api.suppliers.update(supplierId, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        address: editForm.address.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setShowEdit(false);
      await loadSupplier();
    } catch {
      setEditError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="w-24 h-4 bg-slate-100 rounded"></div>
        <div className="h-40 bg-white rounded-2xl border border-slate-100"></div>
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-slate-100"></div>)}</div>
      </div>
    );
  }

  if (!supplier) return null;

  const totalInvoiced = supplier.total_invoiced;
  const totalPaid = supplier.total_paid;
  const totalRemaining = totalInvoiced - totalPaid;

  return (
    <div className="p-6 space-y-6">
      <Link to="/suppliers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        الموردين <ArrowRight size={16} />
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
              <Trash2 size={14} />حذف المورد
            </button>
            <button onClick={() => { setShowEdit(true); setEditError(''); }} className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors">
              <Edit2 size={14} />تعديل
            </button>
            <button onClick={handlePrint} disabled={printing} className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60">
              <Printer size={14} />{printing ? 'جاري الطباعة...' : 'طباعة التقرير'}
            </button>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-slate-900">{supplier.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              {supplier.phone && <span className="flex items-center gap-1.5 text-sm text-slate-500"><Phone size={14} />{supplier.phone}</span>}
              {supplier.address && <span className="flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} />{supplier.address}</span>}
            </div>
            {supplier.notes && <p className="text-sm text-slate-400 mt-2 flex items-center gap-1.5"><FileText size={13} />{supplier.notes}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">إجمالي التوريدات</p>
            <p className="text-lg font-black text-slate-900">{formatCurrency(totalInvoiced)}</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mb-1">إجمالي المدفوع</p>
            <p className="text-lg font-black text-emerald-700">{formatCurrency(totalPaid)}</p>
          </div>
          <div className={`text-center p-4 rounded-xl ${totalRemaining > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${totalRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>الرصيد المتبقي</p>
            <p className={`text-lg font-black ${totalRemaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCurrency(totalRemaining)}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Link to={`/suppliers/${supplierId}/new-supply-invoice`} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm">
            <Plus size={16} />فاتورة توريد جديدة
          </Link>
          <h2 className="text-lg font-bold text-slate-900">فواتير التوريد ({supplier.invoices.length})</h2>
        </div>

        {supplier.invoices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400">
            <FileText size={40} className="mx-auto mb-3 text-slate-300" />
            <p>لا توجد فواتير توريد بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {supplier.invoices.map(inv => (
              <SupplyInvoiceCard key={inv.id} invoice={inv} onDeleted={loadSupplier} onPaymentAdded={loadSupplier} />
            ))}
          </div>
        )}
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">تعديل بيانات المورد</h2>
              <button onClick={() => setShowEdit(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              {editError && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle size={16} /><span>{editError}</span></div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الاسم <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الهاتف</label>
                <input type="text" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">العنوان</label>
                <input type="text" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</button>
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors active:scale-[0.98]">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
