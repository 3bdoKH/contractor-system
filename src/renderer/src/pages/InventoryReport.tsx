import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, Printer, Calendar, FileText, Edit3, RotateCcw,
  Trash2, Check, X, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '../utils';

const MONTHS = [
  { value: 1, label: 'يناير' }, { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' }, { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' }, { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' }, { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' }, { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' }, { value: 12, label: 'ديسمبر' },
];

type EditingItem = {
  id: number;
  qty: string;
  price: string;
};

type ConfirmDialog = {
  type: 'reset-zero' | 'clear-all' | 'remove-item';
  merchandise_id?: number;
  name?: string;
};

export default function InventoryReport() {
  const [reportType, setReportType] = useState<'all' | 'annual' | 'monthly'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [report, setReport] = useState<InventoryReport>({
    items: [], summary: { total_items: 0, total_stock_qty: 0, total_valuation: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [adjustMode, setAdjustMode] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const dateFilters = useMemo(() => {
    if (reportType === 'all') return { from: '', to: '' };
    if (reportType === 'annual') return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    if (reportType === 'monthly') {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      return { from: `${selectedYear}-${monthStr}-01`, to: `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}` };
    }
    return { from: '', to: '' };
  }, [reportType, selectedYear, selectedMonth]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const f: any = {};
      if (dateFilters.from) f.from = dateFilters.from;
      if (dateFilters.to) f.to = dateFilters.to;
      const data = await window.api.inventory.getReport(f);
      setReport(data);
    } catch (err) {
      console.error('Error loading inventory report:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFilters]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return report.items;
    const q = searchQuery.toLowerCase();
    return report.items.filter((item) => item.name.toLowerCase().includes(q));
  }, [report.items, searchQuery]);

  const filteredSummary = useMemo(() => ({
    total_items: filteredItems.length,
    total_stock_qty: filteredItems.reduce((s, i) => s + i.closing_stock, 0),
    total_valuation: filteredItems.reduce((s, i) => s + i.valuation, 0),
  }), [filteredItems]);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const list: number[] = [];
    for (let y = cur - 5; y <= cur + 2; y++) list.push(y);
    return list.reverse();
  }, []);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const f: any = {};
      if (dateFilters.from) f.from = dateFilters.from;
      if (dateFilters.to) f.to = dateFilters.to;
      let title = 'تقرير حركة وجرد المخزن';
      if (reportType === 'annual') title = `تقرير حركة وجرد المخزن السنوي لعام ${selectedYear}`;
      else if (reportType === 'monthly') {
        const mLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || '';
        title = `تقرير حركة وجرد المخزن الشهري لـ ${mLabel} ${selectedYear}`;
      }
      await window.api.inventory.printReport(f, title);
    } catch (err) {
      console.error('Error printing inventory report:', err);
    } finally {
      setPrinting(false);
    }
  };

  // Start editing an item
  const startEdit = (item: InventoryReportItem) => {
    setEditingItem({
      id: item.id,
      qty: item.has_manual_override ? String(item.closing_stock) : String(item.auto_closing_stock ?? item.closing_stock),
      price: String(item.latest_price),
    });
  };

  const cancelEdit = () => setEditingItem(null);

  const saveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const qty = editingItem.qty === '' ? null : Number(editingItem.qty);
      const price = editingItem.price === '' ? null : Number(editingItem.price);
      await window.api.inventory.setAdjustment({
        merchandise_id: editingItem.id,
        manual_quantity: qty,
        manual_price: price,
      });
      setEditingItem(null);
      await loadReport();
      showToast('تم حفظ التعديل اليدوي بنجاح');
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeAdjustment = async (merchandise_id: number) => {
    try {
      await window.api.inventory.removeAdjustment(merchandise_id);
      await loadReport();
      showToast('تم إزالة التعديل، الكمية تلقائية الآن');
    } catch {
      showToast('حدث خطأ', 'error');
    }
    setConfirm(null);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === 'reset-zero') {
      try {
        await window.api.inventory.resetToZero();
        await loadReport();
        showToast('تم إعادة تعيين المخزون إلى صفر لجميع المواد');
      } catch { showToast('حدث خطأ', 'error'); }
    } else if (confirm.type === 'clear-all') {
      try {
        await window.api.inventory.resetAllAdjustments();
        await loadReport();
        showToast('تم مسح جميع التعديلات اليدوية');
      } catch { showToast('حدث خطأ', 'error'); }
    } else if (confirm.type === 'remove-item' && confirm.merchandise_id) {
      await removeAdjustment(confirm.merchandise_id);
      return;
    }
    setConfirm(null);
  };

  const hasAnyOverride = report.items.some((i) => i.has_manual_override);

  return (
    <div className="p-6 space-y-6 text-right" dir="rtl">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" dir="rtl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle size={22} />
              <h3 className="font-bold text-slate-900 text-base">
                {confirm.type === 'reset-zero' && 'إعادة تعيين المخزون إلى صفر'}
                {confirm.type === 'clear-all' && 'مسح جميع التعديلات اليدوية'}
                {confirm.type === 'remove-item' && `إزالة تعديل: ${confirm.name}`}
              </h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              {confirm.type === 'reset-zero' && 'سيتم تعيين الكمية الفعلية لجميع المواد إلى صفر (0). يمكنك بعدها تعديل كل مادة يدوياً.'}
              {confirm.type === 'clear-all' && 'سيتم إزالة جميع التعديلات اليدوية وسيعود النظام للحساب التلقائي من الفواتير.'}
              {confirm.type === 'remove-item' && 'سيتم إزالة التعديل اليدوي لهذه المادة وسيعود النظام للحساب التلقائي.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">إلغاء</button>
              <button onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">تقرير حركة وجرد المخزن</h1>
          <p className="text-slate-500 text-sm mt-0.5">مراقبة الوارد والمنصرف والكميات المتبقية وقيمة المخزون</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setAdjustMode(!adjustMode); setEditingItem(null); }}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all duration-150 text-sm border ${adjustMode ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
          >
            <Edit3 size={15} />
            {adjustMode ? 'إغلاق وضع التعديل' : 'تعديل يدوي'}
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || printing}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all duration-150 text-sm"
          >
            <Printer size={16} />
            {printing ? 'جاري التصدير...' : 'طباعة PDF'}
          </button>
        </div>
      </div>

      {/* Manual Adjustment Banner */}
      {adjustMode && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-xl text-violet-600"><Edit3 size={18} /></div>
            <div>
              <p className="font-bold text-violet-900 text-sm">وضع التعديل اليدوي نشط</p>
              <p className="text-violet-600 text-xs mt-0.5">انقر على أيقونة التعديل بجوار أي مادة لضبط كميتها أو سعرها يدوياً</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {hasAnyOverride && (
              <button
                onClick={() => setConfirm({ type: 'clear-all' })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                <Trash2 size={13} />
                مسح كل التعديلات
              </button>
            )}
            <button
              onClick={() => setConfirm({ type: 'reset-zero' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition"
            >
              <RotateCcw size={13} />
              إعادة تعيين إلى صفر
            </button>
          </div>
        </div>
      )}

      {/* Override notice (when not in adjust mode) */}
      {!adjustMode && hasAnyOverride && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 text-violet-700 text-sm">
          <Edit3 size={14} />
          <span>بعض الكميات تم تعديلها يدوياً — <button onClick={() => setAdjustMode(true)} className="underline font-semibold">انقر هنا لإدارة التعديلات</button></span>
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(['all', 'annual', 'monthly'] as const).map((t) => (
              <button key={t} onClick={() => setReportType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${reportType === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {t === 'all' ? 'كل الوقت' : t === 'annual' ? 'سنوي' : 'شهري'}
              </button>
            ))}
          </div>
          {(reportType === 'annual' || reportType === 'monthly') && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">السنة:</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {reportType === 'monthly' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">الشهر:</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="relative w-full md:w-72">
          <input type="text" placeholder="بحث باسم البضاعة..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right bg-slate-50 focus:bg-white transition-colors" />
          <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="px-5 py-3.5 text-right">اسم البضاعة / المادة</th>
                <th className="px-4 py-3.5 text-center">وحدة الأساس</th>
                <th className="px-4 py-3.5 text-center">الوارد (+)</th>
                <th className="px-4 py-3.5 text-center">المنصرف (-)</th>
                <th className="px-4 py-3.5 text-center"> الرصيد</th>
                <th className="px-4 py-3.5 text-center">آخر سعر شراء</th>
                <th className="px-4 py-3.5 text-center">القيمة التقديرية</th>
                {adjustMode && <th className="px-4 py-3.5 text-center w-24">تعديل</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(adjustMode ? 9 : 8)].map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-full mx-auto" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={adjustMode ? 9 : 8} className="text-center py-12 text-slate-400">
                    لا توجد بضائع متوفرة تطابق خيارات البحث 📦
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isEditing = editingItem?.id === item.id;
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.has_manual_override ? 'bg-violet-50/30' : ''}`}>
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          {item.name}
                          {item.has_manual_override && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-semibold">
                              <Edit3 size={10} /> يدوي
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Base unit */}
                      <td className="px-4 py-3.5 text-center">
                        {item.base_unit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
                            {item.base_unit}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {item.incoming > 0 ? `${item.incoming.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {item.outgoing > 0 ? `${item.outgoing.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editingItem.qty}
                            onChange={(e) => setEditingItem({ ...editingItem, qty: e.target.value })}
                            className="w-24 text-center border border-violet-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            autoFocus
                          />
                        ) : (
                          <span className={item.has_manual_override ? 'text-violet-700' : 'text-slate-900'}>
                            {item.closing_stock.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
                            {item.has_manual_override && (
                              <span className="block text-xs text-slate-400 font-normal">
                                تلقائي: {(item.auto_closing_stock ?? 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editingItem.price}
                            onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                            className="w-24 text-center border border-violet-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        ) : (
                          item.latest_price > 0 ? `${formatCurrency(item.latest_price)} ج.م` : '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {item.valuation > 0 ? `${formatCurrency(item.valuation)} ج.م` : '—'}
                      </td>
                      {adjustMode && (
                        <td className="px-4 py-3.5 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={saveEdit} disabled={saving}
                                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition">
                                <Check size={14} />
                              </button>
                              <button onClick={cancelEdit}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => startEdit(item)}
                                className="p-1.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 transition" title="تعديل يدوي">
                                <Edit3 size={14} />
                              </button>
                              {item.has_manual_override && (
                                <button
                                  onClick={() => setConfirm({ type: 'remove-item', merchandise_id: item.id, name: item.name })}
                                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition" title="إزالة التعديل">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
