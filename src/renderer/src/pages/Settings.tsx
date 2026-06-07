import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface SettingsForm {
  contractor_name: string;
  contractor_phone: string;
  contractor_address: string;
  pdf_header_title: string;
  pdf_footer_note: string;
}

const emptyForm: SettingsForm = {
  contractor_name: '',
  contractor_phone: '',
  contractor_address: '',
  pdf_header_title: '',
  pdf_footer_note: '',
};

const FIELDS: { key: keyof SettingsForm; label: string; placeholder: string; optional?: boolean }[] = [
  { key: 'contractor_name', label: 'اسم النشاط', placeholder: 'مثال: فلان الفلاني' },
  { key: 'contractor_phone', label: 'رقم الهاتف', placeholder: '01xxxxxxxxx', optional: true },
  { key: 'contractor_address', label: 'العنوان', placeholder: 'العنوان الكامل', optional: true },
  { key: 'pdf_header_title', label: 'عنوان التقرير في PDF', placeholder: 'مثال: كشف حساب' },
  { key: 'pdf_footer_note', label: 'ملاحظة أسفل التقرير', placeholder: 'ملاحظة اختيارية تظهر في PDF', optional: true },
];

export default function Settings() {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await window.api.settings.getAll();
      setForm({
        contractor_name: data.contractor_name ?? '',
        contractor_phone: data.contractor_phone ?? '',
        contractor_address: data.contractor_address ?? '',
        pdf_header_title: data.pdf_header_title ?? '',
        pdf_footer_note: data.pdf_footer_note ?? '',
      });
    } catch {
      setError('فشل تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await window.api.settings.update({
        contractor_name: form.contractor_name.trim(),
        contractor_phone: form.contractor_phone.trim(),
        contractor_address: form.contractor_address.trim(),
        pdf_header_title: form.pdf_header_title.trim(),
        pdf_footer_note: form.pdf_footer_note.trim(),
      });
      setSuccess(true);
      window.dispatchEvent(new CustomEvent('settings-updated'));
      setTimeout(() => setSuccess(false), 3500);
    } catch {
      setError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="w-40 h-6 bg-slate-100 rounded"></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <div className="w-36 h-4 bg-slate-100 rounded"></div>
              <div className="w-full h-11 bg-slate-50 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-100 rounded-xl">
          <SettingsIcon size={22} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الإعدادات</h1>
          <p className="text-slate-500 text-sm mt-0.5">معلومات النشاط وإعدادات التقارير</p>
        </div>
      </div>

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          تم حفظ الإعدادات بنجاح ✓
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {/* Contractor info section */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">معلومات النشاط</h2>
            {FIELDS.slice(0, 3).map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {field.label}
                  {field.optional && <span className="text-slate-400 font-normal mr-1">(اختياري)</span>}
                </label>
                <input
                  type="text"
                  value={form[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            ))}
          </div>

          {/* PDF section */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">إعدادات التقارير PDF</h2>
            {FIELDS.slice(3).map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {field.label}
                  {field.optional && <span className="text-slate-400 font-normal mr-1">(اختياري)</span>}
                </label>
                {field.key === 'pdf_footer_note' ? (
                  <textarea
                    value={form[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={form[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>
    </div>
  );
}
