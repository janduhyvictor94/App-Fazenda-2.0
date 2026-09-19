# Como publicar o protótipo no GitHub e na Vercel

Isto é o passo a passo pra você rodar **no seu computador** (eu não tenho como
publicar isso por você daqui — não tenho acesso ao seu GitHub nem à sua
Vercel). É só copiar e colar os comandos, na ordem, dentro de um terminal
aberto na pasta `PROTOTIPO-NOVO-VISUAL`.

**Isto cria um projeto NOVO e SEPARADO — o app de produção (App Fazenda 2.0)
não é tocado em nenhum momento.** Você vai terminar com um link novo
(tipo `https://fazenda-prototipo.vercel.app`) só para o protótipo, pra você
testar à vontade sem nenhum risco pro que já está no ar.

## Pré-requisitos (só na primeira vez)

- **Git** instalado — [git-scm.com/downloads](https://git-scm.com/downloads)
  (se digitar `git --version` no terminal e aparecer um número, já tem).
- Uma conta no **[github.com](https://github.com)** (grátis).
- Uma conta na **[vercel.com](https://vercel.com)** (grátis — dá pra entrar
  direto com a conta do GitHub, sem criar senha nova).

## Passo 1 — Preparar a pasta e enviar pro GitHub

Abra um terminal (PowerShell ou Prompt de Comando) **dentro da pasta**
`PROTOTIPO-NOVO-VISUAL` (clique com o botão direito na pasta → "Abrir no
Terminal", ou `cd` até lá) e rode, um de cada vez:

```
git init
git add .
git commit -m "Protótipo novo visual + Fase 2 (Notas Fiscais, Mapa, Inteligência, Metas, Planejamentos)"
```

Agora crie o repositório vazio no GitHub:

1. Vá em [github.com/new](https://github.com/new).
2. Nome sugerido: `fazenda-prototipo-2027` (pode ser outro nome, sem espaço).
3. Deixe **Private** marcado (só você vê o código).
4. **Não** marque nenhuma das caixinhas de "Add README/.gitignore/license" —
   a pasta já tem tudo isso.
5. Clique em "Create repository".

O GitHub vai te mostrar alguns comandos — use estes três (troque
`SEU-USUARIO` pelo seu nome de usuário do GitHub, que aparece na tela):

```
git remote add origin https://github.com/SEU-USUARIO/fazenda-prototipo-2027.git
git branch -M main
git push -u origin main
```

Vai pedir pra você logar no GitHub pelo navegador na primeira vez — normal,
só autorizar.

## Passo 2 — Publicar na Vercel (importando do GitHub)

Esse caminho é melhor que `vercel --prod` pela linha de comando porque, a
cada vez que você mandar uma atualização pro GitHub (`git push`), a Vercel
republica sozinha — sem você digitar mais nada.

1. Entre em [vercel.com/new](https://vercel.com/new) (logue com a conta do
   GitHub).
2. Clique em **"Import"** ao lado do repositório `fazenda-prototipo-2027`
   que você acabou de criar.
3. A Vercel já reconhece sozinha que é um projeto Vite — não precisa mudar
   nada em "Build Command" nem "Output Directory".
4. **Antes de clicar em Deploy**, abra "Environment Variables" e adicione:
   - `ANTHROPIC_API_KEY` → a mesma chave já usada em produção (está nas
     configurações do projeto atual na Vercel, em Settings → Environment
     Variables — copie o valor de lá). Necessária pro botão "Extrair com IA"
     das Notas Fiscais funcionar.
5. Clique em **Deploy** e espere ~1 minuto.

Pronto — você recebe um link tipo `https://fazenda-prototipo-2027.vercel.app`.
Esse é o endereço pra testar o protótipo completo, com as rotas `/api`
funcionando de verdade (a única coisa que o `npm run dev` normal não fazia).

## Passo 3 — Testar tudo no link publicado

Além de navegar pelas telas, vale conferir especificamente o que só funciona
publicado (não no `npm run dev` comum):

- **Notas Fiscais** → botão "Extrair com IA" (lê a foto de verdade).
- **Metas** e **Planejamentos** → já funcionam igual localmente, mas bom
  confirmar que salvam normalmente no mesmo Supabase.

Se algo der erro relacionado a `ANTHROPIC_API_KEY`, confira se ela foi salva
em Settings → Environment Variables → e clique em "Redeploy" (as variáveis
só valem a partir do próximo deploy depois de serem salvas).

## Atualizando depois de qualquer mudança

Sempre que eu (ou você) alterar algo na pasta `PROTOTIPO-NOVO-VISUAL`, é só:

```
git add .
git commit -m "Descreva o que mudou aqui"
git push
```

A Vercel republica sozinha em menos de um minuto.

## Sobre o WhatsApp (se for configurar agora)

A URL pública que o painel da Meta pede
(`https://SEU-LINK.vercel.app/api/whatsapp-webhook`) só existe depois deste
passo a passo. O restante da configuração (criar app na Meta, variáveis
`WHATSAPP_TOKEN` etc.) está na seção própria do `LEIA-ME-PROTOTIPO.md`.

## E quando estiver tudo aprovado — substituir o app de produção?

Depois de testar tudo publicado (não só localmente) e você estiver
satisfeito, aí sim faz sentido conversar sobre substituir o app atual por
este. Prefiro chegar nessa conversa só depois de você ter testado no link de
verdade — é a única forma de garantir que nada quebrou antes de mexer no que
está em produção hoje. Quando quiser seguir com isso, me chama que preparo o
passo a passo dessa troca também (ela pode ser feita sem downtime, com os
dois no ar ao mesmo tempo até você confirmar).
