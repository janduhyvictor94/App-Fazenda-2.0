import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Check, X, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

// Normaliza texto pra comparar nomes sem se importar com acento/maiúscula
const normalizar = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Acha um item pelo nome, tolerando acento/maiúscula. Se tiver mais de um
// candidato parecido (nome ambíguo), NÃO escolhe sozinho — melhor perguntar
// de novo do que registrar no talhão/insumo errado.
const encontrarPorNome = (lista, nomeAlvo, campo = 'nome') => {
  if (!nomeAlvo) return { item: null, ambiguo: false };
  const alvo = normalizar(nomeAlvo);

  const exato = lista.find(item => normalizar(item[campo]) === alvo);
  if (exato) return { item: exato, ambiguo: false };

  const parecidos = lista.filter(item => normalizar(item[campo]).includes(alvo) || alvo.includes(normalizar(item[campo])));
  if (parecidos.length === 1) return { item: parecidos[0], ambiguo: false };
  if (parecidos.length > 1) return { item: null, ambiguo: true, opcoes: parecidos.map(p => p[campo]) };
  return { item: null, ambiguo: false };
};

// Busca e já lança um erro claro se não achar (ou se for ambíguo) — usado em
// todo lugar que PRECISA achar o registro pra continuar.
const buscarObrigatorio = (lista, nomeAlvo, tipoLabel) => {
  const { item, ambiguo, opcoes } = encontrarPorNome(lista, nomeAlvo);
  if (ambiguo) throw new Error(`"${nomeAlvo}" é ambíguo — encontrei mais de um ${tipoLabel} parecido (${opcoes.join(', ')}). Seja mais específico.`);
  if (!item) throw new Error(`${tipoLabel} "${nomeAlvo}" não encontrado no cadastro.`);
  return item;
};

// Converte pra número com segurança — nunca deixa passar NaN adiante.
const numero = (v, padrao = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

// A conversa fica guardada no navegador — assim ela sobrevive a um recarregamento
// de página ou troca de aba, e você sempre vê o que já foi mandado.
const CHAVE_MENSAGENS = 'fazenda_assistente_mensagens';
const CHAVE_HISTORICO_API = 'fazenda_assistente_historico';
const CHAVE_PROPOSTA = 'fazenda_assistente_proposta';

const MENSAGEM_INICIAL = [
  { autor: 'ia', texto: 'Oi! Pode me contar o que você quer registrar — colheita, atividade, pagamento, ou até me perguntar algo tipo "quanto gastei com colheita esse mês".' }
];

const carregarDoStorage = (chave, padrao) => {
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? JSON.parse(salvo) : padrao;
  } catch { return padrao; }
};

