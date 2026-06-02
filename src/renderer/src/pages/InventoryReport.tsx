import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Printer, Calendar, FileText, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../utils';

const MONTHS = [
  { value: 1, label: 'يناير' },
  { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' },
  { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' },
  { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' },
  { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' },
  { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' },
  { value: 12, label: 'ديسمبر' },
];

export default function InventoryReport() {
  const [reportType, setReportType] = useState<'all' | 'annual' | 'monthly'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [report, setReport] = useState<InventoryReport>({
    items: [],
    summary: { total_items: 0, total_stock_qty: 0, total_valuation: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  // Calculate from / to date strings based on filters
  const dateFilters = useMemo(() => {
    if (reportType === 'all') {
      return { from: '', to: '' };
    }
    if (reportType === 'annual') {
      return {
        from: `${selectedYear}-01-01`,
        to: `${selectedYear}-12-31`,
      };
    }
    if (reportType === 'monthly') {
      const monthStr = String(selectedMonth).padStart(2, '0');
      // Find the last day of this month
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      return {
        from: `${selectedYear}-${monthStr}-01`,
        to: `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    return { from: '', to: '' };
  }, [reportType, selectedYear, selectedMonth]);

  // Load report data
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

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Search filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return report.items;
    const query = searchQuery.toLowerCase();
    return report.items.filter((item) => item.name.toLowerCase().includes(query));
  }, [report.items, searchQuery]);

  // Calculate search-filtered summary in case they search
  const filteredSummary = useMemo(() => {
    const total_items = filteredItems.length;
    const total_stock_qty = filteredItems.reduce((sum, item) => sum + item.closing_stock, 0);
    const total_valuation = filteredItems.reduce((sum, item) => sum + item.valuation, 0);
    return { total_items, total_stock_qty, total_valuation };
  }, [filteredItems]);

  // Year choices
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list: number[] = [];
    for (let y = current - 5; y <= current + 2; y++) {
      list.push(y);
    }
    return list.reverse();
  }, []);

  // Print PDF report
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const f: any = {};
      if (dateFilters.from) f.from = dateFilters.from;
      if (dateFilters.to) f.to = dateFilters.to;

      let title = 'تقرير حركة وجرد المخزن';
      if (reportType === 'annual') {
        title = `تقرير حركة وجرد المخزن السنوي لعام ${selectedYear}`;
      } else if (reportType === 'monthly') {
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

  return (
    <div className="p-6 space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">تقرير حركة وجرد المخزن</h1>
          <p className="text-slate-500 text-sm mt-0.5">مراقبة الوارد والمنصرف والكميات المتبقية وقيمة المخزون</p>
        </div>

        <button
          onClick={handlePrint}
          disabled={loading || printing}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all duration-150 text-sm w-full md:w-auto"
        >
          <Printer size={16} />
          {printing ? 'جاري التصدير...' : 'طباعة التقرير PDF'}
        </button>
      </div>

      {/* Control Panel / Filter Options */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Report Type Select */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setReportType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                reportType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              كل الوقت
            </button>
            <button
              onClick={() => setReportType('annual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                reportType === 'annual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              سنوي
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                reportType === 'monthly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              شهري
            </button>
          </div>

          {/* Year selector (Annual / Monthly) */}
          {(reportType === 'annual' || reportType === 'monthly') && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">السنة:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month selector (Monthly) */}
          {reportType === 'monthly' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">الشهر:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="بحث باسم البضاعة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right bg-slate-50 focus:bg-white transition-colors"
          />
          <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Items */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">عدد المواد المفلترة</span>
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-600">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">
            {loading ? '...' : filteredSummary.total_items.toLocaleString('ar-EG')}
          </p>
        </div>

        {/* Total Stock Quantity */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">إجمالي كمية المخزون</span>
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
              <Calendar size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">
            {loading ? '...' : filteredSummary.total_stock_qty.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Total Valuation */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">إجمالي قيمة المخزون الحالي</span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600">
              <span className="text-sm font-bold">ج.م</span>
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">
            {loading ? '...' : `${formatCurrency(filteredSummary.total_valuation)} ج.م`}
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="px-5 py-3.5 text-right">اسم البضاعة / المادة</th>
                <th className="px-4 py-3.5 text-center">رصيد أول</th>
                <th className="px-4 py-3.5 text-center">الوارد (+)</th>
                <th className="px-4 py-3.5 text-center">المنصرف (-)</th>
                <th className="px-4 py-3.5 text-center">رصيد آخر</th>
                <th className="px-4 py-3.5 text-center">آخر سعر شراء</th>
                <th className="px-4 py-3.5 text-center">القيمة التقديرية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-2/3"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-12 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-12 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-12 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-12 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-20 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    لا توجد بضائع متوفرة تطابق خيارات البحث 📦
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{item.name}</td>
                    <td className="px-4 py-3.5 text-center font-medium text-slate-600">
                      {item.opening_stock.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-600">
                      {item.incoming > 0 ? `+${item.incoming.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-red-500">
                      {item.outgoing > 0 ? `-${item.outgoing.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                      {item.closing_stock.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium text-slate-600">
                      {item.latest_price > 0 ? `${formatCurrency(item.latest_price)} ج.م` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                      {item.valuation > 0 ? `${formatCurrency(item.valuation)} ج.م` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
