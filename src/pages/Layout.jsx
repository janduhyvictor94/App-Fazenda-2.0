import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  LayoutDashboard, Map, Wheat, Calendar, Package, 
  DollarSign, Users, FileText, ClipboardList,
  Menu, X, Leaf, LogOut, CloudRain, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
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

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] bg-gradient-to-tr from-stone-50 via-white to-emerald-50/30 font-sans antialiased text-stone-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white/80 backdrop-blur-2xl border-r border-stone-200/40 transform transition-all duration-500 ease-in-out lg:translate-x-0 shadow-2xl shadow-stone-200/20",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3.5 group cursor-default">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/50 group-hover:rotate-6 transition-transform">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-stone-800 leading-none">Fazenda</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-black mt-1.5 opacity-80">Cassiano's</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-hide">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3.5 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group relative",
                    isActive 
                      ? "bg-emerald-600 text-white shadow-xl shadow-emerald-200/60 ring-1 ring-white/20" 
                      : "text-stone-500 hover:bg-emerald-50/50 hover:text-emerald-700"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-stone-400 group-hover:text-emerald-600")} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && <Sparkles className="w-3 h-3 text-emerald-200 animate-pulse" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-6">
            <button onClick={handleLogout} className="group flex items-center gap-3 w-full px-5 py-4 text-sm font-black text-red-500/80 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all duration-300 border border-transparent hover:border-red-100">
              <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72 transition-all duration-300">
        <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-md border-b border-stone-200/30">
          <div className="flex items-center justify-between px-6 py-5 lg:px-10">
            <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl bg-white border border-stone-200 shadow-sm lg:hidden hover:scale-105 active:scale-95 transition-all">
              <Menu className="w-5 h-5 text-stone-600" />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-stone-400">
                Gestão Operacional • {navigation.find(n => n.page === currentPageName)?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-5">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-black text-stone-800">Fazenda Cassiano's</p>
                <div className="flex items-center justify-end gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sistema Online</p>
                </div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-tr from-stone-100 to-stone-200 rounded-2xl flex items-center justify-center border border-stone-200/50 shadow-inner hover:border-emerald-200 transition-colors cursor-pointer">
                <Users className="w-5 h-5 text-stone-500" />
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </main>
      </div>
    </div>
  );
}