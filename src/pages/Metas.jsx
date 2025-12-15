import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Map, Edit, Trash2, Filter, DollarSign, Wheat } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format, isWithinInterval, parseISO } from 'date-fns';

// Constantes úteis
const STATUS_OK = 'ok';
const STATUS_CUSTO_ALTO = 'acima_meta';
const STATUS_PROD_BAIXA = 'abaixo_meta';

// Função auxiliar de data para somar 1 dia ao date objects de Colheitas e Custos
const addOneDay = (dateString) => {
    const d = new Date(dateString + 'T12:00:00'); // Garante que a hora seja fixa para evitar problemas de fuso
    return d;
};

export default function Metas() {
  const [open, setOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState(null);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear().toString()); 
  
  const [formData, setFormData] = useState({
    ano: new Date().getFullYear().toString(),
    talhao_id: '',
    data_inicio_ciclo: format(new Date(), 'yyyy-MM-dd'), // NOVO: Data de Início do Ciclo de Custos
    data_fim_ciclo: '', // NOVO: Data de Fim do Ciclo (Meta Colheita)
    meta_custo_por_ha: '',
    meta_producao_ton_por_ha: '',
  });

  const queryClient = useQueryClient();
  const anoAtual = new Date().getFullYear().toString();

  // 1. Fetch de Dados Estáticos
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('id, nome, area_hectares');
      if (error) throw error;
      return data;
    }
  });

  // 2. Fetch das Metas Cadastradas
  const { data: metas = [] } = useQuery({
    queryKey: ['metas_talhoes'],
    queryFn: async () => {
        // Buscamos colunas específicas. Adicione as novas colunas aqui:
      const { data, error } = await supabase.from('metas_talhoes').select('*, talhao:talhoes(nome)').order('ano', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 3. Fetch de Todos os Custos e Colheitas (dados brutos para calcular o ciclo)
  const { data: dadosBrutos = {} } = useQuery({
    queryKey: ['dados_brutos'],
    queryFn: async () => {
      const [colheitasRes, custosRes, atividadesRes] = await Promise.all([
        supabase.from('colheitas').select('talhao_id, valor_total, quantidade_kg, data'),
        supabase.from('custos').select('talhao_id, valor, data'),
        supabase.from('atividades').select('talhao_id, custo_total, data_programada'),
      ]);
      
      return {
          colheitas: colheitasRes.data || [],
          custos: custosRes.data || [],
          atividades: atividadesRes.data || []
      };
    },
    refetchInterval: 60000 
  });

  // 4. Mutações (CRUD)

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('metas_talhoes').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas_talhoes'] });
      setAnoFiltro(formData.ano); 
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('metas_talhoes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas_talhoes'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('metas_talhoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas_talhoes'] });
    }
  });

  // 5. Funções de Controle

  const resetForm = () => {
    setFormData({
      ano: anoAtual,
      talhao_id: '',
      data_inicio_ciclo: format(new Date(), 'yyyy-MM-dd'),
      data_fim_ciclo: '',
      meta_custo_por_ha: '',
      meta_producao_ton_por_ha: '',
    });
    setEditingMeta(null);
    setOpen(false);
  };
  
  const handleEdit = (meta) => {
    setEditingMeta(meta);
    setFormData({
      ano: meta.ano.toString() || anoAtual,
      talhao_id: meta.talhao_id || '',
      data_inicio_ciclo: meta.data_inicio_ciclo || format(new Date(), 'yyyy-MM-dd'),
      data_fim_ciclo: meta.data_fim_ciclo || '',
      meta_custo_por_ha: meta.meta_custo_por_ha || '',
      meta_producao_ton_por_ha: meta.meta_producao_ton_por_ha || '',
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Objeto de dados para o Supabase (remove campos temporários se houver)
    const data = {
      ano: parseInt(formData.ano),
      talhao_id: formData.talhao_id,
      data_inicio_ciclo: formData.data_inicio_ciclo,
      data_fim_ciclo: formData.data_fim_ciclo,
      meta_custo_por_ha: parseFloat(formData.meta_custo_por_ha) || 0,
      meta_producao_ton_por_ha: parseFloat(formData.meta_producao_ton_por_ha) || 0,
    };

    // Validação básica para ciclo
    if (!data.data_inicio_ciclo || !data.data_fim_ciclo) {
        alert("Por favor, defina a Data de Início e Fim do Ciclo.");
        return;
    }

    if (editingMeta) {
        updateMutation.mutate({ id: editingMeta.id, data });
    } else {
        createMutation.mutate(data);
    }
  };

  // --- LÓGICA DO DESEMPENHO BASEADO EM DATAS ---
  
  // Agrupar metas pelo ano para o filtro
  const metasFiltradas = metas.filter(m => m.ano.toString() === anoFiltro);

  const desempenhoDetalhado = metasFiltradas
    .map(meta => {
      const talhao = talhoes.find(t => t.id === meta.talhao_id);
      if (!talhao || talhao.area_hectares === 0) return null;
      
      const area = talhao.area_hectares || 0;
      const inicio = meta.data_inicio_ciclo;
      const fim = meta.data_fim_ciclo;
      
      if (!inicio || !fim) return null; // Ignora metas sem ciclo completo

      const intervalo = { start: addOneDay(inicio), end: addOneDay(fim) };
      
      // 1. CÁLCULO DE CUSTO REALIZADO
      let custoTotal = 0;
      const custosIntervalo = [...dadosBrutos.custos, ...dadosBrutos.atividades]
        .filter(item => item.talhao_id === meta.talhao_id)
        .filter(item => {
            const dataCusto = item.data || item.data_programada;
            if (!dataCusto) return false;
            return isWithinInterval(addOneDay(dataCusto), intervalo);
        });
      
      custoTotal = custosIntervalo.reduce((acc, c) => acc + (c.valor || c.custo_total || 0), 0);
      const custoAtualPorHa = custoTotal / area;
      
      // 2. CÁLCULO DE PRODUÇÃO REALIZADA
      let producaoKg = 0;
      const colheitasIntervalo = dadosBrutos.colheitas
        .filter(item => item.talhao_id === meta.talhao_id)
        .filter(item => {
            if (!item.data) return false;
            return isWithinInterval(addOneDay(item.data), intervalo);
        });
        
      producaoKg = colheitasIntervalo.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
      const producaoAtualTonPorHa = (producaoKg / 1000) / area;
      
      // 3. Status
      const temDadosCusto = custoTotal > 0;
      const temDadosProducao = producaoKg > 0;

      let custoStatus = STATUS_OK;
      if (meta.meta_custo_por_ha > 0 && temDadosCusto && custoAtualPorHa > meta.meta_custo_por_ha) {
         custoStatus = STATUS_CUSTO_ALTO;
      }

      let producaoStatus = STATUS_OK;
      if (meta.meta_producao_ton_por_ha > 0 && temDadosProducao && producaoAtualTonPorHa < meta.meta_producao_ton_por_ha) {
        producaoStatus = STATUS_PROD_BAIXA;
      }

      return {
        ...talhao,
        meta,
        custoAtualPorHa,
        producaoAtualTonPorHa,
        custoStatus,
        producaoStatus,
        temDadosCusto,
        temDadosProducao,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
        if (a.custoStatus === STATUS_CUSTO_ALTO || a.producaoStatus === STATUS_PROD_BAIXA) return -1;
        if (b.custoStatus === STATUS_CUSTO_ALTO || b.producaoStatus === STATUS_PROD_BAIXA) return 1;
        return 0;
    });

  const totalAlertas = desempenhoDetalhado.filter(d => d.custoStatus !== STATUS_OK || d.producaoStatus !== STATUS_OK).length;
  const totalMetasCadastradas = metasFiltradas.length;
  
  // Anos disponíveis para o filtro
  const anosDisponiveis = [...new Set(metas.map(m => m.ano.toString()))].sort((a, b) => parseInt(b) - parseInt(a));
  if (!anosDisponiveis.includes(anoAtual)) anosDisponiveis.unshift(anoAtual);

  // Use useEffect para garantir que o filtro inicial seja o ano mais recente
  useEffect(() => {
    if (metas.length > 0) {
      const anosMetas = [...new Set(metas.map(m => m.ano.toString()))].sort((a, b) => parseInt(b) - parseInt(a));
      if (anosMetas.length > 0 && anosMetas[0] !== anoFiltro) {
          setAnoFiltro(anosMetas[0]);
      }
    }
  }, [metas]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Metas de Produtividade</h1>
          <p className="text-stone-500">Acompanhe KPIs (Key Performance Indicators) por ciclo de produção.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-fuchsia-600 hover:bg-fuchsia-700">
              <Plus className="w-4 h-4 mr-2" />
              Definir Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingMeta ? 'Editar Meta' : 'Definir Meta de Desempenho'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-semibold text-stone-700 pt-2 border-b pb-2">Definição do Ciclo</h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ano da Meta</Label>
                  <Input
                    type="number"
                    value={formData.ano}
                    onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                    required
                    disabled={!!editingMeta} 
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Talhão</Label>
                  <Select
                    value={formData.talhao_id}
                    onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}
                    required
                    disabled={!!editingMeta} 
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o Talhão" />
                    </SelectTrigger>
                    <SelectContent>
                      {talhoes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome} ({t.area_hectares} ha)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="p-4 bg-stone-50 rounded-xl space-y-3">
                <Label className="text-sm font-semibold text-stone-700">Período de Análise (Ciclo)</Label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs">Data Início do Ciclo (Custo Base)</Label>
                        <Input
                            type="date"
                            value={formData.data_inicio_ciclo}
                            onChange={(e) => setFormData({ ...formData, data_inicio_ciclo: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Data Fim do Ciclo (Meta Colheita)</Label>
                        <Input
                            type="date"
                            value={formData.data_fim_ciclo}
                            onChange={(e) => setFormData({ ...formData, data_fim_ciclo: e.target.value })}
                            required
                        />
                    </div>
                </div>
                <p className="text-xs text-stone-500">O sistema somará CUSTOS e PRODUÇÃO entre essas duas datas para o monitoramento.</p>
              </div>

              <h3 className="font-semibold text-stone-700 pt-2 border-b pb-2">Metas Quantitativas</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Meta Custo por Ha (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.meta_custo_por_ha}
                    onChange={(e) => setFormData({ ...formData, meta_custo_por_ha: e.target.value })}
                    placeholder="Ex: 500"
                  />
                  <p className="text-xs text-stone-500 flex items-center gap-1">
                      <DollarSign className='w-3 h-3 text-red-500' />
                      Custo por hectare esperado para este ciclo.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Meta Produção por Ha (ton)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.meta_producao_ton_por_ha}
                    onChange={(e) => setFormData({ ...formData, meta_producao_ton_por_ha: e.target.value })}
                    placeholder="Ex: 30"
                  />
                  <p className="text-xs text-stone-500">Mínimo de toneladas/hectare esperado na colheita.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-fuchsia-600 hover:bg-fuchsia-700"
                  disabled={createMutation.isPending || updateMutation.isPending || !formData.talhao_id || !formData.data_inicio_ciclo || !formData.data_fim_ciclo || (!formData.meta_custo_por_ha && !formData.meta_producao_ton_por_ha)}
                >
                  {editingMeta ? 'Salvar Edição' : 'Salvar Meta'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* FILTRO DE ANO */}
      <Card className="border-stone-100">
        <CardContent className="pt-4">
            <div className="flex items-center gap-4">
                <Filter className="w-4 h-4 text-stone-400" />
                <Label className="text-sm font-medium text-stone-600">Visualizar Metas do Ano (Referência):</Label>
                <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder={anoAtual} />
                    </SelectTrigger>
                    <SelectContent>
                        {anosDisponiveis.map(ano => (
                            <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="text-sm text-stone-500 ml-4 p-2 bg-blue-50/50 rounded-lg">
                    As metas são calculadas usando o **Intervalo de Datas** de cada ciclo definido.
                </div>
            </div>
        </CardContent>
      </Card>
      
      {/* Stats e Alertas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={`Metas Cadastradas (${anoFiltro})`}
          value={totalMetasCadastradas}
          subtitle={`${talhoes.length} talhões cadastrados`}
          icon={Target}
          iconBg="bg-fuchsia-50"
          iconColor="text-fuchsia-600"
        />
        <StatCard
          title="Total de Alertas"
          value={totalAlertas}
          subtitle="Ciclos não atingidos"
          icon={AlertTriangle}
          iconBg={totalAlertas > 0 ? "bg-red-50" : "bg-emerald-50"}
          iconColor={totalAlertas > 0 ? "text-red-600" : "text-emerald-600"}
        />
        <StatCard
          title="Ciclos com Desempenho OK"
          value={desempenhoDetalhado.length - totalAlertas}
          subtitle="Metas de custo e produção dentro do esperado"
          icon={CheckCircle}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Tabela de Desempenho Cruzado */}
      {desempenhoDetalhado.length === 0 && totalMetasCadastradas > 0 ? (
        <EmptyState
          icon={Target}
          title={`Nenhuma meta definida para ${anoFiltro}`}
          description="Defina metas de custo e produção por hectare para o ano selecionado para começar a monitorar a eficiência."
          actionLabel="Definir Meta Agora"
          onAction={() => setOpen(true)}
        />
      ) : desempenhoDetalhado.length === 0 && totalMetasCadastradas === 0 && anoFiltro === anoAtual ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta definida"
          description={`Defina metas para ${anoAtual} ou selecione um ano com metas cadastradas.`}
          actionLabel="Definir Meta Agora"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card className="border-stone-100 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-stone-800">
                Monitoramento de Desempenho vs. Metas ({anoFiltro})
            </CardTitle>
            <p className="text-sm text-stone-500">
                Análise baseada nos intervalos de ciclo definidos para cada meta.
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead>Talhão</TableHead>
                  <TableHead>Ciclo (Data)</TableHead>
                  <TableHead className="text-right">Meta Custo/ha</TableHead>
                  <TableHead className="text-right">Custo Atual/ha</TableHead>
                  <TableHead>Status Custo</TableHead>
                  <TableHead className="text-right">Meta Prod./ha (ton)</TableHead>
                  <TableHead className="text-right">Produção Atual/ha (ton)</TableHead>
                  <TableHead>Status Produção</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desempenhoDetalhado.map((d) => (
                  <TableRow key={d.id} className={d.custoStatus === STATUS_CUSTO_ALTO || d.producaoStatus === STATUS_PROD_BAIXA ? 'bg-red-50 hover:bg-red-100/50' : 'hover:bg-emerald-50/50'}>
                    <TableCell className="font-bold flex items-center gap-2">
                        <Map className="w-4 h-4 text-stone-400" />
                        {d.nome}
                    </TableCell>

                    <TableCell className="text-xs text-stone-600 font-medium whitespace-nowrap">
                        {d.meta.data_inicio_ciclo ? format(addOneDay(d.meta.data_inicio_ciclo), 'dd/MM/yyyy') : 'N/A'} - {d.meta.data_fim_ciclo ? format(addOneDay(d.meta.data_fim_ciclo), 'dd/MM/yyyy') : 'N/A'}
                    </TableCell>
                    
                    {/* Custo/Ha */}
                    <TableCell className="text-right text-stone-700">
                      {d.meta ? `R$ ${d.meta.meta_custo_por_ha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {d.temDadosCusto ? `R$ ${d.custoAtualPorHa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : <span className="text-stone-400 italic">Sem Dados</span>}
                    </TableCell>
                    <TableCell>
                      {d.meta && d.temDadosCusto ? <StatusBadge type="custo" status={d.custoStatus} /> : (d.meta) ? <span className="text-xs text-stone-500 italic">Aguardando Custo</span> : <span className="text-xs text-stone-400 italic">Sem Meta</span>}
                    </TableCell>
                    
                    {/* Produção/Ha */}
                    <TableCell className="text-right text-stone-700">
                      {d.meta ? `${d.meta.meta_producao_ton_por_ha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {d.temDadosProducao ? `${d.producaoAtualTonPorHa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton` : <span className="text-stone-400 italic">Sem Dados</span>}
                    </TableCell>
                    <TableCell>
                       {d.meta && d.temDadosProducao ? <StatusBadge type="producao" status={d.producaoStatus} /> : (d.meta) ? <span className="text-xs text-stone-500 italic">Aguardando Prod.</span> : <span className="text-xs text-stone-400 italic">Sem Meta</span>}
                    </TableCell>
                    
                    {/* Ações */}
                    <TableCell>
                        <div className="flex items-center justify-end gap-1">
                            {d.meta && (
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEdit(d.meta)}
                                    title="Editar Meta"
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                            )}
                            {d.meta && (
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => deleteMutation.mutate(d.meta.id)}
                                    title="Excluir Meta"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

const StatusBadge = ({ type, status }) => {
    let icon = null;
    let label = '';
    let color = '';

    if (type === 'custo') {
        if (status === STATUS_CUSTO_ALTO) {
            icon = <TrendingUp className="w-4 h-4" />;
            label = 'Custo Alto';
            color = 'bg-red-100 text-red-700';
        } else if (status === STATUS_OK) {
            icon = <CheckCircle className="w-4 h-4" />;
            label = 'OK';
            color = 'bg-emerald-100 text-emerald-700';
        }
    } else if (type === 'producao') {
        if (status === STATUS_PROD_BAIXA) {
            icon = <TrendingDown className="w-4 h-4" />;
            label = 'Prod. Baixa';
            color = 'bg-amber-100 text-amber-700';
        } else if (status === STATUS_OK) {
            icon = <CheckCircle className="w-4 h-4" />;
            label = 'OK';
            color = 'bg-emerald-100 text-emerald-700';
        }
    }
    
    return (
        <div className={`flex items-center gap-1.5 p-1.5 rounded-full text-xs font-semibold shrink-0 ${color}`}>
            {icon}
            {label}
        </div>
    );
}