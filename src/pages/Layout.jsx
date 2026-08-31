import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  LayoutDashboard, Map, Wheat, Calendar, Package, 
  DollarSign, Users, FileText, ClipboardList,
  Menu, Leaf, LogOut, CloudRain, Sparkles, ChevronRight, ChevronsLeft, ChevronsRight,
  Sprout, ClipboardCheck // NOVO IMPORT
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  // NOVA ABA SAFRAS AQUI, LOGO APÓS O DASHBOARD PARA DESTAQUE
  { name: 'Gestão de Safras', icon: Sprout, page: 'Safras' }, 
  { name: 'Planejamentos', icon: ClipboardCheck, page: 'Planejamentos' },
  
  { name: 'Talhões', icon: Map, page: 'Talhoes' },
  { name: 'Colheitas', icon: Wheat, page: 'Colheitas' },
  { name: 'Atividades', icon: ClipboardList, page: 'Atividades' },
  { name: 'Pluviometria', icon: CloudRain, page: 'Pluviometria' },
  { name: 'Calendário', icon: Calendar, page: 'Calendario' },
  { name: 'Insumos', icon: Package, page: 'Insumos' },
  { name: 'Financeiro', icon: DollarSign, page: 'Financeiro' },
  { name: 'Funcionários', icon: Users, page: 'Funcionarios' },
  { name: 'Consultorias', icon: FileText, page: 'Consultorias' },
  { name: 'Relatórios', icon: FileText, page: 'Relatorios' },
];

const SIDEBAR_COLLAPSED_KEY = 'fazenda_sidebar_collapsed';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Menu retrátil: lembra a preferência entre sessões, igual o tema.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false'); } catch {}
  }, [collapsed]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-stone-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/40 via-stone-50 to-white dark:from-stone-900/30 dark:via-stone-950 dark:to-stone-950 font-sans antialiased text-stone-900 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-stone-900/10 backdrop-blur-sm lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-white/90 backdrop-blur-xl border-r border-stone-100 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-2xl shadow-stone-200/20",
        collapsed ? "w-20" : "w-72",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full relative">
          {/* Botão de retrair/expandir — só aparece em telas grandes (no mobile o menu já fecha sozinho) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex absolute -right-3 top-9 w-6 h-6 bg-white border border-stone-200 rounded-full items-center justify-center text-stone-500 hover:text-emerald-600 hover:border-emerald-200 shadow-sm transition-all z-10"
            title={collapsed ? 'Expandir menu' : 'Retrair menu'}
          >
            {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
          </button>

          {/* Logo Area */}
          <div className={cn("p-8 pb-6 flex items-center", collapsed ? "justify-center px-0" : "justify-between")}>
            <div className={cn("flex items-center group cursor-default", collapsed ? "gap-0" : "gap-4")}>
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200/50 transition-transform group-hover:scale-105 duration-300">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              {!collapsed && (
                <div className="flex flex-col overflow-hidden whitespace-nowrap">
                  <span className="text-lg font-black tracking-tight text-stone-800 leading-none">Fazenda</span>
                  <span className="text-xs uppercase tracking-[0.25em] text-emerald-600 font-bold mt-1">Cassiano's</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-2">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group relative",
                    collapsed && "justify-center px-0",
                    isActive 
                      ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" 
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-emerald-400" : "text-stone-500 group-hover:text-stone-600")} />
                  {!collapsed && <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</span>}
                  {!collapsed && isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-4 border-t border-stone-100 bg-stone-50/50">
            <button onClick={handleLogout} title={collapsed ? 'Sair do Sistema' : undefined} className={cn("flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group", collapsed && "justify-center px-0")}>
              <LogOut className="w-5 h-5 shrink-0 transition-transform group-hover:-translate-x-1" />
              {!collapsed && <span className="whitespace-nowrap">Sair do Sistema</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className={cn("transition-all duration-300 flex flex-col min-h-screen", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        
        {/* Header Clean */}
        <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-stone-100">
          <div className="flex items-center justify-between px-6 py-4 lg:px-8">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-stone-100 lg:hidden text-stone-500 transition-colors">
                    <Menu className="w-6 h-6" />
                </button>
                <div className="hidden lg:flex items-center gap-2 text-sm font-medium text-stone-500">
                    <span className="hover:text-stone-600 cursor-pointer transition-colors">App</span>
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                    <span className="text-stone-800 font-bold bg-stone-100 px-2 py-0.5 rounded-md">
                        {navigation.find(n => n.page === currentPageName)?.name || 'Dashboard'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeSwitcher />
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-bold text-stone-800">Administrador</p>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Online</p>
                </div>
              </div>
              <div className="w-10 h-10 bg-white rounded-full border border-stone-100 shadow-sm flex items-center justify-center text-stone-500 hover:text-emerald-600 hover:border-emerald-100 transition-all cursor-pointer">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
