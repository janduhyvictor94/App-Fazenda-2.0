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
import { Plus, Edit, Trash2, FileText, Calendar, User, ChevronDown, ChevronUp, Printer, AlertCircle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const prioridadeLabels = {
  alta: { label: 'Alta', color: 'bg-red-100 text-red-700' },
  media: { label: 'Média', color: 'bg-amber-100 text-amber-700' },
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-700' }
};

export default function Consultorias() {
  const [open, setOpen] = useState(false);
  const [editingConsultoria, setEditingConsultoria] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [formData, setFormData] = useState({
    consultor_nome: '',
    data_visita: format(new Date(), 'yyyy-MM-dd'),
    talhoes_visitados: [],
    indicacoes: [],
    observacoes_gerais: '',
    proxima_visita: ''
  });
  const [novaIndicacao, setNovaIndicacao] = useState({
    talhao_id: '',
    talhao_nome: '',
    recomendacao: '',
    prioridade: 'media',
    prazo: ''
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

  const { data: consultorias = [], isLoading } = useQuery({
    queryKey: ['consultorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultorias').select('*').order('data_visita', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('consultorias').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultorias'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('consultorias').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultorias'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('consultorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultorias'] });
    }
  });

  const resetForm = () => {
    setFormData({
      consultor_nome: '',
      data_visita: format(new Date(), 'yyyy-MM-dd'),
      talhoes_visitados: [],
      indicacoes: [],
      observacoes_gerais: '',
      proxima_visita: ''
    });
    setNovaIndicacao({
      talhao_id: '',
      talhao_nome: '',
      recomendacao: '',
      prioridade: 'media',
      prazo: ''
    });
    setEditingConsultoria(null);
    setOpen(false);
  };

  const handleEdit = (consultoria) => {
    setEditingConsultoria(consultoria);
    setFormData({
      consultor_nome: consultoria.consultor_nome || '',
      data_visita: consultoria.data_visita || '',
      talhoes_visitados: consultoria.talhoes_visitados || [],
      indicacoes: consultoria.indicacoes || [],
      observacoes_gerais: consultoria.observacoes_gerais || '',
      proxima_visita: consultoria.proxima_visita || ''
    });
    setOpen(true);
  };

  const addIndicacao = () => {
    if (!novaIndicacao.recomendacao) return;
    
    const talhao = talhoes.find(t => t.id === novaIndicacao.talhao_id);
    const indicacao = {
      ...novaIndicacao,
      talhao_nome: talhao?.nome || 'Geral'
    };

    setFormData({
      ...formData,
      indicacoes: [...formData.indicacoes, indicacao]
    });
    setNovaIndicacao({
      talhao_id: '',
      talhao_nome: '',
      recomendacao: '',
      prioridade: 'media',
      prazo: ''
    });
  };

  const removeIndicacao = (index) => {
    setFormData({
      ...formData,
      indicacoes: formData.indicacoes.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Tratamento de dados para evitar erro 400 no Supabase
    // Strings vazias em campos de data causam erro, convertemos para null
    const payload = {
      ...formData,
      proxima_visita: formData.proxima_visita || null,
      // Garantir que arrays sejam arrays
      talhoes_visitados: formData.talhoes_visitados || [],
      indicacoes: formData.indicacoes || []
    };

    if (editingConsultoria) {
      updateMutation.mutate({ id: editingConsultoria.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handlePrint = (consultoria) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Consultoria - ${consultoria.consultor_nome}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #166534; border-bottom: 2px solid #166534; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 30px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .info { margin: 10px 0; }
          .info strong { color: #374151; }
          .indicacao { background: #f9fafb; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #10b981; }
          .indicacao.alta { border-left-color: #ef4444; }
          .indicacao.media { border-left-color: #f59e0b; }
          .indicacao.baixa { border-left-color: #10b981; }
          .prioridade { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .prioridade.alta { background: #fee2e2; color: #b91c1c; }
          .prioridade.media { background: #fef3c7; color: #b45309; }
          .prioridade.baixa { background: #dcfce7; color: #166534; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>FAZENDA CASSIANO'S</h1>
        <h2>Relatório de Visita Técnica</h2>
        <div class="header">
          <div>
            <div class="info"><strong>Consultor:</strong> ${consultoria.consultor_nome}</div>
            <div class="info"><strong>Data da Visita:</strong> ${consultoria.data_visita ? format(new Date(consultoria.data_visita), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-'}</div>
            ${consultoria.proxima_visita ? `<div class="info"><strong>Próxima Visita:</strong> ${format(new Date(consultoria.proxima_visita), "dd/MM/yyyy")}</div>` : ''}
          </div>
        </div>
        
        ${consultoria.observacoes_gerais ? `<div class="info"><strong>Observações Gerais:</strong><p>${consultoria.observacoes_gerais}</p></div>` : ''}
        
        <h2>Indicações e Recomendações</h2>
        ${consultoria.indicacoes?.length > 0 ? consultoria.indicacoes.map(ind => `
          <div class="indicacao ${ind.prioridade}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong>${ind.talhao_nome || 'Geral'}</strong>
              <span class="prioridade ${ind.prioridade}">Prioridade ${ind.prioridade === 'alta' ? 'Alta' : ind.prioridade === 'media' ? 'Média' : 'Baixa'}</span>
            </div>
            <p>${ind.recomendacao}</p>
            ${ind.prazo ? `<small>Prazo: ${ind.prazo}</small>` : ''}
          </div>
        `).join('') : '<p>Nenhuma indicação registrada.</p>'}
        
        <div class="footer">
          <p>Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Consultorias</h1>
          <p className="text-stone-500">Registro de visitas e recomendações técnicas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Consultoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingConsultoria ? 'Editar Consultoria' : 'Nova Consultoria'}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da visita técnica e adicione as recomendações para os talhões.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Consultor</Label>
                  <Input
                    value={formData.consultor_nome}
                    onChange={(e) => setFormData({ ...formData, consultor_nome: e.target.value })}
                    placeholder="Nome do consultor"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data da Visita</Label>
                  <Input
                    type="date"
                    value={formData.data_visita}
                    onChange={(e) => setFormData({ ...formData, data_visita: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Próxima Visita (opcional)</Label>
                <Input
                  type="date"
                  value={formData.proxima_visita}
                  onChange={(e) => setFormData({ ...formData, proxima_visita: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações Gerais</Label>
                <Textarea
                  value={formData.observacoes_gerais}
                  onChange={(e) => setFormData({ ...formData, observacoes_gerais: e.target.value })}
                  placeholder="Observações gerais da visita..."
                  rows={3}
                />
              </div>

              {/* Indicações */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-4">
                <Label className="text-base font-medium">Indicações e Recomendações</Label>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={novaIndicacao.talhao_id}
                      onValueChange={(value) => setNovaIndicacao({ ...novaIndicacao, talhao_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Talhão (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Geral</SelectItem>
                        {talhoes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={novaIndicacao.prioridade}
                      onValueChange={(value) => setNovaIndicacao({ ...novaIndicacao, prioridade: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={novaIndicacao.recomendacao}
                    onChange={(e) => setNovaIndicacao({ ...novaIndicacao, recomendacao: e.target.value })}
                    placeholder="Descreva a recomendação..."
                    rows={2}
                  />
                  <div className="flex gap-3">
                    <Input
                      value={novaIndicacao.prazo}
                      onChange={(e) => setNovaIndicacao({ ...novaIndicacao, prazo: e.target.value })}
                      placeholder="Prazo (ex: 7 dias, até 15/01)"
                      className="flex-1"
                    />
                    <Button type="button" onClick={addIndicacao} variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {formData.indicacoes.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {formData.indicacoes.map((ind, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-white rounded-lg border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{ind.talhao_nome || 'Geral'}</span>
                            <Badge className={prioridadeLabels[ind.prioridade]?.color}>
                              {prioridadeLabels[ind.prioridade]?.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-stone-600">{ind.recomendacao}</p>
                          {ind.prazo && (
                            <p className="text-xs text-stone-400 mt-1">Prazo: {ind.prazo}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIndicacao(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingConsultoria ? 'Salvar' : 'Registrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista */}
      {consultorias.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma consultoria registrada"
          description="Registre as visitas de consultoria para acompanhar as recomendações técnicas."
          actionLabel="Registrar Consultoria"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {consultorias.map((consultoria) => (
            <Card key={consultoria.id} className="border-stone-100">
              <Collapsible
                open={expandedId === consultoria.id}
                onOpenChange={() => setExpandedId(expandedId === consultoria.id ? null : consultoria.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                        <User className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{consultoria.consultor_nome}</CardTitle>
                        <div className="flex items-center gap-3 text-sm text-stone-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {consultoria.data_visita ? format(new Date(consultoria.data_visita), 'dd/MM/yyyy') : '-'}
                          </div>
                          {consultoria.indicacoes?.length > 0 && (
                            <Badge variant="outline">
                              {consultoria.indicacoes.length} indicações
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrint(consultoria)}
                      >
                        <Printer className="w-4 h-4 mr-1" />
                        Imprimir
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(consultoria)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(consultoria.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {expandedId === consultoria.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {consultoria.observacoes_gerais && (
                      <div className="p-3 bg-stone-50 rounded-lg">
                        <p className="text-sm font-medium text-stone-600 mb-1">Observações Gerais</p>
                        <p className="text-sm text-stone-700">{consultoria.observacoes_gerais}</p>
                      </div>
                    )}

                    {consultoria.indicacoes?.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-stone-600">Indicações e Recomendações</p>
                        {consultoria.indicacoes.map((ind, idx) => (
                          <div key={idx} className="p-3 bg-stone-50 rounded-lg border-l-4 border-l-teal-500">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{ind.talhao_nome || 'Geral'}</span>
                              <Badge className={prioridadeLabels[ind.prioridade]?.color}>
                                {prioridadeLabels[ind.prioridade]?.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-stone-700">{ind.recomendacao}</p>
                            {ind.prazo && (
                              <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Prazo: {ind.prazo}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {consultoria.proxima_visita && (
                      <div className="flex items-center gap-2 text-sm text-teal-600">
                        <Calendar className="w-4 h-4" />
                        <span>Próxima visita: {format(new Date(consultoria.proxima_visita), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}