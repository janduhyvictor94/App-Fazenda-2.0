# Protótipo — Novo Visual + Fase 2 (2027)

Isto é um projeto separado, dentro da mesma pasta do App Fazenda 2.0, só para
você testar o novo visual e as funcionalidades novas **sem tocar em nada que
já está em produção**. Nenhum arquivo do app atual foi alterado.

## O que já funciona aqui

- Conecta direto no **mesmo Supabase real** da Fazenda Cassiano's (a mesma
  conexão que o app atual usa) — os números que você vê são os dados de
  verdade. A maioria das telas é **somente leitura**; as que gravam algo
  estão claramente marcadas (ver mais abaixo).
- **Filtro global de período** (Ano / Safra) no topo — troca o que aparece em
  todas as telas de uma vez. O padrão é o ano corrente, então a visão de cara
  é sempre limpa.
- **Nada de histórico é apagado ou escondido para sempre** — anos, safras e
  meses anteriores ficam recolhidos num "acordeão" (clique pra abrir), com os
  valores exatamente como foram lançados.
- **Rateio de custos gerais preservado**: a mesma fórmula do Dashboard atual
  (custo geral ÷ área total da fazenda × área do talhão), usada também na
  Inteligência Gerencial. Não mudei o cálculo — só deixei visível quando um
  valor é rateio (selo "rateio").
- **As 15 telas do app atual**, todas neste visual novo: Visão Geral, Safras,
  Planejamentos, Metas, Talhões, Colheitas, Atividades, Calendário,
  Pluviometria, Financeiro, Funcionários, Insumos, Consultorias, Relatórios e
  Assistente IA. (Metas e Planejamentos são as duas únicas que faltavam desde
  a primeira versão do protótipo — foram portadas agora, ver seção própria
  mais abaixo.)
- **Funcionários** já aplica a limpeza que você pediu: mostra só quem está
  ativo, com o histórico de desligados recolhido.
- **Assistente IA**: agora é uma conversa de verdade, igual à de produção —
  não é mais um exemplo visual (ver seção própria mais abaixo com o que foi
  portado).

### As 3 telas novas da Fase 2

| Tela | O que faz | Grava no banco? |
|---|---|---|
| **Notas Fiscais** | Foto da nota → IA extrai os itens → você confere → confirma | Sim — a única escrita além do Mapa |
| **Mapa por Satélite** | Desenha o contorno de cada talhão sobre imagem de satélite gratuita | Sim — ao salvar um contorno |
| **Inteligência Gerencial** | Custo/ha, produtividade e margem por talhão, com alertas automáticos | Não — só leitura/cálculo |
| **Metas** | Meta de custo/produção por hectare, por talhão e ciclo | Sim — criar/editar/excluir meta |
| **Planejamentos** | Molde de cronograma de aplicações, aplicável numa safra real | Sim — planejamento e as atividades geradas |

E a **Integração WhatsApp** está com o código pronto (`api/whatsapp-webhook.js`),
mas ela depende de uma conta Meta Business que só você pode criar — não é
"testável" aqui do jeito que as outras são. Veja a seção própria mais abaixo.

- Layout responsivo: sidebar com seções e rolagem no desktop; no mobile, as
  4 telas mais usadas ficam fixas embaixo e as outras atrás do botão "Mais".

## Como testar na sua máquina

Dentro desta pasta (`PROTOTIPO-NOVO-VISUAL`), no terminal:

```
npm install
npm run dev
```

Vai abrir em `http://localhost:5183`. Como conecta no Supabase real pelo seu
navegador, os números que aparecem são os dados atuais da fazenda. Se já
rodou `npm install` antes, não precisa rodar de novo — só `npm run dev`.

**Antes de usar Notas Fiscais ou Mapa por Satélite pela primeira vez**, rode
as duas migrações uma vez no Supabase (Dashboard → SQL Editor → New query →
cola o conteúdo do arquivo → Run):

```
sql/001_mapa_satelite.sql   (necessária pro Mapa por Satélite)
sql/002_whatsapp.sql        (necessária só se for configurar o WhatsApp)
```

Ambas só ADICIONAM colunas/tabelas novas — não mexem em nada que já existe.
Notas Fiscais não precisa de migração (usa a tabela `custos` que já existe).

## Notas Fiscais — como testar

Essa tela tem duas partes que testam separado:

1. **A tabela e o botão "Confirmar e salvar"** (o que grava no banco) —
   funciona com `npm run dev` normal. Pra testar sem depender da IA, use o
   botão **"+ Adicionar item manualmente"** e preencha os campos à mão.
