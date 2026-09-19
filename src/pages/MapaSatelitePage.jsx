import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Satellite,
  MapPin,
  Pencil,
  Check,
  X,
  Trash2,
  LocateFixed,
  Save,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Search
} from 'lucide-react';
import { salvarLocalizacaoTalhao, getAreaTalhao } from '../lib/data.js';

// Ponto de partida do mapa — Petrolina-PE/Juazeiro-BA, o polo de fruticultura
// irrigada (manga/goiaba) onde a Fazenda Cassiano's provavelmente fica. É só
// um ponto de partida: use o campo de busca ou "Minha localização" pra
// navegar até o lugar certo antes de desenhar os talhões.
const CENTRO_INICIAL = [-9.3891, -40.503];
const ZOOM_INICIAL = 13;

const CORES = ['#3EE089', '#33C9E8', '#F0A93B', '#F2607F', '#9B8CF2', '#4FD1C5'];
const corDoTalhao = (idx) => CORES[idx % CORES.length];

// Converte a lista de pontos clicados (em [lat, lng]) num GeoJSON Polygon
// padrão (coordenadas em [lng, lat], primeiro ponto repetido no fim).
function pontosParaGeoJSON(pontos) {
  const anel = pontos.map(([lat, lng]) => [lng, lat]);
  anel.push(anel[0]);
  return { type: 'Polygon', coordinates: [anel] };
}

function geoJSONParaLatLngs(geojson) {
  if (!geojson?.coordinates?.[0]) return [];
  return geojson.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng]);
}

