import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import StatCard from '@/components/ui/StatCard'; 
import WeatherWidget from '@/components/ui/WeatherWidget'; 
import PageSkeleton from '@/components/ui/PageSkeleton'; // NOVO
import { 
  Map, Wheat, TrendingUp, 
  Clock, Wallet, CheckCircle2, DollarSign, Activity, Calendar, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const queryOptions = { refetchOnWindowFocus: true, staleTime: 0 };

  // --- QUERIES COM LOADING ---
  const { data: talhoes = [], isLoading: l1 } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; },
    ...queryOptions
  });

  const { data: colheitas = [], isLoading: l2 } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => { const { data } = await supabase.from('colheitas').select('*'); return data || []; },
    ...queryOptions
  });

  const { data: atividades = [], isLoading: l3 } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => { const { data } = await supabase.from('atividades').select('*').order('data_programada', { ascending: false }); return data || []; },
    ...queryOptions
  });

  const { data: custos = [], isLoading: l4 } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => { const { data } = await supabase.from('custos').select('*'); return data || []; },
    ...queryOptions
  });

  // MUTATION
  const completeActivityMutation = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.from('atividades').update({ status: 'concluida', data_realizada: format(new Date(), 'yyyy-MM-dd') }).eq('id', id);
      if (error) throw error; return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); }
  });

  // LOADING STATE
  if (l1 || l2 || l3 || l4) return <PageSkeleton />;

  // --- CÁLCULOS ---
  const receitaColheitas = colheitas.reduce((acc, c) => acc + (Number(c.valor_total) || 0), 0);
  const itensFinanceirosPagos = custos.filter(c => c.status_pagamento && c.status_pagamento.toLowerCase() === 'pago');
  const receitaFinanceiro = itensFinanceirosPagos.filter(c => c.tipo_lancamento === 'receita').reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const totalReceita = receitaColheitas + receitaFinanceiro;
  
  const custoFinanceiroPago = itensFinanceirosPagos.filter(c => c.tipo_lancamento === 'despesa').reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const custoAtividadesConcluidas = atividades.filter(a => a.status === 'concluida').reduce((acc, a) => acc + (Number(a.custo_total) || 0), 0);
  const custoTotalGeral = custoFinanceiroPago + custoAtividadesConcluidas;
  const lucroPrejuizo = totalReceita - custoTotalGeral;
  
  const atividadesPendentes = atividades.filter(a => a.status !== 'concluida').slice(0, 5);

  const dadosProducao = [
    { name: 'Manga', value: colheitas.filter(c => c.cultura === 'manga').reduce((acc, c) => acc + (Number(c.quantidade_kg) || 0), 0) },
    { name: 'Goiaba', value: colheitas.filter(c => c.cultura === 'goiaba').reduce((acc, c) => acc + (Number(c.quantidade_kg) || 0), 0) },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Clima */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-8 rounded-[1.5rem] bg-stone-900 text-white shadow-lg flex flex-col justify-center relative overflow-hidden group">
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">ONLINE</span>
                    <span className="text-stone-400 text-xs font-medium tracking-widest uppercase">Sistema de Gestão</span>
                </div>
                <h1 className="text-3xl font-bold mb-1 tracking-tight">Fazenda Cassiano's</h1>
                <p className="text-stone-400 opacity-90 text-sm">Visão geral de performance e controle operacional.</p>
            </div>
            <Wheat className="absolute right-[-10px] bottom-[-20px] w-40 h-40 text-emerald-500/10 rotate-12 transition-transform group-hover:rotate-[15deg] duration-700" />
        </div>
        <div className="h-full">
            <WeatherWidget className="h-full rounded-[1.5rem] shadow-sm border border-stone-100" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Área Total" value={`${talhoes.reduce((acc, t) => acc + (Number(t.area_hectares) || 0), 0).toFixed(2)} ha`} icon={Map} color="text-stone-600" />
        <StatCard title="Colheita Total" value={`${(colheitas.reduce((acc, c) => acc + (Number(c.quantidade_toneladas) || (Number(c.quantidade_kg) / 1000) || 0), 0)).toFixed(1)} ton`} icon={Wheat} color="text-amber-600" />
        <StatCard title="Receita" value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title="Contas + Func." value={`R$ ${custoFinanceiroPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="text-red-600" />
        <StatCard title="Custo Totais" value={`R$ ${custoTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Activity} color="text-amber-600" />
        <StatCard 
            title="Lucro / Prejuízo" 
            value={`R$ ${lucroPrejuizo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            icon={Wallet}
            className={lucroPrejuizo >= 0 ? "border-emerald-100 bg-emerald-50/30" : "border-red-100 bg-red-50/30"}
            color={lucroPrejuizo >= 0 ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Produção */}
        <Card className="lg:col-span-1 border-stone-100 rounded-[1.5rem] shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-stone-800 font-bold">Produção (kg)</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center">
            <div className="h-64 w-full">
              {dadosProducao.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                        data={dadosProducao} 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        dataKey="value"
                        stroke="none"
                    >
                      {dadosProducao.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    {/* TOOLTIP ESTILO GLASS */}
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '16px', border: '1px solid rgba(231, 229, 228, 0.5)', padding: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ color: '#44403c', fontWeight: 600, fontSize: '13px' }}
                        formatter={(value) => `${value.toLocaleString('pt-BR')} kg`}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                    Sem dados de colheita
                </div>
              )}
            </div>
            <div className="mt-4 text-center">
                <p className="text-xs text-stone-400 uppercase font-bold tracking-wider">Predominante</p>
                <p className="text-lg font-bold text-stone-700">
                    {dadosProducao.length > 0 
                        ? dadosProducao.reduce((prev, current) => (prev.value > current.value) ? prev : current).name 
                        : '-'}
                </p>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Atividades */}
        <Card className="lg:col-span-2 border-stone-100 rounded-[1.5rem] shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-white border-b border-stone-50 pb-4 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Clock className="w-5 h-5" />
                 </div>
                 <CardTitle className="text-lg font-bold text-stone-800">Próximas Atividades</CardTitle>
              </div>
              <Link to={createPageUrl('Atividades')}>
                <Button variant="ghost" size="sm" className="text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs font-bold uppercase tracking-wide">
                    Agenda Completa <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {atividadesPendentes.length > 0 ? (
              <div className="divide-y divide-stone-50">
                {atividadesPendentes.map((ativ) => (
                  <div key={ativ.id} className="p-4 px-6 hover:bg-stone-50/80 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                          ativ.tipo === 'colheita' ? 'bg-amber-50 border-amber-100 text-amber-600' : 
                          ativ.tipo === 'adubacao' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                          'bg-blue-50 border-blue-100 text-blue-600'
                      }`}>
                         <Activity className="w-4 h-4" />
                      </div>
                      
                      <div>
                        <p className="font-bold text-stone-800 text-sm">{ativ.tipo === 'outro' ? ativ.tipo_personalizado : ativ.tipo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-stone-500 font-medium bg-stone-100 px-2 py-0.5 rounded-md">
                                {talhoes.find(t => t.id === ativ.talhao_id)?.nome || 'Geral'}
                            </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] text-stone-400 font-bold uppercase block">Data Programada</span>
                        <span className={`text-sm font-bold ${
                            ativ.data_programada && new Date(ativ.data_programada) < new Date() ? 'text-red-500' : 'text-stone-700'
                        }`}>
                            {ativ.data_programada ? format(parseISO(ativ.data_programada), 'dd/MM/yyyy') : '--'}
                        </span>
                      </div>
                      
                      <Button
                        size="icon"
                        className="rounded-full w-9 h-9 bg-white border border-stone-200 text-stone-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 shadow-sm transition-all active:scale-95"
                        onClick={() => completeActivityMutation.mutate(ativ.id)}
                        disabled={completeActivityMutation.isPending}
                        title="Marcar como concluída"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-stone-400 gap-2">
                <CheckCircle2 className="w-8 h-8 opacity-20" />
                <p className="text-sm">Nenhuma atividade pendente para os próximos dias.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atalhos Rodapé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Novo Talhão', icon: Map, path: 'Talhoes', color: 'text-emerald-600', hoverBg: 'hover:bg-emerald-50 hover:border-emerald-200' },
          { label: 'Nova Colheita', icon: Wheat, path: 'Colheitas', color: 'text-amber-600', hoverBg: 'hover:bg-amber-50 hover:border-amber-200' },
          { label: 'Nova Atividade', icon: Calendar, path: 'Atividades', color: 'text-blue-600', hoverBg: 'hover:bg-blue-50 hover:border-blue-200' },
          { label: 'Lançar Financeiro', icon: DollarSign, path: 'Financeiro', color: 'text-purple-600', hoverBg: 'hover:bg-purple-50 hover:border-purple-200' },
        ].map((item, i) => (
          <Link 
            key={i} 
            to={createPageUrl(item.path)}
            className={`p-4 bg-white rounded-[1rem] border border-stone-100 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3 group ${item.hoverBg}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-stone-50 group-hover:bg-white group-hover:shadow-sm transition-all`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <span className="font-bold text-sm text-stone-600 group-hover:text-stone-800">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}