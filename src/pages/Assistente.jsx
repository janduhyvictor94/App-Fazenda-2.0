import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Check, X, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { calcularFolha } from './Funcionarios';

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

// Tabelas em que a exclusão pelo assistente é permitida — dados do dia a dia, sem
// dependência entre tabelas. Talhões/funcionários/insumos/safras ficam de fora de
// propósito (têm tratamento especial nas telas próprias).
const TABELAS_EXCLUSAO_PERMITIDAS = ['colheitas', 'atividades', 'custos', 'pluviometria', 'consultorias'];

const CAMPO_DATA_POR_TABELA = { colheitas: 'data', custos: 'data', pluviometria: 'data', atividades: 'data_programada', consultorias: 'data_visita' };

// Busca de verdade no banco o que combina com os filtros que a IA extraiu — a
// exclusão nunca acontece "de olhos fechados", sempre em cima do que existe.
const buscarPreviewExclusao = async (dados, ctx) => {
  const { tabela, talhao_nome, data, data_inicio, data_fim, tipo_ou_categoria, texto_descricao } = dados;
  if (!TABELAS_EXCLUSAO_PERMITIDAS.includes(tabela)) {
    throw new Error(`Não é possível excluir dados de "${tabela}" pelo assistente — talhões, funcionários, insumos e safras têm dependências entre tabelas e precisam ser excluídos na tela própria.`);
  }

  let query = supabase.from(tabela).select('*');
  const campoData = CAMPO_DATA_POR_TABELA[tabela];

  if (talhao_nome) {
    const { item: talhao } = encontrarPorNome(ctx.talhoes, talhao_nome);
    if (!talhao) throw new Error(`Talhão "${talhao_nome}" não encontrado.`);
    query = query.eq('talhao_id', talhao.id);
  }
  if (data) query = query.eq(campoData, data);
  if (data_inicio) query = query.gte(campoData, data_inicio);
  if (data_fim) query = query.lte(campoData, data_fim);
  if (tipo_ou_categoria) {
    const campoTipo = tabela === 'colheitas' ? 'tipo_colheita' : tabela === 'atividades' ? 'tipo' : tabela === 'custos' ? 'categoria' : null;
    if (campoTipo) query = query.ilike(campoTipo, `%${tipo_ou_categoria}%`);
  }
  if (texto_descricao) {
    const campoTexto = tabela === 'custos' ? 'descricao' : tabela === 'consultorias' ? 'consultor_nome' : null;
    if (campoTexto) query = query.ilike(campoTexto, `%${texto_descricao}%`);
  }

  const { data: registros, error } = await query.limit(300);
  if (error) throw error;
  return registros || [];
};

// Valor monetário de um registro, quando existir (pra mostrar o total afetado).
const valorRegistro = (tabela, r) => {
  if (tabela === 'colheitas') return r.valor_total || 0;
  if (tabela === 'atividades') return r.custo_total || 0;
  if (tabela === 'custos') return r.valor || 0;
  return 0;
};

