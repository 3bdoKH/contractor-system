import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon, Save, CheckCircle, AlertCircle, RefreshCw,
  Download, Wifi, WifiOff, Send, Database, Loader, Link2Off,
  Phone, Plus, Trash2, FolderDown, Upload, Cloud, CloudUpload, CloudDownload,
  Key, Lock, Server, HardDrive, X, Info,
} from 'lucide-react';

interface SettingsForm {
  contractor_name: string;
  contractor_phones: string[]; // Multiple phones
  contractor_address: string;
  pdf_header_title: string;
  pdf_footer_note: string;
}

interface S3Form {
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const emptyForm: SettingsForm = {
  contractor_name: '',
  contractor_phones: [''],
  contractor_address: '',
  pdf_header_title: '',
  pdf_footer_note: '',
};

const emptyS3Form: S3Form = {
  endpoint: '',
  bucketName: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-east-1',
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
  if (!iso) return 'لم يتم إجراء نسخة بعد';
  return new Date(iso).toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parsePhones(raw: string | undefined): string[] {
  if (!raw) return [''];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* not JSON */
  }
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
  const [s3Form, setS3Form] = useState<S3Form>(emptyS3Form);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [lastRun, setLastRun] = useState<string>('');
  const [lastCloudRun, setLastCloudRun] = useState<string>('');
  const [savingS3, setSavingS3] = useState(false);
  const [testingS3, setTestingS3] = useState(false);
  const [backingUpLocal, setBackingUpLocal] = useState(false);
  const [exportingLocal, setExportingLocal] = useState(false);
  const [restoringLocal, setRestoringLocal] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localMsg, setLocalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cloud restores modal state
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<{ key: string; name: string; size: number; lastModified: string }[]>([]);
  const [loadingCloudFiles, setLoadingCloudFiles] = useState(false);
  const [restoringCloudKey, setRestoringCloudKey] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadBackupConfig();
    window.api.updates.getVersion().then(setAppVersion).catch((): void => { return; });
    window.api.updates.onStatus(({ state }) => {
      setUpdateState(state);
      setChecking(false);
      if (state === 'not-available') setTimeout(() => setUpdateState('idle'), 8000);
    });
    return () => {
      window.api.updates.removeStatusListener();
    };
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
      setIsCloudConnected(cfg.isCloudConnected);
      setLastRun(cfg.lastRun ?? '');
      setLastCloudRun(cfg.lastCloudRun ?? '');
      setS3Form({
        endpoint: cfg.s3Endpoint ?? '',
        bucketName: cfg.s3BucketName ?? '',
        accessKeyId: cfg.s3AccessKeyId ?? '',
        secretAccessKey: cfg.hasSecretKey ? '••••••••••••••••' : '',
        region: cfg.s3Region || 'us-east-1',
      });
    } catch {
      /* ignore */
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const phonesClean = form.contractor_phones.map((p) => p.trim()).filter(Boolean);
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

  function addPhone() {
    setForm((f) => ({ ...f, contractor_phones: [...f.contractor_phones, ''] }));
  }

  function removePhone(index: number) {
    setForm((f) => {
      const phones = f.contractor_phones.filter((_, i) => i !== index);
      return { ...f, contractor_phones: phones.length > 0 ? phones : [''] };
    });
  }

  function updatePhone(index: number, value: string) {
    setForm((f) => {
      const phones = [...f.contractor_phones];
      phones[index] = value;
      return { ...f, contractor_phones: phones };
    });
  }

  async function handleCheckUpdate() {
    setChecking(true);
    setUpdateState('checking');
    try {
      const result = await window.api.updates.checkNow();
      if (result && (result as any).platform === 'unsupported') {
        setUpdateState('unsupported');
        setChecking(false);
      }
    } catch {
      setUpdateState('error');
      setChecking(false);
    }
  }

  // ─── Local Backup Actions ───

  async function handleRunLocalBackup() {
    setBackingUpLocal(true);
    setLocalMsg(null);
    try {
      const res = await window.api.backup.runNow();
      setLocalMsg({ type: res.success ? 'success' : 'error', text: res.message });
      await loadBackupConfig();
    } catch {
      setLocalMsg({ type: 'error', text: 'فشل إجراء النسخة الاحتياطية' });
    } finally {
      setBackingUpLocal(false);
    }
  }

  async function handleExportLocal() {
    setExportingLocal(true);
    setLocalMsg(null);
    try {
      const res = await window.api.backup.exportLocal();
      if (res.success) {
        setLocalMsg({ type: 'success', text: res.message });
      } else if (res.message !== 'تم إلغاء التصدير') {
        setLocalMsg({ type: 'error', text: res.message });
      }
    } catch {
      setLocalMsg({ type: 'error', text: 'فشل تصدير ملف قاعدة البيانات' });
    } finally {
      setExportingLocal(false);
    }
  }

  async function handleRestoreLocal() {
    if (!confirm('⚠️ تحذير: استعادة قاعدة البيانات ستستبدل البيانات الحالية ببيانات الملف المختار!\n\nسيتم إنشاء نسخة احتياطية آمنة تلقائياً قبل الاستعادة.\nهل تريد المتابعة؟')) {
      return;
    }
    setRestoringLocal(true);
    setLocalMsg(null);
    try {
      const res = await window.api.backup.restoreLocal();
      if (res.success) {
        setLocalMsg({ type: 'success', text: res.message });
        setTimeout(() => window.location.reload(), 1500);
      } else if (res.message !== 'تم إلغاء الاستعادة') {
        setLocalMsg({ type: 'error', text: res.message });
      }
    } catch {
      setLocalMsg({ type: 'error', text: 'فشل استعادة قاعدة البيانات' });
    } finally {
      setRestoringLocal(false);
    }
  }

  // ─── Supabase / S3 Actions ───

  async function handleSaveS3(e: React.FormEvent) {
    e.preventDefault();
    setSavingS3(true);
    setCloudMsg(null);
    try {
      const res = await window.api.backup.saveS3Config(s3Form);
      setCloudMsg({ type: res.success ? 'success' : 'error', text: res.message });
      await loadBackupConfig();
    } catch {
      setCloudMsg({ type: 'error', text: 'فشل حفظ إعدادات السحابة' });
    } finally {
      setSavingS3(false);
    }
  }

  async function handleTestS3() {
    setTestingS3(true);
    setCloudMsg(null);
    try {
      const res = await window.api.backup.testS3();
      setCloudMsg({ type: res.success ? 'success' : 'error', text: res.message });
      if (res.success) await loadBackupConfig();
    } catch {
      setCloudMsg({ type: 'error', text: 'فشل الاتصال بالسحابة' });
    } finally {
      setTestingS3(false);
    }
  }

  async function handleDisconnectS3() {
    if (!confirm('هل تريد فصل وتفريغ إعدادات السحابة؟')) return;
    setCloudMsg(null);
    try {
      await window.api.backup.disconnectS3();
      await loadBackupConfig();
      setCloudMsg({ type: 'success', text: 'تم فصل الربط بالسحابة' });
    } catch {
      /* ignore */
    }
  }

  async function handleOpenCloudModal() {
    setShowCloudModal(true);
    setLoadingCloudFiles(true);
    try {
      const res = await window.api.backup.listS3Backups();
      if (res.success) {
        setCloudFiles(res.files);
      } else {
        alert(res.message || 'فشل جلب الملفات من السحابة');
      }
    } catch {
      alert('فشل الاتصال بالسحابة');
    } finally {
      setLoadingCloudFiles(false);
    }
  }

  async function handleRestoreFromCloud(key: string) {
    if (!confirm('⚠️ تحذير: استعادة النسخة من السحابة ستستبدل بيانات التطبيق الحالية!\n\nسيتم إنشاء نسخة احتياطية آمنة تلقائياً قبل الاستعادة.\nهل تريد المتابعة؟')) {
      return;
    }
    setRestoringCloudKey(key);
    try {
      const res = await window.api.backup.restoreFromS3(key);
      if (res.success) {
        alert(res.message);
        window.location.reload();
      } else {
        alert(res.message);
      }
    } catch {
      alert('فشل استعادة النسخة السحابية');
    } finally {
      setRestoringCloudKey(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="w-40 h-6 bg-slate-100 rounded"></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
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
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-100 rounded-xl">
          <SettingsIcon size={22} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الإعدادات والنسخ الاحتياطي</h1>
          <p className="text-slate-500 text-sm mt-0.5">معلومات النشاط وإعدادات التقارير والنسخ السحابي المحمي</p>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">اسم النشاط</label>
              <input
                type="text"
                value={form.contractor_name}
                onChange={(e) => setForm((f) => ({ ...f, contractor_name: e.target.value }))}
                placeholder="مثال: فلان الفلاني"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  أرقام الهاتف <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
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
                        onChange={(e) => updatePhone(idx, e.target.value)}
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                العنوان <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
              </label>
              <input
                type="text"
                value={form.contractor_address}
                onChange={(e) => setForm((f) => ({ ...f, contractor_address: e.target.value }))}
                placeholder="العنوان الكامل"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* PDF Settings Section */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">إعدادات التقارير PDF</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">عنوان التقرير في PDF</label>
              <input
                type="text"
                value={form.pdf_header_title}
                onChange={(e) => setForm((f) => ({ ...f, pdf_header_title: e.target.value }))}
                placeholder="مثال: كشف حساب"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                ملاحظة أسفل التقرير <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
              </label>
              <textarea
                value={form.pdf_footer_note}
                onChange={(e) => setForm((f) => ({ ...f, pdf_footer_note: e.target.value }))}
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
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}
          </button>
        </div>
      </form>

      {/* ── Local Backup & Restore Center ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        <div className="flex items-center gap-3 p-5 bg-slate-50/50">
          <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
            <HardDrive size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">مركز النسخ الاحتياطي والاستعادة المحلية</h2>
            <p className="text-xs text-slate-500 mt-0.5">تصدير واستعادة ملفات قاعدة البيانات (.db) وحفظ نسخ تلقائية ممتدة</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {localMsg && (
            <div
              className={`flex items-center gap-2 p-3.5 rounded-xl text-sm font-medium ${localMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
                }`}
            >
              {localMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {localMsg.text}
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
            <Database size={15} className="text-slate-400 shrink-0" />
            <span>
              آخر نسخة احتياطية محلية: <span className="font-semibold text-slate-800 mr-1">{formatLastRun(lastRun || null)}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={handleRunLocalBackup}
              disabled={backingUpLocal}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.97] text-sm"
            >
              {backingUpLocal ? <Loader size={16} className="animate-spin" /> : <Database size={16} />}
              نسخ احتياطي الآن
            </button>

            <button
              type="button"
              onClick={handleExportLocal}
              disabled={exportingLocal}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-[0.97] text-sm"
            >
              {exportingLocal ? <Loader size={16} className="animate-spin" /> : <FolderDown size={16} />}
              تصدير ملف (.db)
            </button>

            <button
              type="button"
              onClick={handleRestoreLocal}
              disabled={restoringLocal}
              className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.97] text-sm"
            >
              {restoringLocal ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
              استعادة من ملف (.db)
            </button>
          </div>
        </div>
      </div>

      {/* ── Supabase / S3 Cloud Sync Center ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Cloud size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">النسخ السحابي المحمي</h2>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${isCloudConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-slate-300'
              }`}
          >
            {isCloudConnected ? '✓ مرتبط بالسحابة' : 'غير مرتبط'}
          </span>
        </div>

        <div className="p-5 space-y-4">

          {cloudMsg && (
            <div
              className={`flex items-center gap-2 p-3.5 rounded-xl text-sm font-medium ${cloudMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
                }`}
            >
              {cloudMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {cloudMsg.text}
            </div>
          )}

          {isCloudConnected && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CloudUpload size={16} className="text-emerald-600 shrink-0" />
                <span>
                  آخر رفع سحابي: <span className="font-semibold text-slate-800 mr-1">{formatLastRun(lastCloudRun || null)}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenCloudModal}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all"
              >
                <CloudDownload size={14} />
                الإستعادة
              </button>
            </div>
          )}

          <form onSubmit={handleSaveS3} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  S3 Endpoint URL <span className="text-slate-400 font-normal">(رابط نقطة النهاية من Supabase)</span>
                </label>
                <div className="relative">
                  <Server size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={s3Form.endpoint}
                    onChange={(e) => setS3Form((f) => ({ ...f, endpoint: e.target.value }))}
                    placeholder="https://xyz.supabase.co/storage/v1/s3"
                    className="w-full pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bucket Name <span className="text-slate-400 font-normal">(اسم البكت)</span>
                </label>
                <div className="relative">
                  <Database size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={s3Form.bucketName}
                    onChange={(e) => setS3Form((f) => ({ ...f, bucketName: e.target.value }))}
                    placeholder="contractor-backups"
                    className="w-full pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Access Key ID <span className="text-slate-400 font-normal">(مفتاح الوصول S3)</span>
                </label>
                <div className="relative">
                  <Key size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={s3Form.accessKeyId}
                    onChange={(e) => setS3Form((f) => ({ ...f, accessKeyId: e.target.value }))}
                    placeholder="Access Key ID"
                    className="w-full pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Secret Access Key <span className="text-slate-400 font-normal">(المفتاح السري S3)</span>
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="password"
                    value={s3Form.secretAccessKey}
                    onChange={(e) => setS3Form((f) => ({ ...f, secretAccessKey: e.target.value }))}
                    placeholder="Secret Access Key"
                    className="w-full pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={savingS3}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-[0.97]"
              >
                {savingS3 ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
                حفظ بيانات السحابة
              </button>

              <button
                type="button"
                onClick={handleTestS3}
                disabled={testingS3}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]"
              >
                {testingS3 ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                اختبار الاتصال
              </button>

              {isCloudConnected && (
                <button
                  type="button"
                  onClick={handleDisconnectS3}
                  className="mr-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-xl border border-red-100 hover:bg-red-50 transition-all font-medium"
                >
                  <Link2Off size={13} />
                  فصل الربط
                </button>
              )}
            </div>
          </form>
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

      {/* ── Cloud Backups Restore Modal ── */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                <CloudDownload className="text-emerald-600" size={22} />
                <span>النسخ المحفوظة على السحابة (Supabase / S3)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {loadingCloudFiles ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-sm">
                  <Loader size={20} className="animate-spin text-emerald-600" />
                  جاري جلب قائمة النسخ من السحابة...
                </div>
              ) : cloudFiles.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">لا توجد نسخ احتياطية على السحابة بعد</div>
              ) : (
                cloudFiles.map((file) => (
                  <div key={file.key} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-200/80 transition-all">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800 font-mono" dir="ltr">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{formatLastRun(file.lastModified)}</span>
                        <span>•</span>
                        <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreFromCloud(file.key)}
                      disabled={restoringCloudKey === file.key}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-[0.96]"
                    >
                      {restoringCloudKey === file.key ? <Loader size={14} className="animate-spin" /> : <CloudDownload size={14} />}
                      استعادة
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
