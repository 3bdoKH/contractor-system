import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck } from 'lucide-react';

const navItems = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'العملاء', icon: Users, end: false },
  { to: '/suppliers', label: 'الموردين', icon: Truck, end: false },
];


export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0">
      {/* Logo / App Name */}
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white leading-tight">الحاج حسن البطاط</h1>
        <p className="text-xs text-slate-400 mt-0.5">نظام إدارة المقاول</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">نسخة ١.٠</p>
      </div>
    </aside>
  );
}
