// api/assistente.js
//
// Função do servidor (Vercel Serverless Function) que recebe o texto do usuário,
// conversa com a API da Anthropic (Claude), e devolve organizado:
//  - uma PERGUNTA (quando falta informação pra completar a ação)
//  - uma RESPOSTA (quando é uma consulta — a função já busca o dado real no banco)
//  - uma PROPOSTA (quando é uma ação de cadastro — o app mostra pra você confirmar
//    antes de salvar qualquer coisa; o SALVAR de fato acontece no navegador, não aqui)
//
// A chave da Anthropic (ANTHROPIC_API_KEY) fica só aqui no servidor, nunca é
// enviada pro navegador — configure ela em Vercel → Settings → Environment Variables.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zmxujmtoiwayrljrfmwo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHVqbXRvaXdheXJsanJmbXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMTMyODcsImV4cCI6MjA4MDc4OTI4N30.v2B_BZ6fRxDWntwz6tUKdGD6vmZKxYv0QXTbStBc6M0';

const MODELO = 'claude-haiku-4-5-20251001'; // mais barato, recomendado pra começar. Pra trocar por um mais "esperto": 'claude-sonnet-5'.

// Dá mais tempo pra função rodar (o modo de consulta faz 2 chamadas seguidas à IA,
// então o padrão de 10s às vezes não é suficiente).
export const maxDuration = 30;

