import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Check, X, PackageOpen, Tag, Star, ArrowLeftRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitDraft {
  id?: number;
  unit: string;
  is_default: boolean;
  conversion_factor: number; // base unit = 1, others = how many base units
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

// ─── Unit Row in Modal ─────────────────────────────────────────────────────────

function UnitRow({
  unit,
  baseUnitName,
  onSetDefault,
  onDelete,
  onChangeFactor,
  onChangeName,
}: {
  unit: UnitDraft;
  baseUnitName: string;
  onSetDefault: () => void;
  onDelete: () => void;
  onChangeFactor: (v: number) => void;
  onChangeName: (v: string) => void;
}) {
  const isBase = unit.is_default;

  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${isBase
      ? 'bg-amber-50 border-amber-200'
      : 'bg-slate-50 border-slate-200'
    }`}>
      {/* Star / set-default */}
      <button
        type="button"
        onClick={onSetDefault}
        disabled={isBase}
        title={isBase ? 'وحدة الأساس' : 'تعيين كوحدة أساس'}
        className={`shrink-0 p-1 rounded-lg transition-colors ${isBase
          ? 'text-amber-500 cursor-default'
          : 'text-slate-300 hover:text-amber-500'
        }`}
      >
        <Star size={14} className={isBase ? 'fill-amber-400' : ''} />
      </button>

      {/* Unit name */}
      <input
        type="text"
        value={unit.unit}
        onChange={e => onChangeName(e.target.value)}
        placeholder="اسم الوحدة"
        className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      />

      {/* Conversion factor */}
      {isBase ? (
        <span className="text-xs text-amber-600 font-semibold whitespace-nowrap px-2">= 1 (أساس)</span>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-slate-400 whitespace-nowrap">=</span>
          <input
            type="number"
            min="0.0001"
            step="0.01"
            value={unit.conversion_factor}
            onChange={e => onChangeFactor(parseFloat(e.target.value) || 1)}
            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap">{baseUnitName || '—'}</span>
        </div>
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
        title="حذف الوحدة"
      >
        <X size={14} />
      </button>
    </div>
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
    initial?.units.map(u => ({
      id: u.id,
      unit: u.unit,
      is_default: u.is_default === 1,
      conversion_factor: u.conversion_factor ?? 1,
    })) ?? []
  );
  const [unitInput, setUnitInput] = useState('');

  const baseUnit = units.find(u => u.is_default);
  const baseUnitName = baseUnit?.unit ?? '';

  function addUnit() {
    const trimmed = unitInput.trim();
    if (!trimmed || units.find(u => u.unit === trimmed)) return;
    const isFirst = units.length === 0;
    setUnits(prev => [...prev, { unit: trimmed, is_default: isFirst, conversion_factor: isFirst ? 1 : 1 }]);
    setUnitInput('');
  }

  function removeUnit(idx: number) {
    setUnits(prev => {
      const wasDefault = prev[idx].is_default;
      const next = prev.filter((_, i) => i !== idx);
      if (wasDefault && next.length > 0) next[0] = { ...next[0], is_default: true };
      return next;
    });
  }

  function setDefault(idx: number) {
    setUnits(prev => prev.map((u, i) => ({
      ...u,
      is_default: i === idx,
      // Reset conversion_factor to 1 for the new base unit
      conversion_factor: i === idx ? 1 : u.conversion_factor,
    })));
  }

  function updateFactor(idx: number, v: number) {
    setUnits(prev => prev.map((u, i) => i === idx ? { ...u, conversion_factor: v } : u));
  }

  function updateUnitName(idx: number, v: string) {
    setUnits(prev => prev.map((u, i) => i === idx ? { ...u, unit: v } : u));
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), units });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              وحدات القياس والتحويل
            </label>
            {baseUnitName && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Star size={10} className="fill-amber-400" /> الأساس: {baseUnitName}
              </span>
            )}
          </div>

          {/* Explanation banner */}
          {units.length >= 2 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-3 text-xs text-blue-700">
              <ArrowLeftRight size={14} className="shrink-0 mt-0.5" />
              <span>
                حدد <strong>وحدة الأساس</strong> (النجمة ★) وأدخل معامل التحويل لباقي الوحدات.
                مثال: إذا كانت <strong>شكارة</strong> هي الأساس، فـ <strong>1 طن = 20 شكارة</strong>، اكتب 20 في خانة الطن.
              </span>
            </div>
          )}

          {/* Unit rows */}
          <div className="space-y-2 mb-3">
            {units.map((u, idx) => (
              <UnitRow
                key={idx}
                unit={u}
                baseUnitName={baseUnitName}
                onSetDefault={() => setDefault(idx)}
                onDelete={() => removeUnit(idx)}
                onChangeFactor={v => updateFactor(idx, v)}
                onChangeName={v => updateUnitName(idx, v)}
              />
            ))}
          </div>

          {/* Add unit input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={unitInput}
              onChange={e => setUnitInput(e.target.value)}
              placeholder="اسم وحدة جديدة (مثال: شكاره، طن، متر...)"
              className={inputClass}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUnit(); } }}
            />
            <button
              type="button"
              onClick={addUnit}
              disabled={!unitInput.trim()}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">اضغط Enter أو زر + لإضافة وحدة.</p>
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

  const filtered = items.filter(i =>
    i.name.includes(search) || i.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(draft: ItemDraft) {
    if (modal.item) {
      await window.api.merchandise.update(modal.item.id, { name: draft.name });
      await window.api.merchandise.setUnits(modal.item.id, draft.units);
    } else {
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
          <p className="text-slate-500 text-sm mt-1">
            إدارة الأصناف ووحدات القياس مع معاملات التحويل — تستخدم لحساب المخزن بدقة
          </p>
        </div>
        <button onClick={() => setModal({ open: true })} className={btnPrimary}>
          <Plus size={16} />
          إضافة صنف
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="بحث في الأصناف..."
        className={inputClass}
      />

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
          {filtered.map(item => {
            const baseUnit = item.units.find(u => u.is_default === 1);
            const otherUnits = item.units.filter(u => u.is_default !== 1);

            return (
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

                {/* Units display */}
                {item.units.length > 0 ? (
                  <div className="space-y-1.5">
                    {/* Base unit */}
                    {baseUnit && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-700">
                          <Star size={9} className="fill-amber-400 text-amber-400" />
                          {baseUnit.unit}
                          <span className="text-amber-500">(أساس)</span>
                        </span>
                      </div>
                    )}
                    {/* Other units with conversion */}
                    {otherUnits.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                          {u.unit}
                        </span>
                        <ArrowLeftRight size={10} className="text-slate-300" />
                        <span className="text-slate-400">
                          {u.conversion_factor} {baseUnit?.unit ?? ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد وحدات محددة</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
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
