import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  LayoutDashboard, Map, Wheat, Calendar, Package, 
  DollarSign, Users, FileText, ClipboardList,
  Menu, X, ChevronRight, Leaf, LogOut, CloudRain
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
    <div className="min-h-screen bg-[#F8F9FA] font-sans antialiased text-stone-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-md lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white/80 backdrop-blur-xl border-r border-stone-200/50 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-sm",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/50 rotate-3">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-stone-800 leading-none">AgroGestão</span>
                <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mt-1">Cassiano's</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-stone-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-stone-400" />
            </button>
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
                    "flex items-center gap-3.5 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 group",
                    isActive 
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-200 ring-4 ring-emerald-50" 
                      : "text-stone-500 hover:bg-emerald-50 hover:text-emerald-700"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5",
                    isActive ? "text-white" : "text-stone-400 group-hover:text-emerald-600"
                  )} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-6">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300 hover:gap-4"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72 transition-all duration-300">
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-md border-b border-stone-200/40">
          <div className="flex items-center justify-between px-6 py-5 lg:px-10">
            <button onClick={() => setSidebarOpen(true)} className="p-2.5 rounded-2xl bg-white border border-stone-200 shadow-sm lg:hidden">
              <Menu className="w-5 h-5 text-stone-600" />
            </button>
            
            <div className="hidden lg:block">
              <h2 className="text-2xl font-bold text-stone-800">
                {navigation.find(n => n.page === currentPageName)?.name || 'Dashboard'}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-stone-800">Fazenda Cassiano's</p>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Status: Online</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-tr from-stone-100 to-stone-50 rounded-2xl flex items-center justify-center border border-stone-200/60 shadow-inner">
                <Users className="w-5 h-5 text-stone-500" />
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}