// --------------------------------------------------------------------------
// DEFINIÇÃO DAS FERRAMENTAS (o que a IA pode fazer no seu sistema)
// Pra adicionar uma ação nova no futuro: só descrever ela aqui, nesse formato.
// --------------------------------------------------------------------------
const FERRAMENTAS = [
  {
    name: 'registrar_colheita',
    description: 'Registra uma ou mais colheitas do mesmo talhão e data. Use quando o usuário descrever quantidades colhidas (caixas ou kg) com seus preços de venda.',
    input_schema: {
      type: 'object',
      properties: {
        talhao_nome: { type: 'string', description: 'Nome do talhão exatamente como cadastrado (ex: "Goiaba 04")' },
        data: { type: 'string', description: 'Data no formato YYYY-MM-DD. Se não informado, use a data de hoje.' },
        cultura: { type: 'string', description: 'Cultura colhida (ex: goiaba, manga)' },
        itens: {
          type: 'array',
          description: 'Um item por tipo de colheita (ex: caixa verde, madura, polpa)',
          items: {
            type: 'object',
            properties: {
              tipo_colheita: { type: 'string', description: 'Nome do tipo (ex: "Caixa Verde", "Madura", "Polpa")' },
              quantidade_caixas: { type: 'number', description: 'Quantidade em caixas, se aplicável' },
              quantidade_kg: { type: 'number', description: 'Quantidade em kg, se aplicável' },
              preco_unitario: { type: 'number', description: 'Preço de venda por caixa ou por kg (o valor unitário, não o total)' },
              unidade_preco: { type: 'string', enum: ['kg', 'caixa'] }
            },
            required: ['tipo_colheita', 'preco_unitario', 'unidade_preco']
          }
        },
        custo_colheita_unitario: { type: 'number', description: 'Custo pago pra colher (por caixa ou kg), aplicado ao total somado de todos os itens. Opcional.' },
        custo_unidade: { type: 'string', enum: ['kg', 'caixa'] }
      },
      required: ['talhao_nome', 'itens']
    }
  },
  {
    name: 'registrar_atividade',
    description: 'Registra uma atividade/manejo realizado ou programado num talhão (adubação, poda, pulverização, etc.), incluindo insumos usados se houver. SÓ chame esta ferramenta depois de já saber se é terceirizada ou não — se o usuário não disse, pergunte antes.',
    input_schema: {
      type: 'object',
      properties: {
        talhao_nome: { type: 'string' },
        tipo: { type: 'string', description: 'Tipo da atividade (ex: adubacao, poda, pulverizacao, inducao, maturacao, irrigacao, capina, ou um nome livre se não for nenhum desses)' },
        data_programada: { type: 'string', description: 'Data YYYY-MM-DD. Se não informado, use hoje.' },
        insumos: {
          type: 'array',
          description: 'Insumos usados nessa atividade',
          items: {
            type: 'object',
            properties: {
              nome_insumo: { type: 'string', description: 'Nome do insumo, o mais próximo possível do que está cadastrado' },
              quantidade: { type: 'number', description: 'Quantidade usada, na unidade em que o insumo é cadastrado (geralmente kg ou L)' }
            },
            required: ['nome_insumo', 'quantidade']
          }
        },
        terceirizada: { type: 'boolean' },
        responsavel: { type: 'string', description: 'Quem executou (funcionário, se não terceirizada) ou nome do prestador (se terceirizada)' },
        valor_terceirizado: { type: 'number', description: 'Valor pago ao terceirizado, se terceirizada' },
        observacoes: { type: 'string' }
      },
      required: ['talhao_nome', 'tipo', 'terceirizada']
    }
  },
  {
    name: 'registrar_pagamento',
    description: 'Registra um lançamento financeiro (custo/despesa) — água, luz, funcionário, manutenção, etc. Se não for referente a um talhão específico, deixa entrar no rateio geral por área (não informa talhao_nome).',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string' },
        categoria: { type: 'string', enum: ['funcionario', 'insumo', 'colheita', 'manutencao', 'energia', 'agua', 'combustivel', 'terceirizado', 'equipamento', 'administrativo', 'outro'] },
        valor: { type: 'number' },
        data: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        talhao_nome: { type: 'string', description: 'Só preencher se for um custo de um talhão específico. Deixe de fora se for custo geral da fazenda (água, luz, folha) — esses entram no rateio automático por área.' },
        ja_pago: { type: 'boolean', description: 'true se já foi pago, false se ainda está pendente' }
      },
      required: ['descricao', 'categoria', 'valor']
    }
  },
  {
    name: 'criar_talhao',
    description: 'Cadastra um novo talhão/área.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        area_hectares: { type: 'number' },
        cultura: { type: 'string' },
        variedade: { type: 'string' },
        data_plantio: { type: 'string', description: 'YYYY-MM-DD' }
      },
      required: ['nome']
    }
  },
  {
    name: 'criar_funcionario',
    description: 'Cadastra um novo funcionário.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        cargo: { type: 'string' },
        salario: { type: 'number' },
        data_admissao: { type: 'string', description: 'YYYY-MM-DD' },
        talhao_nome: { type: 'string', description: 'Talhão principal onde ele trabalha, se informado' }
      },
      required: ['nome']
    }
  },
  {
    name: 'registrar_chuva',
    description: 'Registra uma medição de chuva (pluviometria).',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        quantidade_mm: { type: 'number' },
        talhao_nome: { type: 'string', description: 'Opcional — deixe de fora se for uma medição geral da fazenda' }
      },
      required: ['quantidade_mm']
    }
  },
  {
    name: 'criar_insumo',
    description: 'Cadastra um novo insumo no estoque.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        categoria: { type: 'string', enum: ['fertilizante', 'defensivo', 'adubo', 'semente', 'outro'] },
        unidade: { type: 'string', description: 'Unidade de uso, ex: kg, L, un' },
        preco_unitario: { type: 'number', description: 'Preço da embalagem comprada' },
        tamanho_embalagem: { type: 'number', description: 'Quantas unidades (kg/L) vêm em cada embalagem. Ex: um saco de 25kg -> 25.' },
        estoque_atual: { type: 'number' }
      },
      required: ['nome', 'unidade', 'preco_unitario']
    }
  },
  {
    name: 'criar_safra',
    description: 'Inicia uma nova safra/ciclo produtivo num talhão.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        talhao_nome: { type: 'string' },
        data_inicio: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        data_fim: { type: 'string', description: 'YYYY-MM-DD, opcional' }
      },
      required: ['nome', 'talhao_nome']
    }
  },
  {
    name: 'registrar_consultoria',
    description: 'Registra uma visita de consultoria técnica.',
    input_schema: {
      type: 'object',
      properties: {
        consultor_nome: { type: 'string' },
        data_visita: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        observacoes_gerais: { type: 'string' },
        proxima_visita: { type: 'string', description: 'YYYY-MM-DD, opcional' }
      },
      required: ['consultor_nome']
    }
  },
  {
    name: 'consultar_dados',
    description: 'Use para PERGUNTAS sobre dados já existentes (quanto foi gasto, quanto foi colhido, qual o salário de alguém, etc.) — NUNCA para cadastrar algo novo.',
    input_schema: {
      type: 'object',
      properties: {
        tabela: { type: 'string', enum: ['custos', 'colheitas', 'atividades', 'funcionarios', 'talhoes', 'pluviometria'] },
        descricao_da_busca: { type: 'string', description: 'Explique em português o que precisa ser calculado/buscado, pro sistema montar a consulta certa (ex: "soma dos custos de categoria colheita em agosto de 2026")' }
      },
      required: ['tabela', 'descricao_da_busca']
    }
  }
];

