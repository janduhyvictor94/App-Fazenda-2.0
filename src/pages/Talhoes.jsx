import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
    }
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
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('talhoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
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
                  <Label>Cultura</Label>
                  <Select
                    value={formData.cultura}
                    onValueChange={(value) => setFormData({ ...formData, cultura: value })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manga">Manga</SelectItem>
                      <SelectItem value="goiaba">Goiaba</SelectItem>
                      <SelectItem value="misto">Misto</SelectItem>
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
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{talhao.variedade || 'Variedade N/A'}</p>
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
                    <p className="text-stone-400 text-xs font-bold uppercase mb-1">Cultura</p>
                    <Badge variant="outline" className={`${culturaLabels[talhao.cultura]?.color || 'bg-stone-100'} bg-opacity-20 border-opacity-50`}>
                      {culturaLabels[talhao.cultura]?.label || talhao.cultura}
                    </Badge>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <p className="text-stone-400 text-xs font-bold uppercase mb-1">Área</p>
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
                    className="rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100"
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