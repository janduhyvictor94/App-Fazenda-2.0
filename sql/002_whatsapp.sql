-- ---------------------------------------------------------------------------
-- Migração pra Integração WhatsApp.
--
-- Rode isto UMA VEZ no seu projeto Supabase (Dashboard → SQL Editor → New
-- query → cola isto → Run). Só CRIA uma tabela nova — não mexe em nada que
-- já existe.
--
-- Pra que serve: o webhook do WhatsApp roda numa função sem memória (cada
-- mensagem é uma execução nova). Quando você manda "colhi 200kg de manga no
-- talhão 1", a IA monta a proposta e ela fica guardada aqui, junto com o seu
-- número, até você apertar "Confirmar" ou "Cancelar" no WhatsApp. Depois de
-- confirmada (ou cancelada), a linha é apagada — não é um histórico
-- permanente, é só a "memória" de curtíssimo prazo entre uma mensagem e a
-- resposta ao botão.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS whatsapp_pendentes (
  telefone text PRIMARY KEY,
  ferramenta text NOT NULL,
  dados jsonb NOT NULL,
  resumo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
