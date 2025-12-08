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
import { Printer, Wheat, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function Relatorios() {
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

  // Filtro de período customizado com correção de data
  const filtrarPorPeriodo = (data, dateField) => {
    if (!data) return data;
    return data.filter(item => {
      if (!item[dateField]) return false;
      // Correção de fuso horário aqui
      const itemDate = new Date(item[dateField] + 'T12:00:00');
      
      // Datas dos inputs (já vêm como YYYY-MM-DD, parseISO funciona bem aqui pois queremos meia-noite)
      const dataInicioDate = dataInicio ? parseISO(dataInicio) : new Date(2020, 0, 1);
      const dataFimDate = dataFim ? parseISO(dataFim) : new Date(2040, 11, 31);
      
      // Ajuste para garantir que a comparação inclua o dia inteiro final
      dataFimDate.setHours(23, 59, 59);

      return isWithinInterval(itemDate, { start: dataInicioDate, end: dataFimDate });
    });
  };

  const filtrarPorTalhao = (data, talhaoField = 'talhao_id') => {
    if (filtroTalhao === 'todos') return data;
    return data.filter(item => item[talhaoField] === filtroTalhao);
  };

  // Dados filtrados
  const colheitasFiltradas = filtrarPorTalhao(filtrarPorPeriodo(colheitas, 'data'));
  const custosFiltrados = filtrarPorTalhao(filtrarPorPeriodo(custos, 'data'));
  const atividadesFiltradas = filtrarPorTalhao(filtrarPorPeriodo(atividades, 'data_programada'));

  // Estatísticas
  const totalColheitaKg = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
  const totalReceita = colheitasFiltradas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const totalCustos = custosFiltrados.reduce((acc, c) => acc + (c.valor || 0), 0);
  const custoAtividades = atividadesFiltradas.reduce((acc, a) => acc + (a.custo_total || 0), 0);
  const custoTotal = totalCustos + custoAtividades;
  const lucro = totalReceita - custoTotal;

  // Colheita por tipo
  const colheitaPorTipo = colheitasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'outros';
    acc[tipo] = (acc[tipo] || 0) + (c.quantidade_kg || 0);
    return acc;
  }, {});

  const tipoColheitaLabels = {
    exportacao: 'Exportação',
    mercado_interno: 'Mercado Interno',
    caixas: 'Caixas',
    arrastao: 'Arrastão',
    polpa: 'Polpa',
    caixa_verde: 'Caixa Verde',
    madura: 'Madura'
  };

  const pieDataColheita = Object.entries(colheitaPorTipo).map(([name, value]) => ({
    name: tipoColheitaLabels[name] || name,
    value
  }));

  // Aproveitamento por tipo (receita/kg)
  const aproveitamentoPorTipo = colheitasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo_colheita || 'outros';
    if (!acc[tipo]) acc[tipo] = { kg: 0, receita: 0 };
    acc[tipo].kg += c.quantidade_kg || 0;
    acc[tipo].receita += c.valor_total || 0;
    return acc;
  }, {});

  const aproveitamentoData = Object.entries(aproveitamentoPorTipo).map(([tipo, data]) => ({
    name: tipoColheitaLabels[tipo] || tipo,
    kg: data.kg,
    receita: data.receita,
    precoMedio: data.kg > 0 ? (data.receita / data.kg) : 0
  }));

  // Evolução mensal
  const evolucaoMensal = colheitas.reduce((acc, c) => {
    if (!c.data) return acc;
    // Correção de data
    const mes = format(new Date(c.data + 'T12:00:00'), 'MMM/yy', { locale: ptBR });
    if (!acc[mes]) acc[mes] = { receita: 0, custos: 0 };
    acc[mes].receita += c.valor_total || 0;
    return acc;
  }, {});

  custos.forEach(c => {
    if (!c.data) return;
    // Correção de data
    const mes = format(new Date(c.data + 'T12:00:00'), 'MMM/yy', { locale: ptBR });
    if (!evolucaoMensal[mes]) evolucaoMensal[mes] = { receita: 0, custos: 0 };
    evolucaoMensal[mes].custos += c.valor || 0;
  });

  const lineData = Object.entries(evolucaoMensal).slice(-12).map(([mes, data]) => ({
    mes,
    receita: data.receita,
    custos: data.custos
  }));

  // Custo por talhão
  const custoPorTalhao = custosFiltrados.reduce((acc, c) => {
    const talhaoNome = c.talhao_id ? (talhoes.find(t => t.id === c.talhao_id)?.nome || 'Desconhecido') : 'Geral';
    acc[talhaoNome] = (acc[talhaoNome] || 0) + (c.valor || 0);
    return acc;
  }, {});

  const barDataCusto = Object.entries(custoPorTalhao).map(([name, value]) => ({ name, valor: value }));

  // Função de impressão
  const handlePrint = () => {
    const talhaoNome = filtroTalhao === 'todos' ? 'Todos os Talhões' : talhoes.find(t => t.id === filtroTalhao)?.nome || '';
    const periodoLabel = dataInicio && dataFim 
      ? `${format(parseISO(dataInicio), 'dd/MM/yyyy')} - ${format(parseISO(dataFim), 'dd/MM/yyyy')}`
      : dataInicio 
      ? `A partir de ${format(parseISO(dataInicio), 'dd/MM/yyyy')}`
      : dataFim
      ? `Até ${format(parseISO(dataFim), 'dd/MM/yyyy')}`
      : 'Todo o período';

    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório - Fazenda Cassiano's</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
          h1 { color: #166534; border-bottom: 2px solid #166534; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 30px; }
          .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { padding: 15px; background: #f9fafb; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #166534; }
          .stat-label { font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f9fafb; font-weight: 600; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>FAZENDA CASSIANO'S</h1>
        <h2>Relatório de Produção e Financeiro</h2>
        
        <div class="header-info">
          <div><strong>Talhão:</strong> ${talhaoNome}</div>
          <div><strong>Período:</strong> ${periodoLabel}</div>
          <div><strong>Gerado em:</strong> ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
        </div>

        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${(totalColheitaKg / 1000).toFixed(1)} ton</div>
            <div class="stat-label">Total Colhido</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">R$ ${totalReceita.toLocaleString('pt-BR')}</div>
            <div class="stat-label">Receita Total</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">R$ ${custoTotal.toLocaleString('pt-BR')}</div>
            <div class="stat-label">Custos Totais</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: ${lucro >= 0 ? '#166534' : '#dc2626'}">R$ ${lucro.toLocaleString('pt-BR')}</div>
            <div class="stat-label">Lucro/Prejuízo</div>
          </div>
        </div>

        <h2>Colheitas por Tipo</h2>
        <table>
          <thead>
            <tr>
              <th>Tipo de Colheita</th>
              <th>Quantidade (kg)</th>
              <th>Receita</th>
              <th>Preço Médio/kg</th>
            </tr>
          </thead>
          <tbody>
            ${aproveitamentoData.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.kg.toLocaleString('pt-BR')}</td>
                <td>R$ ${item.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td>R$ ${item.precoMedio.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Custos por Categoria</h2>
        <table>
          <thead>
            <tr>
              <th>Talhão/Área</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${barDataCusto.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Sistema de Gestão - Fazenda Cassiano's</p>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Relatórios</h1>
          <p className="text-stone-500">Análise de produção, colheitas e financeiro</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Talhão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Talhões</SelectItem>
              {talhoes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-stone-600 whitespace-nowrap">De:</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              min="2020-01-01"
              max="2040-12-31"
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-stone-600 whitespace-nowrap">Até:</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              min="2020-01-01"
              max="2040-12-31"
              className="w-40"
            />
          </div>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Colhido"
          value={`${(totalColheitaKg / 1000).toFixed(1)} ton`}
          icon={Wheat}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Receita Total"
          value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Custos Totais"
          value={`R$ ${custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          title="Lucro/Prejuízo"
          value={`R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={BarChart3}
          iconBg={lucro >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={lucro >= 0 ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      {/* Tabs de relatórios */}
      <Tabs defaultValue="colheitas" className="space-y-6">
        <TabsList className="bg-stone-100">
          <TabsTrigger value="colheitas">Colheitas</TabsTrigger>
          <TabsTrigger value="aproveitamento">Aproveitamento</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="colheitas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-stone-100">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Tipo de Colheita</CardTitle>
              </CardHeader>
              <CardContent>
                {pieDataColheita.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieDataColheita}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {pieDataColheita.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${(value / 1000).toFixed(1)} ton`, 'Quantidade']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-stone-400">
                    Nenhuma colheita no período
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-stone-100">
              <CardHeader>
                <CardTitle className="text-lg">Detalhamento por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pieDataColheita.map((item, index) => (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {(item.value / 1000).toFixed(2)} ton
                        </TableCell>
                        <TableCell className="text-right">
                          {totalColheitaKg > 0 ? ((item.value / totalColheitaKg) * 100).toFixed(1) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aproveitamento" className="space-y-6">
          <Card className="border-stone-100">
            <CardHeader>
              <CardTitle className="text-lg">Aproveitamento por Tipo de Colheita</CardTitle>
            </CardHeader>
            <CardContent>
              {aproveitamentoData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={aproveitamentoData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke="#10b981" />
                      <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="receita" name="Receita (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="precoMedio" name="Preço Médio/kg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Quantidade (kg)</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Preço Médio/kg</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aproveitamentoData.map((item) => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.kg.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">
                            R$ {item.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {item.precoMedio.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <div className="h-72 flex items-center justify-center text-stone-400">
                  Nenhuma colheita no período
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-stone-100">
              <CardHeader>
                <CardTitle className="text-lg">Custos por Talhão/Área</CardTitle>
              </CardHeader>
              <CardContent>
                {barDataCusto.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barDataCusto} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Custo']} />
                      <Bar dataKey="valor" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-stone-400">
                    Nenhum custo no período
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-stone-100">
              <CardHeader>
                <CardTitle className="text-lg">Resumo de Custos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-stone-50 rounded-xl">
                    <p className="text-sm text-stone-500">Custos Diretos (Lançamentos)</p>
                    <p className="text-2xl font-bold text-stone-900">
                      R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-xl">
                    <p className="text-sm text-stone-500">Custos de Atividades</p>
                    <p className="text-2xl font-bold text-stone-900">
                      R$ {custoAtividades.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl">
                    <p className="text-sm text-red-600">Custo Total</p>
                    <p className="text-2xl font-bold text-red-600">
                      R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {totalColheitaKg > 0 && (
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-blue-600">Custo por kg Produzido</p>
                      <p className="text-2xl font-bold text-blue-600">
                        R$ {(custoTotal / totalColheitaKg).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evolucao" className="space-y-6">
          <Card className="border-stone-100">
            <CardHeader>
              <CardTitle className="text-lg">Evolução Mensal - Receita x Custos</CardTitle>
            </CardHeader>
            <CardContent>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, '']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="receita" 
                      name="Receita" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: '#10b981' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="custos" 
                      name="Custos" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ fill: '#ef4444' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-stone-400">
                  Dados insuficientes para exibir evolução
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}