-- ---------------------------------------------------------------------------
-- Migração pro Mapa por Satélite.
--
-- Rode isto UMA VEZ no seu projeto Supabase (Dashboard → SQL Editor → New
-- query → cola isto → Run). É seguro: só ADICIONA colunas novas na tabela
-- `talhoes` que já existe — não apaga, não altera e não recalcula nada do
-- que já está lá. Se alguma coluna já existir, o "IF NOT EXISTS" evita erro.
--
-- O que cada coluna guarda:
--   poligono_geojson  → o contorno do talhão desenhado no mapa (uma lista de
--                       pontos lat/lng), no formato GeoJSON padrão.
--   centro_lat/lng    → um ponto central do talhão, pra colocar o marcador
--                       no mapa antes mesmo de desenhar o contorno completo.
-- ---------------------------------------------------------------------------

ALTER TABLE talhoes ADD COLUMN IF NOT EXISTS poligono_geojson jsonb;
ALTER TABLE talhoes ADD COLUMN IF NOT EXISTS centro_lat double precision;
ALTER TABLE talhoes ADD COLUMN IF NOT EXISTS centro_lng double precision;
