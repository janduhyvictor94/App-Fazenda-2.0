import { createClient } from '@supabase/supabase-js';

// Mesmo projeto Supabase do App Fazenda 2.0 em produção — mesma anon key
// já usada no cliente atual (src/lib/supabaseClient.js do projeto original).
// Este protótipo só faz leitura (select) — nenhuma tela aqui grava dados.
const supabaseUrl = 'https://zmxujmtoiwayrljrfmwo.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHVqbXRvaXdheXJsanJmbXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMTMyODcsImV4cCI6MjA4MDc4OTI4N30.v2B_BZ6fRxDWntwz6tUKdGD6vmZKxYv0QXTbStBc6M0';

export const supabase = createClient(supabaseUrl, supabaseKey);
