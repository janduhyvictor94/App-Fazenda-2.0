import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Wheat, DollarSign, TrendingUp, BarChart3, Package } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from 'recharts';

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6b7280',
  '#14b8a6', '#6366f1', '#d946ef', '#f43f5e', '#a855f7'
];

const categoriaLabels = {
  funcionario: { label: 'Funcionário', color: 'bg-blue-100 text-blue-700' },
  insumo: { label: 'Insumo', color: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700' },
  energia: { label: 'Energia', color: 'bg-yellow-100 text-yellow-700' },
  agua: { label: 'Água', color: 'bg-cyan-100 text-cyan-700' },
  combustivel: { label: 'Combustível', color: 'bg-orange-100 text-orange-700' },
  terceirizado: { label: 'Serviço Terceirizado', color: 'bg-purple-100 text-purple-700' },
  equipamento: { label: 'Equipamento', color: 'bg-indigo-100 text-indigo-700' },
  administrativo: { label: 'Administrativo', color: 'bg-pink-100 text-pink-700' },
  outro: { label: 'Outro', color: 'bg-stone-100 text-stone-700' }
};

const tipoAtividadeLabels = {
  inducao: 'Indução',
  poda: 'Poda',
  adubacao: 'Adubação',
  pulverizacao: 'Pulverização',
  maturacao: 'Maturação',
  irrigacao: 'Irrigação',
  capina: 'Capina',
  outro: 'Outra Atividade'
};

const tipoColheitaLabels = {
  exportacao: 'Exportação',
  mercado_interno: 'Mercado Interno',
  caixas: 'Caixas',
  arrastao: 'Arrastão',
  polpa: 'Polpa',
  caixa_verde: 'Caixa Verde',
  madura: 'Madura'
};

export default function Relatorios({ showMessage }) {
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

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
      const { data, error } = await supabase.from('colheitas').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: custos = [] } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custos').select('*').order('data', { ascending: false });
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

  const filtrarPorPeriodo = (data, dateField) => {
    if (!data) return data;
    return data.filter(item => {
      if (!item[dateField]) return false;
      const itemDate = new Date(item[dateField] + 'T12:00:00');
      const dataInicioDate = dataInicio ? parseISO(dataInicio) : new Date(2020, 0, 1);
      const dataFimDate = dataFim ? parseISO(dataFim) : new Date(2040, 11, 31);
      dataFimDate.setHours(23, 59, 59);
      return isWithinInterval(itemDate, { start: dataInicioDate, end: dataFimDate });
    });
  };

  const filtrarPorTalhao = (data, talhaoField = 'talhao_id') => {
    if (filtroTalhao === 'todos') return data;
    return data.filter(item => item[talhaoField] === filtroTalhao);
  };

  const colheitasFiltradas = filtrarPorTalhao(filtrarPorPeriodo(colheitas, 'data'));
  const custosFiltrados = filtrarPorTalhao(filtrarPorPeriodo(custos, 'data'));
  
  // Melhoria: Apenas atividades 'concluida' entram no custo
  const atividadesFiltradas = filtrarPorTalhao(filtrarPorPeriodo(atividades.filter(a => a.status === 'concluida'), 'data_programada'));

  const totalColheitaKg = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
  const totalColheitaCaixas = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_caixas || 0), 0);
  const totalReceita = colheitasFiltradas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  
  const totalCustosFinanceiro = custosFiltrados.reduce((acc, c) => acc + (c.valor || 0), 0);
  const custoAtividades = atividadesFiltradas.reduce((acc, a) => acc + (a.custo_total || 0), 0);
  const custoTotal = totalCustosFinanceiro + custoAtividades;
  const lucro = totalReceita - custoTotal;

  const usarCaixas = totalColheitaKg < 1 && totalColheitaCaixas > 0;
  const unidadeVisual = usarCaixas ? 'cx' : 'ton';
  const totalVisual = usarCaixas ? totalColheitaCaixas : (totalColheitaKg / 1000);

  const custoPorCategoria = {};
  custosFiltrados.forEach(c => {
    let catLabel = c.categoria ? (categoriaLabels[c.categoria]?.label || c.categoria) : 'Não categorizado';
    catLabel = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
    custoPorCategoria[catLabel] = (custoPorCategoria[catLabel] || 0) + (c.valor || 0);
  });

  atividadesFiltradas.forEach(a => {
    if (a.custo_total > 0) {
      let nomeAtividade = tipoAtividadeLabels[a.tipo] || a.tipo || 'Atividade Geral';
      if (a.tipo === 'outro' && a.tipo_personalizado) nomeAtividade = a.tipo_personalizado;
      nomeAtividade = nomeAtividade.charAt(0).toUpperCase() + nomeAtividade.slice(1);
      if (a.terceirizada) nomeAtividade += ' (Terceirizada)';
      custoPorCategoria[nomeAtividade] = (custoPorCategoria[nomeAtividade] || 0) + (a.custo_total || 0);
    }
  });

  const pieDataCustos = Object.entries(custoPorCategoria)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const colheitaPorTipo = colheitasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'outros';
    const valor = usarCaixas ? (c.quantidade_caixas || 0) : (c.quantidade_kg || 0);
    acc[tipo] = (acc[tipo] || 0) + valor;
    return acc;
  }, {});

  const pieDataColheita = Object.entries(colheitaPorTipo)
    .map(([name, value]) => ({ name: tipoColheitaLabels[name] || name, value }))
    .filter(item => item.value > 0);

  const aproveitamentoPorTipo = colheitasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'outros';
    if (!acc[tipo]) acc[tipo] = { kg: 0, caixas: 0, receita: 0 };
    acc[tipo].kg += c.quantidade_kg || 0;
    acc[tipo].caixas += c.quantidade_caixas || 0;
    acc[tipo].receita += c.valor_total || 0;
    return acc;
  }, {});

  const aproveitamentoData = Object.entries(aproveitamentoPorTipo).map(([tipo, data]) => ({
    name: tipoColheitaLabels[tipo] || tipo,
    kg: data.kg,
    caixas: data.caixas,
    receita: data.receita,
    precoMedio: usarCaixas ? (data.caixas > 0 ? (data.receita / data.caixas) : 0) : (data.kg > 0 ? (data.receita / data.kg) : 0)
  }));

  const evolucaoMensal = colheitas.reduce((acc, c) => {
    if (!c.data) return acc;
    const mes = format(new Date(c.data + 'T12:00:00'), 'MMM/yy', { locale: ptBR });
    if (!acc[mes]) acc[mes] = { receita: 0, custos: 0 };
    acc[mes].receita += c.valor_total || 0;
    return acc;
  }, {});

  custos.forEach(c => {
    if (!c.data) return;
    const mes = format(new Date(c.data + 'T12:00:00'), 'MMM/yy', { locale: ptBR });
    if (!evolucaoMensal[mes]) evolucaoMensal[mes] = { receita: 0, custos: 0 };
    evolucaoMensal[mes].custos += c.valor || 0;
  });

  const lineData = Object.entries(evolucaoMensal).slice(-12).map(([mes, data]) => ({
    mes, receita: data.receita, custos: data.custos
  }));

  const custoPorTalhao = custosFiltrados.reduce((acc, c) => {
    const talhaoNome = c.talhao_id ? (talhoes.find(t => t.id === c.talhao_id)?.nome || 'Desconhecido') : 'Geral';
    acc[talhaoNome] = (acc[talhaoNome] || 0) + (c.valor || 0);
    return acc;
  }, {});
  
  atividadesFiltradas.forEach(a => {
      const talhaoNome = a.talhao_id ? (talhoes.find(t => t.id === a.talhao_id)?.nome || 'Desconhecido') : 'Geral';
      custoPorTalhao[talhaoNome] = (custoPorTalhao[talhaoNome] || 0) + (a.custo_total || 0);
  });

  const barDataCusto = Object.entries(custoPorTalhao).map(([name, value]) => ({ name, valor: value }));

  const talhoesComDados = talhoes.map(talhao => {
    const receitaTalhao = colheitas.filter(c => c.talhao_id === talhao.id).reduce((acc, c) => acc + (c.valor_total || 0), 0);
    const custoDirTalhao = custos.filter(c => c.talhao_id === talhao.id).reduce((acc, c) => acc + (c.valor || 0), 0);
    const custoAtivTalhao = atividades.filter(a => a.talhao_id === talhao.id && a.status === 'concluida').reduce((acc, a) => acc + (a.custo_total || 0), 0);
    const custoTotalTalhao = custoDirTalhao + custoAtivTalhao;
    const lucroTalhao = receitaTalhao - custoTotalTalhao;
    const area = talhao.area_hectares || 0;
    const lucroPorHa = area > 0 ? (lucroTalhao / area) : 0;
    return { id: talhao.id, nome: talhao.nome, area, receita: receitaTalhao, custo: custoTotalTalhao, lucro: lucroTalhao, lucroPorHa };
  }).filter(t => t.receita > 0 || t.custo > 0);

  const barDataLucroHa = talhoesComDados.map(t => ({ name: t.nome, 'Lucro/ha': t.lucroPorHa })).sort((a, b) => b['Lucro/ha'] - a['Lucro/ha']);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Relatórios</h1>
          <p className="text-stone-500">Análise completa de produção e financeiro</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
            <SelectTrigger className="w-48 rounded-xl"><SelectValue placeholder="Talhão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Talhões</SelectItem>
              {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40 rounded-xl" />
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40 rounded-xl" />
          <Button onClick={() => window.print()} variant="outline" className="bg-white rounded-xl shadow-sm border-stone-200">
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Colhido" value={`${totalVisual.toFixed(1)} ${unidadeVisual}`} icon={Wheat} color="text-amber-600" />
        <StatCard title="Total Caixas" value={`${totalColheitaCaixas.toLocaleString('pt-BR')} cx`} icon={Package} color="text-blue-600" />
        <StatCard title="Receita Total" value={`R$ ${totalReceita.toLocaleString('pt-BR')}`} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title="Custos Totais" value={`R$ ${custoTotal.toLocaleString('pt-BR')}`} icon={DollarSign} color="text-red-600" />
        <StatCard title="Lucro/Prejuízo" value={`R$ ${lucro.toLocaleString('pt-BR')}`} icon={BarChart3} color={lucro >= 0 ? "text-emerald-600" : "text-red-600"} />
      </div>

      <Tabs defaultValue="colheitas" className="space-y-6">
        <TabsList className="bg-stone-100 rounded-xl p-1">
          <TabsTrigger value="colheitas" className="rounded-xl">Colheitas</TabsTrigger>
          <TabsTrigger value="aproveitamento" className="rounded-xl">Aproveitamento</TabsTrigger>
          <TabsTrigger value="custos" className="rounded-xl">Custos</TabsTrigger>
          <TabsTrigger value="produtividade" className="rounded-xl">Produtividade</TabsTrigger>
          <TabsTrigger value="evolucao" className="rounded-xl">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="colheitas" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-stone-100 rounded-2xl shadow-sm">
              <CardHeader><CardTitle className="text-lg">Distribuição por Tipo</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  {pieDataColheita.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieDataColheita} innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {pieDataColheita.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-stone-400">Sem dados no período</div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-stone-100 rounded-2xl shadow-sm overflow-hidden">
              <CardHeader><CardTitle className="text-lg">Tabela de Produção</CardTitle></CardHeader>
              <Table>
                <TableHeader className="bg-stone-50">
                  <TableRow><TableHead className="pl-6">Tipo</TableHead><TableHead className="text-right pr-6">Quantidade ({unidadeVisual})</TableHead></TableRow>
                </TableHeader>
                <TableBody>{pieDataColheita.map((item) => (<TableRow key={item.name}><TableCell className="pl-6 font-medium">{item.name}</TableCell><TableCell className="text-right pr-6 font-bold">{item.value.toLocaleString('pt-BR')}</TableCell></TableRow>))}</TableBody>
              </Table>
            </Card>
        </TabsContent>

        <TabsContent value="aproveitamento">
          <Card className="border-stone-100 rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="pt-6">
              <div className="h-72 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aproveitamentoData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis stroke="#10b981" /><Tooltip /><Bar dataKey="receita" name="Receita (R$)" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader className="bg-stone-50">
                  <TableRow><TableHead className="pl-6">Tipo</TableHead><TableHead className="text-right">Kg</TableHead><TableHead className="text-right">Cx</TableHead><TableHead className="text-right">Preço Médio</TableHead><TableHead className="text-right pr-6">Receita</TableHead></TableRow>
                </TableHeader>
                <TableBody>{aproveitamentoData.map((item) => (<TableRow key={item.name}><TableCell className="pl-6 font-medium">{item.name}</TableCell><TableCell className="text-right">{item.kg.toLocaleString('pt-BR')}</TableCell><TableCell className="text-right">{item.caixas}</TableCell><TableCell className="text-right">R$ {item.precoMedio.toFixed(2)}</TableCell><TableCell className="text-right pr-6 font-bold text-emerald-600">R$ {item.receita.toLocaleString('pt-BR')}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-stone-100 rounded-2xl shadow-sm">
              <CardHeader><CardTitle className="text-lg">Composição de Gastos</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieDataCustos} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                        {pieDataCustos.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="border-stone-100 rounded-2xl shadow-sm">
              <CardHeader><CardTitle className="text-lg">Custos por Talhão</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barDataCusto} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/><Tooltip/><Bar dataKey="valor" fill="#ef4444" radius={[0, 4, 4, 0]}/></BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-stone-100 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader><CardTitle className="text-lg">Detalhamento dos Custos</CardTitle></CardHeader>
            <Table>
              <TableHeader className="bg-stone-50">
                <TableRow>
                  <TableHead className="pl-6">Categoria / Atividade</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right pr-6">Participação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pieDataCustos.map((item, index) => (
                  <TableRow key={index} className="hover:bg-stone-50 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                        />
                        <span className="font-medium text-stone-700">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right pr-6 text-stone-500">
                      {custoTotal > 0 ? ((item.value / custoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="produtividade" className="space-y-6">
          <Card className="border-stone-100 rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Lucro por Hectare (KPI)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barDataLucroHa}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`}/><Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}/ha`}/><Bar dataKey="Lucro/ha" fill="#059669" radius={[4, 4, 0, 0]}/></BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-100 rounded-2xl shadow-sm overflow-hidden">
             <Table>
                <TableHeader className="bg-stone-50">
                  <TableRow><TableHead className="pl-6">Talhão</TableHead><TableHead className="text-right">Área</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo Total</TableHead><TableHead className="text-right">Lucro/Prejuízo</TableHead><TableHead className="text-right pr-6">Lucro/Ha</TableHead></TableRow>
                </TableHeader>
                <TableBody>{talhoesComDados.map((t) => (<TableRow key={t.id}><TableCell className="pl-6 font-medium">{t.nome}</TableCell><TableCell className="text-right">{t.area} ha</TableCell><TableCell className="text-right text-emerald-600">R$ {t.receita.toLocaleString('pt-BR')}</TableCell><TableCell className="text-right text-red-600">R$ {t.custo.toLocaleString('pt-BR')}</TableCell><TableCell className={`text-right font-bold ${t.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {t.lucro.toLocaleString('pt-BR')}</TableCell><TableCell className="text-right pr-6 font-bold text-emerald-700">R$ {t.lucroPorHa.toLocaleString('pt-BR')}</TableCell></TableRow>))}</TableBody>
             </Table>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao">
          <Card className="border-stone-100 rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Evolução Mensal (Receita vs Custos)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="mes"/><YAxis/><Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`}/><Legend/><Line type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={2} dot={{r: 4}}/><Line type="monotone" dataKey="custos" name="Custos" stroke="#ef4444" strokeWidth={2} dot={{r: 4}}/></LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}