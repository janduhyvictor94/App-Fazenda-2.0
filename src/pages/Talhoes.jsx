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
import { Plus, Edit, Trash2, Map, Leaf, Eye } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const statusLabels = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  em_preparacao: { label: 'Em Preparação', color: 'bg-amber-100 text-amber-700' },
  colheita: { label: 'Em Colheita', color: 'bg-blue-100 text-blue-700' },
  repouso: { label: 'Repouso', color: 'bg-stone-100 text-stone-700' }
};

const culturaLabels = {
  manga: { label: 'Manga', color: 'bg-orange-100 text-orange-700' },
  goiaba: { label: 'Goiaba', color: 'bg-pink-100 text-pink-700' },
  misto: { label: 'Misto', color: 'bg-purple-100 text-purple-700' }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Talhões</h1>
          <p className="text-stone-500">
            {talhoes.length} talhões • {totalArea.toFixed(2)} hectares total
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Talhão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTalhao ? 'Editar Talhão' : 'Novo Talhão'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome/Código</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: T-01"
                    required
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
                    <SelectTrigger>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
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
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingTalhao ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      {talhoes.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Nenhum talhão cadastrado"
          description="Comece cadastrando os talhões da sua fazenda para organizar as atividades e colheitas."
          actionLabel="Cadastrar Talhão"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {talhoes.map((talhao) => (
            <Card key={talhao.id} className="border-stone-100 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      talhao.cultura === 'manga' ? 'bg-orange-100' : 
                      talhao.cultura === 'goiaba' ? 'bg-pink-100' : 'bg-purple-100'
                    }`}>
                      {/* LÓGICA DE ÍCONES DE FRUTAS AQUI */}
                      {talhao.cultura === 'manga' ? (
                        <span className="text-xl" role="img" aria-label="Manga">🥭</span>
                      ) : talhao.cultura === 'goiaba' ? (
                        <span className="text-xl" role="img" aria-label="Goiaba">🍈</span>
                      ) : (
                        <Leaf className={`w-5 h-5 ${
                          talhao.cultura === 'misto' ? 'text-purple-600' : 'text-stone-600'
                        }`} />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{talhao.nome}</CardTitle>
                      <p className="text-sm text-stone-500">{talhao.variedade || 'Variedade não informada'}</p>
                    </div>
                  </div>
                  <Badge className={statusLabels[talhao.status]?.color || 'bg-stone-100'}>
                    {statusLabels[talhao.status]?.label || talhao.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-stone-500">Cultura</p>
                    <Badge className={culturaLabels[talhao.cultura]?.color || 'bg-stone-100'}>
                      {culturaLabels[talhao.cultura]?.label || talhao.cultura}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-stone-500">Área</p>
                    <p className="font-medium">{talhao.area_hectares || '-'} ha</p>
                  </div>
                  {talhao.data_plantio && (
                    <div>
                      <p className="text-stone-500">Plantio</p>
                      <p className="font-medium">{format(new Date(talhao.data_plantio + 'T12:00:00'), 'MM/yyyy')}</p>
                    </div>
                  )}
                </div>

                {talhao.observacoes && (
                  <p className="text-sm text-stone-500 line-clamp-2">{talhao.observacoes}</p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                  <Link 
                    to={createPageUrl(`Relatorios?talhao=${talhao.id}`)}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="w-4 h-4 mr-1" />
                      Detalhes
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(talhao)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
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