export default function MapaSatelitePage({ dados }) {
  const { talhoes } = dados;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const camadaTalhoesRef = useRef(null); // L.LayerGroup com os polígonos já salvos
  const camadaDesenhoRef = useRef(null); // L.LayerGroup só do desenho em andamento
  const pontosDesenhoRef = useRef([]);

  const [pronto, setPronto] = useState(false);
  const [talhaoEditando, setTalhaoEditando] = useState(null); // id do talhão em modo desenho
  const [temPontos, setTemPontos] = useState(false);
  const [overrides, setOverrides] = useState({}); // { [talhaoId]: {poligono_geojson, centro_lat, centro_lng} }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [buscaResultados, setBuscaResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const talhoesComLocal = useMemo(
    () =>
      talhoes.map((t) => ({
        ...t,
        poligono_geojson: overrides[t.id]?.poligono_geojson ?? t.poligono_geojson,
        centro_lat: overrides[t.id]?.centro_lat ?? t.centro_lat,
        centro_lng: overrides[t.id]?.centro_lng ?? t.centro_lng
      })),
    [talhoes, overrides]
  );

  // Cria o mapa uma única vez.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(CENTRO_INICIAL, ZOOM_INICIAL);

    // Esri World Imagery — satélite gratuito, sem precisar de chave/API paga.
    // IMPORTANTE: `maxNativeZoom: 17` é o que evita o mapa "sumir" quando você
    // dá zoom perto demais — em área rural, o Esri não tem foto em resolução
    // além do zoom ~17 e devolve blocos vazios se a gente pedir mais que isso.
    // Com maxNativeZoom, o Leaflet passa a AMPLIAR a última foto disponível
    // (fica com grão, mas nunca fica em branco) em vez de pedir uma foto que
    // não existe.
    const satelite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 20,
        maxNativeZoom: 17
      }
    );

    // Rótulos (nomes de estradas/lugares) por cima da imagem de satélite.
    const rotulos = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, maxNativeZoom: 18, opacity: 0.9 }
    );

    // Mapa de ruas (OpenStreetMap) — cobertura completa em qualquer zoom, serve
    // de alternativa/plano B pra quando a foto de satélite ficar em branco na
    // sua região, e ajuda a se localizar por nomes de estrada/cidade.
    const ruas = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    const grupoSatelite = L.layerGroup([satelite, rotulos]).addTo(map);

    L.control
      .layers(
        { 'Satélite (Esri)': grupoSatelite, 'Mapa de ruas (OSM)': ruas },
        {},
        { position: 'topright', collapsed: true }
      )
      .addTo(map);

    camadaTalhoesRef.current = L.layerGroup().addTo(map);
    camadaDesenhoRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setPronto(true);

    // Rede de segurança: se o container tiver ganhado o tamanho certo só DEPOIS
    // do mapa já ter sido criado (comum em layouts com grid/flex), o Leaflet
    // guarda um tamanho errado internamente e o mapa passa a se comportar mal
    // ao dar zoom. `invalidateSize` força ele a reconferir o tamanho real.
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    const aoRedimensionar = () => map.invalidateSize();
    window.addEventListener('resize', aoRedimensionar);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', aoRedimensionar);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Aceita colar coordenadas direto (ex: "-9.3891, -40.5030", copiado do Google
  // Maps do celular com "o que há aqui?") — é o jeito mais confiável de chegar
  // exatamente na fazenda, já que nenhum serviço de busca por nome (grátis ou
  // pago) tem cadastrado o endereço exato de uma propriedade rural sem CEP.
  const COORD_REGEX = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

  async function buscarLocalizacao() {
    if (!buscaTexto.trim()) return;
    setErro(null);
    setBuscaResultados([]);

    const coordMatch = buscaTexto.match(COORD_REGEX);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        mapRef.current?.setView([lat, lng], 17);
        return;
      }
    }

    setBuscando(true);
    try {
      // Nominatim (OpenStreetMap) — geocodificação gratuita, sem chave. Uso
      // pontual e de baixo volume (um dono de fazenda buscando de vez em
      // quando); se um dia isso virar uso pesado, vale trocar por um provedor
      // com chave (Mapbox/LocationIQ têm planos gratuitos generosos).
      // `countrycodes=br` + `viewbox` ao redor de Petrolina-PE/Juazeiro-BA
      // (sem `bounded`, então é só uma preferência, não uma trava) ajudam a
      // achar nomes parciais de cidade/estrada/povoado perto da fazenda —
      // mas uma propriedade rural sem endereço formal (só "Fazenda X, zona
      // rural") muitas vezes não existe em NENHUM serviço de busca, gratuito
      // ou pago: o jeito confiável nesse caso é colar as coordenadas (veja
      // acima) ou navegar manualmente com arrastar/zoom.
      const viewbox = '-41.3,-8.8,-39.7,-9.9'; // left,top,right,bottom aproximado da região
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=br&viewbox=${viewbox}&q=${encodeURIComponent(buscaTexto)}`
      );
      if (!resp.ok) throw new Error('Serviço de busca indisponível no momento.');
      const resultados = await resp.json();
      if (resultados.length === 0) {
        setErro(
          'Nenhum lugar encontrado com esse nome. Isso é comum pra propriedades rurais sem endereço formal — tente o nome da cidade/povoado mais próximo, ou cole as coordenadas (ex: -9.3891, -40.5030, copiadas do Google Maps do celular) no mesmo campo.'
        );
      }
      setBuscaResultados(resultados);
    } catch (err) {
      setErro(err.message || 'Erro ao buscar esse endereço.');
    } finally {
      setBuscando(false);
    }
  }

  function irParaResultado(r) {
    mapRef.current?.setView([Number(r.lat), Number(r.lon)], 16);
    setBuscaResultados([]);
    setBuscaTexto(r.display_name);
  }

  // Redesenha os talhões já salvos sempre que os dados (ou os overrides) mudam.
  useEffect(() => {
    if (!pronto || !camadaTalhoesRef.current) return;
    const camada = camadaTalhoesRef.current;
    camada.clearLayers();

    const bounds = [];
    talhoesComLocal.forEach((t, idx) => {
      const cor = corDoTalhao(idx);
      if (t.poligono_geojson) {
        const latlngs = geoJSONParaLatLngs(t.poligono_geojson);
        if (latlngs.length >= 3) {
          const poly = L.polygon(latlngs, { color: cor, weight: 2, fillOpacity: 0.25 }).addTo(camada);
          poly.bindPopup(
            `<strong>${t.nome}</strong><br/>${(t.cultura || '')}${t.area_hectares ? ` · ${getAreaTalhao(t)} ha` : ''}`
          );
          latlngs.forEach((p) => bounds.push(p));
        }
      } else if (t.centro_lat && t.centro_lng) {
        const marker = L.circleMarker([t.centro_lat, t.centro_lng], {
          radius: 8,
          color: cor,
          fillColor: cor,
          fillOpacity: 0.9,
          weight: 2
        }).addTo(camada);
        marker.bindPopup(`<strong>${t.nome}</strong><br/>${t.cultura || ''} · sem contorno desenhado ainda`);
        bounds.push([t.centro_lat, t.centro_lng]);
      }
    });

    if (bounds.length > 0 && !talhaoEditando) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [pronto, talhoesComLocal, talhaoEditando]);

  // Handler de clique no mapa — só ativo durante o desenho.
  useEffect(() => {
    if (!pronto || !mapRef.current) return;
    const map = mapRef.current;

    function aoClicar(e) {
      if (!talhaoEditando) return;
      pontosDesenhoRef.current = [...pontosDesenhoRef.current, [e.latlng.lat, e.latlng.lng]];
      redesenharDraft();
      setTemPontos(pontosDesenhoRef.current.length >= 3);
    }

    map.on('click', aoClicar);
    return () => map.off('click', aoClicar);
  }, [pronto, talhaoEditando]);

  function redesenharDraft() {
    const camada = camadaDesenhoRef.current;
    if (!camada) return;
    camada.clearLayers();
    const pontos = pontosDesenhoRef.current;
    pontos.forEach((p) => L.circleMarker(p, { radius: 5, color: '#F0A93B', fillColor: '#F0A93B', fillOpacity: 1 }).addTo(camada));
    if (pontos.length >= 2) {
      L.polyline(pontos, { color: '#F0A93B', weight: 2, dashArray: '6 6' }).addTo(camada);
    }
    if (pontos.length >= 3) {
      L.polygon(pontos, { color: '#F0A93B', weight: 2, fillOpacity: 0.15, dashArray: '6 6' }).addTo(camada);
    }
  }

  function iniciarDesenho(talhaoId) {
    setErro(null);
    setTalhaoEditando(talhaoId);
    pontosDesenhoRef.current = [];
    setTemPontos(false);
    camadaDesenhoRef.current?.clearLayers();
  }

  function cancelarDesenho() {
    setTalhaoEditando(null);
    pontosDesenhoRef.current = [];
    setTemPontos(false);
    camadaDesenhoRef.current?.clearLayers();
  }

  function desfazerUltimoPonto() {
    pontosDesenhoRef.current = pontosDesenhoRef.current.slice(0, -1);
    redesenharDraft();
    setTemPontos(pontosDesenhoRef.current.length >= 3);
  }

  async function salvarContorno() {
    if (!talhaoEditando || pontosDesenhoRef.current.length < 3) return;
    setSalvando(true);
    setErro(null);
    try {
      const geojson = pontosParaGeoJSON(pontosDesenhoRef.current);
      const centro = pontosDesenhoRef.current.reduce(
        (acc, [lat, lng]) => [acc[0] + lat / pontosDesenhoRef.current.length, acc[1] + lng / pontosDesenhoRef.current.length],
        [0, 0]
      );
      await salvarLocalizacaoTalhao({
        talhaoId: talhaoEditando,
        poligonoGeojson: geojson,
        centroLat: centro[0],
        centroLng: centro[1]
      });
      setOverrides((o) => ({
        ...o,
        [talhaoEditando]: { poligono_geojson: geojson, centro_lat: centro[0], centro_lng: centro[1] }
      }));
      cancelarDesenho();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar o contorno.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagarContorno(talhaoId) {
    setSalvando(true);
    setErro(null);
    try {
      await salvarLocalizacaoTalhao({ talhaoId, poligonoGeojson: null, centroLat: null, centroLng: null });
      setOverrides((o) => ({ ...o, [talhaoId]: { poligono_geojson: null, centro_lat: null, centro_lng: null } }));
    } catch (err) {
      setErro(err.message || 'Erro ao apagar o contorno.');
    } finally {
      setSalvando(false);
    }
  }

  function irParaMinhaLocalizacao() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 16),
      () => setErro('Não consegui acessar sua localização — verifique a permissão do navegador.')
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-start gap-3">
        <Satellite className="w-4 h-4 text-tech shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          Imagem de satélite gratuita (Esri), sem precisar de chave paga, com o mapa de ruas (OpenStreetMap) como
          alternativa — troque entre os dois no ícone de camadas no canto superior direito do mapa. Digite um
          endereço/cidade na busca ao lado, use <span className="text-ink font-semibold">&quot;Minha localização&quot;</span>,
          ou arraste/dê zoom até encontrar a fazenda de verdade antes de desenhar o contorno de cada talhão. Em
          zoom bem próximo, a foto de satélite pode ficar com grão em áreas rurais (é o limite da resolução
          disponível ali) — ela não deve mais sumir; se acontecer, troque pra &quot;Mapa de ruas&quot;.
        </p>
      </div>

      <div className="rounded-xl2 bg-amber/10 border border-amber/25 p-4 flex items-start gap-3">
        <MapPin className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          <span className="text-ink font-semibold">Se a busca não encontrar sua fazenda</span>, é normal — nenhum
          serviço de mapa (grátis ou pago, incluindo Google) tem cadastrado o endereço exato de uma propriedade
          rural sem CEP. O jeito confiável é colar as coordenadas no mesmo campo de busca — no Google Maps do
          celular, mantenha o dedo no local exato da fazenda até aparecer um alfinete, toque nele e copie os dois
          números que aparecem (ex: <code className="text-amber">-9.3891, -40.5030</code>) — cole aqui e aperte
          Enter. Também dá pra só arrastar e dar zoom manualmente até achar visualmente.
        </p>
      </div>

      <div className="rounded-xl2 bg-rose/10 border border-rose/25 p-4 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-rose shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          Salvar um contorno grava no Supabase (tabela <code className="text-rose">talhoes</code>). Antes de usar
          pela primeira vez, rode a migração <code className="text-rose">sql/001_mapa_satelite.sql</code> uma vez no
          SQL Editor do Supabase — ela só adiciona colunas novas, não mexe em nada existente.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="rounded-xl2 bg-surface border border-line p-4 space-y-3 order-2 lg:order-1">
          <h3 className="font-display font-semibold text-sm text-ink">Talhões</h3>

          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarLocalizacao()}
                placeholder="Endereço, cidade, ou cole coordenadas (-9.38, -40.50)"
                className="flex-1 min-w-0 rounded-lg bg-base border border-line px-2.5 py-2 text-xs text-ink"
              />
              <button
                onClick={buscarLocalizacao}
                disabled={buscando}
                className="px-2.5 rounded-lg bg-line-soft text-ink hover:bg-line transition-colors disabled:opacity-40"
              >
                {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>
            {buscaResultados.length > 0 && (
              <div className="rounded-lg border border-line bg-surface-raised overflow-hidden">
                {buscaResultados.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => irParaResultado(r)}
                    className="w-full text-left px-2.5 py-2 text-[11px] text-ink-muted hover:bg-line-soft hover:text-ink border-b border-line-soft last:border-0"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={irParaMinhaLocalizacao}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-line-soft text-ink text-xs font-medium hover:bg-line transition-colors"
          >
            <LocateFixed className="w-3.5 h-3.5" /> Minha localização
          </button>

          <div className="space-y-2">
            {talhoesComLocal.map((t, idx) => {
              const emEdicao = talhaoEditando === t.id;
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-3 space-y-2 ${emEdicao ? 'border-amber/50 bg-amber/5' : 'border-line'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corDoTalhao(idx) }} />
                    <span className="text-sm font-medium text-ink truncate">{t.nome}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint">
                    {t.poligono_geojson ? 'Contorno desenhado' : t.centro_lat ? 'Só ponto central' : 'Sem localização ainda'}
                  </div>
                  {!emEdicao ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => iniciarDesenho(t.id)}
                        disabled={!!talhaoEditando}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand/15 text-brand text-xs font-semibold hover:bg-brand/25 transition-colors disabled:opacity-40"
                      >
                        <Pencil className="w-3 h-3" /> {t.poligono_geojson ? 'Redesenhar' : 'Desenhar'}
                      </button>
                      {t.poligono_geojson && (
                        <button
                          onClick={() => apagarContorno(t.id)}
                          disabled={salvando}
                          className="px-2.5 py-1.5 rounded-lg bg-rose/10 text-rose hover:bg-rose/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-amber">Clique no mapa pra marcar cada canto do talhão (mín. 3 pontos).</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={desfazerUltimoPonto}
                          disabled={pontosDesenhoRef.current.length === 0}
                          className="px-2 py-1.5 rounded-lg bg-line-soft text-ink text-[11px] font-medium disabled:opacity-30"
                        >
                          Desfazer ponto
                        </button>
                        <button
                          onClick={cancelarDesenho}
                          className="px-2 py-1.5 rounded-lg bg-line-soft text-ink text-[11px] font-medium flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                      <button
                        onClick={salvarContorno}
                        disabled={!temPontos || salvando}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand text-base text-xs font-semibold disabled:opacity-40 hover:bg-brand/90 transition-colors"
                      >
                        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Salvar contorno
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {talhoesComLocal.length === 0 && <p className="text-xs text-ink-faint italic">Nenhum talhão cadastrado ainda.</p>}
          </div>

          {erro && (
            <div className="flex items-start gap-2 text-xs text-rose pt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2 rounded-xl2 overflow-hidden border border-line" style={{ height: 520 }}>
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
