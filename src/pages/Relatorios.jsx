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
  const atividadesFiltradas = filtrarPorTalhao(filtrarPorPeriodo(atividades, 'data_programada'));

  const totalColheitaKg = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
  const totalColheitaCaixas = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_caixas || 0), 0);
  const totalReceita = colheitasFiltradas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  
  const totalCustosFinanceiro = custosFiltrados.reduce((acc, c) => acc + (c.valor || 0), 0);
  const custoAtividades = atividadesFiltradas.reduce((acc, a) => acc + (a.custo_total || 0), 0);
  const custoTotal = totalCustosFinanceiro + custoAtividades;
  const lucro = totalReceita - custoTotal;

  const usarCaixas = totalColheitaKg < 1 && totalColheitaCaixas > 0;
  const unidadeVisual = usarCaixas ? 'cx' : 'ton';
  const totalVisual = usarCaixas ? totalColheitaCaixas : totalColheitaKg;

  const custoPorCategoria = {};

  custosFiltrados.forEach(c => {
    let catLabel = c.categoria ? (categoriaLabels[c.categoria]?.label || c.categoria) : 'Não categorizado';
    catLabel = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
    custoPorCategoria[catLabel] = (custoPorCategoria[catLabel] || 0) + (c.valor || 0);
  });

  atividadesFiltradas.forEach(a => {
    if (a.custo_total > 0) {
      let nomeAtividade = tipoAtividadeLabels[a.tipo] || a.tipo || 'Atividade Geral';
      
      if (a.tipo === 'outro' && a.tipo_personalizado) {
        nomeAtividade = a.tipo_personalizado;
      }
      if (!nomeAtividade) nomeAtividade = 'Atividade s/ Nome';
      
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

  const tipoColheitaLabels = {
    exportacao: 'Exportação',
    mercado_interno: 'Mercado Interno',
    caixas: 'Caixas',
    arrastao: 'Arrastão',
    polpa: 'Polpa',
    caixa_verde: 'Caixa Verde',
    madura: 'Madura'
  };

  const pieDataColheita = Object.entries(colheitaPorTipo)
    .map(([name, value]) => ({
      name: tipoColheitaLabels[name] || name,
      value
    }))
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
    precoMedio: usarCaixas 
      ? (data.caixas > 0 ? (data.receita / data.caixas) : 0)
      : (data.kg > 0 ? (data.receita / data.kg) : 0)
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
    mes,
    receita: data.receita,
    custos: data.custos
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

  
  // --- LÓGICA DA NOVA ABA: PRODUTIVIDADE ---
  const talhoesComDados = talhoes.map(talhao => {
    // 1. Receita e Custo
    const receitaTalhao = colheitas.filter(c => c.talhao_id === talhao.id).reduce((acc, c) => acc + (c.valor_total || 0), 0);
    const custoDirTalhao = custos.filter(c => c.talhao_id === talhao.id).reduce((acc, c) => acc + (c.valor || 0), 0);
    const custoAtivTalhao = atividades.filter(a => a.talhao_id === talhao.id).reduce((acc, a) => acc + (a.custo_total || 0), 0);
    
    const custoTotalTalhao = custoDirTalhao + custoAtivTalhao;
    const lucroTalhao = receitaTalhao - custoTotalTalhao;
    const area = talhao.area_hectares || 0;
    
    // 2. KPI: Lucro por Hectare
    const lucroPorHa = area > 0 ? (lucroTalhao / area) : 0;

    return {
      id: talhao.id,
      nome: talhao.nome,
      area: area,
      receita: receitaTalhao,
      custo: custoTotalTalhao,
      lucro: lucroTalhao,
      lucroPorHa: lucroPorHa
    };
  }).filter(t => t.receita > 0 || t.custo > 0); // Mostrar só talhões que tiveram atividade financeira

  const barDataLucroHa = talhoesComDados.map(t => ({
    name: t.nome,
    'Lucro/ha': t.lucroPorHa
  })).sort((a, b) => b['Lucro/ha'] - a['Lucro/ha']);


  const handlePrint = () => {
    const talhaoNome = filtroTalhao === 'todos' ? 'Todos os Talhões' : talhoes.find(t => t.id === filtroTalhao)?.nome || '';
    const periodoLabel = dataInicio && dataFim 
      ? `${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}`
      : dataInicio 
      ? `A partir de ${format(parseISO(dataInicio), 'dd/MM/yyyy')}`
      : dataFim
      ? `Até ${format(parseISO(dataFim), 'dd/MM/yyyy')}`
      : 'Período Completo';

    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Gerencial - Fazenda Cassiano's</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; }
          h1 { color: #065f46; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 5px; font-size: 22px; text-transform: uppercase; }
          .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
          
          .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f3f4f6; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .header-item strong { display: block; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .header-item span { font-size: 16px; font-weight: 600; color: #111; }

          .stats-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 40px; }
          .stat-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
          .stat-box.highlight { background-color: #ecfdf5; border-color: #10b981; }
          .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
          .stat-value { font-size: 16px; font-weight: bold; color: #111; }
          .text-green { color: #059669; }
          .text-red { color: #dc2626; }

          h2 { font-size: 16px; color: #374151; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #059669; padding-left: 10px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background-color: #f9fafb; text-align: left; padding: 10px; border-bottom: 2px solid #e5e7eb; color: #4b5563; font-weight: 600; text-transform: uppercase; font-size: 11px; }
          td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .text-right { text-align: right; }
          
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>Fazenda Cassiano's</h1>
        <div class="subtitle">Relatório Gerencial de Produção e Finanças</div>
        
        <div class="header-grid">
          <div class="header-item">
            <strong>Filtro de Talhão</strong>
            <span>${talhaoNome}</span>
          </div>
          <div class="header-item">
            <strong>Período Analisado</strong>
            <span>${periodoLabel}</span>
          </div>
        </div>

        <div class="stats-container">
          <div class="stat-box">
            <div class="stat-label">Colheita (Kg)</div>
            <div class="stat-value">${(totalColheitaKg / 1000).toFixed(1)} ton</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Colheita (Cx)</div>
            <div class="stat-value">${totalColheitaCaixas.toLocaleString('pt-BR')}</div>
          </div>
          <div class="stat-box highlight">
            <div class="stat-label">Receita Bruta</div>
            <div class="stat-value text-green">R$ ${totalReceita.toLocaleString('pt-BR')}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Custos Totais</div>
            <div class="stat-value text-red">R$ ${custoTotal.toLocaleString('pt-BR')}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Resultado</div>
            <div class="stat-value ${lucro >= 0 ? 'text-green' : 'text-red'}">R$ ${lucro.toLocaleString('pt-BR')}</div>
          </div>
        </div>

        <h2>Detalhamento por Atividade/Custo</h2>
        <table>
          <thead>
            <tr>
              <th>Categoria / Atividade</th>
              <th class="text-right">Valor Total</th>
              <th class="text-right">Participação</th>
            </tr>
          </thead>
          <tbody>
            ${pieDataCustos.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="text-right">R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">${custoTotal > 0 ? ((item.value / custoTotal) * 100).toFixed(1) : 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Custos por Talhão</h2>
        <table>
          <thead>
            <tr>
              <th>Talhão / Área</th>
              <th class="text-right">Custo Total</th>
            </tr>
          </thead>
          <tbody>
            ${barDataCusto.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="text-right">R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h2>Análise de Produtividade por Talhão (Lucro/ha)</h2>
        <table>
          <thead>
            <tr>
              <th>Talhão</th>
              <th class="text-right">Área (ha)</th>
              <th class="text-right">Receita Total</th>
              <th class="text-right">Custo Total</th>
              <th class="text-right">Lucro/Prejuízo</th>
              <th class="text-right">Lucro por Ha</th>
            </tr>
          </thead>
          <tbody>
            ${talhoesComDados.map(t => `
              <tr>
                <td>${t.nome}</td>
                <td class="text-right">${t.area.toFixed(2)}</td>
                <td class="text-right text-green">R$ ${t.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="text-right text-red">R$ ${t.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="text-right ${t.lucro >= 0 ? 'text-green' : 'text-red'}">R$ ${t.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="text-right ${t.lucroPorHa >= 0 ? 'text-green' : 'text-red'}">R$ ${t.lucroPorHa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Documento gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} pelo Sistema de Gestão Fazenda Cassiano's.
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
  };

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  return (
    <div className="space-y-6">
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
          <Button onClick={handlePrint} variant="outline" className="bg-white border-stone-300 hover:bg-stone-50 text-stone-700">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Colhido"
          value={`${(totalColheitaKg / 1000).toFixed(1)} ton`}
          icon={Wheat}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Total Caixas"
          value={`${totalColheitaCaixas.toLocaleString('pt-BR')} cx`}
          icon={Package}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
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

      <Tabs defaultValue="colheitas" className="space-y-6">
        <TabsList className="bg-stone-100">
          <TabsTrigger value="colheitas">Colheitas</TabsTrigger>
          <TabsTrigger value="aproveitamento">Aproveitamento</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="produtividade">Produtividade</TabsTrigger> {/* NOVA ABA */}
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
                      <Tooltip formatter={(value) => [`${value.toLocaleString('pt-BR')} ${unidadeVisual}`, 'Quantidade']} />
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
                      <TableHead className="text-right">Quantidade ({unidadeVisual})</TableHead>
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
                          {item.value.toLocaleString('pt-BR')} {unidadeVisual}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalVisual > 0 ? ((item.value / totalVisual) * 100).toFixed(1) : 0}%
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
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="receita" name="Receita (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Quantidade (kg)</TableHead>
                        <TableHead className="text-right">Qtd (Cx)</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Preço Médio/{unidadeVisual}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aproveitamentoData.map((item) => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.kg.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {item.caixas > 0 ? item.caixas.toLocaleString('pt-BR') : '-'}
                          </TableCell>
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
                <CardTitle className="text-lg">Custos por Categoria e Atividade</CardTitle>
              </CardHeader>
              <CardContent>
                {pieDataCustos.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieDataCustos}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {pieDataCustos.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor']} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-stone-400">
                    Nenhum custo registrado no período
                  </div>
                )}
              </CardContent>
            </Card>

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

            <Card className="border-stone-100 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Detalhamento dos Custos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-stone-50">
                        <TableHead>Categoria / Atividade</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Participação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pieDataCustos.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              {item.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">
                            {custoTotal > 0 ? ((item.value / custoTotal) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="produtividade" className="space-y-6"> {/* CONTEÚDO DA NOVA ABA */}
          <Card className="border-stone-100">
            <CardHeader>
              <CardTitle className="text-lg">Lucro por Hectare (KPI de Eficiência)</CardTitle>
            </CardHeader>
            <CardContent>
              {barDataLucroHa.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={barDataLucroHa} 
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Lucro/ha']}
                        labelFormatter={(name) => `Talhão: ${name}`}
                      />
                      <Legend />
                      <Bar 
                        dataKey="Lucro/ha" 
                        fill="#059669" 
                        radius={[4, 4, 0, 0]}
                        name="Lucro por Hectare"
                      />
                    </BarChart>
                  </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-stone-400">
                  Dados insuficientes para calcular produtividade (Verifique Receita/Custo/Área).
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-stone-100">
            <CardHeader>
              <CardTitle className="text-lg">Detalhe Financeiro por Talhão</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead>Talhão</TableHead>
                    <TableHead className="text-right">Área (ha)</TableHead>
                    <TableHead className="text-right">Receita Total</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="text-right">Lucro/Prejuízo</TableHead>
                    <TableHead className="text-right">Lucro por Ha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {talhoesComDados.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="text-right">{t.area.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        R$ {t.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        R$ {t.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${t.lucro >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        R$ {t.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${t.lucroPorHa >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        R$ {t.lucroPorHa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* FIM CONTEÚDO DA NOVA ABA */}

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
                      dot={{ r: 6, fill: '#10b981' }} 
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="custos" 
                      name="Custos" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ r: 6, fill: '#ef4444' }}
                      activeDot={{ r: 8 }}
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