export default function Assistente() {
  const queryClient = useQueryClient();
  const [mensagens, setMensagens] = useState(() => carregarDoStorage(CHAVE_MENSAGENS, MENSAGEM_INICIAL));
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [historicoAPI, setHistoricoAPI] = useState(() => carregarDoStorage(CHAVE_HISTORICO_API, []));
  const [propostaPendente, setPropostaPendente] = useState(() => carregarDoStorage(CHAVE_PROPOSTA, null));
  const [salvando, setSalvando] = useState(false);
  const fimDaListaRef = useRef(null);

  const { data: talhoes = [], isLoading: carregandoTalhoes } = useQuery({ queryKey: ['talhoes'], queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; } });
  const { data: insumos = [], isLoading: carregandoInsumos } = useQuery({ queryKey: ['insumos'], queryFn: async () => { const { data } = await supabase.from('insumos').select('*'); return data || []; } });
  const { data: funcionarios = [], isLoading: carregandoFuncionarios } = useQuery({ queryKey: ['funcionarios'], queryFn: async () => { const { data } = await supabase.from('funcionarios').select('*'); return data || []; } });
  const contextoCarregando = carregandoTalhoes || carregandoInsumos || carregandoFuncionarios;

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, propostaPendente]);

  // Salva a cada mudança, pra sobreviver a reload/troca de aba
  useEffect(() => { try { localStorage.setItem(CHAVE_MENSAGENS, JSON.stringify(mensagens)); } catch {} }, [mensagens]);
  useEffect(() => { try { localStorage.setItem(CHAVE_HISTORICO_API, JSON.stringify(historicoAPI)); } catch {} }, [historicoAPI]);
  useEffect(() => { try { localStorage.setItem(CHAVE_PROPOSTA, JSON.stringify(propostaPendente)); } catch {} }, [propostaPendente]);

  const novaConversa = () => {
    setMensagens(MENSAGEM_INICIAL);
    setHistoricoAPI([]);
    setPropostaPendente(null);
  };

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
        setHistoricoAPI(dados.historico_atualizado || historicoAPI);
      } else if (dados.tipo === 'proposta') {
        setMensagens(prev => [...prev, { autor: 'ia', texto: dados.resumo }]);
        // Se já existia uma proposta pendente e essa nova é uma correção/complemento
        // dela (ex: você lembrou de mandar o custo depois), ela substitui a anterior.
        setPropostaPendente({ propostas: dados.propostas });
        setHistoricoAPI(dados.historico_atualizado || historicoAPI);
      }
    } catch (err) {
      setMensagens(prev => [...prev, { autor: 'ia', texto: `Não consegui falar com o servidor: ${err.message}` }]);
    } finally {
      setCarregando(false);
    }
  };

  const cancelarProposta = () => {
    setPropostaPendente(null);
    setHistoricoAPI([]); // fecha o "assunto" — próxima mensagem começa do zero, sem risco de ficar preso num estado antigo
    setMensagens(prev => [...prev, { autor: 'ia', texto: 'Ok, não salvei nada.' }]);
  };

  const confirmarProposta = async () => {
    if (!propostaPendente || salvando) return; // trava contra clique duplo
    if (contextoCarregando) {
      setMensagens(prev => [...prev, { autor: 'ia', texto: 'Ainda estou carregando os dados da fazenda, espera só um instante e tenta de novo.' }]);
      return;
    }
    if (!propostaPendente.propostas || propostaPendente.propostas.length === 0) {
      setPropostaPendente(null);
      return;
    }

    setSalvando(true);
    const tabelasAfetadas = new Set();
    const sucessos = [];
    const falhas = [];

    // Processa uma de cada vez — se uma falhar, as outras continuam sendo tentadas,
    // e no final você sabe exatamente o que foi salvo e o que não foi (nunca um
    // erro genérico que esconde o que já entrou no banco).
    for (const item of propostaPendente.propostas) {
      try {
        const tabela = await executarAcao(item.ferramenta, item.dados, { talhoes, insumos, funcionarios });
        if (tabela) tabelasAfetadas.add(tabela);
        sucessos.push(rotuloFerramenta[item.ferramenta] || item.ferramenta);
      } catch (err) {
        falhas.push(`${rotuloFerramenta[item.ferramenta] || item.ferramenta}: ${err.message}`);
      }
    }

    tabelasAfetadas.forEach(t => {
      queryClient.invalidateQueries({ queryKey: [t] });
      if (t === 'colheitas') queryClient.invalidateQueries({ queryKey: ['custos-colheita'] });
      if (t === 'custos') queryClient.invalidateQueries({ queryKey: ['custos-colheita'] });
    });

    let textoResultado = '';
    if (sucessos.length > 0) textoResultado += `✅ Salvo: ${sucessos.join(', ')}.\n`;
    if (falhas.length > 0) textoResultado += `❌ Não salvo:\n${falhas.map(f => `• ${f}`).join('\n')}`;
    setMensagens(prev => [...prev, { autor: 'ia', texto: textoResultado.trim() }]);

    setPropostaPendente(null);
    setHistoricoAPI([]); // conversa "fecha" aqui — próxima mensagem começa limpa
    setSalvando(false);
  };

  // ------------------------------------------------------------------------
  // Executa a ação de verdade no Supabase — mesma lógica/campos que cada
  // página já usa, só que disparada a partir do que a IA organizou.
  // Cada ação valida o que precisa ANTES de tentar salvar, pra nunca gravar
  // um registro pela metade ou com número inválido.
  // ------------------------------------------------------------------------
  const executarAcao = async (ferramenta, dados, ctx) => {
    const hoje = format(new Date(), 'yyyy-MM-dd');

    if (ferramenta === 'registrar_colheita') {
      if (!dados.talhao_nome) throw new Error('Faltou o nome do talhão.');
      const talhao = buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão');
      if (!dados.itens || dados.itens.length === 0) throw new Error('Nenhum item de colheita informado.');

      const data = dados.data || hoje;
      const payload = dados.itens.map((item, idx) => {
        if (!item.tipo_colheita) throw new Error(`Item ${idx + 1}: faltou o tipo de colheita.`);
        const preco = numero(item.preco_unitario, null);
        if (preco === null) throw new Error(`Item ${idx + 1} (${item.tipo_colheita}): faltou o preço.`);
        const qtdKg = numero(item.quantidade_kg, null);
        const qtdCx = numero(item.quantidade_caixas, null);
        const qtdUsada = item.unidade_preco === 'kg' ? (qtdKg || 0) : (qtdCx || 0);
        return {
          talhao_id: talhao.id,
          data,
          cultura: dados.cultura || talhao.cultura,
          tipo_colheita: item.tipo_colheita,
          quantidade_kg: qtdKg,
          quantidade_caixas: qtdCx,
          preco_unitario: preco,
          unidade_preco: item.unidade_preco || 'caixa',
          valor_total: qtdUsada * preco
        };
      });
      const { error } = await supabase.from('colheitas').insert(payload);
      if (error) throw error;

      const custoUnit = numero(dados.custo_colheita_unitario, 0);
      if (custoUnit > 0) {
        const somaQtd = dados.itens.reduce((acc, item) => acc + (dados.custo_unidade === 'kg' ? numero(item.quantidade_kg) : numero(item.quantidade_caixas)), 0);
        const custoTotal = somaQtd * custoUnit;
        if (custoTotal > 0) {
          // Antes de criar o custo, checa se já não existe um pra esse talhão/dia —
          // evita duplicar se você (ou a IA) mandar a mesma colheita duas vezes.
          const { data: custoExistente } = await supabase.from('custos').select('id, descricao, valor').eq('categoria', 'colheita').eq('talhao_id', talhao.id).eq('data', data).limit(1);
          if (custoExistente && custoExistente.length > 0) {
            throw new Error(`Já existe um custo de colheita lançado pra ${talhao.nome} em ${data} (R$${custoExistente[0].valor}). As caixas foram registradas, mas o custo NÃO foi duplicado — edite o lançamento existente no Financeiro se precisar ajustar o valor.`);
          }
          const resumoTipos = dados.itens.map(i => i.tipo_colheita).join(' + ');
          const { error: errCusto } = await supabase.from('custos').insert({
            descricao: `Colheita - ${resumoTipos} - ${talhao.nome}`,
            categoria: 'colheita',
            talhao_id: talhao.id,
            valor: custoTotal,
            data,
            status_pagamento: 'pendente',
            tipo_lancamento: 'despesa',
            observacoes: `Custo de colheita (via assistente): R$ ${custoUnit}/${dados.custo_unidade || 'caixa'}`
          });
          if (errCusto) throw errCusto;
        }
      }
      return 'colheitas';
    }

    if (ferramenta === 'registrar_atividade') {
      if (!dados.talhao_nome) throw new Error('Faltou o nome do talhão.');
      if (!dados.tipo) throw new Error('Faltou o tipo da atividade.');
      const talhao = buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão');

      const insumosResolvidos = [];
      for (const i of (dados.insumos || [])) {
        if (!i.nome_insumo) continue;
        const insumo = buscarObrigatorio(ctx.insumos, i.nome_insumo, 'Insumo');
        const qtd = numero(i.quantidade, 0);
        if (qtd <= 0) throw new Error(`Quantidade inválida pro insumo "${i.nome_insumo}".`);
        const precoPorUnidade = numero(insumo.preco_unitario) / (numero(insumo.tamanho_embalagem) || 1);
        insumosResolvidos.push({
          insumo_id: insumo.id,
          nome: insumo.nome,
          quantidade: qtd,
          unidade: insumo.unidade,
          valor_unitario: precoPorUnidade,
          valor_total: qtd * precoPorUnidade,
          metodo_aplicacao: 'adubacao'
        });
      }
      const terceirizada = !!dados.terceirizada;
      const valorTerceirizado = terceirizada ? numero(dados.valor_terceirizado, 0) : 0;
      const custoInsumos = insumosResolvidos.reduce((acc, i) => acc + i.valor_total, 0);
      const custoTotal = custoInsumos + valorTerceirizado;

      const { error } = await supabase.from('atividades').insert({
        talhao_id: talhao.id,
        tipo: dados.tipo,
        data_programada: dados.data_programada || hoje,
        status: 'programada',
        terceirizada,
        valor_terceirizado: terceirizada ? valorTerceirizado : null,
        insumos_utilizados: insumosResolvidos,
        custo_total: custoTotal,
        responsavel: dados.responsavel || null,
        observacoes: dados.observacoes || null
      });
      if (error) throw error;
      return 'atividades';
    }

    if (ferramenta === 'registrar_pagamento') {
      if (!dados.descricao) throw new Error('Faltou a descrição do pagamento.');
      const valor = numero(dados.valor, null);
      if (!valor || valor <= 0) throw new Error('Valor inválido.');
      const talhao = dados.talhao_nome ? buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão') : null;
      const { error } = await supabase.from('custos').insert({
        descricao: dados.descricao,
        categoria: dados.categoria || 'outro',
        talhao_id: talhao?.id || null,
        valor,
        data: dados.data || hoje,
        status_pagamento: dados.ja_pago ? 'pago' : 'pendente',
        tipo_lancamento: 'despesa'
      });
      if (error) throw error;
      return 'custos';
    }

    if (ferramenta === 'criar_talhao') {
      if (!dados.nome) throw new Error('Faltou o nome do talhão.');
      const { error } = await supabase.from('talhoes').insert({
        nome: dados.nome,
        area_hectares: dados.area_hectares ? numero(dados.area_hectares) : null,
        cultura: dados.cultura || null,
        variedade: dados.variedade || null,
        data_plantio: dados.data_plantio || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'talhoes';
    }

    if (ferramenta === 'criar_funcionario') {
      if (!dados.nome) throw new Error('Faltou o nome do funcionário.');
      const talhao = dados.talhao_nome ? buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão') : null;
      const { error } = await supabase.from('funcionarios').insert({
        nome: dados.nome,
        cargo: dados.cargo || null,
        salario: dados.salario ? numero(dados.salario) : null,
        data_admissao: dados.data_admissao || hoje,
        talhao_id: talhao?.id || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'funcionarios';
    }

    if (ferramenta === 'registrar_chuva') {
      const mm = numero(dados.quantidade_mm, null);
      if (mm === null || mm < 0) throw new Error('Quantidade de chuva inválida.');
      const talhao = dados.talhao_nome ? buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão') : null;
      const { error } = await supabase.from('pluviometria').insert({
        data: dados.data || hoje,
        quantidade_mm: mm,
        talhao_id: talhao?.id || null
      });
      if (error) throw error;
      return 'pluviometria';
    }

    if (ferramenta === 'criar_insumo') {
      if (!dados.nome) throw new Error('Faltou o nome do insumo.');
      if (!dados.unidade) throw new Error('Faltou a unidade do insumo.');
      const preco = numero(dados.preco_unitario, null);
      if (preco === null || preco < 0) throw new Error('Preço inválido.');
      const { error } = await supabase.from('insumos').insert({
        nome: dados.nome,
        categoria: dados.categoria || 'outro',
        unidade: dados.unidade,
        preco_unitario: preco,
        tamanho_embalagem: dados.tamanho_embalagem ? numero(dados.tamanho_embalagem) : null,
        estoque_atual: numero(dados.estoque_atual, 0)
      });
      if (error) throw error;
      return 'insumos';
    }

    if (ferramenta === 'criar_safra') {
      if (!dados.nome) throw new Error('Faltou o nome da safra.');
      if (!dados.talhao_nome) throw new Error('Faltou o nome do talhão.');
      const talhao = buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão');
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
      if (!dados.consultor_nome) throw new Error('Faltou o nome do consultor.');
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

  // Resumo legível de cada proposta, pra você conferir de relance antes de
  // confirmar — em vez de precisar ler um JSON cru pra notar se faltou algo.
  const resumoProposta = (ferramenta, dados) => {
    const linhas = [];
    if (ferramenta === 'registrar_colheita') {
      linhas.push(`Talhão: ${dados.talhao_nome || '?'}`);
      linhas.push(`Data: ${dados.data || 'hoje'}`);
      (dados.itens || []).forEach(i => {
        const qtd = i.unidade_preco === 'kg' ? `${i.quantidade_kg ?? '?'}kg` : `${i.quantidade_caixas ?? '?'}cx`;
        linhas.push(`• ${i.tipo_colheita}: ${qtd} a R$${i.preco_unitario}/${i.unidade_preco}`);
      });
      if (dados.custo_colheita_unitario) {
        linhas.push(`Custo de colheita: R$${dados.custo_colheita_unitario}/${dados.custo_unidade}`);
      } else {
        linhas.push(`Custo de colheita: NÃO informado`);
      }
    } else if (ferramenta === 'registrar_atividade') {
      linhas.push(`Talhão: ${dados.talhao_nome || '?'} · Tipo: ${dados.tipo || '?'}`);
      linhas.push(`Data: ${dados.data_programada || 'hoje'}`);
      (dados.insumos || []).forEach(i => linhas.push(`• ${i.nome_insumo}: ${i.quantidade}`));
      linhas.push(dados.terceirizada ? `Terceirizada — Responsável: ${dados.responsavel || '?'} · Valor: R$${dados.valor_terceirizado ?? '?'}` : `Executada por: ${dados.responsavel || '(não informado)'}`);
    } else if (ferramenta === 'registrar_pagamento') {
      linhas.push(`${dados.descricao} — R$${dados.valor}`);
      linhas.push(`Categoria: ${dados.categoria || '?'} · Data: ${dados.data || 'hoje'}`);
      linhas.push(dados.talhao_nome ? `Talhão: ${dados.talhao_nome}` : `Geral (entra no rateio por área)`);
      linhas.push(dados.ja_pago ? 'Status: já pago' : 'Status: pendente');
    } else {
      // Ações de cadastro simples (talhão, funcionário, insumo, safra, consultoria, chuva)
      Object.entries(dados).forEach(([chave, valor]) => {
        if (valor !== null && valor !== undefined && valor !== '') linhas.push(`${chave}: ${valor}`);
      });
    }
    return linhas;
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="bg-white p-6 rounded-[1.5rem] border border-stone-100 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Assistente</h1>
            <p className="text-stone-500 font-medium">Escreva o que quer registrar ou pergunte algo sobre seus dados</p>
          </div>
        </div>
        <Button onClick={novaConversa} variant="outline" className="rounded-xl border-stone-200 text-stone-500 hover:bg-stone-50 shrink-0">
          <Trash2 className="w-4 h-4 mr-2" /> Nova Conversa
        </Button>
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
                  <p className="font-bold text-stone-800 mb-1.5">{rotuloFerramenta[p.ferramenta] || p.ferramenta}</p>
                  <div className="space-y-0.5">
                    {resumoProposta(p.ferramenta, p.dados).map((linha, i) => (
                      <p key={i} className={linha.includes('NÃO informado') ? 'text-xs font-bold text-red-600' : 'text-xs text-stone-600'}>{linha}</p>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button onClick={confirmarProposta} disabled={salvando || contextoCarregando} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : contextoCarregando ? 'Carregando dados...' : <><Check className="w-4 h-4 mr-2" /> Confirmar e Salvar</>}
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
            disabled={carregando}
          />
          <Button onClick={enviarMensagem} disabled={carregando || !input.trim()} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11 w-11 shrink-0 p-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
