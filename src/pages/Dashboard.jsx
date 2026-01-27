import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import StatCard from '@/components/ui/StatCard';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { 
  LayoutDashboard, Map, Wheat, TrendingUp, 
  DollarSign, PieChart, Activity, Wallet, Sprout, Calendar, ArrowRight, Tractor, CheckCircle2, BarChart2 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Cell, Legend 
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  
  // --- 1. QUERIES (HOOKS) ---
  const { data: talhoes = [], isLoading: l1 } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; }
  });

  const { data: colheitas = [], isLoading: l2 } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => { const { data } = await supabase.from('colheitas').select('*'); return data || []; }
  });

  const { data: custos = [], isLoading: l3 } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => { const { data } = await supabase.from('custos').select('*'); return data || []; }
  });

  const { data: atividades = [], isLoading: l4 } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => { const { data } = await supabase.from('atividades').select('*'); return data || []; }
  });

  // --- 2. DADOS PARA GRÁFICOS (MEMOS - HOOKS) ---
  
  // Gráfico 1: Evolução Financeira (Receita vs Despesa)
  const dadosFinanceiroMisto = useMemo(() => {
    const hoje = new Date();
    const meses = eachMonthOfInterval({
      start: subMonths(hoje, 11), // Últimos 12 meses
      end: hoje
    });

    return meses.map(mes => {
      const mesStr = format(mes, 'yyyy-MM');
      const label = format(mes, 'MMM', { locale: ptBR }).toUpperCase();

      // Receita no mês
      const rec = colheitas
        .filter(c => c.data && c.data.startsWith(mesStr))
        .reduce((acc, c) => acc + (c.valor_total || 0), 0);

      // Despesa PAGA no mês (Financeiro)
      const despFin = custos
        .filter(c => c.data && c.data.startsWith(mesStr) && c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago')
        .reduce((acc, c) => acc + (c.valor || 0), 0);
      
      // Custo Atividade no mês
      const despAtiv = atividades
        .filter(a => a.data_programada && a.data_programada.startsWith(mesStr) && a.status === 'concluida')
        .reduce((acc, a) => acc + (a.custo_total || 0), 0);

      const totalDespesa = despFin + despAtiv;

      return {
        name: label,
        Receita: rec,
        Despesa: totalDespesa
      };
    });
  }, [colheitas, custos, atividades]);

  // Gráfico 2: Produção por Cultura (Barras Horizontais)
  const dadosProducaoCultura = useMemo(() => {
      const porCultura = {};
      colheitas.forEach(c => {
          const talhao = talhoes.find(t => t.id === c.talhao_id);
          const cultura = talhao?.cultura || 'Outros';
          porCultura[cultura] = (porCultura[cultura] || 0) + (c.quantidade_kg || 0);
      });
      return Object.entries(porCultura)
        .map(([name, value]) => ({ name, value: value / 1000 })) // Em Toneladas
        .sort((a, b) => b.value - a.value); // Maior para menor
  }, [colheitas, talhoes]);

  // Lista: Próximas Atividades (Pendentes)
  const proximasAtividades = useMemo(() => {
      const hoje = new Date();
      return atividades
        .filter(a => a.status === 'pendente' && a.data_programada && isAfter(parseISO(a.data_programada), subMonths(hoje, 1))) 
        .sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada))
        .slice(0, 5);
  }, [atividades]);

  // --- 3. CÁLCULOS RIGOROSOS (VARIÁVEIS) ---

  // 1. Área Total
  const areaTotal = talhoes.reduce((acc, t) => acc + (Number(t.area_hectares) || 0), 0);

  // 2. Colheita Total e Receita
  const totalColheitaTon = colheitas.reduce((acc, c) => acc + ((c.quantidade_kg || 0) / 1000), 0);
  const receitaTotal = colheitas.reduce((acc, c) => acc + (c.valor_total || 0), 0);

  // 3. Custos Financeiros (SOMENTE PAGOS)
  const custosFinanceirosPagos = custos.filter(c => 
    c.tipo_lancamento === 'despesa' && 
    c.status_pagamento === 'pago'
  );
  const totalFinanceiroPago = custosFinanceirosPagos.reduce((acc, c) => acc + (c.valor || 0), 0);

  // 4. Custos Operacionais (Atividades Concluídas)
  const atividadesConcluidas = atividades.filter(a => a.status === 'concluida');
  const totalCustoAtividades = atividadesConcluidas.reduce((acc, a) => acc + (a.custo_total || 0), 0);

  // 5. Custo Total Global
  const custoTotalGlobal = totalFinanceiroPago + totalCustoAtividades;

  // 6. Lucro Real
  const lucroReal = receitaTotal - custoTotalGlobal;

  // 7. Produtividade Média
  const produtividadeMedia = areaTotal > 0 ? (totalColheitaTon / areaTotal) : 0;

  // --- 4. CONDICIONAL DE LOADING ---
  if (l1 || l2 || l3 || l4) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Visão Geral da Fazenda</h1>
          <p className="text-stone-500 font-medium">Indicadores consolidados (Regime de Caixa / Realizado)</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl font-bold text-xs border border-emerald-100 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Online
            </div>
            <div className="bg-stone-50 text-stone-600 px-4 py-2 rounded-xl font-bold text-xs border border-stone-200">
                {new Date().toLocaleDateString('pt-BR')}
            </div>
        </div>
      </div>

      {/* KPI CARDS - Linha 1 (Físico) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard 
            title="Área Total" 
            value={`${areaTotal.toFixed(2)} ha`} 
            icon={Map} 
            color="text-stone-600" 
        />
        <StatCard 
            title="Produtividade Média" 
            value={`${produtividadeMedia.toFixed(1)} ton/ha`} 
            icon={Sprout} 
            color="text-purple-600" 
        />
        <StatCard 
            title="Colheita Total" 
            value={`${totalColheitaTon.toFixed(1)} ton`} 
            icon={Wheat} 
            color="text-amber-600" 
        />
        <StatCard 
            title="Próximas Atividades" 
            value={`${atividades.filter(a => a.status === 'pendente').length}`} 
            icon={Tractor} 
            color="text-blue-600" 
        />
      </div>

      {/* KPI CARDS - Linha 2 (Financeiro - CAIXA REALIZADO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
            title="Receita Total" 
            value={`R$ ${receitaTotal.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} 
            icon={TrendingUp} 
            color="text-emerald-600" 
        />
        <StatCard 
            title="Contas + Func. (Pagos)" 
            value={`R$ ${totalFinanceiroPago.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} 
            icon={Wallet} 
            color="text-stone-600" 
        />
        <StatCard 
            title="Custo Total (Global)" 
            value={`R$ ${custoTotalGlobal.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} 
            icon={DollarSign} 
            color="text-red-600" 
        />
        <StatCard 
            title="Lucro/Prejuízo Real" 
            value={`R$ ${lucroReal.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} 
            icon={Activity} 
            color={lucroReal >= 0 ? "text-emerald-600" : "text-red-600"} 
        />
      </div>

      {/* GRÁFICOS E LISTAS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Performance Financeira (Barras - Sem Linha de Saldo) */}
        <div className="xl:col-span-2 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-600" />
                Performance Financeira Mensal
            </h3>
            <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Receita</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Despesa</div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosFinanceiroMisto} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  formatter={(value, name) => [`R$ ${value.toLocaleString('pt-BR')}`, name]}
                  cursor={{fill: 'transparent'}}
                />
                <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Coluna Direita: Produção + Atividades */}
        <div className="space-y-6">
            
            {/* Gráfico 2: Produção por Cultura (Barras Horizontais) */}
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
                <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                    <Wheat className="w-5 h-5 text-amber-600" />
                    Produção por Cultura
                </h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={dadosProducaoCultura} margin={{top: 0, right: 30, left: 0, bottom: 0}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{fill: '#4b5563', fontSize: 13, fontWeight: 500}} />
                            <Tooltip cursor={{fill: '#f9fafb'}} formatter={(value) => [`${value.toFixed(1)} ton`, 'Produção']} contentStyle={{borderRadius: '8px'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                {dadosProducaoCultura.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Lista: Próximas Atividades */}
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex-1">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Próximas Atividades
                    </h3>
                </div>
                
                <div className="space-y-3">
                    {proximasAtividades.length === 0 ? (
                        <div className="text-center py-8 text-stone-400 text-sm">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            Nenhuma atividade pendente próxima.
                        </div>
                    ) : (
                        proximasAtividades.map(ativ => (
                            <div key={ativ.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 hover:bg-stone-100 transition-colors">
                                <div>
                                    <p className="font-bold text-stone-700 text-sm">{ativ.tipo}</p>
                                    <p className="text-xs text-stone-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {format(parseISO(ativ.data_programada), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-stone-300" />
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}