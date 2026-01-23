import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Wheat, DollarSign, TrendingUp, BarChart3, Package, Filter, Calendar as CalendarIcon } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import PageSkeleton from '@/components/ui/PageSkeleton'; // NOVO
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
  inducao: 'Indução', poda: 'Poda', adubacao: 'Adubação', pulverizacao: 'Pulverização',
  maturacao: 'Maturação', irrigacao: 'Irrigação', capina: 'Capina', outro: 'Outra Atividade'
};

const tipoColheitaLabels = {
  exportacao: 'Exportação', mercado_interno: 'Mercado Interno', caixas: 'Caixas',
  arrastao: 'Arrastão', polpa: 'Polpa', caixa_verde: 'Caixa Verde', madura: 'Madura'
};

export default function Relatorios({ showMessage }) {
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { data: talhoes = [], isLoading: l1 } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; }
  });

  const { data: colheitas = [], isLoading: l2 } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => { const { data } = await supabase.from('colheitas').select('*').order('data', { ascending: false }); return data || []; }
  });

  const { data: custos = [], isLoading: l3 } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => { const { data } = await supabase.from('custos').select('*').order('data', { ascending: false }); return data || []; }
  });

  const { data: atividades = [], isLoading: l4 } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => { const { data } = await supabase.from('atividades').select('*'); return data || []; }
  });

  if (l1 || l2 || l3 || l4) return <PageSkeleton />;

  // --- LÓGICA DE DADOS (Preservada do original) ---
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

  const pieDataCustos = Object.entries(custoPorCategoria).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const colheitaPorTipo = colheitasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'outros';
    const valor = usarCaixas ? (c.quantidade_caixas || 0) : (c.quantidade_kg || 0);
    acc[tipo] = (acc[tipo] || 0) + valor;
    return acc;
  }, {});

  const pieDataColheita = Object.entries(colheitaPorTipo).map(([name, value]) => ({ name: tipoColheitaLabels[name] || name, value })).filter(item => item.value > 0);

  const aproveitamentoPorTipo = colheitasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'outros';
    if (!acc[tipo]) acc[tipo] = { kg: 0, caixas: 0, receita: 0 };
    acc[tipo].kg += c.quantidade_kg || 0;
    acc[tipo].caixas += c.quantidade_caixas || 0;
    acc[tipo].receita += c.valor_total || 0;
    return acc;
  }, {});

  const aproveitamentoData = Object.entries(aproveitamentoPorTipo).map(([tipo, data]) => ({
    name: tipoColheitaLabels[tipo] || tipo, kg: data.kg, caixas: data.caixas, receita: data.receita,
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

  const lineData = Object.entries(evolucaoMensal).slice(-12).map(([mes, data]) => ({ mes, receita: data.receita, custos: data.custos }));

  // --- RATEIO ---
  const areaTotalFazenda = talhoes.reduce((acc, t) => acc + (Number(t.area_hectares) || 0), 0);
  const custosGeraisPeriodo = filtrarPorPeriodo(custos, 'data').filter(c => !c.talhao_id).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const rateioPorHa = areaTotalFazenda > 0 ? custosGeraisPeriodo / areaTotalFazenda : 0;

  const talhoesComDados = talhoes.map(talhao => {
    const receitaTalhao = colheitas.filter(c => c.talhao_id === talhao.id).reduce((acc, c) => acc + (c.valor_total || 0), 0);
    const custoDirTalhao = custos.filter(c => c.talhao_id === talhao.id).reduce((acc, c) => acc + (c.valor || 0), 0);
    const custoAtivTalhao = atividades.filter(a => a.talhao_id === talhao.id && a.status === 'concluida').reduce((acc, a) => acc + (a.custo_total || 0), 0);
    const custoInsumos = custoDirTalhao + custoAtivTalhao;
    const area = Number(talhao.area_hectares) || 0;
    const custoRateio = area * rateioPorHa;
    const custoTotalTalhao = custoInsumos + custoRateio;
    const lucroTalhao = receitaTalhao - custoTotalTalhao;
    const lucroPorHa = area > 0 ? (lucroTalhao / area) : 0;

    return { 
        id: talhao.id, nome: talhao.nome, area, 
        receita: receitaTalhao, custoInsumos, custoRateio, 
        custo: custoTotalTalhao, lucro: lucroTalhao, lucroPorHa 
    };
  }).filter(t => t.receita > 0 || t.custoInsumos > 0 || t.custoRateio > 0);

  const barDataLucroHa = talhoesComDados.map(t => ({ name: t.nome, 'Lucro/ha': t.lucroPorHa })).sort((a, b) => b['Lucro/ha'] - a['Lucro/ha']);

  const totaisGeraisProdutividade = talhoesComDados.reduce((acc, t) => ({
    area: acc.area + t.area, receita: acc.receita + t.receita,
    custoInsumos: acc.custoInsumos + t.custoInsumos, custoRateio: acc.custoRateio + t.custoRateio,
    lucro: acc.lucro + t.lucro,
  }), { area: 0, receita: 0, custoInsumos: 0, custoRateio: 0, lucro: 0 });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Relatórios Gerenciais</h1>
          <p className="text-stone-500 font-medium">Visão estratégica e análise de resultados</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl border border-stone-200">
             <Filter className="w-4 h-4 text-stone-400 ml-2" />
             <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
                <SelectTrigger className="w-40 border-none bg-transparent shadow-none h-8 font-medium text-stone-700"><SelectValue placeholder="Talhão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Talhões</SelectItem>
                  {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
          </div>
          <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl border border-stone-200">
             <CalendarIcon className="w-4 h-4 text-stone-400 ml-2" />
             <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-32 border-none bg-transparent shadow-none h-8 p-0 text-sm font-medium text-stone-700" />
             <span className="text-stone-400">-</span>
             <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-32 border-none bg-transparent shadow-none h-8 p-0 text-sm font-medium text-stone-700" />
          </div>
          <Button onClick={() => window.print()} variant="outline" className="rounded-xl border-stone-200 text-stone-600 hover:bg-stone-50 h-10 active:scale-95 transition-all">
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Colhido" value={`${totalVisual.toFixed(1)} ${unidadeVisual}`} icon={Wheat} color="text-amber-600" />
        <StatCard title="Receita Total" value={`R$ ${totalReceita.toLocaleString('pt-BR')}`} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title="Custos Totais" value={`R$ ${custoTotal.toLocaleString('pt-BR')}`} icon={DollarSign} color="text-red-600" />
        <StatCard title="Lucro/Prejuízo" value={`R$ ${lucro.toLocaleString('pt-BR')}`} icon={BarChart3} color={lucro >= 0 ? "text-emerald-600" : "text-red-600"} />
        <StatCard title="Margem" value={`${totalReceita > 0 ? ((lucro/totalReceita)*100).toFixed(1) : 0}%`} icon={Package} color="text-blue-600" />
      </div>

      <Tabs defaultValue="colheitas" className="space-y-6">
        <TabsList className="bg-white border border-stone-100 p-1.5 rounded-[1rem] shadow-sm w-full lg:w-auto flex flex-wrap h-auto">
          <TabsTrigger value="colheitas" className="rounded-xl px-4 py-2 data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 font-bold transition-all">Colheitas</TabsTrigger>
          <TabsTrigger value="aproveitamento" className="rounded-xl px-4 py-2 data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 font-bold transition-all">Aproveitamento</TabsTrigger>
          <TabsTrigger value="custos" className="rounded-xl px-4 py-2 data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 font-bold transition-all">Custos</TabsTrigger>
          <TabsTrigger value="produtividade" className="rounded-xl px-4 py-2 data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 font-bold transition-all">Produtividade</TabsTrigger>
          <TabsTrigger value="evolucao" className="rounded-xl px-4 py-2 data-[state=active]:bg-stone-100 data-[state=active]:text-stone-900 font-bold transition-all">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="colheitas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 border-stone-100 rounded-[2rem] shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Por Tipo</CardTitle></CardHeader>
                  <CardContent className="flex items-center justify-center p-0 pb-6">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieDataColheita} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {pieDataColheita.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '16px', border: '1px solid rgba(231, 229, 228, 0.5)', padding: '12px' }} />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2 border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
                  <CardHeader><CardTitle className="text-lg">Detalhamento de Produção</CardTitle></CardHeader>
                  <Table>
                    <TableHeader className="bg-stone-50/50">
                      <TableRow><TableHead className="pl-6">Tipo de Colheita</TableHead><TableHead className="text-right pr-6">Quantidade ({unidadeVisual})</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>{pieDataColheita.map((item) => (<TableRow key={item.name}><TableCell className="pl-6 font-medium">{item.name}</TableCell><TableCell className="text-right pr-6 font-bold text-stone-700">{item.value.toLocaleString('pt-BR')}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="aproveitamento">
          <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
            <CardHeader><CardTitle>Análise de Aproveitamento</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aproveitamentoData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '16px' }} />
                      <Bar dataKey="receita" name="Receita (R$)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={60} />
                  </BarChart>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-stone-100 rounded-[2rem] shadow-sm">
              <CardHeader><CardTitle className="text-lg">Composição</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieDataCustos} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                        {pieDataCustos.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '16px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {pieDataCustos.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-stone-600 truncate max-w-[120px]" title={item.name}>{item.name}</span>
                            </div>
                            <span className="font-bold text-stone-700">{(item.value/custoTotal * 100).toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2 border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
              <CardHeader><CardTitle className="text-lg">Detalhamento dos Custos</CardTitle></CardHeader>
              <Table>
                <TableHeader className="bg-stone-50">
                  <TableRow>
                    <TableHead className="pl-6">Categoria</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right pr-6">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pieDataCustos.map((item, index) => (
                    <TableRow key={index} className="hover:bg-stone-50">
                      <TableCell className="pl-6 font-medium text-stone-700">{item.name}</TableCell>
                      <TableCell className="text-right font-bold text-stone-800">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right pr-6 text-stone-500">{custoTotal > 0 ? ((item.value / custoTotal) * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="produtividade" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
              <Card className="border-stone-100 rounded-[2rem] shadow-sm">
                <CardHeader><CardTitle className="text-lg">KPI: Lucro por Hectare</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barDataLucroHa} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(v) => `R$${v/1000}k`} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '16px' }} formatter={(v) => [`R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Lucro/ha']} />
                          <Bar dataKey="Lucro/ha" radius={[6, 6, 0, 0]}>
                            {barDataLucroHa.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry['Lucro/ha'] >= 0 ? '#10b981' : '#ef4444'} />
                            ))}
                          </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
                  <CardHeader><CardTitle>Demonstrativo de Resultados por Talhão</CardTitle></CardHeader>
                  <Table>
                    <TableHeader className="bg-stone-50">
                      <TableRow>
                        <TableHead className="pl-6">Talhão</TableHead>
                        <TableHead className="text-right">Área</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Custo Insumos</TableHead>
                        <TableHead className="text-right text-purple-600">Rateio Geral</TableHead>
                        <TableHead className="text-right font-bold">Lucro/Prejuízo</TableHead>
                        <TableHead className="text-right pr-6">Lucro/Ha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {talhoesComDados.map((t) => (
                      <TableRow key={t.id} className="hover:bg-stone-50">
                        <TableCell className="pl-6 font-medium">{t.nome}</TableCell>
                        <TableCell className="text-right">{t.area} ha</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">R$ {t.receita.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right text-stone-600">R$ {t.custoInsumos.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right text-purple-600">R$ {t.custoRateio.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</TableCell>
                        <TableCell className={`text-right font-bold ${t.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {t.lucro.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className={`text-right pr-6 font-bold ${t.lucroPorHa >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            R$ {t.lucroPorHa.toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {talhoesComDados.length > 0 && (
                        <TableRow className="bg-stone-100 font-bold border-t-2 border-stone-200">
                            <TableCell className="pl-6">TOTAL GERAL</TableCell>
                            <TableCell className="text-right">{totaisGeraisProdutividade.area.toFixed(2)} ha</TableCell>
                            <TableCell className="text-right text-emerald-700">R$ {totaisGeraisProdutividade.receita.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right text-stone-700">R$ {totaisGeraisProdutividade.custoInsumos.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right text-purple-700">R$ {totaisGeraisProdutividade.custoRateio.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className={`text-right ${totaisGeraisProdutividade.lucro >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>R$ {totaisGeraisProdutividade.lucro.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right pr-6">-</TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                  </Table>
              </Card>
          </div>
        </TabsContent>

        <TabsContent value="evolucao">
          <Card className="border-stone-100 rounded-[2rem] shadow-sm">
            <CardHeader><CardTitle className="text-lg">Fluxo de Caixa Mensal</CardTitle></CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} dy={10} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '16px' }} formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                      <Legend verticalAlign="top" height={36}/>
                      <Line type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 6}} />
                      <Line type="monotone" dataKey="custos" name="Custos" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}