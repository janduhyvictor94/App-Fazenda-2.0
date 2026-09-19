import React, { useEffect, useState } from 'react';
import Shell from './components/Shell.jsx';
import { PeriodoProvider } from './context/PeriodoContext.jsx';
import { LoadingScreen, ErrorScreen } from './components/StatusStates.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SafrasPage from './pages/SafrasPage.jsx';
import FinanceiroPage from './pages/FinanceiroPage.jsx';
import TalhoesPage from './pages/TalhoesPage.jsx';
import ColheitasPage from './pages/ColheitasPage.jsx';
import FuncionariosPage from './pages/FuncionariosPage.jsx';
import AtividadesPage from './pages/AtividadesPage.jsx';
import PluviometriaPage from './pages/PluviometriaPage.jsx';
import CalendarioPage from './pages/CalendarioPage.jsx';
import InsumosPage from './pages/InsumosPage.jsx';
import ConsultoriasPage from './pages/ConsultoriasPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import AssistenteIAPage from './pages/AssistenteIAPage.jsx';
import NotasFiscaisPage from './pages/NotasFiscaisPage.jsx';
import InteligenciaPage from './pages/InteligenciaPage.jsx';
import MapaSatelitePage from './pages/MapaSatelitePage.jsx';
import MetasPage from './pages/MetasPage.jsx';
import PlanejamentosPage from './pages/PlanejamentosPage.jsx';
import { fetchFazendaData } from './lib/data.js';

const PAGINAS = {
  dashboard: DashboardPage,
  safras: SafrasPage,
  planejamentos: PlanejamentosPage,
  metas: MetasPage,
  talhoes: TalhoesPage,
  colheitas: ColheitasPage,
  atividades: AtividadesPage,
  calendario: CalendarioPage,
  pluviometria: PluviometriaPage,
  financeiro: FinanceiroPage,
  funcionarios: FuncionariosPage,
  insumos: InsumosPage,
  consultorias: ConsultoriasPage,
  relatorios: RelatoriosPage,
  'notas-fiscais': NotasFiscaisPage,
  'mapa-satelite': MapaSatelitePage,
  inteligencia: InteligenciaPage,
  assistente: AssistenteIAPage
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [dados, setDados] = useState(null);
  const [error, setError] = useState(null);

  // Recarrega tudo do Supabase — usado pelas telas que gravam (Notas Fiscais,
  // Mapa por Satélite, e agora Metas/Planejamentos) depois de uma escrita,
  // pra tela refletir o banco sem precisar de um cache de query separado.
  const recarregar = () => fetchFazendaData().then(setDados).catch(setError);

  useEffect(() => {
    recarregar();
  }, []);

  if (error) return <ErrorScreen error={error} />;
  if (!dados) return <LoadingScreen />;

  const PaginaAtual = PAGINAS[page] || DashboardPage;

  return (
    <PeriodoProvider safras={dados.safras}>
      <Shell page={page} onNavigate={setPage}>
        <PaginaAtual dados={dados} recarregar={recarregar} />
      </Shell>
    </PeriodoProvider>
  );
}