// --------------------------------------------------------------------------
// Handler principal
// --------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada no servidor. Configure em Vercel → Settings → Environment Variables.' });
  }

  const { mensagem, historico: historicoRecebido = [] } = req.body || {};
  if (!mensagem || typeof mensagem !== 'string') {
    return res.status(400).json({ erro: 'Envie { mensagem: "..." } no corpo da requisição.' });
  }
  if (mensagem.length > 4000) {
    return res.status(400).json({ erro: 'Mensagem muito longa (máximo 4000 caracteres).' });
  }

  // Nunca deixa a conversa crescer sem limite (custo e contexto) — mantém só as
  // últimas trocas, que é o que importa pra entender o que está em andamento agora.
  const historico = Array.isArray(historicoRecebido) ? historicoRecebido.slice(-24) : [];

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Busca contexto real do banco, pra IA conseguir casar "área 04" com o talhão de verdade,
    // "ureia" com o insumo cadastrado, etc. — sem isso ela erraria nome toda hora.
    // Cada busca é resiliente por conta própria: se uma falhar, as outras continuam
    // (melhor a IA funcionar com um pouco menos de contexto do que travar tudo).
    const buscarSeguro = async (query) => {
      try { const { data } = await query; return data || []; } catch { return []; }
    };
    const [talhoes, insumos, funcionarios, culturas] = await Promise.all([
      buscarSeguro(supabase.from('talhoes').select('id, nome, cultura, area_hectares')),
      buscarSeguro(supabase.from('insumos').select('id, nome, unidade, preco_unitario, tamanho_embalagem')),
      buscarSeguro(supabase.from('funcionarios').select('id, nome, status').eq('status', 'ativo')),
      buscarSeguro(supabase.from('culturas').select('nome'))
    ]);

    const hoje = new Date().toISOString().split('T')[0];

    const contexto = `
Data de hoje: ${hoje}

Talhões cadastrados: ${JSON.stringify((talhoes || []).map(t => ({ nome: t.nome, cultura: t.cultura, area_hectares: t.area_hectares })))}

Insumos cadastrados: ${JSON.stringify((insumos || []).map(i => ({ nome: i.nome, unidade: i.unidade, preco_embalagem: i.preco_unitario, tamanho_embalagem: i.tamanho_embalagem })))}

Funcionários ativos: ${JSON.stringify((funcionarios || []).map(f => f.nome))}

Culturas cadastradas: ${JSON.stringify((culturas || []).map(c => c.nome))}
`.trim();

    const systemPrompt = `Você é o assistente do App Fazenda — ajuda o dono a registrar colheitas, atividades e pagamentos, e a consultar dados, usando linguagem natural em português.

${contexto}

REGRAS IMPORTANTES:
1. Sempre tente casar nomes de talhão/insumo/funcionário do que o usuário escreveu com os nomes REAIS cadastrados acima (ex: "area 04" deve virar o nome exato do talhão cadastrado que corresponda). Se não encontrar nenhum correspondente razoável, pergunte ao usuário em vez de inventar.
2. Se faltar uma informação necessária para completar a ação (ex: não disse se é terceirizada, não disse a data, valor ambíguo como "40 reais" podendo ser por caixa ou total), NÃO chame a ferramenta — faça a pergunta em texto normal primeiro, de forma curta e direta.
3. Nunca calcule custo de insumo sozinho — só extraia qual insumo e quanto foi usado; o sistema calcula o valor certo usando o preço real cadastrado.
4. Quando tiver todas as informações, chame a ferramenta correspondente. Você pode chamar mais de uma ferramenta na mesma resposta se o usuário descreveu várias ações de uma vez (ex: várias atividades em áreas diferentes).
5. IMPORTANTE: assim que tiver todas as informações necessárias, CHAME A FERRAMENTA NA MESMA RESPOSTA — nunca escreva só um resumo em texto perguntando "confirma?" e espere o usuário dizer "sim" antes de chamar. O aplicativo já mostra uma tela própria de confirmação depois que você chama a ferramenta, então essa pergunta em texto é redundante e arriscada (ao reescrever os dados de memória numa segunda resposta, você pode esquecer algum detalhe que já tinha, como o custo). Sempre chame a ferramenta com TODOS os dados que o usuário já deu, na primeira resposta possível, escrevendo o resumo em texto JUNTO da chamada (não em vez dela).
6. Seja direto e objetivo — sem enrolação, sem saudação longa.
7. Em "registrar_colheita": se o usuário mencionar QUALQUER custo de colheita (ex: "custo de 4 reais por caixa", "paguei 4 reais pra colher"), SEMPRE preencha custo_colheita_unitario e custo_unidade na chamada — nunca deixe esses campos de fora quando essa informação foi dada, mesmo que venha numa frase separada dentro da mesma mensagem.
8. Se uma ação anterior na conversa AINDA NÃO foi confirmada pelo usuário (você vê isso pelo histórico: você chamou uma ferramenta e a resposta foi só "aguardando confirmação") e a nova mensagem do usuário claramente corrige ou completa aquela mesma ação (ex: ele esqueceu de mencionar um valor e agora está complementando), chame a MESMA ferramenta de novo com TODAS as informações já reunidas (as antigas + a nova) — não só a informação nova sozinha. Isso substitui a proposta anterior por uma completa.`;

    const mensagens = [
      ...historico,
      { role: 'user', content: mensagem }
    ];

    let respostaClaude;
    try {
      respostaClaude = await chamarClaude(apiKey, systemPrompt, mensagens, FERRAMENTAS);
    } catch (erroPrimeiraTentativa) {
      // Se o histórico salvo (ex: de uma versão antiga, ou corrompido) fizer a API
      // rejeitar por causa da estrutura da conversa, tenta de novo do zero, só com
      // a mensagem atual — melhor responder mesmo assim do que travar por completo.
      console.warn('Primeira tentativa falhou, tentando de novo sem histórico:', erroPrimeiraTentativa.message);
      respostaClaude = await chamarClaude(apiKey, systemPrompt, [{ role: 'user', content: mensagem }], FERRAMENTAS);
      mensagens.length = 0;
      mensagens.push({ role: 'user', content: mensagem });
    }

    // Separa o que veio: texto (pergunta/resumo) e chamadas de ferramenta
    const blocosTexto = respostaClaude.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    let chamadasFerramenta = respostaClaude.content.filter(b => b.type === 'tool_use');

    // Nunca deveria acontecer (o prompt já instrui a não fazer isso), mas por segurança:
    // se vier consultar_dados junto com ações de cadastro na mesma resposta, ignora a
    // consulta e trata só as ações de cadastro — evita confusão na tela de confirmação.
    if (chamadasFerramenta.length > 1 && chamadasFerramenta.some(c => c.name === 'consultar_dados')) {
      chamadasFerramenta = chamadasFerramenta.filter(c => c.name !== 'consultar_dados');
    }

    // Caso 1: nenhuma ferramenta chamada -> é só uma pergunta/esclarecimento
    if (chamadasFerramenta.length === 0) {
      return res.status(200).json({
        tipo: 'pergunta',
        texto: blocosTexto || 'Não entendi, pode reformular?',
        historico_atualizado: [...mensagens, { role: 'assistant', content: respostaClaude.content }]
      });
    }

    // Caso 2: chamou consultar_dados -> o SERVIDOR busca o dado real e devolve a resposta final
    const chamadaConsulta = chamadasFerramenta.find(c => c.name === 'consultar_dados');
    if (chamadaConsulta && chamadasFerramenta.length === 1) {
      const resultado = await executarConsulta(supabase, chamadaConsulta.input);

      const turnoComResultado = {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: chamadaConsulta.id,
          content: JSON.stringify(resultado)
        }]
      };

      const segundaResposta = await chamarClaude(
        apiKey,
        systemPrompt,
        [...mensagens, { role: 'assistant', content: respostaClaude.content }, turnoComResultado],
        FERRAMENTAS
      );

      const textoFinal = segundaResposta.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      return res.status(200).json({
        tipo: 'resposta',
        texto: textoFinal || 'Não consegui calcular isso.',
        historico_atualizado: [
          ...mensagens,
          { role: 'assistant', content: respostaClaude.content },
          turnoComResultado,
          { role: 'assistant', content: segundaResposta.content }
        ]
      });
    }

    // Caso 3: uma ou mais ações de cadastro -> devolve pra confirmação (NADA é salvo aqui)
    // Como a ferramenta foi "chamada" mas ainda não executada de verdade, a conversa
    // precisa de um tool_result sintético pra ficar estruturalmente válida pra próxima
    // mensagem (a API da Anthropic exige isso) — e esse texto também dá contexto real
    // pra IA entender, se você completar/corrigir essa mesma ação na mensagem seguinte.
    const propostas = chamadasFerramenta.map(c => ({ ferramenta: c.name, dados: c.input }));
    const turnoAguardando = {
      role: 'user',
      content: chamadasFerramenta.map(c => ({
        type: 'tool_result',
        tool_use_id: c.id,
        content: 'Aguardando confirmação do usuário. Ainda NÃO foi salvo no banco de dados.'
      }))
    };

    return res.status(200).json({
      tipo: 'proposta',
      resumo: blocosTexto || 'Confira os dados abaixo antes de confirmar:',
      propostas,
      historico_atualizado: [
        ...mensagens,
        { role: 'assistant', content: respostaClaude.content },
        turnoAguardando
      ]
    });

  } catch (err) {
    console.error('Erro no assistente:', err);
    return res.status(500).json({ erro: err.message || 'Erro desconhecido ao processar sua mensagem.' });
  }
}

