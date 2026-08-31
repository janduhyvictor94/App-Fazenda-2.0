import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Map, Leaf, Eye, Sprout, Ruler } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatCard from '@/components/ui/StatCard'; // Adicionado para manter padrão visual do topo

const statusLabels = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  em_preparacao: { label: 'Em Preparação', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  colheita: { label: 'Em Colheita', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  repouso: { label: 'Repouso', color: 'bg-stone-100 text-stone-700 border-stone-200' }
};

const culturaLabels = {
  manga: { label: 'Manga', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  goiaba: { label: 'Goiaba', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  misto: { label: 'Misto', color: 'bg-purple-100 text-purple-700 border-purple-200' }
};

export default function Talhoes() {
  const [open, setOpen] = useState(false);
  const [editingTalhao, setEditingTalhao] = useState(null);
  const [openCulturaDialog, setOpenCulturaDialog] = useState(false);
  const [novaCultura, setNovaCultura] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    area_hectares: '',
    cultura: '',
    variedade: '',
    data_plantio: '',
    status: 'ativo',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  // Culturas cadastráveis (manga, goiaba, ou o que o cliente plantar — uva, mamão, etc.)
  const { data: culturas = [] } = useQuery({
    queryKey: ['culturas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('culturas').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const createCulturaMutation = useMutation({
    mutationFn: async (nome) => {
      const { error } = await supabase.from('culturas').insert({ nome: nome.trim().toLowerCase() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] });
      setNovaCultura('');
    },
    onError: (error) => { alert(`Não foi possível cadastrar a cultura.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao criar cultura:', error); }
  });

  const deleteCulturaMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('culturas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['culturas'] }),
    onError: (error) => { alert(`Não foi possível excluir a cultura.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao excluir cultura:', error); }
  });

  const { data: talhoes = [], isLoading } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('talhoes').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
      resetForm();
    },
    onError: (error) => { alert(`Não foi possível cadastrar o talhão.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao criar talhão:', error); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('talhoes').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
      resetForm();
    },
    onError: (error) => { alert(`Não foi possível salvar as alterações.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao atualizar talhão:', error); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // O erro 409 ao excluir acontece porque outras tabelas referenciam este talhão
      // (custos, colheitas, atividades, pluviometria, funcionários) via talhao_id,
      // e o banco bloqueia a exclusão para não deixar dados órfãos (chave estrangeira).
      // Solução: desvincular (talhao_id = null) esses registros antes de excluir o talhão.
      // O histórico é mantido — passa a aparecer como "Geral/Sede" no lugar do talhão excluído.
      const tabelasParaDesvincular = ['custos', 'colheitas', 'atividades', 'pluviometria', 'metas_talhoes', 'funcionarios'];

      for (const tabela of tabelasParaDesvincular) {
        const { error: errUnlink } = await supabase.from(tabela).update({ talhao_id: null }).eq('talhao_id', id);
        if (errUnlink) throw errUnlink;
      }

      // "safras" tem talhao_id como NOT NULL (uma safra sempre pertence a um talhão),
      // então não dá para desvincular. Como nenhuma outra tabela referencia safra_id,
      // é seguro excluir as safras daquele talhão junto com ele.
      const { error: errSafras } = await supabase.from('safras').delete().eq('talhao_id', id);
      if (errSafras) throw errSafras;

      const { error } = await supabase.from('talhoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['safras'] });
      queryClient.invalidateQueries({ queryKey: ['pluviometria'] });
      queryClient.invalidateQueries({ queryKey: ['metas_talhoes'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
    },
    onError: (error) => {
      console.error('Erro ao excluir talhão:', error);
      alert(`Não foi possível excluir o talhão.\n\n${error.message || 'Verifique se ainda há registros vinculados a ele.'}`);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      area_hectares: '',
      cultura: '',
      variedade: '',
      data_plantio: '',
      status: 'ativo',
      observacoes: ''
    });
    setEditingTalhao(null);
    setOpen(false);
  };

  const handleEdit = (talhao) => {
    setEditingTalhao(talhao);
    setFormData({
      nome: talhao.nome || '',
      area_hectares: talhao.area_hectares || '',
      cultura: talhao.cultura || '',
      variedade: talhao.variedade || '',
      data_plantio: talhao.data_plantio || '',
      status: talhao.status || 'ativo',
      observacoes: talhao.observacoes || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      area_hectares: formData.area_hectares ? parseFloat(formData.area_hectares) : null
    };

    if (editingTalhao) {
      updateMutation.mutate({ id: editingTalhao.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalArea = talhoes.reduce((acc, t) => acc + (t.area_hectares || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Padronizado */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Talhões</h1>
          <p className="text-stone-500 font-medium">Gestão de áreas produtivas</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95">
              <Plus className="w-4 h-4 mr-2" /> Novo Talhão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editingTalhao ? 'Editar Talhão' : 'Novo Talhão'}</DialogTitle>
              <DialogDescription>Preencha os dados da área produtiva.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome/Código</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: T-01"
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Área (hectares)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.area_hectares}
                    onChange={(e) => setFormData({ ...formData, area_hectares: e.target.value })}
                    placeholder="Ex: 10.5"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cultura</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpenCulturaDialog(true)} className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg">
                      <Plus className="w-3 h-3 mr-1" /> Gerenciar
                    </Button>
                  </div>
                  <Select
                    value={formData.cultura}
                    onValueChange={(value) => setFormData({ ...formData, cultura: value })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {culturas.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>{c.nome.charAt(0).toUpperCase() + c.nome.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Variedade</Label>
                  <Input
                    value={formData.variedade}
                    onChange={(e) => setFormData({ ...formData, variedade: e.target.value })}
                    placeholder="Ex: Palmer, Paluma"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Plantio</Label>
                  <Input
                    type="date"
                    value={formData.data_plantio}
                    onChange={(e) => setFormData({ ...formData, data_plantio: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="em_preparacao">Em Preparação</SelectItem>
                      <SelectItem value="colheita">Em Colheita</SelectItem>
                      <SelectItem value="repouso">Repouso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o talhão..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8">
                  {editingTalhao ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={openCulturaDialog} onOpenChange={setOpenCulturaDialog}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>Gerenciar Culturas</DialogTitle>
              <DialogDescription>Cadastre as culturas que a fazenda trabalha (manga, goiaba, uva, mamão, etc.).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input value={novaCultura} onChange={(e) => setNovaCultura(e.target.value)} placeholder="Ex: Uva" className="rounded-xl" />
                <Button onClick={() => createCulturaMutation.mutate(novaCultura)} disabled={!novaCultura.trim() || createCulturaMutation.isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="border rounded-xl divide-y overflow-hidden">
                {culturas.length === 0 ? (
                  <div className="p-4 text-center text-sm text-stone-400 italic">Nenhuma cultura cadastrada ainda.</div>
                ) : culturas.map((c) => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-stone-50 hover:bg-white transition-colors">
                    <span className="text-sm font-medium capitalize">{c.nome}</span>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Excluir a cultura "${c.nome}"? Talhões já cadastrados com ela não serão afetados, só deixa de aparecer na lista pra novos cadastros.`)) deleteCulturaMutation.mutate(c.id) }} className="h-6 w-6 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards Padronizados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <StatCard title="Talhões Ativos" value={talhoes.length} icon={Map} color="text-stone-600" />
         <StatCard title="Área Total" value={`${totalArea.toFixed(2)} ha`} icon={Ruler} color="text-emerald-600" />
      </div>

      {/* Grid de Cards (Original) Padronizado */}
      {talhoes.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Nenhum talhão cadastrado"
          description="Comece cadastrando os talhões da sua fazenda para organizar as atividades e colheitas."
          actionLabel="Cadastrar Talhão"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {talhoes.map((talhao) => (
            <Card key={talhao.id} className="border-stone-100 rounded-[2rem] shadow-sm hover:shadow-lg transition-all group overflow-hidden">
              <CardHeader className="pb-3 bg-stone-50/50 border-b border-stone-50 pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                      talhao.cultura === 'manga' ? 'bg-orange-50 border border-orange-100' : 
                      talhao.cultura === 'goiaba' ? 'bg-pink-50 border border-pink-100' : 'bg-purple-50 border border-purple-100'
                    }`}>
                      {talhao.cultura === 'manga' ? (
                        <span className="text-2xl" role="img" aria-label="Manga">🥭</span>
                      ) : talhao.cultura === 'goiaba' ? (
                        <span className="text-2xl" role="img" aria-label="Goiaba">🍈</span>
                      ) : (
                        <Leaf className={`w-6 h-6 ${
                          talhao.cultura === 'misto' ? 'text-purple-600' : 'text-stone-600'
                        }`} />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-stone-800">{talhao.nome}</CardTitle>
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">{talhao.variedade || 'Variedade N/A'}</p>
                    </div>
                  </div>
                  <Badge className={`${statusLabels[talhao.status]?.color || 'bg-stone-100'} border`}>
                    {statusLabels[talhao.status]?.label || talhao.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <p className="text-stone-500 text-xs font-bold uppercase mb-1.5 tracking-wide">Cultura</p>
                    <Badge variant="outline" className={`${culturaLabels[talhao.cultura]?.color || 'bg-stone-100'} bg-opacity-20 border-opacity-50 capitalize`}>
                      {culturaLabels[talhao.cultura]?.label || talhao.cultura}
                    </Badge>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <p className="text-stone-500 text-xs font-bold uppercase mb-1.5 tracking-wide">Área</p>
                    <p className="font-bold text-stone-700 text-lg">{talhao.area_hectares || '-'} ha</p>
                  </div>
                </div>
                
                {talhao.data_plantio && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 font-medium px-1">
                        <Sprout className="w-3 h-3" /> Plantio: {format(new Date(talhao.data_plantio + 'T12:00:00'), 'MM/yyyy')}
                    </div>
                )}

                {talhao.observacoes && (
                  <p className="text-sm text-stone-500 line-clamp-2 bg-stone-50/50 p-2 rounded-lg italic">"{talhao.observacoes}"</p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                  <Link 
                    to={createPageUrl(`Relatorios?talhao=${talhao.id}`)}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full rounded-xl border-stone-200 text-stone-600 hover:bg-stone-50">
                      <Eye className="w-4 h-4 mr-2" />
                      Detalhes
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEdit(talhao)}
                    className="rounded-xl text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl"
                    onClick={() => deleteMutation.mutate(talhao.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