// Descrição legível de um registro pra mostrar na lista de confirmação.
const descreverRegistro = (tabela, r, talhoes) => {
  const nomeTalhao = (id) => talhoes.find(t => t.id === id)?.nome || 'Geral';
  if (tabela === 'colheitas') return `${r.data} · ${nomeTalhao(r.talhao_id)} · ${r.tipo_colheita} · R$${(r.valor_total || 0).toFixed(2)}`;
  if (tabela === 'atividades') return `${r.data_programada} · ${nomeTalhao(r.talhao_id)} · ${r.tipo} · R$${(r.custo_total || 0).toFixed(2)}`;
  if (tabela === 'custos') return `${r.data} · ${r.descricao} · R$${(r.valor || 0).toFixed(2)}`;
  if (tabela === 'pluviometria') return `${r.data} · ${nomeTalhao(r.talhao_id)} · ${r.quantidade_mm}mm`;
  if (tabela === 'consultorias') return `${r.data_visita} · ${r.consultor_nome}`;
  return JSON.stringify(r);
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
  const [confirmacaoExtra, setConfirmacaoExtra] = useState('');
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
        // Se a proposta envolve excluir dados, busca AGORA os registros reais que
        // combinam com o filtro — a exclusão nunca acontece "no escuro", só em cima
        // do que realmente existe no banco.
        const propostasComPreview = await Promise.all(dados.propostas.map(async (p) => {
          if (p.ferramenta !== 'excluir_dados') return p;
          try {
            const registros = await buscarPreviewExclusao(p.dados, { talhoes });
            return { ...p, __preview: registros };
          } catch (err) {
            return { ...p, __previewErro: err.message };
          }
        }));
        setConfirmacaoExtra('');
        // Se já existia uma proposta pendente e essa nova é uma correção/complemento
        // dela (ex: você lembrou de mandar o custo depois), ela substitui a anterior.
        setPropostaPendente({ propostas: propostasComPreview });
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
    setConfirmacaoExtra('');
    setHistoricoAPI([]); // fecha o "assunto" — próxima mensagem começa do zero, sem risco de ficar preso num estado antigo
    setMensagens(prev => [...prev, { autor: 'ia', texto: 'Ok, não salvei nada.' }]);
  };

  // Quantos registros no total seriam excluídos por essa proposta (soma de todos
  // os itens de excluir_dados) — usado pra decidir se pede a confirmação extra.
  const totalParaExcluir = propostaPendente?.propostas.filter(p => p.ferramenta === 'excluir_dados').reduce((acc, p) => acc + (p.__preview?.length || 0), 0) || 0;
  const temExclusaoEmMassa = totalParaExcluir > 3;

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
    // Exclusão de mais de 3 registros exige digitar "EXCLUIR" antes de confirmar —
    // fricção proporcional ao risco, pra evitar apagar em massa por engano.
    if (temExclusaoEmMassa && confirmacaoExtra.trim().toUpperCase() !== 'EXCLUIR') {
      setMensagens(prev => [...prev, { autor: 'ia', texto: `Isso vai excluir ${totalParaExcluir} registros — digite "EXCLUIR" no campo indicado pra confirmar.` }]);
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
        if (item.ferramenta === 'excluir_dados') {
          if (item.__previewErro) throw new Error(item.__previewErro);
          const registros = item.__preview || [];
          if (registros.length === 0) {
            sucessos.push(`Exclusão em ${item.dados.tabela}: nenhum registro encontrado com esses filtros — nada foi excluído.`);
          } else {
            const ids = registros.map(r => r.id);
            const { error } = await supabase.from(item.dados.tabela).delete().in('id', ids);
            if (error) throw error;
            sucessos.push(`Excluídos ${ids.length} registro(s) de ${item.dados.tabela}.`);
            tabelasAfetadas.add(item.dados.tabela);
            if (item.dados.tabela === 'custos') tabelasAfetadas.add('custos-colheita');
          }
          continue;
        }

        const tabela = await executarAcao(item.ferramenta, item.dados, { talhoes, insumos, funcionarios });
        if (tabela) tabelasAfetadas.add(tabela);
        if (item.dados.__relatorio) {
          sucessos.push(`${rotuloFerramenta[item.ferramenta] || item.ferramenta}:\n${item.dados.__relatorio.map(l => `  - ${l}`).join('\n')}`);
        } else {
          sucessos.push(rotuloFerramenta[item.ferramenta] || item.ferramenta);
        }
      } catch (err) {
        falhas.push(`${rotuloFerramenta[item.ferramenta] || item.ferramenta}: ${err.message}`);
      }
    }

    tabelasAfetadas.forEach(t => {
      queryClient.invalidateQueries({ queryKey: [t] });
      if (t === 'colheitas' || t === 'custos') queryClient.invalidateQueries({ queryKey: ['custos-colheita'] });
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
          // Só bloqueia se já existir um custo IDÊNTICO (mesmo talhão, mesmo dia, MESMO
          // VALOR) — isso sim é sinal forte de reenvio acidental. Duas colheitas
          // diferentes no mesmo dia (ex: manhã e tarde), com valores diferentes, são
          // lançamentos legítimos e distintos — não devem ser bloqueados.
          const { data: custosDoDia } = await supabase.from('custos').select('id, descricao, valor').eq('categoria', 'colheita').eq('talhao_id', talhao.id).eq('data', data);
          const duplicataExata = (custosDoDia || []).find(c => Math.abs((c.valor || 0) - custoTotal) < 0.01);
          if (duplicataExata) {
            throw new Error(`Já existe um custo de colheita IDÊNTICO (R$${custoTotal.toFixed(2)}) lançado pra ${talhao.nome} em ${data} — parece repetição da mesma colheita. As caixas foram registradas, mas esse custo específico NÃO foi duplicado. Se for realmente uma colheita diferente no mesmo dia, confira o lançamento no Financeiro.`);
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
      const dataProgramada = dados.data_programada || hoje;

      // Só bloqueia se já existir uma atividade IDÊNTICA (mesmo talhão, mesmo tipo,
      // mesma data, mesmo custo total) — duas atividades diferentes no mesmo dia/tipo
      // com custo diferente são legítimas e não devem ser bloqueadas.
      const { data: atividadesDoDia } = await supabase.from('atividades').select('id, custo_total').eq('talhao_id', talhao.id).eq('tipo', dados.tipo).eq('data_programada', dataProgramada);
      if ((atividadesDoDia || []).some(a => Math.abs((a.custo_total || 0) - custoTotal) < 0.01)) {
        throw new Error(`Já existe uma atividade IDÊNTICA (${dados.tipo}, mesmo talhão, mesma data, mesmo custo R$${custoTotal.toFixed(2)}) — parece repetição. Se for uma atividade diferente, ajuste algum dado (ex: quantidade de insumo) que confirme que não é repetição.`);
      }

      const { error } = await supabase.from('atividades').insert({
        talhao_id: talhao.id,
        tipo: dados.tipo,
        data_programada: dataProgramada,
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
      const data = dados.data || hoje;

      // Só bloqueia se já existir um pagamento IDÊNTICO (mesma descrição, mesmo talhão
      // — ou ambos sem talhão —, mesma data, mesmo valor).
      const { data: pagamentosDoDia } = await supabase.from('custos').select('id, descricao, talhao_id, valor').eq('data', data).eq('descricao', dados.descricao);
      const talhaoIdNovo = talhao?.id || null;
      if ((pagamentosDoDia || []).some(p => (p.talhao_id || null) === talhaoIdNovo && Math.abs((p.valor || 0) - valor) < 0.01)) {
        throw new Error(`Já existe um pagamento IDÊNTICO ("${dados.descricao}", R$${valor.toFixed(2)}, mesma data) — parece repetição. Se for um pagamento diferente, ajuste a descrição ou o valor.`);
      }

      const { error } = await supabase.from('custos').insert({
        descricao: dados.descricao,
        categoria: dados.categoria || 'outro',
        talhao_id: talhaoIdNovo,
        valor,
        data,
        status_pagamento: dados.ja_pago ? 'pago' : 'pendente',
        tipo_lancamento: 'despesa'
      });
      if (error) throw error;
      return 'custos';
    }

    if (ferramenta === 'criar_talhao') {
      if (!dados.nome) throw new Error('Faltou o nome do talhão.');
      // Nome de talhão é único por natureza — se já existe um com esse nome, é quase
      // certamente o mesmo talhão sendo cadastrado de novo por engano.
      if (encontrarPorNome(ctx.talhoes, dados.nome).item) {
        throw new Error(`Já existe um talhão chamado "${dados.nome}" — se quiser editar ele, use a tela de Talhões em vez de cadastrar de novo.`);
      }
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
      const dataAdmissao = dados.data_admissao || hoje;

      // Bloqueia só se mesmo nome E mesma data de admissão — duas pessoas podem ter
      // nome igual, mas dificilmente entram na empresa no mesmo dia por coincidência.
      const nomeNormalizado = normalizar(dados.nome);
      const { item: funcExistente } = encontrarPorNome(ctx.funcionarios, dados.nome);
      if (funcExistente) {
        const { data: mesmaAdmissao } = await supabase.from('funcionarios').select('id').eq('id', funcExistente.id).eq('data_admissao', dataAdmissao);
        if (mesmaAdmissao && mesmaAdmissao.length > 0) {
          throw new Error(`Já existe um funcionário chamado "${dados.nome}" admitido em ${dataAdmissao} — parece repetição. Se for uma pessoa diferente, confirme o nome completo pra diferenciar.`);
        }
      }

      const { error } = await supabase.from('funcionarios').insert({
        nome: dados.nome,
        cargo: dados.cargo || null,
        salario: dados.salario ? numero(dados.salario) : null,
        data_admissao: dataAdmissao,
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
      const data = dados.data || hoje;
      const talhaoIdNovo = talhao?.id || null;

      // Só bloqueia se já existir uma medição IDÊNTICA (mesmo talhão — ou ambos sem
      // talhão —, mesma data, mesmo mm). Duas medições no mesmo dia com valores
      // diferentes (ex: correção, ou postos diferentes) são legítimas.
      const { data: chuvasDoDia } = await supabase.from('pluviometria').select('id, talhao_id, quantidade_mm').eq('data', data);
      if ((chuvasDoDia || []).some(c => (c.talhao_id || null) === talhaoIdNovo && Math.abs((c.quantidade_mm || 0) - mm) < 0.01)) {
        throw new Error(`Já existe uma medição de chuva IDÊNTICA (${mm}mm, mesmo talhão, mesma data) — parece repetição.`);
      }

      const { error } = await supabase.from('pluviometria').insert({
        data,
        quantidade_mm: mm,
        talhao_id: talhaoIdNovo
      });
      if (error) throw error;
      return 'pluviometria';
    }

    if (ferramenta === 'criar_insumo') {
      if (!dados.nome) throw new Error('Faltou o nome do insumo.');
      if (!dados.unidade) throw new Error('Faltou a unidade do insumo.');
      const preco = numero(dados.preco_unitario, null);
      if (preco === null || preco < 0) throw new Error('Preço inválido.');
      // Nome de insumo repetido quase sempre é o mesmo item sendo cadastrado de novo.
      if (encontrarPorNome(ctx.insumos, dados.nome).item) {
        throw new Error(`Já existe um insumo chamado "${dados.nome}" — se quiser atualizar o preço/estoque dele, use a tela de Insumos em vez de cadastrar de novo.`);
      }
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

      // Mesmo nome de safra no mesmo talhão é quase certamente repetição.
      const { data: safrasExistentes } = await supabase.from('safras').select('id, nome').eq('talhao_id', talhao.id);
      if ((safrasExistentes || []).some(s => normalizar(s.nome) === normalizar(dados.nome))) {
        throw new Error(`Já existe uma safra chamada "${dados.nome}" nesse talhão — parece repetição.`);
      }

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

    if (ferramenta === 'marcar_folha_paga') {
      const mes = numero(dados.mes, null);
      const ano = numero(dados.ano, null);
      if (!mes || mes < 1 || mes > 12) throw new Error('Mês inválido (use 1 a 12).');
      if (!ano) throw new Error('Faltou o ano.');

      // Se não especificar nomes, aplica a TODOS os funcionários ativos.
      const nomesAlvo = dados.funcionarios && dados.funcionarios.length > 0 ? dados.funcionarios : null;
      const funcionariosAlvo = nomesAlvo
        ? nomesAlvo.map(n => buscarObrigatorio(ctx.funcionarios, n, 'Funcionário'))
        : ctx.funcionarios.filter(f => f.status === 'ativo');
      if (funcionariosAlvo.length === 0) throw new Error('Nenhum funcionário encontrado.');

      // Busca os custos de folha já lançados, pra saber se cada um já existe (e só
      // muda o status) ou precisa ser criado (usando o salário já cadastrado — nunca
      // um valor perguntado, ele já está no cadastro do funcionário).
      const { data: custosFuncionarios } = await supabase.from('custos').select('*').eq('categoria', 'funcionario');
      const idAlvo = `salario-${ano}-${String(mes).padStart(2, '0')}`;
      const relatorio = [];

      for (const func of funcionariosAlvo) {
        const eventos = calcularFolha(func);
        const evento = eventos.find(e => e.id === idAlvo);
        if (!evento) {
          relatorio.push(`${func.nome}: sem salário devido nesse mês (fora do período contratado).`);
          continue;
        }

        const existente = (custosFuncionarios || []).find(c =>
          c.descricao?.includes(func.nome) && c.descricao?.includes(evento.tipo) && isSameMonth(parseISO(c.data), evento.data_pagamento)
        );

        if (existente) {
          if (existente.status_pagamento === 'pago') {
            relatorio.push(`${func.nome}: já estava marcado como pago (R$${evento.valor.toFixed(2)}).`);
          } else {
            const { error } = await supabase.from('custos').update({ status_pagamento: 'pago' }).eq('id', existente.id);
            if (error) throw error;
            relatorio.push(`${func.nome}: marcado como pago (R$${evento.valor.toFixed(2)}).`);
          }
        } else {
          const { error } = await supabase.from('custos').insert({
            descricao: `Folha: ${evento.tipo} - ${func.nome}`,
            categoria: 'funcionario',
            valor: parseFloat(evento.valor.toFixed(2)),
            data: format(evento.data_pagamento, 'yyyy-MM-dd'),
            status_pagamento: 'pago',
            tipo_lancamento: 'despesa',
            observacoes: `Ref: ${evento.referencia}. ${evento.detalhe} (lançado e pago via assistente)`,
            talhao_id: func.talhao_id || null
          });
          if (error) throw error;
          relatorio.push(`${func.nome}: lançado e marcado como pago (R$${evento.valor.toFixed(2)}).`);
        }
      }
      // Guarda o relatório detalhado pra mostrar no resultado final (ver confirmarProposta)
      dados.__relatorio = relatorio;
      return 'custos';
    }

    if (ferramenta === 'registrar_consultoria') {
      if (!dados.consultor_nome) throw new Error('Faltou o nome do consultor.');
      const dataVisita = dados.data_visita || hoje;

      // Mesmo consultor, mesma data de visita = quase certamente repetição.
      const { data: consultoriasNoDia } = await supabase.from('consultorias').select('id, consultor_nome').eq('data_visita', dataVisita);
      if ((consultoriasNoDia || []).some(c => normalizar(c.consultor_nome) === normalizar(dados.consultor_nome))) {
        throw new Error(`Já existe uma visita de "${dados.consultor_nome}" registrada em ${dataVisita} — parece repetição.`);
      }

      const { error } = await supabase.from('consultorias').insert({
        consultor_nome: dados.consultor_nome,
        data_visita: dataVisita,
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
    registrar_consultoria: 'Consultoria',
    marcar_folha_paga: 'Pagamento de Folha',
    excluir_dados: 'Exclusão de Dados'
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
    } else if (ferramenta === 'marcar_folha_paga') {
      linhas.push(`Mês: ${dados.mes}/${dados.ano}`);
      linhas.push(dados.funcionarios && dados.funcionarios.length > 0 ? `Funcionários: ${dados.funcionarios.join(', ')}` : 'Funcionários: TODOS os ativos');
      linhas.push('O valor de cada um vem do salário já cadastrado.');
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

          {propostaPendente && (() => {
            const algumaExclusao = propostaPendente.propostas.some(p => p.ferramenta === 'excluir_dados');
            return (
            <div className={`ml-11 rounded-2xl p-4 space-y-3 border ${algumaExclusao ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wide ${algumaExclusao ? 'text-red-800' : 'text-emerald-800'}`}>
                {algumaExclusao ? '⚠️ Confirme a exclusão' : 'Confirme antes de salvar'}
              </p>
              {propostaPendente.propostas.map((p, idx) => {
                if (p.ferramenta === 'excluir_dados') {
                  return (
                    <div key={idx} className="bg-white rounded-xl p-3 border border-red-100 text-sm">
                      <p className="font-bold text-red-700 mb-1.5">Excluir de: {p.dados.tabela}</p>
                      {p.__previewErro ? (
                        <p className="text-xs font-bold text-red-600">{p.__previewErro}</p>
                      ) : !p.__preview || p.__preview.length === 0 ? (
                        <p className="text-xs text-stone-500 italic">Nenhum registro encontrado com esses filtros — nada será excluído.</p>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-red-600 mb-2">
                            {p.__preview.length} registro(s) encontrado(s)
                            {valorRegistro(p.dados.tabela, p.__preview[0]) !== undefined && p.__preview.some(r => valorRegistro(p.dados.tabela, r) > 0) && (
                              <> · total R$ {p.__preview.reduce((acc, r) => acc + valorRegistro(p.dados.tabela, r), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>
                            )}
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1 border border-stone-100 rounded-lg p-2 bg-stone-50">
                            {p.__preview.map(r => (
                              <p key={r.id} className="text-[11px] text-stone-600">{descreverRegistro(p.dados.tabela, r, talhoes)}</p>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={idx} className="bg-white rounded-xl p-3 border border-emerald-100 text-sm">
                    <p className="font-bold text-stone-800 mb-1.5">{rotuloFerramenta[p.ferramenta] || p.ferramenta}</p>
                    <div className="space-y-0.5">
                      {resumoProposta(p.ferramenta, p.dados).map((linha, i) => (
                        <p key={i} className={linha.includes('NÃO informado') ? 'text-xs font-bold text-red-600' : 'text-xs text-stone-600'}>{linha}</p>
                      ))}
                    </div>
                  </div>
                );
              })}

              {temExclusaoEmMassa && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-bold text-red-700">Isso vai excluir {totalParaExcluir} registros de uma vez. Digite EXCLUIR pra confirmar:</p>
                  <input
                    value={confirmacaoExtra}
                    onChange={(e) => setConfirmacaoExtra(e.target.value)}
                    placeholder="EXCLUIR"
                    className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={confirmarProposta}
                  disabled={salvando || contextoCarregando || (temExclusaoEmMassa && confirmacaoExtra.trim().toUpperCase() !== 'EXCLUIR')}
                  className={`flex-1 rounded-xl text-white font-bold h-10 ${algumaExclusao ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : contextoCarregando ? 'Carregando dados...' : algumaExclusao ? <><Trash2 className="w-4 h-4 mr-2" /> Excluir Permanentemente</> : <><Check className="w-4 h-4 mr-2" /> Confirmar e Salvar</>}
                </Button>
                <Button onClick={cancelarProposta} disabled={salvando} variant="outline" className="rounded-xl border-stone-200 h-10">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            );
          })()}

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
