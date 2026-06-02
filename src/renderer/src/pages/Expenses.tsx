import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, AlertCircle, Receipt, Filter } from 'lucide-react';
import { formatCurrency } from '../utils';

interface Filters {
  from: string;
  to: string;
  category_id: string;
}

interface ExpenseForm {
  date: string;
  category_id: string;
  custom_category: string;
  useCustom: boolean;
  amount: string;
  notes: string;
}

const emptyForm: ExpenseForm = {
  date: '',
  category_id: '',
  custom_category: '',
  useCustom: false,
  amount: '',
  notes: '',
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<Filters>({ from: '', to: '', category_id: '' });

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const buildFilters = useCallback(() => {
    const f: any = {};
    if (filters.from) f.from = filters.from;
    if (filters.to) f.to = filters.to;
    if (filters.category_id) f.category_id = Number(filters.category_id);
    return f;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const f = buildFilters();
      const [data, totalRes] = await Promise.all([
        window.api.expenses.getAll(f),
        window.api.expenses.getTotal(f),
      ]);
      setExpenses(data);
      setTotal(totalRes.total);
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    window.api.expenses.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(exp: Expense) {
    setEditingId(exp.id);
    setForm({
      date: exp.date,
      category_id: exp.category_id ? String(exp.category_id) : '',
      custom_category: exp.custom_category ?? '',
      useCustom: !exp.category_id && !!exp.custom_category,
      amount: String(exp.amount),
      notes: exp.notes ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!form.date.trim()) { setFormError('يرجى إدخال التاريخ'); return; }
    if (!amountNum || amountNum <= 0) { setFormError('يرجى إدخال مبلغ صحيح'); return; }
    if (!form.useCustom && !form.category_id) { setFormError('يرجى اختيار الفئة'); return; }
    if (form.useCustom && !form.custom_category.trim()) { setFormError('يرجى إدخال اسم الفئة المخصصة'); return; }

    setSaving(true);
    setFormError('');
    try {
      const data = {
        date: form.date.trim(),
        amount: amountNum,
        notes: form.notes.trim() || undefined,
        category_id: form.useCustom ? undefined : Number(form.category_id),
        custom_category: form.useCustom ? form.custom_category.trim() : undefined,
      };

      if (editingId !== null) {
        await window.api.expenses.update(editingId, data);
      } else {
        await window.api.expenses.create(data);
      }
      setShowModal(false);
      await load();
    } catch {
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return;
    await window.api.expenses.delete(id);
    await load();
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await window.api.expenses.createCategory(newCatName.trim());
      const updated = await window.api.expenses.getCategories();
      setCategories(updated);
      // auto-select the new category
      const found = updated.find(c => c.name === newCatName.trim());
      if (found) setForm(f => ({ ...f, category_id: String(found.id), useCustom: false }));
      setNewCatName('');
    } finally {
      setAddingCat(false);
    }
  }

  const getCategoryLabel = (exp: Expense) => {
    if (exp.category_name) return exp.category_name;
    if (exp.custom_category) return exp.custom_category;
    return '—';
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={18} />
          مصروف جديد
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">المصروفات</h1>
          <p className="text-slate-500 text-sm mt-0.5">{expenses.length} مصروف</p>
        </div>
      </div>

      {/* Total summary card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between">
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">إجمالي المصروفات</p>
          <p className="text-2xl font-black text-amber-800">{formatCurrency(total)} ج.م</p>
        </div>
        <Receipt size={36} className="text-amber-300" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">تصفية</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">الفئة</label>
            <select
              value={filters.category_id}
              onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">كل الفئات</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {(filters.from || filters.to || filters.category_id) && (
          <button
            onClick={() => setFilters({ from: '', to: '', category_id: '' })}
            className="mt-3 text-xs text-slate-500 hover:text-red-500 transition-colors"
          >
            مسح الفلاتر ×
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <Receipt size={40} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">لا توجد مصروفات</h3>
          <p className="text-slate-500 max-w-sm">سجّل أول مصروف بالنقر على "مصروف جديد"</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">التاريخ</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">الفئة</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">المبلغ</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">ملاحظات</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, idx) => (
                  <tr key={exp.id} className={`border-b border-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 text-slate-700 font-medium">{exp.date}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                        {getCategoryLabel(exp)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {formatCurrency(exp.amount)} ج.م
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{exp.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId !== null ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  التاريخ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  الفئة <span className="text-red-500">*</span>
                </label>
                {form.useCustom ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, useCustom: false, custom_category: '' }))}
                        className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                      >
                        اختر من القائمة
                      </button>
                      <input
                        type="text"
                        value={form.custom_category}
                        onChange={e => setForm(f => ({ ...f, custom_category: e.target.value }))}
                        placeholder="اسم الفئة المخصصة"
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={form.category_id}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setForm(f => ({ ...f, useCustom: true, category_id: '' }));
                        } else {
                          setForm(f => ({ ...f, category_id: e.target.value }));
                        }
                      }}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    >
                      <option value="">-- اختر فئة --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="__custom__">أخرى (مخصص)</option>
                    </select>

                    {/* Quick add category */}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        placeholder="أضف فئة جديدة..."
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        disabled={addingCat || !newCatName.trim()}
                        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  المبلغ (ج.م) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ملاحظات <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات اختيارية"
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                  {saving ? 'جاري الحفظ...' : editingId !== null ? 'حفظ التعديلات' : 'إضافة المصروف'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
