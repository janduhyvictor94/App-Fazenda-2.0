import React, { useState } from 'react';
import {
  LayoutDashboard,
  Sprout,
  Wallet,
  Leaf,
  Sparkles,
  Map as MapIcon,
  Wheat,
  Users,
  MoreHorizontal,
  X,
  ClipboardCheck,
  CloudRain,
  CalendarDays,
  Package,
  FileText,
  BarChart3,
  ReceiptText,
  BrainCircuit,
  Satellite,
  ListChecks
} from 'lucide-react';
import { clsx } from 'clsx';
import PeriodoSwitcher from './PeriodoSwitcher.jsx';

const SECOES_NAV = [
  {
    titulo: null,
    itens: [{ id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard }]
  },
  {
    titulo: 'Operação',
    itens: [
      { id: 'safras', label: 'Safras', icon: Sprout },
      { id: 'planejamentos', label: 'Planejamentos', icon: ListChecks },
      { id: 'talhoes', label: 'Talhões', icon: MapIcon },
      { id: 'colheitas', label: 'Colheitas', icon: Wheat },
      { id: 'atividades', label: 'Atividades', icon: ClipboardCheck },
      { id: 'calendario', label: 'Calendário', icon: CalendarDays },
      { id: 'pluviometria', label: 'Pluviometria', icon: CloudRain }
    ]
  },
  {
    titulo: 'Gestão',
    itens: [
      { id: 'financeiro', label: 'Financeiro', icon: Wallet },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
      { id: 'insumos', label: 'Insumos', icon: Package },
      { id: 'consultorias', label: 'Consultorias', icon: FileText },
      { id: 'relatorios', label: 'Relatórios', icon: BarChart3 }
    ]
  },
  {
    titulo: 'Inteligência',
    itens: [
      { id: 'notas-fiscais', label: 'Notas Fiscais', icon: ReceiptText },
      { id: 'mapa-satelite', label: 'Mapa por Satélite', icon: Satellite },
      { id: 'inteligencia', label: 'Inteligência Gerencial', icon: BrainCircuit },
      { id: 'assistente', label: 'Assistente IA', icon: Sparkles }
    ]
  }
];

const NAV = SECOES_NAV.flatMap((s) => s.itens);

// Páginas que não são recortadas por Ano/Safra — o seletor de período some
// no topo pra não sugerir um filtro que a tela não usa.
const PAGINAS_SEM_PERIODO = new Set([
  'talhoes',
  'funcionarios',
  'insumos',
  'relatorios',
  'assistente',
  'notas-fiscais',
  'mapa-satelite',
  'inteligencia',
  'metas',
  'planejamentos'
]);

// No mobile só cabem 4 confortavelmente — as telas mais usadas no dia a dia.
// O resto fica atrás do botão "Mais".
const MOBILE_PRINCIPAL = ['dashboard', 'colheitas', 'financeiro', 'safras'];

export default function Shell({ page, onNavigate, children }) {
  const [maisAberto, setMaisAberto] = useState(false);
  const navMobile = NAV.filter((n) => MOBILE_PRINCIPAL.includes(n.id));
  const navMais = NAV.filter((n) => !MOBILE_PRINCIPAL.includes(n.id));

  return (
    <div className="min-h-screen bg-base text-ink font-body">
      <div className="flex min-h-screen">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-line bg-surface/60 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-6 py-7">
            <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center shadow-glow-brand">
              <Leaf className="w-4.5 h-4.5 text-brand" strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-[15px] text-ink">Fazenda Cassiano&apos;s</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-brand font-semibold">Painel 2027 · Protótipo</div>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto scrollbar-hide">
            {SECOES_NAV.map((secao, idx) => (
              <div key={secao.titulo || 'root'} className={idx > 0 ? 'pt-4' : ''}>
                {secao.titulo && (
                  <div className="px-3.5 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-faint font-semibold">
                    {secao.titulo}
                  </div>
                )}
                {secao.itens.map((item) => {
                  const Icon = item.icon;
                  const active = page === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all',
                        active
                          ? 'bg-brand/12 text-brand shadow-[inset_0_0_0_1px_rgba(62,224,137,0.25)]'
                          : 'text-ink-muted hover:text-ink hover:bg-line-soft'
                      )}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Conteúdo */}
        <div className="flex-1 lg:pl-64">
          <header className="sticky top-0 z-30 bg-base/85 backdrop-blur-xl border-b border-line">
            <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center">
                  <Leaf className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="font-display font-bold text-sm">Fazenda Cassiano&apos;s</span>
              </div>
              <div className="hidden lg:block">
                <h1 className="font-display font-bold text-lg text-ink">
                  {NAV.find((n) => n.id === page)?.label}
                </h1>
              </div>
              {!PAGINAS_SEM_PERIODO.has(page) && <PeriodoSwitcher />}
            </div>
          </header>

          <main className="px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10 max-w-6xl">{children}</main>
        </div>
      </div>

      {/* Nav — mobile */}
      {maisAberto && (
        <div className="lg:hidden fixed inset-0 z-40 bg-base/70 backdrop-blur-sm" onClick={() => setMaisAberto(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-surface-raised border-t border-line rounded-t-2xl p-4 pb-8 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-xs uppercase tracking-wide text-ink-faint font-semibold">Mais telas</span>
              <button onClick={() => setMaisAberto(false)} className="text-ink-faint">
                <X className="w-4 h-4" />
              </button>
            </div>
            {navMais.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMaisAberto(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium',
                    page === item.id ? 'bg-brand/12 text-brand' : 'text-ink hover:bg-line-soft'
                  )}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-stretch justify-around">
          {navMobile.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-brand' : 'text-ink-faint'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => setMaisAberto(true)}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              navMais.some((n) => n.id === page) ? 'text-brand' : 'text-ink-faint'
            )}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
            Mais
          </button>
        </div>
      </nav>
    </div>
  );
}
