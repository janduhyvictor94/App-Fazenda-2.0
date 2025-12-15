import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CloudRain, Sun, Cloud, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// COORDENADAS (Padrão: Petrolina-PE). 
// Altere aqui para a localização exata da sua fazenda para maior precisão.
const LAT = -9.38; 
const LON = -40.50; 

const getWeatherIcon = (code) => {
  // Códigos WMO da Open-Meteo
  if (code <= 1) return <Sun className="w-8 h-8 text-amber-500" />;
  if (code <= 3) return <Cloud className="w-8 h-8 text-stone-500" />;
  if (code <= 67) return <CloudRain className="w-8 h-8 text-blue-500" />;
  return <CloudRain className="w-8 h-8 text-blue-600" />;
};

export default function WeatherWidget() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=America%2FSao_Paulo&forecast_days=3`
        );
        const data = await response.json();
        
        if (data.daily) {
          const formattedData = data.daily.time.map((time, index) => ({
            date: time,
            max: data.daily.temperature_2m_max[index],
            min: data.daily.temperature_2m_min[index],
            rainProb: data.daily.precipitation_probability_max[index],
            code: data.daily.weathercode[index]
          }));
          setForecast(formattedData);
        }
      } catch (error) {
        console.error("Erro ao buscar clima:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, []);

  if (loading) return <div className="h-40 bg-stone-50 rounded-xl animate-pulse" />;

  return (
    <Card className="border-stone-100 bg-gradient-to-br from-blue-50/50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-stone-800">
          <CloudRain className="w-5 h-5 text-blue-600" />
          Previsão do Tempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {forecast.map((day, idx) => (
            <div key={day.date} className="flex flex-col items-center p-2 bg-white rounded-lg border border-stone-100 shadow-sm text-center">
              <span className="text-xs font-semibold text-stone-500 mb-1 capitalize">
                {idx === 0 ? 'Hoje' : format(new Date(day.date + 'T12:00:00'), 'EEE', { locale: ptBR })}
              </span>
              <div className="mb-1">{getWeatherIcon(day.code)}</div>
              <div className="text-sm font-bold text-stone-700">
                {Math.round(day.max)}° <span className="text-stone-400 text-xs">{Math.round(day.min)}°</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <DropletsIcon size={10} className="text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">{day.rainProb}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Ícone auxiliar pequeno
function DropletsIcon({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.8-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
  );
}