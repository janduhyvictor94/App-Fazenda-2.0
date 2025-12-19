import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Users, Phone, Calendar, Briefcase, User } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';

const statusLabels = {
  ativo: { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  inativo: { label: 'Inativo', color: 'bg-stone-50 text-stone-700 border-stone-100' },
  ferias: { label: 'Férias', color: 'bg-blue-50 text-blue-700 border-blue-100' }
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
      const { data: result, error } = await supabase.from('funcionarios').insert([data]).select();
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
    setFormData({ nome: '', cargo: '', salario: '', data_admissao: '', status: 'ativo', telefone: '', talhao_principal: '', observacoes: '' });
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
    if (editingFuncionario) updateMutation.mutate({ id: editingFuncionario.id, data });
    else createMutation.mutate(data);
  };

  const totalFuncionarios = funcionarios.length;
  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;
  const totalFolha = funcionarios.filter(f => f.status === 'ativo').reduce((acc, f) => acc + (f.salario || 0), 0);

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Funcionários</h1>
          <p className="text-stone-500 font-medium">Gestão da equipe da fazenda</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-2xl h-12 px-6 shadow-lg shadow-blue-100">
              <Plus className="w-5 h-5 mr-2" /> Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{editingFuncionario ? 'Editar' : 'Novo'} Funcionário</DialogTitle>
              <DialogDescription className="sr-only">Formulário para cadastro de funcionários.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="font-bold text-stone-700">Nome Completo</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="rounded-xl h-11" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Cargo</Label>
                  <Input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} className="rounded-xl h-11" required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Salário</Label>
                  <Input type="number" step="0.01" value={formData.salario} onChange={(e) => setFormData({ ...formData, salario: e.target.value })} className="rounded-xl h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Data Admissão</Label>
                  <Input type="date" value={formData.data_admissao} onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Status</Label>
                  <Select value={formData.status || ""} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
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
                  <Label className="font-bold text-stone-700">Telefone</Label>
                  <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="rounded-xl h-11" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Talhão Principal</Label>
                  <Select value={formData.talhao_principal || "none"} onValueChange={(value) => setFormData({ ...formData, talhao_principal: value === "none" ? null : value })}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-stone-700">Observações</Label>
                <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} className="rounded-xl" rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={resetForm} className="rounded-xl">Cancelar</Button>
                <Button type="submit" className="bg-blue-600 rounded-xl px-8" disabled={createMutation.isPending || updateMutation.isPending}>{editingFuncionario ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Equipe Total" value={totalFuncionarios} icon={Users} />
        <StatCard title="Ativos Hoje" value={funcionariosAtivos} icon={User} color="text-emerald-600" />
        <StatCard title="Folha Mensal" value={`R$ ${totalFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Briefcase} color="text-amber-600" />
      </div>

      {funcionarios.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum funcionário" onAction={() => setOpen(true)} actionLabel="Cadastrar" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {funcionarios.map((funcionario) => (
            <Card key={funcionario.id} className="border-none shadow-sm rounded-[2rem] hover:shadow-xl transition-all duration-300 group bg-white overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 transition-transform group-hover:rotate-3">
                      <span className="text-xl font-bold text-white">{funcionario.nome?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-stone-800">{funcionario.nome}</CardTitle>
                      <p className="text-sm font-semibold text-stone-400 uppercase tracking-wider">{funcionario.cargo}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-full px-3 py-1 font-bold border ${statusLabels[funcionario.status]?.color}`}>
                    {statusLabels[funcionario.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-600">
                    <Phone className="w-4 h-4 text-stone-400" /> {funcionario.telefone || '(00) 00000-0000'}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-600">
                    <Calendar className="w-4 h-4 text-stone-400" /> {funcionario.data_admissao ? format(new Date(funcionario.data_admissao + 'T12:00:00'), 'dd/MM/yyyy') : 'Não informada'}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                    <Briefcase className="w-4 h-4" /> R$ {funcionario.salario?.toLocaleString('pt-BR') || '0,00'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 rounded-xl font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => handleEdit(funcionario)}>
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteMutation.mutate(funcionario.id)}>
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