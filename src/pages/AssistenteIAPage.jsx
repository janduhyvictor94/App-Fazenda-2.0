import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { calcularFolha } from '../lib/folha.js';
import { format, isSameMonth, parseISO } from 'date-fns';
import {
  Sparkles,
  Send,
  Check,
  X,
  Loader2,
  Bot,
  User,
  Trash2,
  MessageCircle,
  Camera,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

// ---------------------------------------------------------------------------
// PORTADO de produção (App-Fazenda-2.0/src/pages/Assistente.jsx) — mesma
// lógica de leitura/escrita, mesmas travas de segurança (duplicata, exclusão
// em massa), só o visual foi refeito pro tema escuro deste protótipo e a
// origem dos dados (talhões/insumos/funcionários) trocada pra `dados`, que
// o App.jsx já carrega uma vez só — em vez de@tanstack/react-query, que este
// protótipo não usa. Depois de confirmar uma proposta, chama `recarregar()`
// (a mesma função usada por Notas Fiscais/Metas/Planejamentos) pra atualizar
// o resto do app com o que acabou de ser salvo.
// ---------------------------------------------------------------------------

const normalizar = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const encontrarPorNome = (lista, nomeAlvo, campo = 'nome') => {
  if (!nomeAlvo) return { item: null, ambiguo: false };
  const alvo = normalizar(nomeAlvo);
  const exato = lista.find((item) => normalizar(item[campo]) === alvo);
  if (exato) return { item: exato, ambiguo: false };
  const parecidos = lista.filter((item) => normalizar(item[campo]).includes(alvo) || alvo.includes(normalizar(item[campo])));
  if (parecidos.length === 1) return { item: parecidos[0], ambiguo: false };
  if (parecidos.length > 1) return { item: null, ambiguo: true, opcoes: parecidos.map((p) => p[campo]) };
  return { item: null, ambiguo: false };
};

const buscarObrigatorio = (lista, nomeAlvo, tipoLabel) => {
  const { item, ambiguo, opcoes } = encontrarPorNome(lista, nomeAlvo);
  if (ambiguo) throw new Error(`"${nomeAlvo}" é ambíguo — encontrei mais de um ${tipoLabel} parecido (${opcoes.join(', ')}). Seja mais específico.`);
  if (!item) throw new Error(`${tipoLabel} "${nomeAlvo}" não encontrado no cadastro.`);
  return item;
};

const numero = (v, padrao = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

const TABELAS_EXCLUSAO_PERMITIDAS = ['colheitas', 'atividades', 'custos', 'pluviometria', 'consultorias'];
const CAMPO_DATA_POR_TABELA = { colheitas: 'data', custos: 'data', pluviometria: 'data', atividades: 'data_programada', consultorias: 'data_visita' };

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

const valorRegistro = (tabela, r) => {
  if (tabela === 'colheitas') return r.valor_total || 0;
  if (tabela === 'atividades') return r.custo_total || 0;
  if (tabela === 'custos') return r.valor || 0;
  return 0;
};

const descreverRegistro = (tabela, r, talhoes) => {
  const nomeTalhao = (id) => talhoes.find((t) => t.id === id)?.nome || 'Geral';
  if (tabela === 'colheitas') return `${r.data} · ${nomeTalhao(r.talhao_id)} · ${r.tipo_colheita} · R$${(r.valor_total || 0).toFixed(2)}`;
  if (tabela === 'atividades') return `${r.data_programada} · ${nomeTalhao(r.talhao_id)} · ${r.tipo} · R$${(r.custo_total || 0).toFixed(2)}`;
  if (tabela === 'custos') return `${r.data} · ${r.descricao} · R$${(r.valor || 0).toFixed(2)}`;
  if (tabela === 'pluviometria') return `${r.data} · ${nomeTalhao(r.talhao_id)} · ${r.quantidade_mm}mm`;
  if (tabela === 'consultorias') return `${r.data_visita} · ${r.consultor_nome}`;
  return JSON.stringify(r);
};

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
  } catch {
    return padrao;
  }
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

const resumoProposta = (ferramenta, dados) => {
  const linhas = [];
  if (ferramenta === 'registrar_colheita') {
    linhas.push(`Talhão: ${dados.talhao_nome || '?'}`);
    linhas.push(`Data: ${dados.data || 'hoje'}`);
    (dados.itens || []).forEach((i) => {
      const qtd = i.unidade_preco === 'kg' ? `${i.quantidade_kg ?? '?'}kg` : `${i.quantidade_caixas ?? '?'}cx`;
      linhas.push(`• ${i.tipo_colheita}: ${qtd} a R$${i.preco_unitario}/${i.unidade_preco}`);
    });
    linhas.push(dados.custo_colheita_unitario ? `Custo de colheita: R$${dados.custo_colheita_unitario}/${dados.custo_unidade}` : 'Custo de colheita: NÃO informado');
  } else if (ferramenta === 'registrar_atividade') {
    linhas.push(`Talhão: ${dados.talhao_nome || '?'} · Tipo: ${dados.tipo || '?'}`);
    linhas.push(`Data: ${dados.data_programada || 'hoje'}`);
    (dados.insumos || []).forEach((i) => linhas.push(`• ${i.nome_insumo}: ${i.quantidade}`));
    linhas.push(dados.terceirizada ? `Terceirizada — Responsável: ${dados.responsavel || '?'} · Valor: R$${dados.valor_terceirizado ?? '?'}` : `Executada por: ${dados.responsavel || '(não informado)'}`);
  } else if (ferramenta === 'registrar_pagamento') {
    linhas.push(`${dados.descricao} — R$${dados.valor}`);
    linhas.push(`Categoria: ${dados.categoria || '?'} · Data: ${dados.data || 'hoje'}`);
    linhas.push(dados.talhao_nome ? `Talhão: ${dados.talhao_nome}` : 'Geral (entra no rateio por área)');
    linhas.push(dados.ja_pago ? 'Status: já pago' : 'Status: pendente');
  } else if (ferramenta === 'marcar_folha_paga') {
    linhas.push(`Mês: ${dados.mes}/${dados.ano}`);
    linhas.push(dados.funcionarios && dados.funcionarios.length > 0 ? `Funcionários: ${dados.funcionarios.join(', ')}` : 'Funcionários: TODOS os ativos');
    linhas.push('O valor de cada um vem do salário já cadastrado.');
  } else {
    Object.entries(dados).forEach(([chave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') linhas.push(`${chave}: ${valor}`);
    });
  }
  return linhas;
};

const PASSOS = [
  {
    icon: MessageCircle,
    titulo: '1. Manda uma mensagem de texto',
    texto:
      'Escreve normal, do seu jeito: "colhi 500kg de manga no talhão 1 hoje", "gastei 80 reais de combustível", "choveu 12mm ontem". A IA entende, monta o lançamento e te manda os botões Confirmar/Cancelar antes de salvar qualquer coisa.'
  },
  {
    icon: Camera,
    titulo: '2. Ou manda uma foto da nota fiscal',
    texto:
      'Tira a foto no celular e manda direto pelo WhatsApp — sem precisar abrir o app. A IA lê o fornecedor, a data e cada item da nota. Se um item já é um insumo cadastrado e o preço da nota é diferente do preço registrado, ela propõe atualizar o preço. Se for um insumo novo, ela pergunta rapidinho a unidade (kg, litro, saco ou unidade) antes de cadastrar.'
  },
  {
    icon: CheckCircle2,
    titulo: '3. Você confere e confirma',
    texto:
      'Nada é salvo automaticamente. A IA sempre manda um resumo com os botões "Confirmar" e "Cancelar" — você só toca em Confirmar depois de olhar os valores. A conta de custo por litro/kg (ex: 500ml de um produto de R$100/L = R$50) continua sendo calculada do mesmo jeito de sempre, isso não muda.'
  }
];

export default function AssistenteIAPage({ dados, recarregar }) {
  const { talhoes, insumos, funcionarios } = dados;

  const [mensagens, setMensagens] = useState(() => carregarDoStorage(CHAVE_MENSAGENS, MENSAGEM_INICIAL));
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [historicoAPI, setHistoricoAPI] = useState(() => carregarDoStorage(CHAVE_HISTORICO_API, []));
  const [propostaPendente, setPropostaPendente] = useState(() => carregarDoStorage(CHAVE_PROPOSTA, null));
  const [salvando, setSalvando] = useState(false);
  const [confirmacaoExtra, setConfirmacaoExtra] = useState('');
  const fimDaListaRef = useRef(null);

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, propostaPendente]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_MENSAGENS, JSON.stringify(mensagens));
    } catch {}
  }, [mensagens]);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_HISTORICO_API, JSON.stringify(historicoAPI));
    } catch {}
  }, [historicoAPI]);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_PROPOSTA, JSON.stringify(propostaPendente));
    } catch {}
  }, [propostaPendente]);

  const novaConversa = () => {
    setMensagens(MENSAGEM_INICIAL);
    setHistoricoAPI([]);
    setPropostaPendente(null);
  };

  const enviarMensagem = async () => {
    const texto = input.trim();
    if (!texto || carregando) return;

    setMensagens((prev) => [...prev, { autor: 'usuario', texto }]);
    setInput('');
    setCarregando(true);

    try {
      const resp = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, historico: historicoAPI })
      });
      let dados_;
      try {
        dados_ = await resp.json();
      } catch {
        throw new Error(
          resp.status === 404
            ? 'Rota /api não encontrada. Esta etapa só funciona com "vercel dev" ou publicado na Vercel — o "npm run dev" comum não serve funções /api.'
            : `Erro inesperado (${resp.status}).`
        );
      }

      if (!resp.ok) {
        setMensagens((prev) => [...prev, { autor: 'ia', texto: `Erro: ${dados_.erro || 'algo deu errado'}` }]);
        return;
      }

      if (dados_.tipo === 'pergunta') {
        setMensagens((prev) => [...prev, { autor: 'ia', texto: dados_.texto }]);
        setHistoricoAPI(dados_.historico_atualizado || []);
      } else if (dados_.tipo === 'resposta') {
        setMensagens((prev) => [...prev, { autor: 'ia', texto: dados_.texto }]);
        setHistoricoAPI(dados_.historico_atualizado || historicoAPI);
      } else if (dados_.tipo === 'proposta') {
        setMensagens((prev) => [...prev, { autor: 'ia', texto: dados_.resumo }]);
        const propostasComPreview = await Promise.all(
          dados_.propostas.map(async (p) => {
            if (p.ferramenta !== 'excluir_dados') return p;
            try {
              const registros = await buscarPreviewExclusao(p.dados, { talhoes });
              return { ...p, __preview: registros };
            } catch (err) {
              return { ...p, __previewErro: err.message };
            }
          })
        );
        setConfirmacaoExtra('');
        setPropostaPendente({ propostas: propostasComPreview });
        setHistoricoAPI(dados_.historico_atualizado || historicoAPI);
      }
    } catch (err) {
      setMensagens((prev) => [...prev, { autor: 'ia', texto: `Não consegui falar com o servidor: ${err.message}` }]);
    } finally {
      setCarregando(false);
    }
  };

  const cancelarProposta = () => {
    setPropostaPendente(null);
    setConfirmacaoExtra('');
    setHistoricoAPI([]);
    setMensagens((prev) => [...prev, { autor: 'ia', texto: 'Ok, não salvei nada.' }]);
  };

  const totalParaExcluir = useMemo(
    () => propostaPendente?.propostas.filter((p) => p.ferramenta === 'excluir_dados').reduce((acc, p) => acc + (p.__preview?.length || 0), 0) || 0,
    [propostaPendente]
  );
  const temExclusaoEmMassa = totalParaExcluir > 3;

  const executarAcao = async (ferramenta, dadosAcao, ctx) => {
    const hoje = format(new Date(), 'yyyy-MM-dd');

    if (ferramenta === 'registrar_colheita') {
      if (!dadosAcao.talhao_nome) throw new Error('Faltou o nome do talhão.');
      const talhao = buscarObrigatorio(ctx.talhoes, dadosAcao.talhao_nome, 'Talhão');
      if (!dadosAcao.itens || dadosAcao.itens.length === 0) throw new Error('Nenhum item de colheita informado.');

      const data = dadosAcao.data || hoje;
      const payload = dadosAcao.itens.map((item, idx) => {
        if (!item.tipo_colheita) throw new Error(`Item ${idx + 1}: faltou o tipo de colheita.`);
        const preco = numero(item.preco_unitario, null);
        if (preco === null) throw new Error(`Item ${idx + 1} (${item.tipo_colheita}): faltou o preço.`);
        const qtdKg = numero(item.quantidade_kg, null);
        const qtdCx = numero(item.quantidade_caixas, null);
        const qtdUsada = item.unidade_preco === 'kg' ? qtdKg || 0 : qtdCx || 0;
        return {
          talhao_id: talhao.id,
          data,
          cultura: dadosAcao.cultura || talhao.cultura,
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

      const custoUnit = numero(dadosAcao.custo_colheita_unitario, 0);
      if (custoUnit > 0) {
        const somaQtd = dadosAcao.itens.reduce((acc, item) => acc + (dadosAcao.custo_unidade === 'kg' ? numero(item.quantidade_kg) : numero(item.quantidade_caixas)), 0);
        const custoTotal = somaQtd * custoUnit;
        if (custoTotal > 0) {
          const { data: custosDoDia } = await supabase.from('custos').select('id, descricao, valor').eq('categoria', 'colheita').eq('talhao_id', talhao.id).eq('data', data);
          const duplicataExata = (custosDoDia || []).find((c) => Math.abs((c.valor || 0) - custoTotal) < 0.01);
          if (duplicataExata) {
            throw new Error(`Já existe um custo de colheita IDÊNTICO (R$${custoTotal.toFixed(2)}) lançado pra ${talhao.nome} em ${data} — parece repetição da mesma colheita. As caixas foram registradas, mas esse custo específico NÃO foi duplicado. Se for realmente uma colheita diferente no mesmo dia, confira o lançamento no Financeiro.`);
          }
          const resumoTipos = dadosAcao.itens.map((i) => i.tipo_colheita).join(' + ');
          const { error: errCusto } = await supabase.from('custos').insert({
            descricao: `Colheita - ${resumoTipos} - ${talhao.nome}`,
            categoria: 'colheita',
            talhao_id: talhao.id,
            valor: custoTotal,
            data,
            status_pagamento: 'pendente',
            tipo_lancamento: 'despesa',
            observacoes: `Custo de colheita (via assistente): R$ ${custoUnit}/${dadosAcao.custo_unidade || 'caixa'}`
          });
          if (errCusto) throw errCusto;
        }
      }
      return 'colheitas';
    }

    if (ferramenta === 'registrar_atividade') {
      if (!dadosAcao.talhao_nome) throw new Error('Faltou o nome do talhão.');
      if (!dadosAcao.tipo) throw new Error('Faltou o tipo da atividade.');
      const talhao = buscarObrigatorio(ctx.talhoes, dadosAcao.talhao_nome, 'Talhão');

      const insumosResolvidos = [];
      for (const i of dadosAcao.insumos || []) {
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
      const terceirizada = !!dadosAcao.terceirizada;
      const valorTerceirizado = terceirizada ? numero(dadosAcao.valor_terceirizado, 0) : 0;
      const custoInsumos = insumosResolvidos.reduce((acc, i) => acc + i.valor_total, 0);
      const custoTotal = custoInsumos + valorTerceirizado;
      const dataProgramada = dadosAcao.data_programada || hoje;

      const { data: atividadesDoDia } = await supabase.from('atividades').select('id, custo_total').eq('talhao_id', talhao.id).eq('tipo', dadosAcao.tipo).eq('data_programada', dataProgramada);
      if ((atividadesDoDia || []).some((a) => Math.abs((a.custo_total || 0) - custoTotal) < 0.01)) {
        throw new Error(`Já existe uma atividade IDÊNTICA (${dadosAcao.tipo}, mesmo talhão, mesma data, mesmo custo R$${custoTotal.toFixed(2)}) — parece repetição. Se for uma atividade diferente, ajuste algum dado (ex: quantidade de insumo) que confirme que não é repetição.`);
      }

      const { error } = await supabase.from('atividades').insert({
        talhao_id: talhao.id,
        tipo: dadosAcao.tipo,
        data_programada: dataProgramada,
        status: 'programada',
        terceirizada,
        valor_terceirizado: terceirizada ? valorTerceirizado : null,
        insumos_utilizados: insumosResolvidos,
        custo_total: custoTotal,
        responsavel: dadosAcao.responsavel || null,
        observacoes: dadosAcao.observacoes || null
      });
      if (error) throw error;
      return 'atividades';
    }

    if (ferramenta === 'registrar_pagamento') {
      if (!dadosAcao.descricao) throw new Error('Faltou a descrição do pagamento.');
      const valor = numero(dadosAcao.valor, null);
      if (!valor || valor <= 0) throw new Error('Valor inválido.');
      const talhao = dadosAcao.talhao_nome ? buscarObrigatorio(ctx.talhoes, dadosAcao.talhao_nome, 'Talhão') : null;
      const data = dadosAcao.data || hoje;

      const { data: pagamentosDoDia } = await supabase.from('custos').select('id, descricao, talhao_id, valor').eq('data', data).eq('descricao', dadosAcao.descricao);
      const talhaoIdNovo = talhao?.id || null;
      if ((pagamentosDoDia || []).some((p) => (p.talhao_id || null) === talhaoIdNovo && Math.abs((p.valor || 0) - valor) < 0.01)) {
        throw new Error(`Já existe um pagamento IDÊNTICO ("${dadosAcao.descricao}", R$${valor.toFixed(2)}, mesma data) — parece repetição. Se for um pagamento diferente, ajuste a descrição ou o valor.`);
      }

      const { error } = await supabase.from('custos').insert({
        descricao: dadosAcao.descricao,
        categoria: dadosAcao.categoria || 'outro',
        talhao_id: talhaoIdNovo,
        valor,
        data,
        status_pagamento: dadosAcao.ja_pago ? 'pago' : 'pendente',
        tipo_lancamento: 'despesa'
      });
      if (error) throw error;
      return 'custos';
    }

    if (ferramenta === 'criar_talhao') {
      if (!dadosAcao.nome) throw new Error('Faltou o nome do talhão.');
      if (encontrarPorNome(ctx.talhoes, dadosAcao.nome).item) {
        throw new Error(`Já existe um talhão chamado "${dadosAcao.nome}" — se quiser editar ele, use a tela de Talhões em vez de cadastrar de novo.`);
      }
      const { error } = await supabase.from('talhoes').insert({
        nome: dadosAcao.nome,
        area_hectares: dadosAcao.area_hectares ? numero(dadosAcao.area_hectares) : null,
        cultura: dadosAcao.cultura || null,
        variedade: dadosAcao.variedade || null,
        data_plantio: dadosAcao.data_plantio || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'talhoes';
    }

    if (ferramenta === 'criar_funcionario') {
      if (!dadosAcao.nome) throw new Error('Faltou o nome do funcionário.');
      const talhao = dadosAcao.talhao_nome ? buscarObrigatorio(ctx.talhoes, dadosAcao.talhao_nome, 'Talhão') : null;
      const dataAdmissao = dadosAcao.data_admissao || hoje;

      const { item: funcExistente } = encontrarPorNome(ctx.funcionarios, dadosAcao.nome);
      if (funcExistente) {
        const { data: mesmaAdmissao } = await supabase.from('funcionarios').select('id').eq('id', funcExistente.id).eq('data_admissao', dataAdmissao);
        if (mesmaAdmissao && mesmaAdmissao.length > 0) {
          throw new Error(`Já existe um funcionário chamado "${dadosAcao.nome}" admitido em ${dataAdmissao} — parece repetição. Se for uma pessoa diferente, confirme o nome completo pra diferenciar.`);
        }
      }

      const { error } = await supabase.from('funcionarios').insert({
        nome: dadosAcao.nome,
        cargo: dadosAcao.cargo || null,
        salario: dadosAcao.salario ? numero(dadosAcao.salario) : null,
        data_admissao: dataAdmissao,
        talhao_id: talhao?.id || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'funcionarios';
    }

    if (ferramenta === 'registrar_chuva') {
      const mm = numero(dadosAcao.quantidade_mm, null);
      if (mm === null || mm < 0) throw new Error('Quantidade de chuva inválida.');
      const talhao = dadosAcao.talhao_nome ? buscarObrigatorio(ctx.talhoes, dadosAcao.talhao_nome, 'Talhão') : null;
      const data = dadosAcao.data || hoje;
      const talhaoIdNovo = talhao?.id || null;

      const { data: chuvasDoDia } = await supabase.from('pluviometria').select('id, talhao_id, quantidade_mm').eq('data', data);
      if ((chuvasDoDia || []).some((c) => (c.talhao_id || null) === talhaoIdNovo && Math.abs((c.quantidade_mm || 0) - mm) < 0.01)) {
        throw new Error(`Já existe uma medição de chuva IDÊNTICA (${mm}mm, mesmo talhão, mesma data) — parece repetição.`);
      }

      const { error } = await supabase.from('pluviometria').insert({ data, quantidade_mm: mm, talhao_id: talhaoIdNovo });
      if (error) throw error;
      return 'pluviometria';
    }

    if (ferramenta === 'criar_insumo') {
      if (!dadosAcao.nome) throw new Error('Faltou o nome do insumo.');
      if (!dadosAcao.unidade) throw new Error('Faltou a unidade do insumo.');
      const preco = numero(dadosAcao.preco_unitario, null);
      if (preco === null || preco < 0) throw new Error('Preço inválido.');
      if (encontrarPorNome(ctx.insumos, dadosAcao.nome).item) {
        throw new Error(`Já existe um insumo chamado "${dadosAcao.nome}" — se quiser atualizar o preço/estoque dele, use a tela de Insumos em vez de cadastrar de novo.`);
      }
      const { error } = await supabase.from('insumos').insert({
        nome: dadosAcao.nome,
        categoria: dadosAcao.categoria || 'outro',
        unidade: dadosAcao.unidade,
        preco_unitario: preco,
        tamanho_embalagem: dadosAcao.tamanho_embalagem ? numero(dadosAcao.tamanho_embalagem) : null,
        estoque_atual: numero(dadosAcao.estoque_atual, 0)
      });
      if (error) throw error;
      return 'insumos';
    }

    if (ferramenta === 'criar_safra') {
      if (!dadosAcao.nome) throw new Error('Faltou o nome da safra.');
      if (!dadosAcao.talhao_nome) throw new Error('Faltou o nome do talhão.');
      const talhao = buscarObrigatorio(ctx.talhoes, dadosAcao.talhao_nome, 'Talhão');

      const { data: safrasExistentes } = await supabase.from('safras').select('id, nome').eq('talhao_id', talhao.id);
      if ((safrasExistentes || []).some((s) => normalizar(s.nome) === normalizar(dadosAcao.nome))) {
        throw new Error(`Já existe uma safra chamada "${dadosAcao.nome}" nesse talhão — parece repetição.`);
      }

      const { error } = await supabase.from('safras').insert({
        nome: dadosAcao.nome,
        talhao_id: talhao.id,
        data_inicio: dadosAcao.data_inicio || hoje,
        data_fim: dadosAcao.data_fim || null,
        status: 'ativo'
      });
      if (error) throw error;
      return 'safras';
    }

    if (ferramenta === 'marcar_folha_paga') {
      const mes = numero(dadosAcao.mes, null);
      const ano = numero(dadosAcao.ano, null);
      if (!mes || mes < 1 || mes > 12) throw new Error('Mês inválido (use 1 a 12).');
      if (!ano) throw new Error('Faltou o ano.');

      const nomesAlvo = dadosAcao.funcionarios && dadosAcao.funcionarios.length > 0 ? dadosAcao.funcionarios : null;
      const funcionariosAlvo = nomesAlvo
        ? nomesAlvo.map((n) => buscarObrigatorio(ctx.funcionarios, n, 'Funcionário'))
        : ctx.funcionarios.filter((f) => f.status === 'ativo');
      if (funcionariosAlvo.length === 0) throw new Error('Nenhum funcionário encontrado.');

      const { data: custosFuncionarios } = await supabase.from('custos').select('*').eq('categoria', 'funcionario');
      const idAlvo = `salario-${ano}-${String(mes).padStart(2, '0')}`;
      const relatorio = [];

      for (const func of funcionariosAlvo) {
        const eventos = calcularFolha(func);
        const evento = eventos.find((e) => e.id === idAlvo);
        if (!evento) {
          relatorio.push(`${func.nome}: sem salário devido nesse mês (fora do período contratado).`);
          continue;
        }

        const existente = (custosFuncionarios || []).find(
          (c) => c.descricao?.includes(func.nome) && c.descricao?.includes(evento.tipo) && isSameMonth(parseISO(c.data), evento.data_pagamento)
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
      dadosAcao.__relatorio = relatorio;
      return 'custos';
    }

    if (ferramenta === 'registrar_consultoria') {
      if (!dadosAcao.consultor_nome) throw new Error('Faltou o nome do consultor.');
      const dataVisita = dadosAcao.data_visita || hoje;

      const { data: consultoriasNoDia } = await supabase.from('consultorias').select('id, consultor_nome').eq('data_visita', dataVisita);
      if ((consultoriasNoDia || []).some((c) => normalizar(c.consultor_nome) === normalizar(dadosAcao.consultor_nome))) {
        throw new Error(`Já existe uma visita de "${dadosAcao.consultor_nome}" registrada em ${dataVisita} — parece repetição.`);
      }

      const { error } = await supabase.from('consultorias').insert({
        consultor_nome: dadosAcao.consultor_nome,
        data_visita: dataVisita,
        observacoes_gerais: dadosAcao.observacoes_gerais || null,
        proxima_visita: dadosAcao.proxima_visita || null,
        indicacoes: []
      });
      if (error) throw error;
      return 'consultorias';
    }

    throw new Error(`Ação "${ferramenta}" desconhecida.`);
  };

  const confirmarProposta = async () => {
    if (!propostaPendente || salvando) return;
    if (!propostaPendente.propostas || propostaPendente.propostas.length === 0) {
      setPropostaPendente(null);
      return;
    }
    if (temExclusaoEmMassa && confirmacaoExtra.trim().toUpperCase() !== 'EXCLUIR') {
      setMensagens((prev) => [...prev, { autor: 'ia', texto: `Isso vai excluir ${totalParaExcluir} registros — digite "EXCLUIR" no campo indicado pra confirmar.` }]);
      return;
    }

    setSalvando(true);
    const sucessos = [];
    const falhas = [];

    for (const item of propostaPendente.propostas) {
      try {
        if (item.ferramenta === 'excluir_dados') {
          if (item.__previewErro) throw new Error(item.__previewErro);
          const registros = item.__preview || [];
          if (registros.length === 0) {
            sucessos.push(`Exclusão em ${item.dados.tabela}: nenhum registro encontrado com esses filtros — nada foi excluído.`);
          } else {
            const ids = registros.map((r) => r.id);
            const { error } = await supabase.from(item.dados.tabela).delete().in('id', ids);
            if (error) throw error;
            sucessos.push(`Excluídos ${ids.length} registro(s) de ${item.dados.tabela}.`);
          }
          continue;
        }

        await executarAcao(item.ferramenta, item.dados, { talhoes, insumos, funcionarios });
        if (item.dados.__relatorio) {
          sucessos.push(`${rotuloFerramenta[item.ferramenta] || item.ferramenta}:\n${item.dados.__relatorio.map((l) => `  - ${l}`).join('\n')}`);
        } else {
          sucessos.push(rotuloFerramenta[item.ferramenta] || item.ferramenta);
        }
      } catch (err) {
        falhas.push(`${rotuloFerramenta[item.ferramenta] || item.ferramenta}: ${err.message}`);
      }
    }

    let textoResultado = '';
    if (sucessos.length > 0) textoResultado += `✅ Salvo: ${sucessos.join(', ')}.\n`;
    if (falhas.length > 0) textoResultado += `❌ Não salvo:\n${falhas.map((f) => `• ${f}`).join('\n')}`;
    setMensagens((prev) => [...prev, { autor: 'ia', texto: textoResultado.trim() }]);

    setPropostaPendente(null);
    setHistoricoAPI([]);
    setSalvando(false);
    recarregar();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 bg-brand/10 border border-brand/25 p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-semibold text-ink">Como usar o Assistente pelo WhatsApp</h3>
            <p className="text-sm text-ink-muted mt-1">
              Esta é a forma mais rápida de registrar as coisas no dia a dia — direto do celular, sem precisar abrir
              o app. O chat abaixo, aqui dentro do app, também é real — é o mesmo assistente.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {PASSOS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.titulo} className="rounded-xl bg-base border border-line p-3.5 space-y-2">
                <Icon className="w-4 h-4 text-brand" />
                <div className="text-sm font-semibold text-ink">{p.titulo}</div>
                <p className="text-xs text-ink-muted leading-relaxed">{p.texto}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl2 bg-amber/10 border border-amber/25 p-4 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          <span className="text-ink font-semibold">Ainda não recebeu o número de WhatsApp da fazenda?</span> Essa
          integração precisa ser configurada uma vez (uma conta do WhatsApp Business e algumas chaves no Vercel) —
          o passo a passo completo está no arquivo <code className="text-amber">LEIA-ME-PROTOTIPO.md</code> que
          acompanha o protótipo. O chat abaixo já funciona sem nenhuma dessas chaves.
        </p>
      </div>

      <div className="rounded-xl2 bg-surface border border-line overflow-hidden flex flex-col h-[min(720px,70vh)]">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">Assistente da Fazenda</div>
              <div className="text-[11px] text-ink-faint">conversa real — grava no Supabase depois que você confirmar</div>
            </div>
          </div>
          <button
            onClick={novaConversa}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-line-soft text-ink-muted text-xs font-medium hover:bg-line hover:text-ink transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" /> Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {mensagens.map((m, idx) => (
            <div key={idx} className={`flex gap-3 ${m.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}>
              {m.autor === 'ia' && (
                <div className="w-7 h-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-brand" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.autor === 'usuario' ? 'bg-brand/15 text-ink' : 'bg-line-soft text-ink'}`}>
                {m.texto}
              </div>
              {m.autor === 'usuario' && (
                <div className="w-7 h-7 rounded-full bg-line-soft border border-line flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-ink-muted" />
                </div>
              )}
            </div>
          ))}

          {propostaPendente &&
            (() => {
              const algumaExclusao = propostaPendente.propostas.some((p) => p.ferramenta === 'excluir_dados');
              return (
                <div className={`ml-10 rounded-2xl p-4 space-y-3 border ${algumaExclusao ? 'bg-rose/10 border-rose/25' : 'bg-brand/10 border-brand/25'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide ${algumaExclusao ? 'text-rose' : 'text-brand'}`}>
                    {algumaExclusao ? '⚠️ Confirme a exclusão' : 'Confirme antes de salvar'}
                  </p>
                  {propostaPendente.propostas.map((p, idx) => {
                    if (p.ferramenta === 'excluir_dados') {
                      return (
                        <div key={idx} className="bg-base rounded-xl p-3 border border-rose/25 text-sm">
                          <p className="font-bold text-rose mb-1.5">Excluir de: {p.dados.tabela}</p>
                          {p.__previewErro ? (
                            <p className="text-xs font-bold text-rose">{p.__previewErro}</p>
                          ) : !p.__preview || p.__preview.length === 0 ? (
                            <p className="text-xs text-ink-faint italic">Nenhum registro encontrado com esses filtros — nada será excluído.</p>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-rose mb-2">
                                {p.__preview.length} registro(s) encontrado(s)
                                {p.__preview.some((r) => valorRegistro(p.dados.tabela, r) > 0) && (
                                  <> · total R$ {p.__preview.reduce((acc, r) => acc + valorRegistro(p.dados.tabela, r), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>
                                )}
                              </p>
                              <div className="max-h-40 overflow-y-auto space-y-1 border border-line rounded-lg p-2 bg-surface">
                                {p.__preview.map((r) => (
                                  <p key={r.id} className="text-[11px] text-ink-muted">
                                    {descreverRegistro(p.dados.tabela, r, talhoes)}
                                  </p>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="bg-base rounded-xl p-3 border border-brand/25 text-sm">
                        <p className="font-bold text-ink mb-1.5">{rotuloFerramenta[p.ferramenta] || p.ferramenta}</p>
                        <div className="space-y-0.5">
                          {resumoProposta(p.ferramenta, p.dados).map((linha, i) => (
                            <p key={i} className={linha.includes('NÃO informado') ? 'text-xs font-bold text-rose' : 'text-xs text-ink-muted'}>
                              {linha}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {temExclusaoEmMassa && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-bold text-rose">Isso vai excluir {totalParaExcluir} registros de uma vez. Digite EXCLUIR pra confirmar:</p>
                      <input
                        value={confirmacaoExtra}
                        onChange={(e) => setConfirmacaoExtra(e.target.value)}
                        placeholder="EXCLUIR"
                        className="w-full rounded-xl bg-base border border-rose/40 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose/30"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={confirmarProposta}
                      disabled={salvando || (temExclusaoEmMassa && confirmacaoExtra.trim().toUpperCase() !== 'EXCLUIR')}
                      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold h-10 text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                        algumaExclusao ? 'bg-rose hover:bg-rose/90' : 'bg-brand hover:bg-brand/90'
                      }`}
                    >
                      {salvando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : algumaExclusao ? (
                        <>
                          <Trash2 className="w-4 h-4" /> Excluir Permanentemente
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Confirmar e Salvar
                        </>
                      )}
                    </button>
                    <button
                      onClick={cancelarProposta}
                      disabled={salvando}
                      className="inline-flex items-center justify-center px-3.5 rounded-xl bg-line-soft text-ink-muted hover:bg-line hover:text-ink h-10 disabled:opacity-40 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

          {carregando && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />
              </div>
              <div className="bg-line-soft rounded-2xl px-4 py-2.5 text-sm text-ink-faint">Pensando...</div>
            </div>
          )}
          <div ref={fimDaListaRef} />
        </div>

        <div className="border-t border-line p-4 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensagem();
              }
            }}
            placeholder="Ex: Goiaba 2, 25 caixas verdes a 50 reais, custo de 4 reais a caixa hoje"
            className="flex-1 rounded-xl bg-base border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
            rows={2}
            disabled={carregando}
          />
          <button
            onClick={enviarMensagem}
            disabled={carregando || !input.trim()}
            className="w-11 h-11 rounded-xl bg-brand text-base flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
