import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, Settings, Boxes, Package } from 'lucide-react';
import packageJSON from '../../../../package.json';

const navItems = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'العملاء', icon: Users, end: false },
  { to: '/suppliers', label: 'الموردين', icon: Truck, end: false },
  { to: '/inventory-report', label: 'تقرير المخزن', icon: Boxes, end: false },
  { to: '/merchandise-settings', label: 'الأصناف والوحدات', icon: Package, end: false },
];

export default function Sidebar() {
  const [contractorName, setContractorName] = useState<string>('');

  useEffect(() => {
    async function loadContractorName() {
      try {
        const data = await window.api.settings.getAll();
        if (data && data.contractor_name) {
          setContractorName(data.contractor_name);
        } else {
          setContractorName('نظام ادارة');
        }
      } catch (err) {
        console.error('Failed to load settings in sidebar:', err);
        setContractorName('نظام ادارة');
      }
    }

    loadContractorName();

    const handleSettingsUpdate = () => {
      loadContractorName();
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${isActive
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const firstLetter = contractorName ? contractorName.trim().charAt(0) : 'م';

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0">
      {/* Logo / App Name */}
      <div className="px-6 py-5 border-b border-slate-700/50 flex items-center gap-3 bg-slate-950/20">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-500/20 shrink-0">
          {firstLetter}
        </div>
        <h1 className="text-base font-bold text-white leading-tight truncate" title={contractorName}>
          {contractorName || 'نظام المقاول'}
        </h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Settings + Version */}
      <div className="px-3 pb-3 border-t border-slate-700 pt-3 space-y-1">
        <NavLink to="/settings" className={linkClass}>
          <Settings size={18} />
          <span>الإعدادات</span>
        </NavLink>
        <p className="text-xs text-slate-500 text-center py-2">{`نسخة ${packageJSON.version}`}</p>
      </div>
    </aside>
  );
}
