import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Plus, Trash2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils';

interface ItemRow {
  id: string;
  merchandise_id: number | null;
  custom_name: string;
  useCustom: boolean;
  quantity: string;
  unit_price: string;
  unit: string;
}

function newRow(): ItemRow {
  return {
    id: Math.random().toString(36).slice(2),
    merchandise_id: null,
    custom_name: '',
    useCustom: false,
    quantity: '',
    unit_price: '',
    unit: '',
  };
}

export default function NewInvoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const [customer, setCustomer] = useState<{ name: string } | null>(null);
  const [merchandise, setMerchandise] = useState<Merchandise[]>([]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      window.api.customers.getById(customerId),
      window.api.merchandise.getAll(),
    ]).then(([cust, merch]) => {
      if (!cust) { navigate('/customers'); return; }
      setCustomer({ name: cust.name });
      setMerchandise(merch);
    });
  }, [customerId]);

  function updateRow(id: string, patch: Partial<ItemRow>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function removeRow(id: string) {
    setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs);
  }

  const grandTotal = rows.reduce((sum, r) => {
    const q = parseFloat(r.quantity) || 0;
    const p = parseFloat(r.unit_price) || 0;
    return sum + q * p;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!date.trim()) {
      setError('يرجى إدخال تاريخ الفاتورة');
      return;
    }

    const validRows = rows.filter(r => {
      const hasName = r.useCustom ? r.custom_name.trim() : r.merchandise_id;
      const hasQty = parseFloat(r.quantity) > 0;
      const hasPrice = parseFloat(r.unit_price) >= 0;
      return hasName && hasQty && hasPrice;
    });

    if (validRows.length === 0) {
      setError('يرجى إضافة بند واحد على الأقل بكمية وسعر');
      return;
    }

    setSaving(true);
    try {
      await window.api.invoices.create({
        customer_id: customerId,
        date: date.trim(),
        notes: notes.trim() || undefined,
        items: validRows.map(r => ({
          merchandise_id: r.useCustom ? undefined : (r.merchandise_id ?? undefined),
          custom_name: r.useCustom ? r.custom_name.trim() : undefined,
          quantity: parseFloat(r.quantity),
          unit_price: parseFloat(r.unit_price),
          unit: r.unit || undefined,
        })),
      });
      navigate(`/customers/${customerId}`);
    } catch (err) {
      setError('حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <Link
        to={`/customers/${customerId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        {customer?.name}
        <ArrowRight size={16} />
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">فاتورة جديدة</h1>
        {customer && <p className="text-slate-500 text-sm mt-1">{customer.name}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Date & Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              التاريخ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full max-w-xs px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ملاحظات</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات اختيارية"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setRows(rs => [...rs, newRow()])}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={16} />
              إضافة بند
            </button>
            <h2 className="text-base font-semibold text-slate-900">بنود الفاتورة</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-3"></th>
                  <th className="px-3 py-3 text-right font-medium">الصنف</th>
                  <th className="px-3 py-3 text-center font-medium w-28">الكمية</th>
                  <th className="px-3 py-3 text-center font-medium w-28">الوحدة</th>
                  <th className="px-3 py-3 text-center font-medium w-32">سعر الوحدة</th>
                  <th className="px-3 py-3 text-center font-medium w-36">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0);
                  return (
                    <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                          title="حذف البند"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {row.useCustom ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateRow(row.id, { useCustom: false, custom_name: '' })}
                              className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                            >
                              اختر من القائمة
                            </button>
                            <input
                              type="text"
                              value={row.custom_name}
                              onChange={e => updateRow(row.id, { custom_name: e.target.value })}
                              placeholder="اسم الصنف"
                              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateRow(row.id, { useCustom: true, merchandise_id: null })}
                              className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                            >
                              صنف مخصص
                            </button>
                            <select
                              value={row.merchandise_id ?? ''}
                              onChange={e => updateRow(row.id, { merchandise_id: Number(e.target.value) || null })}
                              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 bg-white"
                            >
                              <option value="">-- اختر صنف --</option>
                              {merchandise.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.quantity}
                          onChange={e => updateRow(row.id, { quantity: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-center text-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.unit}
                          onChange={e => updateRow(row.id, { unit: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-center text-slate-900 bg-white"
                        >
                          <option value="">--</option>
                          <option value="طن">طن</option>
                          <option value="شكاره">شكاره</option>
                          <option value="عدد">عدد</option>
                          <option value="متر">متر</option>
                          <option value="سيخ">سيخ</option>
                          <option value="كيلو">كيلو</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unit_price}
                          onChange={e => updateRow(row.id, { unit_price: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-center text-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-slate-800">
                        {formatCurrency(rowTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 font-bold text-slate-700 text-right">الإجمالي الكلي</td>
                  <td className="px-4 py-3 text-center font-bold text-lg text-slate-900">
                    {formatCurrency(grandTotal)} ج.م
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-base"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
          </button>
          <Link
            to={`/customers/${customerId}`}
            className="px-8 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl transition-colors text-center"
          >
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
