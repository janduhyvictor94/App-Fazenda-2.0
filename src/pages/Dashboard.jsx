import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import StatCard from '@/components/ui/StatCard';
import { 
  Map, 
  Wheat, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Package, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: colheitas = [] } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('colheitas').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('atividades').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: custos = [] } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custos').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcionarios').select('*');
      if (error) throw error;
      return data;
    }
  });

  // Cálculos
  const totalColheita = colheitas.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
  const totalReceita = colheitas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const totalCustos = custos.reduce((acc, c) => acc + (c.valor || 0), 0);
  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;

  // Atividades próximas
  const atividadesPendentes = atividades
    .filter(a => a.status === 'programada' || a.status === 'em_andamento')
    .sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada))
    .slice(0, 5);

  // Colheitas por tipo
  const colheitasPorTipo = colheitas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'Outros';
    acc[tipo] = (acc[tipo] || 0) + (c.quantidade_kg || 0);
    return acc;
  }, {});

  const pieData = Object.entries(colheitasPorTipo).map(([name, value]) => ({ name, value }));

  // Colheitas por cultura
  const colheitasPorCultura = colheitas.reduce((acc, c) => {
    const cultura = c.cultura || 'Outros';
    acc[cultura] = (acc[cultura] || 0) + (c.valor_total || 0);
    return acc;
  }, {});

  const barData = Object.entries(colheitasPorCultura).map(([name, value]) => ({ 
    name: name.charAt(0).toUpperCase() + name.slice(1), 
    valor: value 
  }));

  const getActivityLabel = (date) => {
    if (!date) return '';
    // Correção de data
    const d = new Date(date + 'T12:00:00');
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, "dd 'de' MMM", { locale: ptBR });
  };

  const tipoAtividadeLabels = {
    inducao: 'Indução',
    poda: 'Poda',
    adubacao: 'Adubação',
    pulverizacao: 'Pulverização',
    maturacao: 'Maturação',
    irrigacao: 'Irrigação',
    capina: 'Capina',
    outro: 'Outro'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Bem-vindo ao Painel</h1>
          <p className="text-stone-500">Visão geral da Fazenda Cassiano's</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {talhoes.length} Talhões
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {funcionariosAtivos} Funcionários Ativos
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Colhido"
          value={`${(totalColheita / 1000).toFixed(1)} ton`}
          subtitle="Todas as culturas"
          icon={Wheat}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Receita Total"
          value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Vendas de colheitas"
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Custos Totais"
          value={`R$ ${totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Despesas registradas"
          icon={DollarSign}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          title="Lucro Estimado"
          value={`R$ ${(totalReceita - totalCustos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Receita - Custos"
          icon={TrendingUp}
          iconBg={(totalReceita - totalCustos) >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={(totalReceita - totalCustos) >= 0 ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      {/* Charts and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colheita por Tipo */}
        <Card className="border-stone-100">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-stone-800">Colheita por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${(value / 1000).toFixed(1)} ton`, 'Quantidade']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-stone-400">
                Nenhuma colheita registrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receita por Cultura */}
        <Card className="border-stone-100">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-stone-800">Receita por Cultura</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita']}
                  />
                  <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-stone-400">
                Nenhuma receita registrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximas Atividades */}
        <Card className="border-stone-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-800">Próximas Atividades</CardTitle>
            <Link 
              to={createPageUrl('Calendario')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {atividadesPendentes.length > 0 ? (
              <div className="space-y-3">
                {atividadesPendentes.map((atividade) => {
                  const talhao = talhoes.find(t => t.id === atividade.talhao_id);
                  return (
                    <div 
                      key={atividade.id}
                      className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        atividade.status === 'em_andamento' ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                        {atividade.status === 'em_andamento' ? (
                          <Clock className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Calendar className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">
                          {tipoAtividadeLabels[atividade.tipo] || atividade.tipo_personalizado || atividade.tipo}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          {talhao?.nome || 'Talhão não encontrado'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getActivityLabel(atividade.data_programada)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-stone-400">
                <CheckCircle className="w-8 h-8 mb-2" />
                <p>Nenhuma atividade pendente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link 
          to={createPageUrl('Talhoes')}
          className="p-4 bg-white rounded-2xl border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <Map className="w-8 h-8 text-emerald-600 mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-stone-800">Gerenciar Talhões</p>
          <p className="text-sm text-stone-500">{talhoes.length} cadastrados</p>
        </Link>
        <Link 
          to={createPageUrl('Colheitas')}
          className="p-4 bg-white rounded-2xl border border-stone-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <Wheat className="w-8 h-8 text-amber-600 mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-stone-800">Nova Colheita</p>
          <p className="text-sm text-stone-500">{colheitas.length} registradas</p>
        </Link>
        <Link 
          to={createPageUrl('Atividades')}
          className="p-4 bg-white rounded-2xl border border-stone-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <Calendar className="w-8 h-8 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-stone-800">Nova Atividade</p>
          <p className="text-sm text-stone-500">{atividades.length} cadastradas</p>
        </Link>
        <Link 
          to={createPageUrl('Financeiro')}
          className="p-4 bg-white rounded-2xl border border-stone-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <DollarSign className="w-8 h-8 text-purple-600 mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-stone-800">Lançar Custo</p>
          <p className="text-sm text-stone-500">{custos.length} lançamentos</p>
        </Link>
      </div>
    </div>
  );
}