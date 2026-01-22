import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  LayoutDashboard, Map, Wheat, Calendar, Package, 
  DollarSign, Users, FileText, ClipboardList,
  Menu, Leaf, LogOut, CloudRain, Sparkles, ChevronRight
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
    <div className="min-h-screen bg-[#FAFAFA] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/40 via-stone-50 to-white font-sans antialiased text-stone-900 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-stone-900/10 backdrop-blur-sm lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white/90 backdrop-blur-xl border-r border-stone-100 transform transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl shadow-stone-200/20",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="p-8 pb-6 flex items-center justify-between">
            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200/50 transition-transform group-hover:scale-105 duration-300">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-stone-800 leading-none">Fazenda</span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-600 font-bold mt-1">Cassiano's</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide py-2">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group relative",
                    isActive 
                      ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" 
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-emerald-400" : "text-stone-400 group-hover:text-stone-600")} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-4 border-t border-stone-100 bg-stone-50/50">
            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group">
              <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="lg:pl-72 transition-all duration-300 flex flex-col min-h-screen">
        
        {/* Header Clean */}
        <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-stone-100">
          <div className="flex items-center justify-between px-6 py-4 lg:px-8">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-stone-100 lg:hidden text-stone-500 transition-colors">
                    <Menu className="w-6 h-6" />
                </button>
                <div className="hidden lg:flex items-center gap-2 text-sm font-medium text-stone-400">
                    <span className="hover:text-stone-600 cursor-pointer transition-colors">App</span>
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                    <span className="text-stone-800 font-bold bg-stone-100 px-2 py-0.5 rounded-md">
                        {navigation.find(n => n.page === currentPageName)?.name || 'Dashboard'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-bold text-stone-800">Administrador</p>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Online</p>
                </div>
              </div>
              <div className="w-10 h-10 bg-white rounded-full border border-stone-100 shadow-sm flex items-center justify-center text-stone-400 hover:text-emerald-600 hover:border-emerald-100 transition-all cursor-pointer">
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