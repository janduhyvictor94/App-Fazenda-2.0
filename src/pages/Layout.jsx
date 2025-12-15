import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/lib/supabaseClient'; // Importação do cliente Supabase
import { 
  LayoutDashboard, 
  Map, 
  Wheat, 
  Calendar, 
  Package, 
  DollarSign, 
  Users, 
  FileText, 
  ClipboardList,
  Menu,
  X,
  ChevronRight,
  Leaf,
  LogOut // Importação do ícone de Logout
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Talhões', icon: Map, page: 'Talhoes' },
  { name: 'Colheitas', icon: Wheat, page: 'Colheitas' },
  { name: 'Atividades', icon: ClipboardList, page: 'Atividades' },
  { name: 'Calendário', icon: Calendar, page: 'Calendario' },
  { name: 'Insumos', icon: Package, page: 'Insumos' },
  { name: 'Financeiro', icon: DollarSign, page: 'Financeiro' },
  { name: 'Funcionários', icon: Users, page: 'Funcionarios' },
  { name: 'Consultorias', icon: FileText, page: 'Consultorias' },
  { name: 'Relatórios', icon: FileText, page: 'Relatorios' },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- NOVA FUNÇÃO DE LOGOUT CORRIGIDA ---
  const handleLogout = async () => {
    try {
      // 1. Tenta avisar ao Supabase para encerrar a sessão
      await supabase.auth.signOut();
    } catch (error) {
      // Se der erro 403 ou qualquer outro, apenas ignoramos
      console.log("Erro silencioso ao sair:", error);
    } finally {
      // 2. FORÇA O REDIRECIONAMENTO (Isso roda sempre)
      // Limpa dados locais para garantir
      localStorage.clear(); 
      // Manda o usuário para a tela de login
      window.location.href = '/login';
    }
  };
  // ---------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-emerald-50/30">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-white/95 backdrop-blur-xl border-r border-stone-200/60 transform transition-transform duration-300 ease-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-stone-900 tracking-tight">FAZENDA</h1>
                <p className="text-xs font-medium text-emerald-600 tracking-widest">CASSIANO'S</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-emerald-50 text-emerald-700 shadow-sm" 
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-emerald-600" : "text-stone-400"
                  )} />
                  <span>{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto text-emerald-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer com Botão de Logout */}
          <div className="p-4 border-t border-stone-100">
            <div className="mb-3 px-4 py-3 bg-gradient-to-r from-emerald-50 to-stone-50 rounded-xl">
              <p className="text-xs text-stone-500">Sistema de Gestão</p>
              <p className="text-sm font-medium text-stone-700">Fazenda Cassiano's</p>
            </div>
            
            <button
              onClick={handleLogout} // <--- AQUI MUDOU: Agora chama a função segura
              className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-stone-200/60">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-stone-100 lg:hidden transition-colors"
            >
              <Menu className="w-5 h-5 text-stone-600" />
            </button>
            
            <div className="hidden lg:block">
              <h2 className="text-xl font-semibold text-stone-800">
                {navigation.find(n => n.page === currentPageName)?.name || 'Dashboard'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-stone-700">Fazenda Cassiano's</p>
                <p className="text-xs text-stone-500">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}