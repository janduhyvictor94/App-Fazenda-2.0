import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import StatCard from '@/components/ui/StatCard'; 
import WeatherWidget from '@/components/ui/WeatherWidget'; 
import { 
  Map, Wheat, TrendingUp, 
  Clock, Wallet, CheckCircle2, DollarSign, Activity, Calendar
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
  const queryOptions = {
    refetchOnWindowFocus: true,
    staleTime: 0
  };

  // QUERIES
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data } = await supabase.from('talhoes').select('*');
      return data || [];
    },
    ...queryOptions
  });

  const { data: colheitas = [] } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => {
      const { data } = await supabase.from('colheitas').select('*');
      return data || [];
    },
    ...queryOptions
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      // Busca todas as atividades para cálculo correto de custos
      const { data } = await supabase.from('atividades').select('*').order('data_programada', { ascending: false });
      return data || [];
    },
    ...queryOptions
  });

  const { data: custos = [] } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => {
      const { data } = await supabase.from('custos').select('*');
      return data || [];
    },
    ...queryOptions
  });

  // MUTATION PARA CONCLUIR ATIVIDADE
  const completeActivityMutation = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase
        .from('atividades')
        .update({ 
          status: 'concluida',
          data_realizada: format(new Date(), 'yyyy-MM-dd')
        })
        .eq('id', id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
    }
  });

  // --- CÁLCULOS FINANCEIROS E KPI ---

  // 1. Receita: Soma colheitas + Receitas lançadas no financeiro (Pagas)
  const receitaColheitas = colheitas.reduce((acc, c) => acc + (Number(c.valor_total) || 0), 0);
  
  const itensFinanceirosPagos = custos.filter(c => c.status_pagamento && c.status_pagamento.toLowerCase() === 'pago');

  const receitaFinanceiro = itensFinanceirosPagos
    .filter(c => c.tipo_lancamento === 'receita')
    .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  
  const totalReceita = receitaColheitas + receitaFinanceiro;
  
  // 2. Custos Financeiros (PAGOS) - (Contas + Funcionários)
  const custoFinanceiroPago = itensFinanceirosPagos
    .filter(c => c.tipo_lancamento === 'despesa')
    .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

  // 3. Custo de Atividades (Operacional) - Apenas concluídas
  const custoAtividadesConcluidas = atividades
    .filter(a => a.status === 'concluida')
    .reduce((acc, a) => acc + (Number(a.custo_total) || 0), 0);

  // 4. Custo Total Geral (Financeiro Pago + Atividades Operacionais)
  const custoTotalGeral = custoFinanceiroPago + custoAtividadesConcluidas;
  
  // 5. Lucro / Prejuízo (Receita - Custo Total Geral)
  // Agora subtrai o custo TOTAL (Financeiro + Atividades)
  const lucroPrejuizo = totalReceita - custoTotalGeral;
  
  // Listas e Gráficos
  const atividadesPendentes = atividades
    .filter(a => a.status !== 'concluida')
    .slice(0, 5); // Pega apenas as 5 primeiras para exibir

  const dadosProducao = [
    { name: 'Manga', value: colheitas.filter(c => c.cultura === 'manga').reduce((acc, c) => acc + (Number(c.quantidade_kg) || 0), 0) },
    { name: 'Goiaba', value: colheitas.filter(c => c.cultura === 'goiaba').reduce((acc, c) => acc + (Number(c.quantidade_kg) || 0), 0) },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Header com Widget de Clima */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-8 rounded-[2rem] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-xl flex flex-col justify-center relative overflow-hidden">
            <div className="relative z-10">
                <h1 className="text-3xl font-bold mb-2">Fazenda Cassiano's</h1>
                <p className="text-emerald-100 opacity-90 text-lg">Painel de controle e lucratividade agrícola.</p>
            </div>
            <Wheat className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-white/10 rotate-12" />
        </div>
        <WeatherWidget />
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Área - com .toFixed(2) para evitar casas decimais infinitas */}
        <StatCard title="Área Total" value={`${talhoes.reduce((acc, t) => acc + (Number(t.area_hectares) || 0), 0).toFixed(2)} ha`} icon={Map} />
        
        {/* 2. Colheita - Proteção contra NaN */}
        <StatCard title="Colheita Total" value={`${(colheitas.reduce((acc, c) => acc + (Number(c.quantidade_toneladas) || (Number(c.quantidade_kg) / 1000) || 0), 0)).toFixed(1)} ton`} icon={Wheat} />
        
        {/* 3. Receita */}
        <StatCard title="Receita" value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-blue-600" />
        
        {/* 4. Contas + Funcionarios */}
        <StatCard 
            title="(Contas + Funcionarios)" 
            value={`R$ ${custoFinanceiroPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            icon={DollarSign} 
            color="text-red-600"
        />

        {/* 5. Custo Totais */}
        <StatCard 
            title="Custo Totais" 
            value={`R$ ${custoTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            icon={Activity} 
            color="text-amber-600"
        />

        {/* 6. Lucro / Prejuízo (Atualizado) */}
        <StatCard 
            title="Lucro / Prejuízo" 
            value={`R$ ${lucroPrejuizo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            icon={Wallet}
            className={lucroPrejuizo >= 0 ? "border-emerald-200" : "border-red-200"}
            color={lucroPrejuizo >= 0 ? "text-emerald-600" : "text-red-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Atividades */}
        <Card className="border-stone-200/60 shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" /> Próximas Atividades
              </CardTitle>
              <Link to={createPageUrl('Atividades')} className="text-sm font-bold text-emerald-600 hover:underline">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {atividadesPendentes.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {atividadesPendentes.map((ativ) => (
                  <div key={ativ.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between group">
                    <div>
                      <p className="font-bold text-stone-800">{ativ.tipo === 'outro' ? ativ.tipo_personalizado : ativ.tipo}</p>
                      <p className="text-sm text-stone-500">Talhão: {talhoes.find(t => t.id === ativ.talhao_id)?.nome || '-'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-white">{ativ.data_programada ? format(parseISO(ativ.data_programada), 'dd/MM') : '--/--'}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-all"
                        onClick={() => completeActivityMutation.mutate(ativ.id)}
                        disabled={completeActivityMutation.isPending}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-stone-400">Nenhuma atividade pendente</div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico */}
        <Card className="border-stone-200/60 shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Produção (kg)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {dadosProducao.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosProducao} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {dadosProducao.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-stone-400">Sem dados de colheita</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atalhos Rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Novo Talhão', icon: Map, path: 'Talhoes', bg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Nova Colheita', icon: Wheat, path: 'Colheitas', bg: 'bg-amber-50 text-amber-600' },
          { label: 'Nova Atividade', icon: Calendar, path: 'Atividades', bg: 'bg-blue-50 text-blue-600' },
          { label: 'Financeiro', icon: DollarSign, path: 'Financeiro', bg: 'bg-purple-50 text-purple-600' },
        ].map((item, i) => (
          <Link 
            key={i} 
            to={createPageUrl(item.path)}
            className="p-6 bg-white rounded-[2rem] border border-stone-100 hover:border-emerald-200 hover:shadow-lg transition-all flex flex-col items-center group"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${item.bg}`}>
              <item.icon className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm text-stone-700">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}