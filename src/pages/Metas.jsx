import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Map, Edit, Trash2, Filter } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format, isWithinInterval } from 'date-fns';

const STATUS_OK = 'ok';
const STATUS_CUSTO_ALTO = 'acima_meta';
const STATUS_PROD_BAIXA = 'abaixo_meta';

export default function Metas() {
  const queryClient = useQueryClient();
  const anoAtualStr = new Date().getFullYear().toString();

  // Estados
  const [open, setOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState(null);
  const [anoFiltro, setAnoFiltro] = useState(anoAtualStr);
  const [formData, setFormData] = useState({
    ano: anoAtualStr,
    talhao_id: '',
    data_inicio_ciclo: format(new Date(), 'yyyy-MM-dd'),
    data_fim_ciclo: '',
    meta_custo_por_ha: '',
    meta_producao_ton_por_ha: '',
  });

  // Queries
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('id, nome, area_hectares');
      if (error) throw error;
      return data;
    }
  });

  const { data: metas = [] } = useQuery({
    queryKey: ['metas_talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('metas_talhoes').select('*, talhao:talhoes(nome)').order('ano', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: dadosBrutos = { colheitas: [], custos: [], atividades: [] } } = useQuery({
    queryKey: ['dados_brutos'],
    queryFn: async () => {
      const [col, cus, ati] = await Promise.all([
        supabase.from('colheitas').select('*'),
        supabase.from('custos').select('*'),
        supabase.from('atividades').select('*')
      ]);
      return { colheitas: col.data || [], custos: cus.data || [], atividades: ati.data || [] };
    }
  });

  // Mutações
  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editingMeta) {
        const { error } = await supabase.from('metas_talhoes').update(payload).eq('id', editingMeta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('metas_talhoes').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas_talhoes'] });
      setOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('metas_talhoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metas_talhoes'] })
  });

  // Handlers
  const resetForm = () => {
    setFormData({
      ano: anoAtualStr,
      talhao_id: '',
      data_inicio_ciclo: format(new Date(), 'yyyy-MM-dd'),
      data_fim_ciclo: '',
      meta_custo_por_ha: '',
      meta_producao_ton_por_ha: '',
    });
    setEditingMeta(null);
  };

  const handleEdit = (meta) => {
    setEditingMeta(meta);
    setFormData({
      ano: meta.ano?.toString() || anoAtualStr,
      talhao_id: meta.talhao_id || '',
      data_inicio_ciclo: meta.data_inicio_ciclo || '',
      data_fim_ciclo: meta.data_fim_ciclo || '',
      meta_custo_por_ha: meta.meta_custo_por_ha?.toString() || '',
      meta_producao_ton_por_ha: meta.meta_producao_ton_por_ha?.toString() || '',
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // CONSTRUÇÃO DO PAYLOAD LIMPO (Apenas colunas que existem no banco)
    const payload = {
      ano: parseInt(formData.ano),
      talhao_id: formData.talhao_id,
      data_inicio_ciclo: formData.data_inicio_ciclo || null,
      data_fim_ciclo: formData.data_fim_ciclo || null,
      meta_custo_por_ha: Number(formData.meta_custo_por_ha) || 0,
      meta_producao_ton_por_ha: Number(formData.meta_producao_ton_por_ha) || 0
    };

    mutation.mutate(payload);
  };

  // Cálculos de interface
  const addOneDay = (dateStr) => dateStr ? new Date(dateStr + 'T12:00:00') : null;
  const metasFiltradas = metas.filter(m => m.ano?.toString() === anoFiltro);
  const anosDisponiveis = [...new Set(metas.map(m => m.ano?.toString()))].sort((a,b) => b-a);
  if (!anosDisponiveis.includes(anoAtualStr)) anosDisponiveis.push(anoAtualStr);

  const desempenhoDetalhado = metasFiltradas.map(meta => {
    const talhao = talhoes.find(t => t.id === meta.talhao_id);
    if (!talhao || !meta.data_inicio_ciclo || !meta.data_fim_ciclo) return null;
    
    const area = talhao.area_hectares || 1;
    const intervalo = { start: addOneDay(meta.data_inicio_ciclo), end: addOneDay(meta.data_fim_ciclo) };
    
    const custo = [...dadosBrutos.custos, ...dadosBrutos.atividades]
      .filter(i => i.talhao_id === meta.talhao_id && isWithinInterval(addOneDay(i.data || i.data_programada), intervalo))
      .reduce((a, b) => a + (b.valor || b.custo_total || 0), 0);

    const prod = dadosBrutos.colheitas
      .filter(i => i.talhao_id === meta.talhao_id && isWithinInterval(addOneDay(i.data), intervalo))
      .reduce((a, b) => a + (b.quantidade_kg || 0), 0);

    const cHa = custo / area;
    const pHa = (prod / 1000) / area;

    return {
      ...talhao,
      meta,
      cHa,
      pHa,
      cStat: (meta.meta_custo_por_ha > 0 && cHa > meta.meta_custo_por_ha) ? STATUS_CUSTO_ALTO : STATUS_OK,
      pStat: (meta.meta_producao_ton_por_ha > 0 && pHa < meta.meta_producao_ton_por_ha) ? STATUS_PROD_BAIXA : STATUS_OK
    };
  }).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Metas</h1>
          <p className="text-stone-500">Gestão de performance por hectare.</p>
        </div>
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-fuchsia-600 hover:bg-fuchsia-700"><Plus className="w-4 h-4 mr-2" /> Nova Meta</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
              <DialogDescription className="sr-only">Formulário de metas.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input value={formData.ano} onChange={(e) => setFormData({...formData, ano: e.target.value})} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Talhão</Label>
                  <Select value={formData.talhao_id} onValueChange={(v) => setFormData({...formData, talhao_id: v})} required>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Início</Label><Input type="date" value={formData.data_inicio_ciclo} onChange={(e) => setFormData({...formData, data_inicio_ciclo: e.target.value})} required /></div>
                <div className="space-y-2"><Label>Fim</Label><Input type="date" value={formData.data_fim_ciclo} onChange={(e) => setFormData({...formData, data_fim_ciclo: e.target.value})} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Meta Custo/Ha</Label><Input type="number" value={formData.meta_custo_por_ha} onChange={(e) => setFormData({...formData, meta_custo_por_ha: e.target.value})} /></div>
                <div className="space-y-2"><Label>Meta Ton/Ha</Label><Input type="number" step="0.1" value={formData.meta_producao_ton_por_ha} onChange={(e) => setFormData({...formData, meta_producao_ton_por_ha: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-fuchsia-600" disabled={mutation.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-stone-100"><CardContent className="pt-4 flex items-center gap-4">
        <Filter className="w-4 h-4 text-stone-400" />
        <Select value={anoFiltro} onValueChange={setAnoFiltro}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{anosDisponiveis.map(ano => <SelectItem key={ano} value={ano}>{ano}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent></Card>

      {desempenhoDetalhado.length === 0 ? <EmptyState icon={Target} title="Sem metas" description="Defina as metas para acompanhar." /> : (
        <Card className="border-stone-100 overflow-hidden"><Table><TableHeader><TableRow className="bg-stone-50">
          <TableHead>Talhão</TableHead>
          <TableHead className="text-right">Meta Custo</TableHead>
          <TableHead className="text-right">Real Custo</TableHead>
          <TableHead className="text-right">Meta Prod</TableHead>
          <TableHead className="text-right">Real Prod</TableHead>
          <TableHead className="w-24"></TableHead>
        </TableRow></TableHeader>
        <TableBody>{desempenhoDetalhado.map(d => (
          <TableRow key={d.id} className={d.cStat !== STATUS_OK || d.pStat !== STATUS_OK ? 'bg-red-50/30' : ''}>
            <TableCell className="font-bold">{d.nome}</TableCell>
            <TableCell className="text-right text-stone-500">R$ {d.meta.meta_custo_por_ha?.toLocaleString()}</TableCell>
            <TableCell className={`text-right font-medium ${d.cStat === STATUS_CUSTO_ALTO ? 'text-red-600' : 'text-emerald-600'}`}>R$ {d.cHa.toLocaleString()}</TableCell>
            <TableCell className="text-right text-stone-500">{d.meta.meta_producao_ton_por_ha} ton</TableCell>
            <TableCell className={`text-right font-medium ${d.pStat === STATUS_PROD_BAIXA ? 'text-amber-600' : 'text-emerald-600'}`}>{d.pHa.toFixed(1)} ton</TableCell>
            <TableCell><div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(d.meta)}><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteMutation.mutate(d.meta.id)}><Trash2 className="w-4 h-4" /></Button>
            </div></TableCell>
          </TableRow>
        ))}</TableBody></Table></Card>
      )}
    </div>
  );
}