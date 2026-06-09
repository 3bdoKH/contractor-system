import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search, Receipt, Calendar, CreditCard, AlertCircle, X, Coins } from 'lucide-react';
import { formatCurrency } from '../utils';

interface NewExpenseForm {
  description: string;
  amount: string;
  date: string;
  notes: string;
}

const emptyForm = (): NewExpenseForm => ({
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
});

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewExpenseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Filters
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    try {
      const data = await window.api.expenses.getAll();
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!form.description.trim()) {
      setFormError('البيان مطلوب');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!form.date) {
      setFormError('التاريخ مطلوب');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await window.api.expenses.create({
        description: form.description.trim(),
        amount: amountNum,
        date: form.date,
        notes: form.notes.trim() || undefined,
      });
      setShowModal(false);
      setForm(emptyForm());
      await loadExpenses();
    } catch (err) {
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    const confirmMessage = expense.type === 'manual'
      ? `هل تريد حذف مصروف "${expense.description}" بقيمة ${formatCurrency(expense.amount)} ج.م؟`
      : `هل تريد حذف دفعة المورد "${expense.description}" بقيمة ${formatCurrency(expense.amount)} ج.م؟ (سيتم تعديل رصيد المورد تلقائياً)`;

    if (!confirm(confirmMessage)) return;

    try {
      if (expense.type === 'manual') {
        await window.api.expenses.delete(expense.id);
      } else {
        await window.api.supplierPayments.delete(expense.id);
      }
      await loadExpenses();
    } catch (err) {
      alert('فشل حذف البند');
    }
  }

  // Filter and group logic
  const filteredExpenses = expenses.filter(exp => {
    // Search query
    const matchQuery = exp.description.toLowerCase().includes(query.toLowerCase()) ||
      (exp.notes && exp.notes.toLowerCase().includes(query.toLowerCase()));

    // Date ranges
    const matchStart = startDate ? exp.date >= startDate : true;
    const matchEnd = endDate ? exp.date <= endDate : true;

    return matchQuery && matchStart && matchEnd;
  });

  // Totals
  const totalManual = filteredExpenses
    .filter(e => e.type === 'manual')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalSupplier = filteredExpenses
    .filter(e => e.type === 'supplier_payment')
    .reduce((sum, e) => sum + e.amount, 0);

  const grandTotal = totalManual + totalSupplier;

  // Group by date daily
  const groups: { [date: string]: Expense[] } = {};
  filteredExpenses.forEach(exp => {
    if (!groups[exp.date]) {
      groups[exp.date] = [];
    }
    groups[exp.date].push(exp);
  });

  // Sorted dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setShowModal(true); setForm(emptyForm()); setFormError(''); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm"
        >
          <Plus size={18} />
          إضافة مصروف جديد
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">المصاريف</h1>
          <p className="text-slate-500 text-sm mt-0.5">تسجيل ومتابعة المصروفات اليومية ودفعات الموردين</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <Coins size={24} />
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي المصاريف</p>
            <p className="text-xl font-black text-slate-900">{formatCurrency(grandTotal)} ج.م</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
            <Receipt size={24} />
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 mb-1">مصروفات يدوية</p>
            <p className="text-xl font-black text-emerald-700">{formatCurrency(totalManual)} ج.م</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
          <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
            <CreditCard size={24} />
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 mb-1">دفعات الموردين</p>
            <p className="text-xl font-black text-indigo-700">{formatCurrency(totalSupplier)} ج.م</p>
          </div>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-4 gap-4 items-end">
        <div className="col-span-2 relative">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">بحث</label>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="بحث في البيان أو الملاحظات..."
              className="w-full pr-9 pl-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">من تاريخ</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">إلى تاريخ</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm text-slate-700"
          />
        </div>
      </div>

      {/* Expenses List Grouped Daily */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="space-y-2">
              <div className="w-32 h-6 bg-slate-100 rounded animate-pulse"></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                {[1, 2].map(j => (
                  <div key={j} className="flex justify-between items-center py-2 animate-pulse">
                    <div className="w-24 h-4 bg-slate-100 rounded"></div>
                    <div className="w-48 h-4 bg-slate-100 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-200">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <Receipt size={40} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">لا توجد مصاريف مسجلة</h3>
          <p className="text-slate-500 max-w-sm text-sm">
            {query || startDate || endDate ? 'لا توجد نتائج تطابق فلاتر البحث الحالية' : 'ابدأ بإضافة أول مصروف يدوي أو قم بتسجيل دفعات للموردين لتظهر هنا'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => {
            const items = groups[date];
            const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);
            return (
              <div key={date} className="space-y-2">
                {/* Date Header */}
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="font-bold text-sm">{date}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    اليومي: {formatCurrency(dayTotal)} ج.م
                  </div>
                </div>

                {/* Date Items Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {items.map(item => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        {/* Right Section: Amount & Action */}
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="text-left">
                            <span className="font-bold text-slate-900">{formatCurrency(item.amount)} ج.م</span>
                          </div>
                        </div>

                        {/* Left Section: Description & Type Badge */}
                        <div className="text-right flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <p className="font-semibold text-slate-800 text-sm">{item.description}</p>
                            {item.notes && <p className="text-xs text-slate-400 mt-1">{item.notes}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.type === 'manual'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}>
                            {item.type === 'manual' ? 'مصروف ' : 'دفعة مورد'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">إضافة مصروف يدوي جديد</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  البيان / نوع المصروف <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 text-sm"
                  placeholder="مثال: بنزين، كهرباء، صيانة..."
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  المبلغ <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 text-sm"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  التاريخ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none text-sm animate-none"
                  rows={3}
                  placeholder="ملاحظات اختيارية"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] text-sm"
                >
                  {saving ? 'جاري الحفظ...' : 'إضافة المصروف'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors active:scale-[0.98] text-sm"
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
