import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon, Save, CheckCircle, AlertCircle, RefreshCw,
  Download, Wifi, WifiOff, Shield, Send, Database, Loader, Link, Link2Off,
  Phone, Plus, Trash2,
} from 'lucide-react';

interface SettingsForm {
  contractor_name: string;
  contractor_phones: string[];  // Multiple phones
  contractor_address: string;
  pdf_header_title: string;
  pdf_footer_note: string;
}

const emptyForm: SettingsForm = {
  contractor_name: '',
  contractor_phones: [''],
  contractor_address: '',
  pdf_header_title: '',
  pdf_footer_note: '',
};

const UPDATE_STATE_UI: Record<UpdateState, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: '', color: '', icon: null },
  checking: { label: 'جاري التحقق من وجود تحديثات...', color: 'text-blue-600', icon: <RefreshCw size={15} className="animate-spin" /> },
  available: { label: '✓ يتوفر إصدار جديد! جاري التنزيل...', color: 'text-teal-700', icon: <Download size={15} /> },
  'not-available': { label: '✓ التطبيق محدث بالكامل', color: 'text-emerald-700', icon: <CheckCircle size={15} /> },
  downloaded: { label: '✓ تم تنزيل التحديث — أعد تشغيل التطبيق', color: 'text-purple-700', icon: <Download size={15} /> },
  error: { label: '✗ فشل التحقق عن وجود تحديثات', color: 'text-red-600', icon: <WifiOff size={15} /> },
  unsupported: { label: 'التحديث التلقائي متاح على Windows فقط', color: 'text-slate-400', icon: <Wifi size={15} /> },
};

function formatLastRun(iso: string | null): string {
  if (!iso) return 'لم يتم إجراء نسخة احتياطية بعد';
  return new Date(iso).toLocaleString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Parse the stored phone value: may be a JSON array string or a plain string */
function parsePhones(raw: string | undefined): string[] {
  if (!raw) return [''];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* not JSON */ }
  // Legacy: single plain string
  return [raw];
}

