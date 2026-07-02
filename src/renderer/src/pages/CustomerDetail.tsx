import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, Printer, Plus, Edit2, Trash2, Phone, MapPin, FileText, X, AlertCircle, Wallet, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import { formatCurrency } from '../utils';
import InvoiceCard from '../components/InvoiceCard';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [skipPaid, setSkipPaid] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Advance modal state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [advanceError, setAdvanceError] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [showAdvanceList, setShowAdvanceList] = useState(true);
  const [advanceSweepInfo, setAdvanceSweepInfo] = useState<{ applied: number } | null>(null);

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  async function loadCustomer() {
    setLoading(true);
    try {
      const data = await window.api.customers.getById(customerId);
      if (!data) { navigate('/customers'); return; }
      setCustomer(data);
      setEditForm({
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        notes: data.notes || '',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint() {
    setShowPrintModal(false);
    setPrinting(true);
    try {
      await window.api.print.customerReport(customerId, { skipPaid });
    } catch (e) {
      alert('فشل إنشاء التقرير');
    } finally {
      setPrinting(false);
    }
  }

  async function handleDelete() {
    if (!customer) return;
    if (!confirm(`هل تريد حذف العميل "${customer.name}" وجميع بياناته؟ لا يمكن التراجع عن هذا.`)) return;
    await window.api.customers.delete(customerId);
    navigate('/customers');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError('الاسم مطلوب'); return; }
    setSaving(true);
    setEditError('');
    try {
      await window.api.customers.update(customerId, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        address: editForm.address.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setShowEdit(false);
      await loadCustomer();
    } catch {
      setEditError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAdvance(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(advanceForm.amount);
    if (!amountNum || amountNum <= 0) { setAdvanceError('يرجى إدخال مبلغ صحيح'); return; }
    if (!advanceForm.date) { setAdvanceError('التاريخ مطلوب'); return; }
    setSavingAdvance(true);
    setAdvanceError('');
    try {
      const result = await window.api.customers.addAdvance({
        customer_id: customerId,
        amount: amountNum,
        date: advanceForm.date,
        notes: advanceForm.notes.trim() || undefined,
      });
      setShowAdvanceModal(false);
      setAdvanceForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
      if (result.applied_to_existing > 0) {
        setAdvanceSweepInfo({ applied: result.applied_to_existing });
        setTimeout(() => setAdvanceSweepInfo(null), 5000);
      }
      await loadCustomer();
    } catch {
      setAdvanceError('حدث خطأ أثناء الحفظ');
    } finally {
      setSavingAdvance(false);
    }
  }

  async function handleDeleteAdvance(advance: CustomerAdvance) {
    if (advance.used_amount > 0) {
      alert('لا يمكن حذف دفعة مقدمة تم استخدامها في فواتير');
      return;
    }
    if (!confirm(`هل تريد حذف الدفعة المقدمة بقيمة ${formatCurrency(advance.amount)} ج.م؟`)) return;
    try {
      await window.api.customers.deleteAdvance(advance.id);
      await loadCustomer();
    } catch {
      alert('فشل حذف الدفعة المقدمة');
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="w-24 h-4 bg-slate-100 rounded"></div>
        <div className="h-40 bg-white rounded-2xl border border-slate-100"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-slate-100"></div>)}
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const totalInvoiced = customer.total_invoiced;
  const totalPaid = customer.total_paid;
  const totalRemaining = totalInvoiced - totalPaid;
  const advanceBalance = customer.advance_balance ?? 0;
  const advances = customer.advances ?? [];
  const hasAdvances = advances.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Link
        to="/customers"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        العملاء
        <ArrowRight size={16} />
      </Link>

      {/* Sweep notification banner */}
      {advanceSweepInfo && (
        <div className="flex items-center gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 text-sm">
          <span className="text-xl">✓</span>
          <span>
            تم تسوية فواتير سابقة بمبلغ <strong>{formatCurrency(advanceSweepInfo.applied)} ج.م</strong> من الدفعة المقدمة تلقائياً
          </span>
          <button onClick={() => setAdvanceSweepInfo(null)} className="mr-auto text-teal-500 hover:text-teal-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Customer Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              حذف العميل
            </button>
            <button
              onClick={() => { setShowEdit(true); setEditError(''); }}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Edit2 size={14} />
              تعديل
            </button>
            <button
              onClick={() => { setShowAdvanceModal(true); setAdvanceError(''); }}
              className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Wallet size={14} />
              تسجيل دفعة مقدمة
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={printing}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              <Printer size={14} />
              {printing ? 'جاري الطباعة...' : 'طباعة التقرير'}
            </button>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              {customer.phone && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone size={14} />
                  {customer.phone}
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin size={14} />
                  {customer.address}
                </span>
              )}
            </div>
            {customer.notes && (
              <p className="text-sm text-slate-400 mt-2 flex items-center gap-1.5">
                <FileText size={13} />
                {customer.notes}
              </p>
            )}
          </div>
        </div>

        {/* Balance summary — 4 cards */}
        <div className="grid grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">إجمالي الفواتير</p>
            <p className="text-lg font-black text-slate-900">{formatCurrency(totalInvoiced)}</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mb-1">إجمالي المدفوع</p>
            <p className="text-lg font-black text-emerald-700">{formatCurrency(totalPaid)}</p>
          </div>
          <div className={`text-center p-4 rounded-xl ${totalRemaining > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${totalRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>الرصيد المتبقي</p>
            <p className={`text-lg font-black ${totalRemaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatCurrency(totalRemaining)}
            </p>
          </div>
          <div className={`text-center p-4 rounded-xl ${advanceBalance > 0 ? 'bg-teal-50' : 'bg-slate-50'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${advanceBalance > 0 ? 'text-teal-600' : 'text-slate-400'}`}>رصيد مقدم</p>
            <p className={`text-lg font-black ${advanceBalance > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
              {formatCurrency(advanceBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Advance Payments Section */}
      {hasAdvances && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAdvanceList(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-teal-50/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-teal-700">
              {showAdvanceList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="text-sm font-semibold">
                رصيد مقدم متاح: {formatCurrency(advanceBalance)} ج.م
              </span>
            </div>
            <h3 className="text-sm font-bold text-teal-800">
              الدفعات المقدمة ({advances.length})
            </h3>
          </button>

          {showAdvanceList && (
            <div className="divide-y divide-slate-100 border-t border-teal-100">
              {advances.map(adv => {
                const remaining = adv.amount - adv.used_amount;
                const fullyConsumed = remaining <= 0;
                return (
                  <div key={adv.id} className="flex items-center justify-between px-5 py-3">
                    {/* Left: delete */}
                    <button
                      onClick={() => handleDeleteAdvance(adv)}
                      disabled={adv.used_amount > 0}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title={adv.used_amount > 0 ? 'لا يمكن الحذف — تم استخدام جزء من هذه الدفعة' : 'حذف'}
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Middle: amounts */}
                    <div className="flex items-center gap-6 text-sm">
                      {adv.used_amount > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400">المستخدم</p>
                          <p className="font-bold text-slate-500">{formatCurrency(adv.used_amount)} ج.م</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-teal-600">المتبقي</p>
                        <p className={`font-bold ${fullyConsumed ? 'text-slate-400' : 'text-teal-700'}`}>
                          {formatCurrency(remaining)} ج.م
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400">المبلغ الأصلي</p>
                        <p className="font-bold text-slate-700">{formatCurrency(adv.amount)} ج.م</p>
                      </div>
                    </div>

                    {/* Right: date + status + notes */}
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fullyConsumed ? 'bg-slate-100 text-slate-500' : 'bg-teal-100 text-teal-700'}`}>
                          {fullyConsumed ? 'مستخدمة بالكامل' : 'متاحة'}
                        </span>
                        <p className="text-xs font-semibold text-slate-600">{adv.date}</p>
                      </div>
                      {adv.notes && <p className="text-xs text-slate-400 mt-0.5">{adv.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invoices section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link
            to={`/customers/${customerId}/new-invoice`}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm"
          >
            <Plus size={16} />
            فاتورة جديدة
            {advanceBalance > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                رصيد: {formatCurrency(advanceBalance)}
              </span>
            )}
          </Link>
          <h2 className="text-lg font-bold text-slate-900">
            الفواتير ({customer.invoices.length})
          </h2>
        </div>

        {customer.invoices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400">
            <FileText size={40} className="mx-auto mb-3 text-slate-300" />
            <p>لا توجد فواتير بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customer.invoices.map(inv => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                customerId={customerId}
                onDeleted={loadCustomer}
                onPaymentAdded={loadCustomer}
              />
            ))}
          </div>
        )}
      </div>

      {/* Print Options Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Printer size={16} className="text-slate-600" />
                خيارات الطباعة
              </h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Filter option */}
              <div
                onClick={() => setSkipPaid(v => !v)}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  skipPaid
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Filter size={16} className={skipPaid ? 'text-blue-600' : 'text-slate-400'} />
                  <div>
                    <p className={`text-sm font-semibold ${skipPaid ? 'text-blue-800' : 'text-slate-700'}`}>
                      تخطي الفواتير المدفوعة بالكامل
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      سيتم طباعة الفواتير غير المسددة فقط
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  skipPaid ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                }`}>
                  {skipPaid && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>

              {/* Info line */}
              <p className="text-xs text-slate-400 text-center">
                ترتيب الفواتير: الأحدث أولاً
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-slate-800/20 active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                >
                  <Printer size={15} />
                  طباعة
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors active:scale-[0.98] text-sm"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">تسجيل دفعة مقدمة</h2>
              <button onClick={() => setShowAdvanceModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAdvance} className="p-6 space-y-4">
              {advanceError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  <span>{advanceError}</span>
                </div>
              )}
              <div className="p-3 bg-teal-50 text-teal-700 rounded-lg text-sm">
                سيتم تطبيق هذا الرصيد تلقائياً على الفواتير القادمة لهذا العميل
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  المبلغ <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={advanceForm.amount}
                  onChange={e => setAdvanceForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all duration-200 text-sm"
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  التاريخ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={advanceForm.date}
                  onChange={e => setAdvanceForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all duration-200 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  value={advanceForm.notes}
                  onChange={e => setAdvanceForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all duration-200 resize-none text-sm"
                  rows={2}
                  placeholder="ملاحظات اختيارية"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingAdvance}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98] text-sm"
                >
                  {savingAdvance ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors active:scale-[0.98] text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">تعديل بيانات العميل</h2>
              <button onClick={() => setShowEdit(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              {editError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  <span>{editError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الاسم <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  required autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الهاتف</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">العنوان</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
