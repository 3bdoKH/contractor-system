import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Check, X, PackageOpen, Tag, Star } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitDraft {
  id?: number;          // existing unit
  unit: string;
  is_default: boolean;
}

interface ItemDraft {
  name: string;
  units: UnitDraft[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 text-sm';

const btnPrimary =
  'flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm';

const btnGhost =
  'flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm';

// ─── Unit tag chip ─────────────────────────────────────────────────────────────

function UnitChip({
  unit,
  isDefault,
  onSetDefault,
  onDelete,
}: {
  unit: UnitDraft;
  isDefault: boolean;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
        isDefault
          ? 'bg-amber-50 border-amber-300 text-amber-700'
          : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}
    >
      {isDefault && <Star size={10} className="text-amber-500 fill-amber-400" />}
      {unit.unit}
      <button
        type="button"
        title="تعيين كافتراضي"
        onClick={onSetDefault}
        className="hover:text-amber-500 transition-colors"
      >
        <Star size={11} className={isDefault ? 'fill-amber-400 text-amber-400' : ''} />
      </button>
      <button
        type="button"
        title="حذف الوحدة"
        onClick={onDelete}
        className="hover:text-red-500 transition-colors"
      >
        <X size={11} />
      </button>
    </span>
  );
}

// ─── Add‑Item Modal ────────────────────────────────────────────────────────────

function ItemModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: MerchandiseWithUnits;
  onSave: (draft: ItemDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [units, setUnits] = useState<UnitDraft[]>(
    initial?.units.map(u => ({ id: u.id, unit: u.unit, is_default: u.is_default === 1 })) ?? []
  );
  const [unitInput, setUnitInput] = useState('');

  function addUnit() {
    const trimmed = unitInput.trim();
    if (!trimmed || units.find(u => u.unit === trimmed)) return;
    setUnits(prev => [...prev, { unit: trimmed, is_default: prev.length === 0 }]);
    setUnitInput('');
  }

  function removeUnit(idx: number) {
    setUnits(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // If we removed the default and there are remaining, set first as default
      if (prev[idx].is_default && next.length > 0) {
        next[0] = { ...next[0], is_default: true };
      }
      return next;
    });
  }

  function setDefault(idx: number) {
    setUnits(prev => prev.map((u, i) => ({ ...u, is_default: i === idx })));
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), units });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {initial ? 'تعديل الصنف' : 'إضافة صنف جديد'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            اسم الصنف <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: اسمنت اسود"
            className={inputClass}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
          />
        </div>

        {/* Units */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            وحدات القياس
          </label>

          {/* Unit chips */}
          {units.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {units.map((u, idx) => (
                <UnitChip
                  key={idx}
                  unit={u}
                  isDefault={u.is_default}
                  onSetDefault={() => setDefault(idx)}
                  onDelete={() => removeUnit(idx)}
                />
              ))}
            </div>
          )}

          {/* Add unit input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={unitInput}
              onChange={e => setUnitInput(e.target.value)}
              placeholder="مثال: شكاره، طن، متر..."
              className={inputClass}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUnit(); } }}
            />
            <button
              type="button"
              onClick={addUnit}
              disabled={!unitInput.trim()}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">اضغط Enter أو زر + لإضافة وحدة. النجمة ★ تحدد الوحدة الافتراضية.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl transition-colors"
          >
            <Check size={16} />
            حفظ
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MerchandiseSettings() {
  const [items, setItems] = useState<MerchandiseWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; item?: MerchandiseWithUnits }>({ open: false });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await window.api.merchandise.getAllWithUnits();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => i.name.includes(search) || i.name.toLowerCase().includes(search.toLowerCase()));

  async function handleSave(draft: ItemDraft) {
    if (modal.item) {
      // Update name
      await window.api.merchandise.update(modal.item.id, { name: draft.name });
      // Replace units
      await window.api.merchandise.setUnits(modal.item.id, draft.units);
    } else {
      // Create item with initial units
      await window.api.merchandise.create({ name: draft.name, units: draft.units });
    }
    setModal({ open: false });
    await load();
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await window.api.merchandise.delete(id);
    setDeletingId(null);
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الأصناف والوحدات</h1>
          <p className="text-slate-500 text-sm mt-1">إدارة قائمة الأصناف ووحدات القياس المتاحة لكل صنف</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className={btnPrimary}
        >
          <Plus size={16} />
          إضافة صنف
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث في الأصناف..."
          className={`${inputClass} pr-4 pl-4`}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <PackageOpen size={48} className="text-slate-300" />
          <p className="text-base font-medium">
            {search ? 'لا يوجد صنف بهذا الاسم' : 'لا توجد أصناف بعد'}
          </p>
          {!search && (
            <button onClick={() => setModal({ open: true })} className="text-blue-600 hover:underline text-sm">
              أضف أول صنف
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-shadow group"
            >
              {/* Item header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-blue-50 rounded-xl shrink-0">
                    <Tag size={16} className="text-blue-600" />
                  </div>
                  <p className="font-bold text-slate-900 truncate text-sm">{item.name}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => setModal({ open: true, item })}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                    title="تعديل"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="حذف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Units */}
              {item.units.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.units.map(u => (
                    <span
                      key={u.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        u.is_default
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {u.is_default && <Star size={9} className="fill-amber-400 text-amber-400" />}
                      {u.unit}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">لا توجد وحدات محددة</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary bar */}
      {!loading && items.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {items.length} صنف · {items.reduce((s, i) => s + i.units.length, 0)} وحدة
        </p>
      )}

      {/* Modal */}
      {modal.open && (
        <ItemModal
          initial={modal.item}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