2. **O botão "Extrair com IA"** (a leitura da foto) — chama uma função no
   servidor (`api/extrair-nota.js`, mesmo padrão do `api/assistente.js` que
   já existe em produção: a chave da IA nunca sai do servidor). Rotas `/api`
   só existem com `vercel dev` ou já publicado na Vercel — o `npm run dev`
   comum não serve essa parte (o botão mostra um erro explicando isso nesse
   modo).

Pra testar a extração de verdade: `npm install -g vercel` (se não tiver) e
depois `vercel dev` dentro desta pasta. Na primeira vez ele pede pra linkar
um projeto Vercel e configurar `ANTHROPIC_API_KEY` (a mesma já usada em
produção). Abre numa porta diferente (geralmente 3000).

**Nenhum item é salvo automaticamente pela IA.** Ela só propõe — você
confere, edita, escolhe categoria/talhão de cada item, e só clica em
"Confirmar e salvar" se estiver tudo certo.

## Mapa por Satélite — como testar

1. Rode a migração `sql/001_mapa_satelite.sql` no Supabase (uma vez).
2. Abra a tela — o mapa carrega com imagem de satélite gratuita (Esri, sem
   chave/API paga) num ponto de partida em Petrolina-PE/Juazeiro-BA (a
   região onde a fazenda provavelmente fica, pelo tipo de cultura). Pra
   chegar no lugar certo, três opções: digite um endereço/cidade na busca e
   aperte Enter (usa o serviço gratuito do OpenStreetMap), clique em
   **"Minha localização"**, ou arraste e dê zoom manualmente.
3. O ícone de camadas no canto superior direito do mapa troca entre
   **"Satélite (Esri)"** e **"Mapa de ruas (OSM)"** — o mapa de ruas tem
   cobertura completa em qualquer zoom e serve de alternativa caso a foto de
   satélite fique com grão numa área muito rural.
4. Clique em **"Desenhar"** ao lado de um talhão, depois clique no mapa pra
   marcar cada canto do terreno (mínimo 3 pontos). **"Desfazer ponto"** tira
   o último clique; **"Salvar contorno"** grava no Supabase.
5. O contorno salvo aparece colorido no mapa, com popup mostrando nome/área
   ao clicar. **"Redesenhar"** substitui um contorno já salvo; a lixeira
   apaga o contorno daquele talhão (fica só com a área/lista, sem mapa).

Isto roda inteiro com `npm run dev` normal — não depende de IA nem de
`vercel dev`, só do Supabase (por isso a migração precisa estar feita antes).

**Sobre o mapa "sumir" ao dar zoom perto demais**: em área rural, a foto de
satélite gratuita não tem resolução além de um certo nível de zoom — antes,
isso fazia o Leaflet pedir uma foto que não existe e ficar em branco.
Corrigido: agora ele amplia a última foto disponível (fica com grão, mas não
some mais) e, se ainda assim ficar ruim na sua região, é só trocar pra
"Mapa de ruas" no ícone de camadas.

## Inteligência Gerencial — como testar