export default function Settings() {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Update state
  const [appVersion, setAppVersion] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [checking, setChecking] = useState(false);

  // Backup state
  const [backupConnected, setBackupConnected] = useState(false);
  const [lastRun, setLastRun] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadBackupConfig();
    window.api.updates.getVersion().then(setAppVersion).catch(() => { });
    window.api.updates.onStatus(({ state }) => {
      setUpdateState(state);
      setChecking(false);
      if (state === 'not-available') setTimeout(() => setUpdateState('idle'), 8000);
    });
    return () => { window.api.updates.removeStatusListener(); };
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await window.api.settings.getAll();
      setForm({
        contractor_name: data.contractor_name ?? '',
        contractor_phones: parsePhones(data.contractor_phone),
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

  async function loadBackupConfig() {
    try {
      const cfg = await window.api.backup.getConfig();
      setBackupConnected(cfg.isConnected);
      setLastRun(cfg.lastRun ?? '');
    } catch { /* ignore */ }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess(false);
    try {
      // Store phones as a JSON array string
      const phonesClean = form.contractor_phones.map(p => p.trim()).filter(Boolean);
      await window.api.settings.update({
        contractor_name: form.contractor_name.trim(),
        contractor_phone: JSON.stringify(phonesClean.length > 0 ? phonesClean : ['']),
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

  // Phone list helpers
  function addPhone() {
    setForm(f => ({ ...f, contractor_phones: [...f.contractor_phones, ''] }));
  }

  function removePhone(index: number) {
    setForm(f => {
      const phones = f.contractor_phones.filter((_, i) => i !== index);
      return { ...f, contractor_phones: phones.length > 0 ? phones : [''] };
    });
  }

  function updatePhone(index: number, value: string) {
    setForm(f => {
      const phones = [...f.contractor_phones];
      phones[index] = value;
      return { ...f, contractor_phones: phones };
    });
  }

  async function handleCheckUpdate() {
    setChecking(true); setUpdateState('checking');
    try {
      const result = await window.api.updates.checkNow();
      if (result && (result as any).platform === 'unsupported') {
        setUpdateState('unsupported'); setChecking(false);
      }
    } catch {
      setUpdateState('error'); setChecking(false);
    }
  }

  async function handleConnect() {
    setConnecting(true); setBackupMsg(null);
    try {
      const res = await window.api.backup.connect();
      if (res.success) {
        setBackupMsg({ type: 'success', text: '✓ تم الربط بنجاح! النسخ الاحتياطي التلقائي مفعّل' });
        await loadBackupConfig();
      } else {
        setBackupMsg({ type: 'error', text: res.message || 'فشل الربط' });
      }
    } catch {
      setBackupMsg({ type: 'error', text: 'فشل الاتصال بـ Telegram' });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('هل تريد فصل الربط مع Telegram؟ لن تُرسل نسخ احتياطية حتى تربط من جديد.')) return;
    setDisconnecting(true); setBackupMsg(null);
    try {
      await window.api.backup.disconnect();
      setBackupConnected(false); setLastRun('');
      setBackupMsg({ type: 'success', text: 'تم فصل الربط' });
    } catch { /* ignore */ } finally {
      setDisconnecting(false);
    }
  }

  async function handleBackupNow() {
    setBackingUp(true); setBackupMsg(null);
    try {
      const res = await window.api.backup.runNow();
      setBackupMsg({ type: res.success ? 'success' : 'error', text: res.message });
      if (res.success) await loadBackupConfig();
    } catch {
      setBackupMsg({ type: 'error', text: 'فشل إجراء النسخة الاحتياطية' });
    } finally {
      setBackingUp(false);
    }
  }

  async function handleTestConnection() {
    setTestingConn(true); setBackupMsg(null);
    try {
      const res = await window.api.backup.sendTest();
      setBackupMsg({
        type: res.success ? 'success' : 'error',
        text: res.success ? '✓ تم إرسال رسالة اختبار — تحقق من Telegram' : (res.message || 'فشل الإرسال'),
      });
    } catch {
      setBackupMsg({ type: 'error', text: 'فشل الاتصال' });
    } finally {
      setTestingConn(false);
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

  const stateUI = UPDATE_STATE_UI[updateState];

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

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          تم حفظ الإعدادات بنجاح ✓
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── General Settings Form ── */}
      <form onSubmit={handleSave}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

          {/* Business Info Section */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">معلومات النشاط</h2>

            {/* Contractor Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم النشاط
              </label>
              <input
                type="text"
                value={form.contractor_name}
                onChange={e => setForm(f => ({ ...f, contractor_name: e.target.value }))}
                placeholder="مثال: فلان الفلاني"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            {/* Phone Numbers — dynamic list */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  أرقام الهاتف
                  <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
                </label>
                <button
                  type="button"
                  onClick={addPhone}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all"
                >
                  <Plus size={13} />
                  إضافة رقم
                </button>
              </div>

              <div className="space-y-2">
                {form.contractor_phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={phone}
                        onChange={e => updatePhone(idx, e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full pr-9 pl-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                        dir="ltr"
                      />
                    </div>
                    {form.contractor_phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhone(idx)}
                        className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-all"
                        title="حذف الرقم"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                العنوان
                <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
              </label>
              <input
                type="text"
                value={form.contractor_address}
                onChange={e => setForm(f => ({ ...f, contractor_address: e.target.value }))}
                placeholder="العنوان الكامل"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* PDF Settings Section */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">إعدادات التقارير PDF</h2>

            {/* PDF Header Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                عنوان التقرير في PDF
              </label>
              <input
                type="text"
                value={form.pdf_header_title}
                onChange={e => setForm(f => ({ ...f, pdf_header_title: e.target.value }))}
                placeholder="مثال: كشف حساب"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            {/* PDF Footer Note */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                ملاحظة أسفل التقرير
                <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
              </label>
              <textarea
                value={form.pdf_footer_note}
                onChange={e => setForm(f => ({ ...f, pdf_footer_note: e.target.value }))}
                placeholder="ملاحظة اختيارية تظهر في PDF"
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 resize-none"
              />
            </div>
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

      {/* ── Telegram Backup Section ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <div className={`p-2 rounded-lg ${backupConnected ? 'bg-emerald-100' : 'bg-sky-100'}`}>
            <Shield size={18} className={backupConnected ? 'text-emerald-600' : 'text-sky-600'} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">النسخ الاحتياطي عبر Telegram</h2>
            <p className="text-xs text-slate-400 mt-0.5">نسخة احتياطية تلقائية يومية — يحتفظ بآخر 7 نسخ محلياً وعلى Telegram</p>
          </div>
          <span className={`mr-auto text-[11px] font-bold px-2.5 py-1 rounded-full ${backupConnected
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-500'
            }`}>
            {backupConnected ? '✓ مرتبط' : 'غير مرتبط'}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Feedback message */}
          {backupMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${backupMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
              {backupMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {backupMsg.text}
            </div>
          )}

          {/* ── CONNECTED STATE ── */}
          {backupConnected ? (
            <>
              {/* Last run info */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                <Database size={14} className="text-slate-400 shrink-0" />
                <span>
                  آخر نسخة احتياطية:
                  <span className="font-semibold text-slate-800 mr-1">{formatLastRun(lastRun || null)}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleBackupNow}
                  disabled={backingUp}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 active:scale-[0.97]"
                >
                  {backingUp ? <Loader size={15} className="animate-spin" /> : <Database size={15} />}
                  {backingUp ? 'جاري الإرسال...' : 'نسخ احتياطي الآن'}
                </button>

                <button
                  onClick={handleTestConnection}
                  disabled={testingConn}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                >
                  {testingConn ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                  اختبار الاتصال
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="mr-auto flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 px-3 py-2 rounded-xl border border-red-100 hover:border-red-200 hover:bg-red-50 transition-all"
                >
                  <Link2Off size={13} />
                  فصل الربط
                </button>
              </div>
            </>
          ) : (
            /* ── NOT CONNECTED STATE ── */
            <div className="space-y-4">
              {/* Instructions card */}
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-sky-800 mb-3 flex items-center gap-2">
                  <span>كيفية تفعيل النسخ الاحتياطي</span>
                </p>
                <div className="space-y-2 text-sky-700">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sky-500 mt-0.5 shrink-0">١</span>
                    <p>افتح Telegram وابحث عن البوت <span className="font-mono font-bold bg-sky-100 px-1.5 py-0.5 rounded">@contractor_backup_bot</span></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sky-500 mt-0.5 shrink-0">٢</span>
                    <p>أرسل له الرسالة <span className="font-mono font-bold bg-sky-100 px-1.5 py-0.5 rounded">/start</span></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sky-500 mt-0.5 shrink-0">٣</span>
                    <p>اضغط زر <strong>"ربط Telegram"</strong> أدناه</p>
                  </div>
                </div>
              </div>

              {/* Connect button */}
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98]"
              >
                {connecting
                  ? <><Loader size={18} className="animate-spin" /> جاري الربط...</>
                  : <><Link size={18} /> ربط Telegram</>
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Updates Section ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">التحديثات</h2>
        <div className="flex items-center justify-between">
          <div className="text-right space-y-1">
            <p className="text-sm text-slate-500">
              الإصدار الحالي: <span className="font-bold text-slate-800">{appVersion || '—'}</span>
            </p>
            {updateState !== 'idle' && stateUI.label && (
              <div className={`flex items-center gap-1.5 text-sm ${stateUI.color}`}>
                {stateUI.icon}
                <span>{stateUI.label}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleCheckUpdate}
            disabled={checking || updateState === 'checking' || updateState === 'unsupported'}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]"
          >
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
            {updateState === 'checking' ? 'جاري البحث...' : 'بحث عن تحديث'}
          </button>
        </div>
      </div>
    </div>
  );
}
