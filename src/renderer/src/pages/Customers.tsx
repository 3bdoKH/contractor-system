import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X, AlertCircle, UserCircle } from 'lucide-react';
import { formatCurrency, getInvoiceStatus, STATUS_CLASSES, STATUS_LABELS } from '../utils';

interface NewCustomerForm {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

const emptyForm: NewCustomerForm = { name: '', phone: '', address: '', notes: '' };

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewCustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  console.log('window.api =', window.api)
  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) {
        window.api.customers.search(query).then(setCustomers);
      } else {
        loadCustomers();
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await window.api.customers.getAll();
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('اسم العميل مطلوب');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await window.api.customers.create({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setShowModal(false);
      setForm(emptyForm);
      await loadCustomers();
    } catch {
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  function getCustomerStatusClass(c: Customer) {
    const remaining = c.total_invoiced - c.total_paid;
    if (c.total_invoiced === 0) return 'bg-slate-100 text-slate-600';
    if (remaining <= 0) return 'bg-emerald-100 text-emerald-800';
    if (c.total_paid > 0) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  }

  function getCustomerStatusLabel(c: Customer) {
    const remaining = c.total_invoiced - c.total_paid;
    if (c.total_invoiced === 0) return 'لا توجد فواتير';
    if (remaining <= 0) return STATUS_LABELS.paid;
    if (c.total_paid > 0) return STATUS_LABELS.partial;
    return STATUS_LABELS.unpaid;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setShowModal(true); setForm(emptyForm); setFormError(''); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={18} />
          عميل جديد
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">العملاء</h1>
          <p className="text-slate-500 text-sm mt-0.5">{customers.length} عميل</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف..."
          className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition"
        />
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse">
              <div className="w-20 h-10 bg-slate-100 rounded-lg"></div>
              <div className="text-right">
                <div className="w-32 h-4 bg-slate-100 rounded mb-2"></div>
                <div className="w-20 h-3 bg-slate-50 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <UserCircle size={40} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {query ? 'لا توجد نتائج' : 'لم يتم إضافة عملاء بعد'}
          </h3>
          <p className="text-slate-500 max-w-sm">
            {query ? 'جرب البحث باسم مختلف أو تأكد من صحة رقم الهاتف' : 'ابدأ بإضافة أول عميل لك بالنقر على زر "عميل جديد" في الأعلى'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {customers.map(c => {
              const remaining = c.total_invoiced - c.total_paid;
              return (
                <Link
                  key={c.id}
                  to={`/customers/${c.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">المتبقي</p>
                      <p className={`font-black text-sm ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${getCustomerStatusClass(c).replace('border', '')} bg-opacity-10`}>
                      {getCustomerStatusLabel(c)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{c.name}</p>
                    {c.phone && <p className="text-xs text-slate-400 mt-0.5">{c.phone}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">إضافة عميل جديد</h2>
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
                  الاسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  placeholder="اسم العميل"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الهاتف</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  placeholder="01xxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">العنوان</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  placeholder="العنوان"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none"
                  rows={3}
                  placeholder="ملاحظات اختيارية"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                  {saving ? 'جاري الحفظ...' : 'إضافة العميل'}
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
