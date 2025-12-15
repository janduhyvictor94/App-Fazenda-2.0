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
import { Plus, Edit, Trash2, Users, Phone, Calendar, Briefcase } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';

const statusLabels = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  inativo: { label: 'Inativo', color: 'bg-stone-100 text-stone-700' },
  ferias: { label: 'Férias', color: 'bg-blue-100 text-blue-700' }
};

export default function Funcionarios() {
  const [open, setOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    salario: '',
    data_admissao: '',
    status: 'ativo',
    telefone: '',
    talhao_principal: '',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcionarios').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('funcionarios').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('funcionarios').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cargo: '',
      salario: '',
      data_admissao: '',
      status: 'ativo',
      telefone: '',
      talhao_principal: '',
      observacoes: ''
    });
    setEditingFuncionario(null);
    setOpen(false);
  };

  const handleEdit = (funcionario) => {
    setEditingFuncionario(funcionario);
    setFormData({
      nome: funcionario.nome || '',
      cargo: funcionario.cargo || '',
      salario: funcionario.salario || '',
      data_admissao: funcionario.data_admissao || '',
      status: funcionario.status || 'ativo',
      telefone: funcionario.telefone || '',
      talhao_principal: funcionario.talhao_principal || '',
      observacoes: funcionario.observacoes || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      salario: formData.salario ? parseFloat(formData.salario) : null,
      talhao_principal: formData.talhao_principal || null
    };

    if (editingFuncionario) {
      updateMutation.mutate({ id: editingFuncionario.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Stats
  const totalFuncionarios = funcionarios.length;
  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;
  const totalFolha = funcionarios.filter(f => f.status === 'ativo').reduce((acc, f) => acc + (f.salario || 0), 0);

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Funcionários</h1>
          <p className="text-stone-500">Gestão da equipe da fazenda</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingFuncionario ? 'Editar Funcionário' : 'Novo Funcionário'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do funcionário"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    placeholder="Ex: Tratorista"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.salario}
                    onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
                    placeholder="R$"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input
                    type="date"
                    value={formData.data_admissao}
                    onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
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
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="ferias">Férias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Talhão Principal</Label>
                  <Select
                    value={formData.talhao_principal}
                    onValueChange={(value) => setFormData({ ...formData, talhao_principal: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhum</SelectItem>
                      {talhoes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingFuncionario ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total de Funcionários"
          value={totalFuncionarios}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Funcionários Ativos"
          value={funcionariosAtivos}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Folha Mensal"
          value={`R$ ${totalFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Funcionários ativos"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Lista */}
      {funcionarios.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum funcionário cadastrado"
          description="Cadastre seus funcionários para gerenciar a equipe da fazenda."
          actionLabel="Cadastrar Funcionário"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funcionarios.map((funcionario) => (
            <Card key={funcionario.id} className="border-stone-100 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-600">
                        {funcionario.nome?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{funcionario.nome}</CardTitle>
                      <p className="text-sm text-stone-500">{funcionario.cargo}</p>
                    </div>
                  </div>
                  <Badge className={statusLabels[funcionario.status]?.color}>
                    {statusLabels[funcionario.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {funcionario.salario && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-stone-400" />
                      <span>R$ {funcionario.salario.toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                  {funcionario.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-stone-400" />
                      <span>{funcionario.telefone}</span>
                    </div>
                  )}
                  {funcionario.data_admissao && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-stone-400" />
                      <span>{format(new Date(funcionario.data_admissao + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                  {funcionario.talhao_principal && (
                    <div className="flex items-center gap-2 text-stone-600">
                      <span className="text-stone-400">Talhão:</span>
                      <span>{getTalhaoNome(funcionario.talhao_principal)}</span>
                    </div>
                  )}
                </div>

                {funcionario.observacoes && (
                  <p className="text-sm text-stone-500 line-clamp-2">{funcionario.observacoes}</p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(funcionario)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate(funcionario.id)}
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