Abre direto, sem configuração nenhuma — é só leitura/cálculo em cima dos
dados que já existem (custo por hectare, kg colhido por hectare, margem por
talhão, e alertas automáticos como "custo acima da média" ou "pagamento
pendente há mais de 45 dias"). Tem um seletor de ano próprio no topo da
tela, porque ela compara talhões entre si (não faz sentido por safra, já que
cada talhão pode ter uma safra em época diferente).

Os alertas são regras simples (comparação com a média da fazenda, prazos) —
não é machine learning nem previsão, é cruzamento de números que você já tem.
Os limiares (ex: 30% acima da média, 45 dias) estão comentados em
`src/lib/data.js` (`gerarAlertasGerenciais`) e são fáceis de ajustar.

## Metas e Planejamentos — como testar

Essas duas são as únicas telas que faltavam desde a primeira versão do
protótipo (as outras 16 já estavam prontas) — porto fiel do que já existe em
produção hoje, sem mudar nenhuma regra. Rodam com `npm run dev` normal, sem
migração nenhuma (usam tabelas que já existem no Supabase: `metas_talhoes`,
`planejamentos`, `culturas`).

**Metas** — defina, por talhão, uma meta de custo (R$/ha) e de produção
(ton/ha) para um ciclo entre duas datas. A tela soma sozinha tudo que foi
lançado em Financeiro/Atividades e Colheitas daquele talhão dentro do
período, divide pela área, e compara com a meta (fica vermelho se o custo
estourou, âmbar se a produção ficou abaixo). Editar e excluir funcionam
igual à tela de produção.

**Planejamentos** — monte um cronograma-modelo (por dia, semana, mês, ou
"livre/etapas") com as aplicações foliares, adubações e serviços
terceirizados de cada etapa. A tela calcula sozinha a lista de compras
(insumos arredondados pra embalagem fechada) e o custo total estimado.
Quando estiver pronto, **"Aplicar na Safra"** gera as atividades de verdade
numa safra ativa — com as datas já calculadas a partir de uma data-base (ou
sem nenhuma data, no modo "livre", onde cada etapa só ganha data quando for
marcada como concluída em Atividades). PDF e Excel exportam o mesmo
cronograma e resumo de compras que você vê na tela.

**Atenção**: "Aplicar na Safra" grava atividades de verdade na tabela
`atividades` — mesma tabela que a tela Atividades usa. Teste numa safra que
não seja crítica antes de aplicar num plano real, exatamente como você já
faria em produção.

## WhatsApp — o que já está pronto e o que falta você configurar

O código do webhook (`api/whatsapp-webhook.js`) está completo e segue a
mesma lógica já testada do Assistente em produção (mesmos campos, mesmas
tabelas, mesmo cuidado de nunca gravar sem confirmação). Além de texto, ele
também aceita **foto de nota fiscal**: manda a foto pelo WhatsApp que a IA
lê os itens (mesma leitura da tela Notas Fiscais), casa cada item com o
cadastro de insumos e, pra cada um:

- Se o insumo já existe e o preço da nota é diferente do preço registrado,
  propõe **atualizar o preço** (a conta de custo por litro/kg — ex: 500ml de
  um produto de R$100/L = R$50 — continua exatamente a mesma, só o preço
  cadastrado muda).
- Se é um insumo novo, pergunta a unidade (kg, litro, saco ou unidade) antes
  de cadastrar — ela não adivinha.
- Se o nome bate com mais de um insumo cadastrado (ambíguo) ou não dá pra
  ler o valor, ela avisa e não mexe no cadastro, só registra o gasto (ou nem
  isso, se não tiver valor legível) — pra não abrir brecha de cadastrar
  errado.

A lógica de decisão (`processarItemNota` em `api/whatsapp-webhook.js`) tem
testes automatizados cobrindo o exemplo que você deu (produto de R$100/litro,
comprar 500ml = R$50) e os casos de nome ambíguo/unidade não reconhecida —
rodei antes de liberar. Como sempre, nada é gravado até você apertar
Confirmar. **Não deu pra testar isso de ponta a ponta com o WhatsApp de
verdade neste ambiente** — diferente das outras telas, a integração exige
uma conta Meta Business de verdade e uma URL pública na internet, que só
você pode criar. O risco está concentrado na parte "conversar com a Meta"
(baixar a foto, mandar os botões), não na parte de gravar no banco
(reaproveitada do que já funciona e foi testada isoladamente).

Passo a passo pra colocar no ar:

1. **Publique este protótipo na Vercel** (`vercel --prod` ou conectando o
   repositório) — o webhook precisa de uma URL pública, tipo
   `https://seu-projeto.vercel.app/api/whatsapp-webhook`.
2. Rode `sql/002_whatsapp.sql` no Supabase (uma vez).
3. Crie um app em [developers.facebook.com](https://developers.facebook.com)
   → produto **WhatsApp** → pegue um número de teste (grátis) ou seu número
   comercial verificado.
4. Em **Configuração do WhatsApp → Webhook**, cole a URL do passo 1 e um
   "Verify token" (uma senha qualquer, escolhida por você).
5. Configure as variáveis de ambiente na Vercel:
   - `WHATSAPP_TOKEN` (token de acesso, gerado no painel da Meta)
   - `WHATSAPP_PHONE_NUMBER_ID` (aparece no mesmo painel)
   - `WHATSAPP_VERIFY_TOKEN` (a mesma senha do passo 4)
   - `ANTHROPIC_API_KEY` (a mesma já usada pelo Assistente)
6. Mande uma mensagem de teste pro número configurado: "colhi 300kg de manga
   no talhão 1 hoje" — a IA deve responder com um resumo e botões de
   Confirmar/Cancelar. Depois, teste mandando a foto de uma nota fiscal
   qualquer pra ver o mesmo fluxo com insumos.

Sem essas variáveis configuradas, o webhook simplesmente não recebe nada (a
Meta não consegue validar a URL) — não há risco de alguém mandar mensagem e
cair silenciosamente em erro.

Onde ficou explicado **dentro do app**: a tela **Assistente IA** agora tem um
passo a passo de como usar (texto e foto) logo no topo, e a tela **Notas
Fiscais** tem um aviso apontando pra esse mesmo caminho — antes disso não
existia nenhuma explicação visível, só este arquivo.

## O que NÃO está aqui ainda

Com Notas Fiscais, Mapa por Satélite, Inteligência Gerencial, Metas,
Planejamentos e o webhook do WhatsApp prontos (este último pendente da sua
configuração na Meta), o protótipo tem **paridade completa** com as telas de
produção, mais as 4 funcionalidades novas da Fase 2. O que ainda faz sentido
evoluir depois de testar:

- Refinar os limiares/regras da Inteligência Gerencial com base no que você
  achar útil ou ruidoso na prática.
- A Integração WhatsApp ainda não trata mensagem de áudio (só texto, foto e
  os botões de confirmar/cancelar).
- Depois de aprovado tudo, a substituição do app em produção por este (ver
  `COMO-SUBSTITUIR-PRODUCAO.md`).

## Assistente IA — agora portado de verdade

A tela **Assistente IA** deixou de ser um exemplo visual: agora é uma cópia
fiel do assistente de produção (`src/pages/Assistente.jsx` +
`api/assistente.js`), com as 11 ações (colheita, atividade, pagamento, chuva,
consultoria, criar talhão/funcionário/insumo/safra, marcar folha paga e
exclusão de dados) e as mesmas travas de segurança:

- **Bloqueio de duplicata**: só bloqueia quando o lançamento é IDÊNTICO
  (mesmo talhão, mesma data, mesmo valor) — dois lançamentos legítimos no
  mesmo dia com valores diferentes não são bloqueados.
- **Exclusão em massa**: excluir mais de 3 registros de uma vez exige digitar
  "EXCLUIR" antes de confirmar. Toda exclusão mostra antes os registros reais
  que serão apagados (nunca "no escuro").
- **Folha de pagamento**: usa o mesmo cálculo de produção (`src/lib/folha.js`,
  cópia de `calcularFolha` — salário, 13º proporcional e férias), nunca
  pergunta o valor do salário, sempre usa o cadastrado.

`api/assistente.js` é idêntico, byte a byte, ao de produção (mesma URL/chave
do Supabase, mesmo modelo de IA) — só a tela (`AssistenteIAPage.jsx`) foi
redesenhada pro visual escuro deste protótipo e trocou `@tanstack/react-query`
por `dados`/`recarregar` (o mesmo padrão já usado em Notas Fiscais, Metas e
Planejamentos). Testei o fluxo completo (mensagem → proposta → confirmar →
grava) e o cálculo de folha com um script automatizado antes de liberar.

## Onde estão as regras que eu segui

- `src/lib/data.js` — busca os dados, replica a fórmula de rateio, os
  filtros de período, os cálculos de Inteligência Gerencial
  (`indicadoresPorTalhao`, `gerarAlertasGerenciais`) e as escritas do
  protótipo: `salvarLancamentosDeNota`, `salvarLocalizacaoTalhao`,
  `salvarMeta`/`excluirMeta`, `salvarPlanejamento`/`duplicarPlanejamento`/
  `excluirPlanejamento`, e `aplicarPlanejamentoNaSafra` — comentadas como tal.
- `src/lib/folha.js` — cópia de `calcularFolha` (produção), usada pelo
  Assistente em `marcar_folha_paga`.
- `src/context/PeriodoContext.jsx` — o filtro global de Ano/Safra.
- `src/components/Shell.jsx` — menu, seções e navegação.
- `src/components/Modal.jsx` — o pop-up usado por Metas e Planejamentos.
- `src/pages/` — as 18 telas, uma por arquivo. `AssistenteIAPage.jsx` é o
  Assistente real, portado de produção.
- `api/assistente.js` — idêntico ao de produção; o cérebro por trás da tela
  Assistente IA.
- `api/extrair-nota.js` — lê a foto da nota fiscal com IA (só propõe). A
  função `extrairItensDaNota` de dentro dele é reaproveitada pelo webhook do
  WhatsApp — uma leitura só, dois lugares que usam.
- `api/whatsapp-webhook.js` — recebe/responde mensagens do WhatsApp (texto,
  foto de nota e botões). `processarItemNota` é a função que decide, pra
  cada item da nota, se atualiza preço, cadastra insumo novo, ou só registra
  o gasto — é a peça mais sensível a erro, por isso tem testes próprios.
- `sql/` — as duas migrações (rode uma vez cada, antes de usar a tela
  correspondente).
