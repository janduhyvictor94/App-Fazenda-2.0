import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Check, X, Loader2, Bot, User } from 'lucide-react';
import { format } from 'date-fns';

// Normaliza texto pra comparar nomes sem se importar com acento/maiúscula
const normalizar = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const encontrarPorNome = (lista, nomeAlvo, campo = 'nome') => {
  if (!nomeAlvo) return null;
  const alvo = normalizar(nomeAlvo);
  return lista.find(item => normalizar(item[campo]) === alvo)
    || lista.find(item => normalizar(item[campo]).includes(alvo) || alvo.includes(normalizar(item[campo])))
    || null;
};

export default function Assistente() {
  const queryClient = useQueryClient();
  const [mensagens, setMensagens] = useState([
    { autor: 'ia', texto: 'Oi! Pode me contar o que você quer registrar — colheita, atividade, pagamento, ou até me perguntar algo tipo "quanto gastei com colheita esse mês".' }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [historicoAPI, setHistoricoAPI] = useState([]);
  const [propostaPendente, setPropostaPendente] = useState(null); // { resumo, propostas }
  const [salvando, setSalvando] = useState(false);
  const fimDaListaRef = useRef(null);

  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; } });
  const { data: insumos = [] } = useQuery({ queryKey: ['insumos'], queryFn: async () => { const { data } = await supabase.from('insumos').select('*'); return data || []; } });
  const { data: funcionarios = [] } = useQuery({ queryKey: ['funcionarios'], queryFn: async () => { const { data } = await supabase.from('funcionarios').select('*'); return data || []; } });

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, propostaPendente]);

  const enviarMensagem = async () => {
    const texto = input.trim();
    if (!texto || carregando) return;

    setMensagens(prev => [...prev, { autor: 'usuario', texto }]);
    setInput('');
    setCarregando(true);

    try {
      const resp = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, historico: historicoAPI })
      });
      const dados = await resp.json();

      if (!resp.ok) {
        setMensagens(prev => [...prev, { autor: 'ia', texto: `Erro: ${dados.erro || 'algo deu errado'}` }]);
        return;
      }

      if (dados.tipo === 'pergunta') {
        setMensagens(prev => [...prev, { autor: 'ia', texto: dados.texto }]);
        setHistoricoAPI(dados.historico_atualizado || []);
      } else if (dados.tipo === 'resposta') {
        setMensagens(prev => [...prev, { autor: 'ia', texto: dados.texto }]);
        setHistoricoAPI([]); // consulta encerra o fluxo, começa do zero na próxima
      } else if (dados.tipo === 'proposta') {
        setMensagens(prev => [...prev, { autor: 'ia', texto: dados.resumo }]);
        setPropostaPendente({ propostas: dados.propostas });
        setHistoricoAPI([]);
      }
    } catch (err) {
      setMensagens(prev => [...prev, { autor: 'ia', texto: `Não consegui falar com o servidor: ${err.message}` }]);
    } finally {
      setCarregando(false);
    }
  };

  const cancelarProposta = () => {
    setPropostaPendente(null);
    setMensagens(prev => [...prev, { autor: 'ia', texto: 'Ok, não salvei nada.' }]);
  };

  const confirmarProposta = async () => {
    if (!propostaPendente) return;
    setSalvando(true);
    try {
      const tabelasAfetadas = new Set();
      for (const item of propostaPendente.propostas) {
        const tabela = await executarAcao(item.ferramenta, item.dados, { talhoes, insumos, funcionarios });
        if (tabela) tabelasAfetadas.add(tabela);
      }
      tabelasAfetadas.forEach(t => queryClient.invalidateQueries({ queryKey: [t] }));
      setMensagens(prev => [...prev, { autor: 'ia', texto: '✅ Pronto, salvei tudo certinho.' }]);
      setPropostaPendente(null);
    } catch (err) {
      setMensagens(prev => [...prev, { autor: 'ia', texto: `❌ Não consegui salvar: ${err.message}` }]);
    } finally {
      setSalvando(false);
    }
  };

  // ------------------------------------------------------------------------
  // Executa a ação de verdade no Supabase — mesma lógica/campos que cada
  // página já usa, só que disparada a partir do que a IA organizou.
  // ------------------------------------------------------------------------
  const executarAcao = async (ferramenta, dados, ctx) => {
    const hoje = format(new Date(), 'yyyy-MM-dd');

    if (ferramenta === 'registrar_colheita') {
      const talhao = encontrarPorNome(ctx.talhoes, dados.talhao_nome);
      if (!talhao) throw new Error(`Talhão "${dados.talhao_nome}" não encontrado.`);
      const data = dados.data || hoje;

      const payload = (dados.itens || []).map(item => ({
        talhao_id: talhao.id,
        data,
        cultura: dados.cultura || talhao.cultura,
        tipo_colheita: item.tipo_colheita,
        quantidade_kg: item.quantidade_kg || null,
        quantidade_caixas: item.quantidade_caixas || null,
        preco_unitario: item.preco_unitario,
        unidade_preco: item.unidade_preco,
        valor_total: (item.unidade_preco === 'kg' ? (item.quantidade_kg || 0) : (item.quantidade_caixas || 0)) * item.preco_unitario
      }));
      const { error } = await supabase.from('colheitas').insert(payload);
      if (error) throw error;

      if (dados.custo_colheita_unitario > 0) {
        const somaQtd = (dados.itens || []).reduce((acc, item) => acc + (dados.custo_unidade === 'kg' ? (item.quantidade_kg || 0) : (item.quantidade_caixas || 0)), 0);
        const custoTotal = somaQtd * dados.custo_colheita_unitario;
        if (custoTotal > 0) {
          const resumoTipos = (dados.itens || []).map(i => i.tipo_colheita).join(' + ');
          const { error: errCusto } = await supabase.from('custos').insert({
            descricao: `Colheita - ${resumoTipos} - ${talhao.nome}`,
            categoria: 'colheita',
            talhao_id: talhao.id,
            valor: custoTotal,
            data,
            status_pagamento: 'pendente',
            tipo_lancamento: 'despesa',
            observacoes: `Custo de colheita (via assistente): R$ ${dados.custo_colheita_unitario}/${dados.custo_unidade}`
          });
          if (errCusto) throw errCusto;
        }
      }
      return 'colheitas';
    }

    if (ferramenta === 'registrar_atividade') {
      const talhao = encontrarPorNome(ctx.talhoes, dados.talhao_nome);
      if (!talhao) throw new Error(`Talhão "${dados.talhao_nome}" não encontrado.`);

      const insumosResolvidos = [];
      for (const i of (dados.insumos || [])) {
        const insumo = encontrarPorNome(ctx.insumos, i.nome_insumo);
        if (!insumo) throw new Error(`Insumo "${i.nome_insumo}" não encontrado no cadastro.`);
        const precoPorUnidade = (insumo.preco_unitario || 0) / (insumo.tamanho_embalagem || 1);
        insumosResolvidos.push({
          insumo_id: insumo.id,
          nome: insumo.nome,
          quantidade: i.quantidade,
          unidade: insumo.unidade,
          valor_unitario: precoPorUnidade,
          valor_total: i.quantidade * precoPorUnidade,
          metodo_aplicacao: 'adubacao'
        });
      }
      const custoInsumos = insumosResolvidos.reduce((acc, i) => acc + i.valor_total, 0);
      const custoTotal = custoInsumos + (dados.terceirizada ? (dados.valor_terceirizado || 0) : 0);

      const { error } = await supabase.from('atividades').insert({
        talhao_id: talhao.id,
        tipo: dados.tipo,
        data_programada: dados.data_programada || hoje,
        status: 'programada',
        terceirizada: !!dados.terceirizada,
        valor_terceirizado: dados.terceirizada ? (dados.valor_terceirizado || null) : null,
        insumos_utilizados: insumosResolvidos,
        custo_total: custoTotal,
        responsavel: dados.responsavel || null,
        observacoes: dados.observacoes || null
      });
      if (error) throw error;
      return 'atividades';
    }

    if (ferramenta === 'registrar_pagamento') {
      const talhao = dados.talhao_nome ? encontrarPorNome(ctx.talhoes, dados.talhao_nome) : null;
      const { error } = await supabase.from('custos').insert({
        descricao: dados.descricao,
        categoria: dados.categoria || 'outro',
        talhao_id: talhao?.id || null,
        valor: dados.valor,
        data: dados.data || hoje,
        status_pagamento: dados.ja_pago ? 'pago' : 'pendente',
        tipo_lancamento: 'despesa'
      });
      if (error) throw error;
      return 'custos';
    }

    if (ferramenta === 'criar_talhao') {
      const { error } = await supabase.from('talhoes').insert({
        nome: dados.nome,
        area_hectares: dados.area_hectares || null,
        cultura: dados.cultura || null,
        variedade: dados.variedade || null,
        data_plantio: dados.data_plantio || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'talhoes';
    }

    if (ferramenta === 'criar_funcionario') {
      const talhao = dados.talhao_nome ? encontrarPorNome(ctx.talhoes, dados.talhao_nome) : null;
      const { error } = await supabase.from('funcionarios').insert({
        nome: dados.nome,
        cargo: dados.cargo || null,
        salario: dados.salario || null,
        data_admissao: dados.data_admissao || hoje,
        talhao_id: talhao?.id || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'funcionarios';
    }

    if (ferramenta === 'registrar_chuva') {
      const talhao = dados.talhao_nome ? encontrarPorNome(ctx.talhoes, dados.talhao_nome) : null;
      const { error } = await supabase.from('pluviometria').insert({
        data: dados.data || hoje,
        quantidade_mm: dados.quantidade_mm,
        talhao_id: talhao?.id || null
      });
      if (error) throw error;
      return 'pluviometria';
    }

    if (ferramenta === 'criar_insumo') {
      const { error } = await supabase.from('insumos').insert({
        nome: dados.nome,
        categoria: dados.categoria || 'outro',
        unidade: dados.unidade,
        preco_unitario: dados.preco_unitario,
        tamanho_embalagem: dados.tamanho_embalagem || null,
        estoque_atual: dados.estoque_atual || 0
      });
      if (error) throw error;
      return 'insumos';
    }

    if (ferramenta === 'criar_safra') {
      const talhao = encontrarPorNome(ctx.talhoes, dados.talhao_nome);
      if (!talhao) throw new Error(`Talhão "${dados.talhao_nome}" não encontrado.`);
      const { error } = await supabase.from('safras').insert({
        nome: dados.nome,
        talhao_id: talhao.id,
        data_inicio: dados.data_inicio || hoje,
        data_fim: dados.data_fim || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'safras';
    }

    if (ferramenta === 'registrar_consultoria') {
      const { error } = await supabase.from('consultorias').insert({
        consultor_nome: dados.consultor_nome,
        data_visita: dados.data_visita || hoje,
        observacoes_gerais: dados.observacoes_gerais || null,
        proxima_visita: dados.proxima_visita || null,
        indicacoes: []
      });
      if (error) throw error;
      return 'consultorias';
    }

    throw new Error(`Ação "${ferramenta}" desconhecida.`);
  };

  const rotuloFerramenta = {
    registrar_colheita: 'Colheita',
    registrar_atividade: 'Atividade',
    registrar_pagamento: 'Pagamento',
    criar_talhao: 'Novo Talhão',
    criar_funcionario: 'Novo Funcionário',
    registrar_chuva: 'Chuva',
    criar_insumo: 'Novo Insumo',
    criar_safra: 'Nova Safra',
    registrar_consultoria: 'Consultoria'
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="bg-white p-6 rounded-[1.5rem] border border-stone-100 shadow-sm flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Assistente</h1>
          <p className="text-stone-500 font-medium">Escreva o que quer registrar ou pergunte algo sobre seus dados</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[1.5rem] border border-stone-100 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {mensagens.map((m, idx) => (
            <div key={idx} className={`flex gap-3 ${m.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}>
              {m.autor === 'ia' && (
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.autor === 'usuario' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-800 border border-stone-100'}`}>
                {m.texto}
              </div>
              {m.autor === 'usuario' && (
                <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-stone-500" />
                </div>
              )}
            </div>
          ))}

          {propostaPendente && (
            <div className="ml-11 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Confirme antes de salvar</p>
              {propostaPendente.propostas.map((p, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3 border border-emerald-100 text-sm">
                  <p className="font-bold text-stone-800 mb-1">{rotuloFerramenta[p.ferramenta] || p.ferramenta}</p>
                  <pre className="text-xs text-stone-500 whitespace-pre-wrap font-sans">{JSON.stringify(p.dados, null, 2)}</pre>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button onClick={confirmarProposta} disabled={salvando} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Confirmar e Salvar</>}
                </Button>
                <Button onClick={cancelarProposta} disabled={salvando} variant="outline" className="rounded-xl border-stone-200 h-10">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {carregando && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              </div>
              <div className="bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm text-stone-400">Pensando...</div>
            </div>
          )}
          <div ref={fimDaListaRef} />
        </div>

        <div className="border-t border-stone-100 p-4 flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
            placeholder="Ex: Goiaba 2, 25 caixas verdes a 50 reais, custo de 4 reais a caixa hoje"
            className="rounded-xl resize-none"
            rows={2}
            disabled={carregando || !!propostaPendente}
          />
          <Button onClick={enviarMensagem} disabled={carregando || !input.trim() || !!propostaPendente} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11 w-11 shrink-0 p-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