// --------------------------------------------------------------------------
// Chama a API da Anthropic
// --------------------------------------------------------------------------
async function chamarClaude(apiKey, system, messages, tools) {
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), 25000);

  let resposta;
  try {
    resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 1500,
        system,
        messages,
        tools
      }),
      signal: controlador.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('A IA demorou demais pra responder. Tenta de novo.');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    throw new Error(`Erro na API da Anthropic (${resposta.status}): ${erroTexto}`);
  }

  return resposta.json();
}

// --------------------------------------------------------------------------
// Executa consultas de leitura reais no Supabase (nunca escreve nada)
// --------------------------------------------------------------------------
async function executarConsulta(supabase, { tabela }) {
  const tabelasPermitidas = ['custos', 'colheitas', 'atividades', 'funcionarios', 'talhoes', 'pluviometria'];
  if (!tabelasPermitidas.includes(tabela)) {
    return { erro: 'Tabela não permitida para consulta.' };
  }
  // Busca os últimos 500 registros da tabela pedida — a IA mesma soma/filtra a
  // partir daí na segunda chamada, usando a "descricao_da_busca" como guia.
  const { data, error } = await supabase.from(tabela).select('*').order('created_at', { ascending: false }).limit(500);
  if (error) return { erro: error.message };
  return { registros: data };
}
